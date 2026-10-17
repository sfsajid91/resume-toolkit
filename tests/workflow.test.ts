import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { describe, expect, test } from "bun:test";
import { applicationSchema, reportSchema, validationOutputSchema, type Report } from "../src/application/schema.ts";

const projectRoot = fileURLToPath(new URL("..", import.meta.url));
const execFileAsync = promisify(execFile);
const decoder = new TextDecoder();

type CliResult = { readonly exitCode: number; readonly stdout: string; readonly stderr: string };

function runCli(args: readonly string[], options: { readonly offlineGuard?: string; readonly marker?: string } = {}): CliResult {
  const command = options.offlineGuard === undefined
    ? [process.execPath, "run", "src/cli.ts", ...args]
    : [process.execPath, "run", "--preload", options.offlineGuard, "src/cli.ts", ...args];
  const env = options.marker === undefined
    ? { ...process.env, TYPESAFE_API_KEY: "" }
    : { ...process.env, TYPESAFE_API_KEY: "", OFFLINE_GUARD_MARKER: options.marker };
  const result = Bun.spawnSync(command, { cwd: projectRoot, env, stdout: "pipe", stderr: "pipe" });
  return { exitCode: result.exitCode, stdout: decoder.decode(result.stdout), stderr: decoder.decode(result.stderr) };
}

function parseObject(output: string): Record<string, unknown> {
  return object(JSON.parse(output) as unknown);
}

function object(value: unknown): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) throw new Error("Expected a JSON object.");
  return value as Record<string, unknown>;
}

function hash(bytes: Uint8Array): string {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

async function command(program: string, args: string[]): Promise<string> {
  const { stdout } = await execFileAsync(program, args, { encoding: "utf8", maxBuffer: 2 * 1024 * 1024 });
  return stdout;
}


function xmlText(xml: string): string[] {
  return [...xml.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/gu)].map(([, value]) =>
    (value ?? "").replaceAll("&amp;", "&").replaceAll("&lt;", "<").replaceAll("&gt;", ">").replaceAll("&quot;", '"').replaceAll("&apos;", "'"),
  );
}

describe("synthetic agent workflow through the CLI", () => {
  test("discovers contracts, reviews a bound simulated report, revises, and exports offline", async () => {
    const directory = await mkdtemp(join(tmpdir(), "resume-workflow-"));
    try {
      const applicationPath = join(directory, "application.v1.json");
      const reportPath = join(directory, "report.v1.simulated.json");
      const revisionPath = join(directory, "application.v2.json");
      const exampleBytes = await readFile(new URL("../examples/application.json", import.meta.url));
      const v1 = applicationSchema.parse(JSON.parse(exampleBytes.toString("utf8")) as unknown);
      const v1Claim = v1.resume.sections[0]?.items[0]?.bullets[0];
      if (v1Claim === undefined) throw new Error("Example claim-cache input missing.");
      v1Claim.text = "Led the team-wide API caching initiative, driving a measured 50% reduction in p95 latency.";
      const originalBytes = Buffer.from(`${JSON.stringify(v1, null, 2)}\n`);
      await writeFile(applicationPath, originalBytes);
      const v1Hash = hash(originalBytes);

      const applicationSchemaResult = runCli(["schema", "--kind", "application", "--json"]);
      const reportSchemaResult = runCli(["schema", "--kind", "report", "--json"]);
      expect(applicationSchemaResult.exitCode).toBe(0);
      expect(reportSchemaResult.exitCode).toBe(0);
      const applicationContract = parseObject(applicationSchemaResult.stdout);
      const applicationProperties = object(applicationContract.properties);
      expect(applicationProperties).toHaveProperty("schemaVersion");
      expect(applicationProperties).toHaveProperty("revision");
      expect(applicationProperties).toHaveProperty("resume");
      expect(applicationProperties).toHaveProperty("evidence");
      expect(applicationProperties).toHaveProperty("job");
      const reportContract = parseObject(reportSchemaResult.stdout);
      const reportProperties = object(reportContract.properties);
      expect(reportProperties).toHaveProperty("application");
      expect(reportProperties).toHaveProperty("validation");
      expect(reportProperties).toHaveProperty("evaluation");
      expect(reportProperties).toHaveProperty("assessmentScope");
      expect(JSON.stringify(reportContract)).toContain("evidence_support");
      expect(JSON.stringify(reportContract)).toContain("observedTokenUsage");

      const validation = runCli(["validate", "--input", applicationPath, "--json"]);
      expect(validation.exitCode).toBe(0);
      const validationOutput = validationOutputSchema.parse(parseObject(validation.stdout));
      expect(validationOutput.status).toBe("valid");
      expect(validationOutput.inputHash).toBe(v1Hash);
      // Structural/reference validity does not certify the semantic truth of claim-cache.
      expect(validationOutput.evidenceLinkage.status).toBe("complete");
      expect(parseObject(validation.stdout)).not.toHaveProperty("evaluation");

      const previewResult = runCli(["evaluate", "--input", applicationPath, "--dry-run", "--json"]);
      expect(previewResult.exitCode).toBe(0);
      const preview = parseObject(previewResult.stdout);
      expect(preview.status).toBe("dry_run");
      expect(preview.inputHash).toBe(v1Hash);
      const requestText = JSON.stringify(preview.request);
      expect(requestText).toContain("Implemented TypeScript API caching");
      expect(requestText).toContain("production TypeScript API experience");
      expect(requestText).not.toContain("alex@example.com");
      expect(requestText).not.toContain("Reviewed career note 3");
      expect(requestText).not.toContain(v1.job?.rawText ?? "");
      expect(object(preview.egressDisclosure)).toHaveProperty("excludes");

      const simulatedReport: Report = reportSchema.parse({
        schemaVersion: 1,
        toolVersion: "synthetic-workflow-test",
        rubricVersion: "synthetic-workflow-test",
        generatedAt: "2026-10-15T00:00:00.000Z",
        application: { id: v1.id, revision: v1.revision, inputHash: v1Hash },
        validation: { status: validationOutput.status, issues: validationOutput.issues },
        evaluation: {
          status: "complete",
          requestedModel: "synthetic-only",
          observedModel: null,
          observedTokenUsage: null,
          findings: [{
            criterion: "evidence_support",
            target: { id: "claim-cache", path: "/resume/sections/0/items/0/bullets/0" },
            answer: "contradicted",
            uncertainty: 0,
            reviewAction: "Remove the team-wide ownership and unsupported 50% result; evidence says the contribution was cache implementation, not the full performance work.",
          }],
          error: null,
        },
        assessmentScope: { evidenceSupport: "claims_and_skills", requirementCoverage: "selected_resume_content", sourceTruth: "unverified", headerFacts: "not_evaluated" },
      });
      // This fixture is explicitly simulated: no Jev request, model observation, or usage was obtained.
      await writeFile(reportPath, `${JSON.stringify(simulatedReport, null, 2)}\n`);
      const receivedReport = reportSchema.parse(JSON.parse(await readFile(reportPath, "utf8")) as unknown);
      const finding = receivedReport.evaluation.findings.find((item) =>
        item.criterion === "evidence_support" && item.answer === "contradicted",
      );
      if (finding === undefined) throw new Error("Synthetic contradicted finding missing.");

      const v2 = structuredClone(v1);
      v2.revision = 2;
      const revisedClaim = v2.resume.sections.flatMap((section) =>
        section.items.flatMap((entry) => entry.bullets),
      ).find((claim) => claim.id === finding.target.id);
      if (revisedClaim === undefined) throw new Error("Review target is not a claim in this snapshot.");
      revisedClaim.text = "Implemented TypeScript API caching; team measurements showed p95 latency decreased from 250 ms to 200 ms.";
      const v2Bytes = Buffer.from(`${JSON.stringify(v2, null, 2)}\n`);
      await writeFile(revisionPath, v2Bytes);
      expect(applicationSchema.parse(JSON.parse(await readFile(revisionPath, "utf8")) as unknown).revision).toBe(2);
      expect(await readFile(applicationPath)).toEqual(originalBytes);
      expect(v1.revision).toBe(1);
      expect(v1.resume.sections[0]?.items[0]?.bullets[0]?.text).toContain("measured 50% reduction");
      expect(v1.evidence).toEqual(v2.evidence);
      expect(hash(originalBytes)).toBe(v1Hash);
      const v2Hash = hash(v2Bytes);
      expect(v2Hash).not.toBe(v1Hash);
      expect(receivedReport.application.inputHash).toBe(v1Hash);
      expect(receivedReport.application.inputHash).not.toBe(v2Hash);

      const validationV2 = runCli(["validate", "--input", revisionPath, "--json"]);
      expect(validationV2.exitCode).toBe(0);
      const validatedV2 = validationOutputSchema.parse(parseObject(validationV2.stdout));
      expect(validatedV2.inputHash).toBe(v2Hash);
      const previewV2Result = runCli(["evaluate", "--input", revisionPath, "--dry-run", "--json"]);
      expect(previewV2Result.exitCode).toBe(0);
      const previewV2 = parseObject(previewV2Result.stdout);
      expect(previewV2.inputHash).toBe(v2Hash);
      expect(JSON.stringify(previewV2.request)).toContain(revisedClaim.text);

      const networkGuardPath = join(directory, "offline-guard.js");
      const markerPath = join(directory, "offline-guard-loaded");
      await writeFile(networkGuardPath, [
        'import { writeFileSync } from "node:fs";',
        'import net from "node:net";',
        'import tls from "node:tls";',
        'const deny = () => { throw new Error("network access blocked by workflow test"); };',
        'globalThis.fetch = deny;',
        'globalThis.WebSocket = class { constructor() { deny(); } };',
        'net.connect = deny; net.createConnection = deny; tls.connect = deny;',
        'if (typeof Bun.connect === "function") Bun.connect = deny;',
        'writeFileSync(process.env.OFFLINE_GUARD_MARKER, "loaded");',
      ].join("\n"));

      const pdfPath = join(directory, "resume.v2.pdf");
      const docxPath = join(directory, "resume.v2.docx");
      for (const [format, output] of [["pdf", pdfPath], ["docx", docxPath]] as const) {
        const rendered = runCli([
          "render", "--input", revisionPath, "--format", format, "--paper", "a4", "--out", output, "--json",
        ], { offlineGuard: networkGuardPath, marker: markerPath });
        expect(rendered.exitCode).toBe(0);
        expect(rendered.stderr).toBe("");
        expect(parseObject(rendered.stdout)).toEqual(expect.objectContaining({ status: "rendered", format, outputPath: output, inputHash: v2Hash }));
        expect(await readFile(markerPath, "utf8")).toBe("loaded");
        await rm(markerPath, { force: true });
      }
      expect((await readFile(pdfPath)).subarray(0, 4).toString()).toBe("%PDF");
      expect((await readFile(docxPath)).subarray(0, 4).toString()).toBe("PK\u0003\u0004");
      const pdfText = await command("pdftotext", [pdfPath, "-"]);
      expect(pdfText.replace(/\s+/gu, " ")).toContain("ALEX EXAMPLE");
      expect(pdfText.replace(/\s+/gu, " ")).toContain(revisedClaim.text);
      expect(pdfText).not.toContain("Led the team-wide");
      expect(pdfText).not.toContain("50% reduction");
      await command("unzip", ["-t", docxPath]);
      const [documentXml, stylesXml, numberingXml] = await Promise.all([
        command("unzip", ["-p", docxPath, "word/document.xml"]),
        command("unzip", ["-p", docxPath, "word/styles.xml"]),
        command("unzip", ["-p", docxPath, "word/numbering.xml"]),
      ]);
      const visibleText = xmlText(documentXml).join(" ");
      expect(visibleText).toContain("ALEX EXAMPLE");
      expect(visibleText).toContain(revisedClaim.text);
      expect(visibleText).not.toContain("Led the team-wide");
      expect(visibleText).not.toContain("50% reduction");
      expect(documentXml).toContain("<w:body>");
      expect(documentXml).toContain("<w:p>");
      expect(documentXml).toContain("<w:numPr>");
      expect(numberingXml).toContain('w:numFmt w:val="bullet"');
      expect(stylesXml).toContain('w:styleId="ResumeName"');
      expect(stylesXml).toContain('w:styleId="ResumeBullet"');
      expect(documentXml).not.toContain("<w:tbl");
      expect(await readFile(applicationPath)).toEqual(originalBytes);
      expect(await readFile(revisionPath)).toEqual(v2Bytes);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  }, 120_000);
});
