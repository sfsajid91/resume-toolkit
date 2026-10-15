import { readFile } from "node:fs/promises";
import { describe, expect, test } from "bun:test";
import { applicationSchema } from "./schema.ts";
import { resolveResume } from "./resume.ts";

async function fixture(path: string) {
  const value: unknown = JSON.parse(await readFile(new URL(path, import.meta.url), "utf8")) as unknown;
  return applicationSchema.parse(value);
}

describe("resolved resume", () => {
  test("preserves selected order and wording while excluding application metadata", async () => {
    const application = await fixture("../examples/dense-application.json");
    const original = JSON.stringify(application);
    const resolved = resolveResume(application);

    expect(resolved.sections.map(({ title }) => title)).toEqual([
      "Experience", "Projects", "Education", "Certifications",
    ]);
    expect(resolved.sections[0]?.entries[0]?.name).toBe("Northstar Systems");
    expect(resolved.sections[0]?.entries[0]?.dateRange).toBe("2022-04 – Present");
    expect(resolved.summary[0]).toBe(application.resume.summary[0]?.text);
    expect(resolved.sections[0]?.entries[0]?.bullets[0]).toBe(
      application.resume.sections[0]?.items[0]?.bullets[0]?.text,
    );
    expect(resolved.basics.links[0]?.url).toBe("https://morgan.example.net");
    expect(resolved).not.toHaveProperty("evidence");
    expect(resolved).not.toHaveProperty("job");
    expect(JSON.stringify(application)).toBe(original);
  });
});
