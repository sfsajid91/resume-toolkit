import { readFile } from "node:fs/promises";
import { parseArgs } from "node:util";
import { loadSnapshot } from "./io.ts";
import { generateJsonSchema, schemaKindSchema, type ValidationIssue, type ValidationOutput } from "./schema.ts";
import { validateApplication } from "./validate.ts";

const USAGE = [
  "Usage:",
  "  bun run src/cli.ts --help [--json]",
  "  bun run src/cli.ts --version [--json]",
  "  bun run src/cli.ts schema --kind application|report [--json]",
  "  bun run src/cli.ts validate --input <path> [--json]",
].join("\n");

const OPTIONS = {
  help: { type: "boolean" },
  version: { type: "boolean" },
  json: { type: "boolean" },
  kind: { type: "string" },
  input: { type: "string" },
} as const;

type ParsedArguments = {
  readonly values: {
    readonly help: boolean;
    readonly version: boolean;
    readonly json: boolean;
    readonly kind: string | undefined;
    readonly input: string | undefined;
  };
  readonly positionals: readonly string[];
  readonly tokens: readonly { readonly kind: string; readonly name?: string }[];
};

export async function runCli(args: readonly string[]): Promise<number> {
  let parsed: ParsedArguments;
  try {
    parsed = parseArguments(args);
  } catch {
    return usageError(args.includes("--json"));
  }

  const { values, positionals, tokens } = parsed;
  if (hasDuplicateOptions(tokens)) return usageError(values.json);

  if (values.help || values.version) {
    if (positionals.length > 0 || values.kind !== undefined || values.input !== undefined || (values.help && values.version)) {
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
  if (command === "schema") return runSchema(values.kind, values.input, values.json);
  if (command === "validate") return runValidation(values.kind, values.input, values.json);
  return usageError(values.json);
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
      kind: typeof parsed.values.kind === "string" ? parsed.values.kind : undefined,
      input: typeof parsed.values.input === "string" ? parsed.values.input : undefined,
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

function runSchema(kindValue: string | undefined, input: string | undefined, json: boolean): number {
  const kind = schemaKindSchema.safeParse(kindValue);
  if (input !== undefined || !kind.success) return usageError(json);
  writeOutput(generateJsonSchema(kind.data), json);
  return 0;
}

async function runValidation(kind: string | undefined, input: string | undefined, json: boolean): Promise<number> {
  if (kind !== undefined || input === undefined || input.length === 0) return usageError(json);

  const loaded = await loadSnapshot(input);
  if (!loaded.ok) {
    const exitCode = loaded.error.code === "io_error" || loaded.error.code === "input_too_large" ? 4 : 1;
    const result = {
      status: "error",
      error: loaded.error,
    };
    if (json) writeOutput(result, true);
    else process.stderr.write(`${loaded.error.message}\n`);
    return exitCode;
  }

  const result = validateApplication(loaded.value);
  const output: ValidationOutput = { ...result, inputHash: loaded.inputHash };
  writeValidationOutput(output, json);
  return result.status === "valid" ? 0 : 1;
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
  process.exitCode = await runCli(process.argv.slice(2));
}
