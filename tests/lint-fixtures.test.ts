import { readFile } from "node:fs/promises";
import { describe, expect, test } from "bun:test";
import { applicationSchema } from "../src/application/schema.ts";
import { validateApplication } from "../src/application/validate.ts";

const expectedCodes = [
  "lint.banned_word",
  "lint.bullet_count",
  "lint.bullet_length",
  "lint.cert_expired",
  "lint.dash",
  "lint.date_overlap",
  "lint.duplicate_bullet",
  "lint.freelance_gap",
  "lint.header_links",
  "lint.hedge_text",
  "lint.missing_contact",
  "lint.no_stack",
  "lint.opener_repeat",
  "lint.project_unlinked",
  "lint.repeated_theme",
  "lint.rule_of_three",
  "lint.skills_domain",
  "lint.skills_thin",
  "lint.summary",
  "lint.thin_experience",
  "lint.transaction_bullet",
  "lint.vague_verb",
  "lint.weak_opener",
  "lint.without_tail",
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
});
