#!/usr/bin/env bun
import { readFile, writeFile } from "node:fs/promises";
import { extname, join, relative, resolve, sep } from "node:path";
import { parseArgs } from "node:util";
import { installLatestRelease } from "../scripts/release.ts";
import { exportDocx } from "./docx.ts";
import { DESIGN_VERSION, type PaperSize } from "./design.ts";
import { evaluatePrepared, prepareEvaluation, type EvaluationTransportOptions } from "./evaluate.ts";
import { loadSnapshot, pathsAlias, writeStagedOutput } from "./io.ts";
import { exportPdf } from "./pdf.ts";
import { resolveResume } from "./resume.ts";
import { applicationSchema, generateJsonSchema, schemaKindSchema, type Report, type ValidationIssue, type ValidationOutput } from "./schema.ts";
import { validateApplication } from "./validate.ts";

const USAGE = [
  "Usage:",
  "  bun run src/cli.ts --help [--json]",
  "  bun run src/cli.ts --version [--json]",
  "  bun run src/cli.ts schema --kind application|report [--json]",
  "  bun run src/cli.ts validate --input <path> [--json]",
  "  bun run src/cli.ts evaluate --input <path> --dry-run [--json]",
  "  bun run src/cli.ts evaluate --input <path> --allow-remote [--out report.json] [--force] [--json]",
  "  bun run src/cli.ts render --input <path> --format pdf|docx --out <path> [--paper a4|letter] [--force] [--json]",
  "  bun run src/cli.ts update [--json]",
].join("\n");

const OPTIONS = {
  help: { type: "boolean" },
  version: { type: "boolean" },
  json: { type: "boolean" },
  force: { type: "boolean" },
  "dry-run": { type: "boolean" },
  "allow-remote": { type: "boolean" },
  kind: { type: "string" },
  input: { type: "string" },
  out: { type: "string" },
  format: { type: "string" },
  paper: { type: "string" },
} as const;

type ParsedArguments = {
  readonly values: {
    readonly help: boolean;
    readonly version: boolean;
    readonly json: boolean;
    readonly force: boolean;
    readonly dryRun: boolean;
    readonly allowRemote: boolean;
    readonly kind: string | undefined;
    readonly input: string | undefined;
    readonly out: string | undefined;
    readonly format: string | undefined;
    readonly paper: string | undefined;
  };
  readonly positionals: readonly string[];
  readonly tokens: readonly { readonly kind: string; readonly name?: string }[];
};

export type CliRuntimeOptions = {
  readonly evaluation?: EvaluationTransportOptions;
  readonly stdout?: (text: string) => void;
};

export async function runCli(args: readonly string[], runtime: CliRuntimeOptions = {}): Promise<number> {
  let parsed: ParsedArguments;
  try {
    parsed = parseArguments(args);
  } catch {
    return usageError(args.includes("--json"));
  }

  const { values, positionals, tokens } = parsed;
  if (hasDuplicateOptions(tokens)) return usageError(values.json);

  if (values.help || values.version) {
    if (positionals.length > 0 || hasCommandOptions(values) || (values.help && values.version)) {
      return usageError(values.json);
    }
    if (values.help) {
      if (values.json) writeOutput({ status: "help", usage: USAGE }, true);
      else process.stdout.write(`${USAGE}\n`);
      return 0;
    }
    const version = await getPackageVersion();
    if (version === undefined) return ioError(values.json, "Package version could not be read.");
    if (values.json) writeOutput({ version }, true);
    else process.stdout.write(`${version}\n`);
    return 0;
  }

  if (positionals.length !== 1) return usageError(values.json);
  const command = positionals[0];
  if (command === "schema") return runSchema(values);
  if (command === "validate") return runValidation(values);
  if (command === "evaluate") return runEvaluation(values, runtime.evaluation ?? {}, runtime.stdout ?? ((text) => process.stdout.write(text)));
  if (command === "render") return runRender(values);
  if (command === "update") return hasCommandOptions(values) ? usageError(values.json) : runUpdate(values.json);
  return usageError(values.json);
}

function hasCommandOptions(values: ParsedArguments["values"]): boolean {
  return values.kind !== undefined
    || values.input !== undefined
    || values.out !== undefined
    || values.format !== undefined
    || values.paper !== undefined
    || values.force
    || values.dryRun
    || values.allowRemote;
}

function parseArguments(args: readonly string[]): ParsedArguments {
  const parsed = parseArgs({
    args: [...args],
    options: OPTIONS,
    allowPositionals: true,
    strict: true,
    tokens: true,
  });
  return {
    values: {
      help: parsed.values.help === true,
      version: parsed.values.version === true,
      json: parsed.values.json === true,
      force: parsed.values.force === true,
      dryRun: parsed.values["dry-run"] === true,
      allowRemote: parsed.values["allow-remote"] === true,
      kind: typeof parsed.values.kind === "string" ? parsed.values.kind : undefined,
      input: typeof parsed.values.input === "string" ? parsed.values.input : undefined,
      out: typeof parsed.values.out === "string" ? parsed.values.out : undefined,
      format: typeof parsed.values.format === "string" ? parsed.values.format : undefined,
      paper: typeof parsed.values.paper === "string" ? parsed.values.paper : undefined,
    },
    positionals: parsed.positionals,
    tokens: parsed.tokens ?? [],
  };
}
function hasDuplicateOptions(tokens: ParsedArguments["tokens"]): boolean {
  const counts = new Map<string, number>();
  for (const token of tokens) {
    if (token.kind !== "option" || token.name === undefined) continue;
    const count = counts.get(token.name) ?? 0;
    if (count > 0) return true;
    counts.set(token.name, count + 1);
  }
  return false;
}



function runSchema(values: ParsedArguments["values"]): number {
  const { kind, input, out, format, paper, force, dryRun, allowRemote, json } = values;
  const kindResult = schemaKindSchema.safeParse(kind);
  if (
    input !== undefined || out !== undefined || format !== undefined || paper !== undefined || force
    || dryRun || allowRemote || !kindResult.success
  ) {
    return usageError(json);
  }
  writeOutput(generateJsonSchema(kindResult.data), json);
  return 0;
}
async function runValidation(values: ParsedArguments["values"]): Promise<number> {
  const { kind, input, out, format, paper, force, dryRun, allowRemote, json } = values;
  if (
    kind !== undefined || input === undefined || input.length === 0 || out !== undefined
    || format !== undefined || paper !== undefined || force || dryRun || allowRemote
  ) return usageError(json);

  const loaded = await loadSnapshot(input);
  if (!loaded.ok) {
    const exitCode = loaded.error.code === "io_error" || loaded.error.code === "input_too_large" ? 4 : 1;
    const result = { status: "error", error: loaded.error };
    if (json) writeOutput(result, true);
    else process.stderr.write(`${loaded.error.message}\n`);
    return exitCode;
  }

  const result = validateApplication(loaded.value);
  const output: ValidationOutput = { ...result, inputHash: loaded.inputHash };
  writeValidationOutput(output, json);
  return result.status === "valid" ? 0 : 1;
}
async function runEvaluation(
  values: ParsedArguments["values"],
  evaluationOptions: EvaluationTransportOptions,
  stdout: (text: string) => void,
): Promise<number> {
  const { kind, input, out, format, paper, force, dryRun, allowRemote, json } = values;
  if (
    kind !== undefined || input === undefined || input.length === 0 || format !== undefined || paper !== undefined
    || dryRun === allowRemote || (dryRun && (out !== undefined || force))
    || (allowRemote && force && out === undefined)
    || (out !== undefined && (out.length === 0 || extname(out).toLowerCase() !== ".json"))
  ) return usageError(json);

  const emit = (value: unknown): void => stdout(`${JSON.stringify(value, null, json ? undefined : 2)}\n`);
  const loaded = await loadSnapshot(input);
  if (!loaded.ok) {
    const exitCode = loaded.error.code === "io_error" || loaded.error.code === "input_too_large" ? 4 : 1;
    if (json) emit({ status: "error", error: loaded.error });
    else process.stderr.write(`${loaded.error.message}\n`);
    return exitCode;
  }

  const prepared = prepareEvaluation(loaded.value, loaded.inputHash);
  if (!prepared.ok) {
    if (prepared.reason === "invalid_application") {
      const result: ValidationOutput = { ...prepared.validation, inputHash: loaded.inputHash };
      if (json) emit(result);
      else {
        process.stdout.write(`Status: invalid\nInput: ${loaded.inputHash}\n`);
        for (const issue of result.issues) process.stdout.write(`${formatIssue(issue)}\n`);
      }
      return 1;
    }
    if (json) {
      emit({
        status: "error",
        error: { code: "request_too_large", message: prepared.message },
        inputHash: loaded.inputHash,
        validation: { status: prepared.validation.status, issues: prepared.validation.issues },
      });
    } else {
      process.stderr.write(`${prepared.message}\n`);
    }
    return 1;
  }

  const plan = prepared.value;
  if (dryRun) {
    emit({
      status: "dry_run",
      inputHash: loaded.inputHash,
      validation: plan.validation,
      request: plan.request,
      requestBytes: plan.requestBytes,
      egressDisclosure: {
        recipient: "TypeSafe Jev",
        includes: ["selected resume header and content", "referenced evidence IDs and text", "job company/title context and normalized requirements/exact quotes", "evaluation rubric questions"],
        excludes: ["email, phone, location, and contact links", "evidence source locators", "resume URLs", "job source URL and raw full job text"],
        note: "The preview contains private resume and evidence text; minimization is not anonymization.",
      },
    });
    return 0;
  }

  if (out !== undefined) {
    try {
      if (await pathsAlias(input, out)) return ioError(json, "Input and output paths refer to the same file.");
    } catch {
      return ioError(json, "Input and output paths could not be checked.");
    }
  }

  const apiKey = evaluationOptions.apiKey ?? process.env.TYPESAFE_API_KEY;
  if (apiKey === undefined || apiKey.trim().length === 0) {
    const result = { status: "error", error: { code: "configuration_error", message: "TYPESAFE_API_KEY is required for remote evaluation." } };
    if (json) emit(result);
    else process.stderr.write(`${result.error.message}\n`);
    return 2;
  }

  const toolVersion = await getPackageVersion();
  if (toolVersion === undefined) return ioError(json, "Package version could not be read.");
  const result = await evaluatePrepared(plan, toolVersion, { ...evaluationOptions, apiKey });
  if (result.kind === "configuration_error") {
    if (json) emit({ status: "error", error: { code: "configuration_error", message: result.message } });
    else process.stderr.write(`${result.message}\n`);
    return 2;
  }

  if (out !== undefined) {
    try {
      await writeStagedOutput(out, force, async (stagedPath) => {
        await writeFile(stagedPath, `${JSON.stringify(result.report, null, 2)}\n`, "utf8");
      });
    } catch {
      return ioError(json, "Evaluation report could not be written; any existing output was preserved.");
    }
  }
  writeEvaluationOutput(result.report, json, stdout);
  return result.kind === "complete" ? 0 : result.exitCode;
}
function writeEvaluationOutput(
  report: Report,
  json: boolean,
  stdout: (text: string) => void,
): void {
  if (json) {
    stdout(`${JSON.stringify(report)}\n`);
    return;
  }
  stdout(`Status: ${report.evaluation.status}\nApplication: ${report.application.id} revision ${report.application.revision}\nInput: ${report.application.inputHash}\n`);
  for (const finding of report.evaluation.findings) {
    stdout(`${finding.criterion} ${finding.target.path}: ${finding.answer}\n`);
  }
  if (report.evaluation.error !== null) stdout(`Error: ${report.evaluation.error.code} — ${report.evaluation.error.message}\n`);
}


async function runRender(values: ParsedArguments["values"]): Promise<number> {
  const { kind, input, out, format, paper: paperValue, force, dryRun, allowRemote, json } = values;
  if (
    kind !== undefined
    || input === undefined
    || input.length === 0
    || out === undefined
    || out.length === 0
    || (format !== "pdf" && format !== "docx")
    || (paperValue !== undefined && paperValue !== "a4" && paperValue !== "letter")
    || dryRun
    || allowRemote
  ) return usageError(json);

  if (extname(out).toLowerCase() !== `.${format}`) return usageError(json);
  const paper: PaperSize = paperValue === "letter" ? "letter" : "a4";
  const loaded = await loadSnapshot(input);
  if (!loaded.ok) {
    const exitCode = loaded.error.code === "io_error" || loaded.error.code === "input_too_large" ? 4 : 1;
    const result = { status: "error", error: loaded.error };
    if (json) writeOutput(result, true);
    else process.stderr.write(`${loaded.error.message}\n`);
    return exitCode;
  }

  const validation = validateApplication(loaded.value);
  const validationOutput: ValidationOutput = { ...validation, inputHash: loaded.inputHash };
  if (validation.status !== "valid") {
    writeValidationOutput(validationOutput, json);
    return 1;
  }

  const parsedApplication = applicationSchema.safeParse(loaded.value);
  if (!parsedApplication.success) return ioError(json, "Validated application could not be resolved.");
  try {
    if (await pathsAlias(input, out)) return ioError(json, "Input and output paths refer to the same file.");
  } catch {
    return ioError(json, "Input and output paths could not be checked.");
  }

  let toolVersion: string;
  try {
    const resume = resolveResume(parsedApplication.data);
    const options = { outputPath: out, paper, force };
    toolVersion = format === "pdf"
      ? await exportPdf(resume, options)
      : await exportDocx(resume, options);
  } catch {
    return ioError(json, "Rendering failed; the existing output was preserved.");
  }

  writeRenderOutput({
    outputPath: out,
    format,
    paper,
    inputHash: loaded.inputHash,
    designVersion: DESIGN_VERSION,
    toolVersion,
    warnings: validation.issues.filter((issue) => issue.severity === "warning"),
  }, json);
  return 0;
}

async function runUpdate(json: boolean): Promise<number> {
  const home = process.env.HOME;
  if (home === undefined) return ioError(json, "HOME must be set to update the toolkit.");
  const installationRoot = process.env.RESUME_TOOLKIT_DIR ?? join(home, ".local", "share", "resume-toolkit");
  const sourceRoot = resolve(import.meta.dir, "..");
  const workspace = relative(sourceRoot, process.cwd());
  const outsideSource = workspace === ".." || workspace.startsWith(`..${sep}`);
  try {
    const result = await installLatestRelease({
      root: installationRoot,
      ...(process.env.RESUME_TOOLKIT_RELEASE_URL ? { releaseUrl: process.env.RESUME_TOOLKIT_RELEASE_URL } : {}),
      ...(outsideSource ? { workspace: process.cwd() } : {}),
    });
    if (json) writeOutput({ status: "updated", version: result.version, installation: installationRoot }, true);
    else process.stdout.write(`Updated resume-toolkit to ${result.version}.\n`);
    return 0;
  } catch {
    return ioError(json, "Toolkit update failed; the previous installation was preserved.");
  }
}


function writeRenderOutput(
  result: {
    readonly outputPath: string;
    readonly format: "pdf" | "docx";
    readonly paper: PaperSize;
    readonly inputHash: string;
    readonly designVersion: string;
    readonly toolVersion: string;
    readonly warnings: readonly ValidationIssue[];
  },
  json: boolean,
): void {
  if (json) {
    writeOutput({ status: "rendered", ...result }, true);
    return;
  }
  process.stdout.write(`Status: rendered\nFormat: ${result.format}\nOutput: ${result.outputPath}\nInput: ${result.inputHash}\nPaper: ${result.paper}\nDesign: ${result.designVersion}\nRenderer: ${result.toolVersion}\n`);
  for (const warning of result.warnings) process.stdout.write(`${formatIssue(warning)}\n`);
}

function usageError(json: boolean): number {
  const message = "Invalid command-line usage; run --help for supported arguments.";
  if (json) writeOutput({ status: "error", error: { code: "usage_error", message } }, true);
  else process.stderr.write(`${message}\n${USAGE}\n`);
  return 2;
}

function ioError(json: boolean, message: string): number {
  const result = { status: "error", error: { code: "io_error", message } };
  if (json) writeOutput(result, true);
  else process.stderr.write(`${message}\n`);
  return 4;
}

function writeOutput(value: unknown, json: boolean, pretty = false): void {
  const serialized = JSON.stringify(value, null, pretty || !json ? 2 : undefined);
  process.stdout.write(`${serialized}\n`);
}
function writeValidationOutput(result: ValidationOutput, json: boolean): void {
  if (json) {
    writeOutput(result, true);
    return;
  }

  process.stdout.write(`Status: ${result.status}\nInput: ${result.inputHash}\nEvidence linkage: ${result.evidenceLinkage.status}\n`);
  for (const issue of result.issues) process.stdout.write(`${formatIssue(issue)}\n`);
}

async function getPackageVersion(): Promise<string | undefined> {
  try {
    const text = await readFile(new URL("../package.json", import.meta.url), "utf8");
    const value: unknown = JSON.parse(text) as unknown;
    if (value === null || typeof value !== "object" || !("version" in value) || typeof value.version !== "string") {
      return undefined;
    }
    return value.version;
  } catch {
    return undefined;
  }
}

function formatIssue(issue: ValidationIssue): string {
  const location = issue.path === "" ? "/" : issue.path;
  return `${issue.severity.toUpperCase()} ${issue.code} ${location}: ${issue.message}`;
}

if (import.meta.main) {
  void (async () => {
    process.exitCode = await runCli(process.argv.slice(2));
  })();
}
