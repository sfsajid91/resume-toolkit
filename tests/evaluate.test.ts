import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "bun:test";
import { runCli } from "../src/cli.ts";
import { MAX_REQUEST_BYTES, prepareEvaluation } from "../src/evaluation/evaluate.ts";
import { applicationSchema, reportSchema, type Application } from "../src/application/schema.ts";

const projectRoot = fileURLToPath(new URL("..", import.meta.url));
const fixturePath = `${projectRoot}/examples/application.json`;
const inputHash = `sha256:${"a".repeat(64)}`;

type MockScenario = "valid" | "missing_answer" | "wrong_type" | "wrong_probability" | "auth_rejected" | "provider_budget" | "timeout";
type MockQuestion = { readonly type: string; readonly criteria?: unknown };
type MockRequest = { readonly questions: Record<string, MockQuestion> };

async function loadApplication(): Promise<Application> {
  const value: unknown = JSON.parse(await readFile(fixturePath, "utf8")) as unknown;
  return applicationSchema.parse(value);
}

function jsonResult(output: string): Record<string, unknown> {
  return JSON.parse(output) as Record<string, unknown>;
}

function makeAnswers(questions: Record<string, MockQuestion>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(questions).map(([id, question]) => {
    if (question.type === "choice") {
      const criteria = question.criteria as Record<string, unknown>;
      const labels = Object.keys(criteria);
      const probabilities = Object.fromEntries(labels.map((label, index) => [label, index === 0 ? 0.8 : 0.1]));
      return [id, { type: "choice", choice: labels[0], probabilities, confidence: 0.8 }];
    }
    if (question.type === "noul") return [id, { type: "noul", noul: 0.8 }];
    const criteria = question.criteria as string[];
    return [id, {
      type: "score",
      score: 1.1,
      legend: Object.fromEntries(criteria.map((label, index) => [String(index), label])),
      probabilities: { "0": 0.25, "1": 0.4, "2": 0.35 },
      confidence: 0.7,
    }];
  }));
}

describe("evaluation preparation", () => {
  test("projects only selected content and counts the exact UTF-8 request bytes", async () => {
    const application = structuredClone(await loadApplication());
    application.resume.sections[0]!.items[0]!.bullets[0]!.text += " é🧪";
    application.resume.basics.email = "CONTACT_EMAIL_SENTINEL@example.test";
    application.resume.basics.phone = "CONTACT_PHONE_SENTINEL";
    application.resume.basics.location = "CONTACT_LOCATION_SENTINEL";
    application.resume.basics.links.push({ label: "contact", url: "https://contact.invalid/private" });
    application.resume.sections[0]!.items[0]!.url = "https://resume.invalid/private";
    application.evidence![0]!.source.locator = "LOCAL_LOCATOR_SENTINEL";
    application.evidence!.push({
      id: "unused-evidence",
      entryId: "exp-api",
      text: "UNREFERENCED_EVIDENCE_SENTINEL",
      source: { kind: "document", locator: "UNUSED_LOCAL_LOCATOR_SENTINEL" },
      confirmedByUser: true,
    });
    application.job!.sourceUrl = "https://job.invalid/private";
    application.job!.rawText += " RAW_FULL_JOB_TEXT_SENTINEL";

    const unchanged = structuredClone(application);
    const prepared = prepareEvaluation(application, inputHash);
    expect(prepared.ok).toBe(true);
    if (!prepared.ok) throw new Error("Valid fixture failed evaluation preparation.");
    const serialized = JSON.stringify(prepared.value.request);
    expect(prepared.value.requestBytes).toBe(new TextEncoder().encode(serialized).byteLength);
    expect(prepared.value.requestBytes).toBeLessThanOrEqual(MAX_REQUEST_BYTES);
    expect(application).toEqual(unchanged);
    for (const privateValue of [
      "CONTACT_EMAIL_SENTINEL@example.test",
      "CONTACT_PHONE_SENTINEL",
      "CONTACT_LOCATION_SENTINEL",
      "contact.invalid",
      "resume.invalid",
      "LOCAL_LOCATOR_SENTINEL",
      "UNREFERENCED_EVIDENCE_SENTINEL",
      "UNUSED_LOCAL_LOCATOR_SENTINEL",
      "job.invalid",
      "RAW_FULL_JOB_TEXT_SENTINEL",
    ]) expect(serialized).not.toContain(privateValue);

    const state = prepared.value.request.state as {
      resume: { basics: Record<string, unknown> };
      evidence: Array<Record<string, unknown>>;
      job: Record<string, unknown>;
    };
    expect(Object.keys(state.resume.basics)).toEqual(["name"]);
    expect(state.evidence).toHaveLength(1);
    expect(state.evidence[0]).toEqual(expect.objectContaining({ id: "fact-cache", text: expect.any(String) }));
    expect(state.job).toHaveProperty("requirements");
    expect(state.job).not.toHaveProperty("rawText");
    expect(Object.values(prepared.value.request.questions).map((question) => question.type)).toEqual([
      "choice", "choice", "noul", "noul", "score", "score",
    ]);
  });

  test("rejects requests above 48 KiB without truncating them", async () => {
    const application = structuredClone(await loadApplication());
    const requirements = Array.from({ length: 12 }, (_, index) => {
      const quote = `requirement-${index}-${"é".repeat(2_500)}`;
      return { id: `large-${index}`, text: quote, quote, importance: "preferred" as const };
    });
    application.job!.requirements = requirements;
    application.job!.rawText = requirements.map((requirement) => requirement.quote).join("\n");
    const prepared = prepareEvaluation(application, inputHash);
    expect(prepared).toMatchObject({ ok: false, reason: "request_too_large" });
    if (prepared.ok) throw new Error("Oversized evaluation request was accepted.");
    expect(prepared.message).toContain("nothing was truncated or sent");
  });

  test("rejects unmet evidence and job prerequisites before evaluation", async () => {
    const application = structuredClone(await loadApplication());
    delete application.job;
    application.resume.skills[0]!.evidenceIds = [];
    const prepared = prepareEvaluation(application, inputHash);
    expect(prepared.ok).toBe(false);
    if (prepared.ok) throw new Error("Missing evaluation prerequisites were accepted.");
    expect(prepared.validation.issues.map((issue) => issue.code)).toContain("evaluation.job_required");
    expect(prepared.validation.issues.map((issue) => issue.code)).toContain("evaluation.evidence_reference_required");
  });
  test("CLI dry-run works with an empty key and emits the exact request preview", async () => {
    let stdout = "";
    const exitCode = await runCli(["evaluate", "--input", fixturePath, "--dry-run", "--json"], {
      evaluation: { apiKey: "" },
      stdout: (text) => { stdout += text; },
    });
    const output = jsonResult(stdout);
    expect(exitCode).toBe(0);
    expect(output.status).toBe("dry_run");
    expect(output).toHaveProperty("request");
    expect(output).toHaveProperty("requestBytes");
    expect(output).toHaveProperty("egressDisclosure");
  });
});

describe("live evaluation through a local mock service", () => {
  test("reports complete findings and returns unavailable with exit 3 for malformed, rejected, and timed-out requests", async () => {
    let scenario: MockScenario = "valid";
    let lastRequest: MockRequest | undefined;
    const server = Bun.serve({
      hostname: "127.0.0.1",
      port: 0,
      async fetch(request) {
        expect(new URL(request.url).pathname).toBe("/v1/systemone");
        expect(request.headers.get("authorization")).toBe("Bearer local-test-key");
        if (scenario === "auth_rejected") return Response.json({ error: "invalid test key" }, { status: 401 });
        if (scenario === "provider_budget") return Response.json({ error: { code: "max_tokens_exceeded" } }, { status: 400 });
        const body: MockRequest = await request.json() as MockRequest;
        lastRequest = body;
        const answers = makeAnswers(body.questions);
        const firstChoice = Object.entries(body.questions).find(([, question]) => question.type === "choice")?.[0];
        if (scenario === "missing_answer" && firstChoice !== undefined) delete answers[firstChoice];
        if (scenario === "wrong_type" && firstChoice !== undefined) answers[firstChoice] = { type: "noul", noul: 0.5 };
        if (scenario === "wrong_probability" && firstChoice !== undefined) {
          answers[firstChoice] = {
            type: "choice",
            choice: "supported",
            probabilities: { supported: 1.2, contradicted: 0, insufficient: 0 },
            confidence: 0.8,
          };
        }
        const response = { model: "jev-test-model", answers, usage: { input_tokens: 12, output_tokens: 3 } };
        if (scenario === "timeout") {
          // Exercise the real SDK/AbortSignal deadline against this local server; fake timers do not drive the HTTP transport.
          await Bun.sleep(400);
        }
        return Response.json(response);
      },
    });

    try {
      const invoke = async (nextScenario: MockScenario): Promise<{ exitCode: number; output: Record<string, unknown> }> => {
        scenario = nextScenario;
        let stdout = "";
        const exitCode = await runCli(["evaluate", "--input", fixturePath, "--allow-remote", "--json"], {
          evaluation: { apiKey: "local-test-key", baseURL: server.url.origin, timeoutMs: nextScenario === "timeout" ? 80 : 3_000 },
          stdout: (text) => { stdout += text; },
        });
        return { exitCode, output: jsonResult(stdout) };
      };

      const complete = await invoke("valid");
      expect(complete.exitCode).toBe(0);
      const report = reportSchema.parse(complete.output);
      expect(report.evaluation.status).toBe("complete");
      expect(report.evaluation.observedModel).toBe("jev-test-model");
      expect(report.evaluation.observedTokenUsage).toEqual({ inputTokens: 12, outputTokens: 3, totalTokens: 15 });
      expect(report.evaluation.findings.find((finding) => finding.criterion === "relevance")?.answer).toBe(1.1);
      expect(new Set(report.evaluation.findings.map((finding) => finding.criterion))).toEqual(
        new Set(["evidence_support", "requirement_coverage", "relevance", "clarity"]),
      );
      expect(lastRequest).toBeDefined();
      expect(Object.values(lastRequest!.questions).map((question) => question.type)).toContain("choice");
      expect(Object.values(lastRequest!.questions).map((question) => question.type)).toContain("noul");
      expect(Object.values(lastRequest!.questions).map((question) => question.type)).toContain("score");

      for (const [scenarioName, errorCode] of [
        ["missing_answer", "invalid_response"],
        ["wrong_type", "invalid_response"],
        ["wrong_probability", "invalid_response"],
        ["auth_rejected", "authentication_rejected"],
        ["provider_budget", "provider_budget_rejected"],
        ["timeout", "deadline_exceeded"],
      ] as const) {
        const failed = await invoke(scenarioName);
        expect(failed.exitCode).toBe(3);
        const failedReport = reportSchema.parse(failed.output);
        expect(failedReport.evaluation.status).toBe("unavailable");
        expect(failedReport.evaluation.findings).toEqual([]);
        expect(failedReport.evaluation.error?.code).toBe(errorCode);
      }
    } finally {
      server.stop(true);
    }
  }, 10_000);
});
