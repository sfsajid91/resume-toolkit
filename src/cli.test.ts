import { createHash } from "node:crypto";
import { readFile, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "bun:test";
import { applicationSchema } from "./schema.ts";

const projectRoot = fileURLToPath(new URL("..", import.meta.url));
const fixturePath = join(projectRoot, "examples", "application.json");

function runCli(args: readonly string[]): { readonly exitCode: number; readonly stdout: string; readonly stderr: string } {
  const result = Bun.spawnSync([process.execPath, "run", "src/cli.ts", ...args], {
    cwd: projectRoot,
    stdout: "pipe",
    stderr: "pipe",
  });
  const decoder = new TextDecoder();
  return {
    exitCode: result.exitCode,
    stdout: decoder.decode(result.stdout),
    stderr: decoder.decode(result.stderr),
  };
}

function parseObject(output: string): Record<string, unknown> {
  const parsed: unknown = JSON.parse(output) as unknown;
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Expected one JSON object on stdout.");
  }
  return parsed as Record<string, unknown>;
}

describe("CLI subprocess behavior", () => {
  test("returns exact exit codes and never changes the application fixture", async () => {
    const original = await readFile(fixturePath);
    const directory = await mkdtemp(join(tmpdir(), "resume-toolkit-cli-"));
    try {
      const validApplication = applicationSchema.parse(JSON.parse(original.toString("utf8")) as unknown);
      const invalidPath = join(directory, "invalid.json");
      const invalidValue: unknown = structuredClone(validApplication);
      if (invalidValue === null || typeof invalidValue !== "object" || Array.isArray(invalidValue)) {
        throw new Error("Fixture root must be an object.");
      }
      (invalidValue as Record<string, unknown>).schemaVersion = 99;
      await writeFile(invalidPath, JSON.stringify(invalidValue));

      const noEvidencePath = join(directory, "no-evidence.json");
      const noEvidence = structuredClone(validApplication);
      delete noEvidence.evidence;
      await writeFile(noEvidencePath, JSON.stringify(noEvidence));

      const unconfirmedPath = join(directory, "unconfirmed.json");
      const unconfirmed = structuredClone(validApplication);
      unconfirmed.evidence![0]!.confirmedByUser = false;
      await writeFile(unconfirmedPath, JSON.stringify(unconfirmed));

      const valid = runCli(["validate", "--input", fixturePath, "--json"]);
      expect(valid.exitCode).toBe(0);
      expect(valid.stderr).toBe("");
      expect(valid.stdout.trim().split("\n")).toHaveLength(1);
      const validResult = parseObject(valid.stdout);
      expect(validResult.status).toBe("valid");
      expect(validResult.inputHash).toBe(`sha256:${createHash("sha256").update(original).digest("hex")}`);

      const invalid = runCli(["validate", "--input", invalidPath, "--json"]);
      expect(invalid.exitCode).toBe(1);
      expect(parseObject(invalid.stdout).status).toBe("invalid");
      const noEvidenceRun = runCli(["validate", "--input", noEvidencePath, "--json"]);
      expect(noEvidenceRun.exitCode).toBe(0);
      const noEvidenceResult = parseObject(noEvidenceRun.stdout);
      expect((noEvidenceResult.evidenceLinkage as Record<string, unknown>).status).toBe("unavailable");
      expect((noEvidenceResult.issues as Array<Record<string, unknown>>).some((issue) => issue.code === "evidence.unavailable" && issue.severity === "warning")).toBe(true);

      const unconfirmedRun = runCli(["validate", "--input", unconfirmedPath, "--json"]);
      expect(unconfirmedRun.exitCode).toBe(0);
      const unconfirmedResult = parseObject(unconfirmedRun.stdout);
      expect((unconfirmedResult.evidenceLinkage as Record<string, unknown>).status).toBe("unconfirmed");
      expect((unconfirmedResult.issues as Array<Record<string, unknown>>).some((issue) => issue.code === "evidence.unconfirmed" && issue.severity === "warning")).toBe(true);

      const usage = runCli(["validate", "--input", fixturePath, "--unknown", "--json"]);
      expect(usage.exitCode).toBe(2);
      expect(usage.stderr).toBe("");
      expect(parseObject(usage.stdout).error).toEqual({
        code: "usage_error",
        message: "Invalid command-line usage; run --help for supported arguments.",
      });

      const missing = runCli(["validate", "--input", join(directory, "missing.json"), "--json"]);
      expect(missing.exitCode).toBe(4);
      expect(parseObject(missing.stdout).status).toBe("error");

      const oversizedPath = join(directory, "oversized.json");
      await writeFile(oversizedPath, Buffer.alloc(2_097_153, 0x20));
      const oversized = runCli(["validate", "--input", oversizedPath, "--json"]);
      expect(oversized.exitCode).toBe(4);
      expect(parseObject(oversized.stdout).status).toBe("error");

      expect(await readFile(fixturePath)).toEqual(original);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  }, 15_000);

  test("rejects render flag and extension mismatches as usage errors", () => {
    const wrongExtension = runCli([
      "render", "--input", fixturePath, "--format", "docx", "--out", "resume.pdf", "--json",
    ]);
    const wrongCommand = runCli(["validate", "--input", fixturePath, "--format", "docx", "--json"]);
    expect(wrongExtension.exitCode).toBe(2);
    expect(wrongCommand.exitCode).toBe(2);
    expect(parseObject(wrongExtension.stdout).error).toEqual(expect.objectContaining({ code: "usage_error" }));
  });

  test("renders through available exporters and protects outputs", async () => {
    const directory = await mkdtemp(join(tmpdir(), "resume-toolkit-render-cli-"));
    try {
      const fixtures = ["application.json", "dense-application.json", "edge-application.json"] as const;
      const formats: readonly ("pdf" | "docx")[] = Bun.which("typst") === null ? ["docx"] : ["pdf", "docx"];
      for (const [index, name] of fixtures.entries()) {
        const input = join(projectRoot, "examples", name);
        const bytes = await readFile(input);
        for (const format of formats) {
          const output = join(directory, `${index}.${format}`);
          const result = runCli([
            "render", "--input", input, "--format", format, "--out", output,
            ...(index === 2 ? ["--paper", "letter"] : []), "--json",
          ]);
          expect(result.exitCode).toBe(0);
          expect(result.stderr).toBe("");
          expect(result.stdout.trim().split("\n")).toHaveLength(1);
          const rendered = parseObject(result.stdout);
          expect(rendered).toEqual(expect.objectContaining({
            status: "rendered",
            outputPath: output,
            format,
            inputHash: `sha256:${createHash("sha256").update(bytes).digest("hex")}`,
          }));
          expect(typeof rendered.toolVersion).toBe("string");
          expect(Array.isArray(rendered.warnings)).toBe(true);
          const artifact = await readFile(output);
          expect(artifact.subarray(0, 4).toString()).toBe(format === "pdf" ? "%PDF" : "PK\u0003\u0004");
        }
      }

      const protectedOutput = join(directory, "protected.docx");
      await writeFile(protectedOutput, "previous output");
      const refused = runCli([
        "render", "--input", fixturePath, "--format", "docx", "--out", protectedOutput, "--json",
      ]);
      expect(refused.exitCode).toBe(4);
      expect(await readFile(protectedOutput, "utf8")).toBe("previous output");

      const forced = runCli([
        "render", "--input", fixturePath, "--format", "docx", "--out", protectedOutput, "--force", "--json",
      ]);
      expect(forced.exitCode).toBe(0);

      const invalidInput = join(directory, "invalid.json");
      const invalidOutput = join(directory, "invalid.docx");
      await writeFile(invalidInput, JSON.stringify({ schemaVersion: 99 }));
      const invalid = runCli([
        "render", "--input", invalidInput, "--format", "docx", "--out", invalidOutput, "--json",
      ]);
      expect(invalid.exitCode).toBe(1);
      await expect(readFile(invalidOutput)).rejects.toMatchObject({ code: "ENOENT" });

      const writeFailure = runCli([
        "render", "--input", fixturePath, "--format", "docx",
        "--out", join(directory, "missing-parent", "resume.docx"), "--json",
      ]);
      expect(writeFailure.exitCode).toBe(4);

      const originalInput = await readFile(fixturePath);
      const aliasPath = join(directory, "input-alias.docx");
      await symlink(fixturePath, aliasPath);
      const alias = runCli([
        "render", "--input", fixturePath, "--format", "docx", "--out", aliasPath, "--json",
      ]);
      expect(alias.exitCode).toBe(4);
      expect(await readFile(fixturePath)).toEqual(originalInput);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  }, 45_000);

  test("emits schema and help as single JSON objects and rejects conflicting flags", () => {
    const schema = runCli(["schema", "--kind", "report", "--json"]);
    expect(schema.exitCode).toBe(0);
    expect(schema.stdout.trim().split("\n")).toHaveLength(1);
    expect(parseObject(schema.stdout)["$schema"]).toBe("https://json-schema.org/draft/2020-12/schema");

    const help = runCli(["--help", "--json"]);
    expect(help.exitCode).toBe(0);
    expect(parseObject(help.stdout).status).toBe("help");

    const conflict = runCli(["--help", "--version", "--json"]);
    const version = runCli(["--version", "--json"]);
    expect(version.exitCode).toBe(0);
    expect(parseObject(version.stdout).version).toBe("0.1.0");
    expect(conflict.exitCode).toBe(2);
    expect(parseObject(conflict.stdout).error).toEqual(expect.objectContaining({ code: "usage_error" }));
  });
});
