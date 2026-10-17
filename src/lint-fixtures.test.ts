import { readFile } from "node:fs/promises";
import { describe, expect, test } from "bun:test";
import { applicationSchema } from "./schema.ts";
import { validateApplication } from "./validate.ts";
import { BANNED_TERMS } from "./lint-terms.ts";

const expectedCodes = [
  "lint.banned_word",
  "lint.dash",
  "lint.without_tail",
  "lint.rule_of_three",
  "lint.weak_opener",
  "lint.bullet_length",
  "lint.bullet_count",
  "lint.opener_repeat",
  "lint.no_number",
  "lint.duplicate_bullet",
  "lint.repeated_theme",
  "lint.summary",
  "lint.skills_thin",
  "lint.skill_not_in_body",
  "lint.date_overlap",
  "lint.cert_expired",
] as const;

async function fixture(name: string) {
  const source = await readFile(new URL(`../examples/${name}`, import.meta.url), "utf8");
  return applicationSchema.parse(JSON.parse(source) as unknown);
}

describe("lint fixtures", () => {
  test("bad synthetic fixture exercises every lint code without invalidating input", async () => {
    const result = validateApplication(await fixture("lint-bad-application.json"));
    const warnings = result.issues.filter((issue) => issue.code.startsWith("lint."));
    expect(result.status).toBe("valid");
    expect(result.evidenceLinkage.status).toBe("unavailable");
    expect([...new Set(warnings.map((issue) => issue.code))].sort()).toEqual([...expectedCodes].sort());
    expect(warnings.every((issue) => issue.severity === "warning" && issue.path.startsWith("/"))).toBe(true);
  });

  test("fixed synthetic fixture has no lint findings", async () => {
    const result = validateApplication(await fixture("lint-good-application.json"));
    expect(result.status).toBe("valid");
    expect(result.issues.filter((issue) => issue.code.startsWith("lint."))).toEqual([]);
  });
  test("writing guide banned terms exactly match lint vocabulary", async () => {
    const guide = await readFile(new URL("../skills/resume-toolkit/writing-guide.md", import.meta.url), "utf8");
    const list = guide.match(/^Banned terms \(lint terms\): (.+)$/mu)?.[1] ?? "";
    const terms = [...list.matchAll(/`([^`]+)`/gu)].map(([, term]) => term ?? "");
    expect(terms).toEqual([...BANNED_TERMS]);
  });
});
