import { readFile } from "node:fs/promises";
import { describe, expect, test } from "bun:test";
import { applicationSchema } from "./schema.ts";
import { resolveResume } from "./resume.ts";

async function fixture(path: string) {
  const value: unknown = JSON.parse(await readFile(new URL(path, import.meta.url), "utf8")) as unknown;
  return applicationSchema.parse(value);
}

describe("resolved resume", () => {
  test("preserves selected order, formats display fields, and excludes application metadata", async () => {
    const application = await fixture("../examples/dense-application.json");
    const original = JSON.stringify(application);
    const resolved = resolveResume(application);

    expect(resolved.basics.name).toBe("MORGAN EXAMPLE");
    expect(resolved.sections.map(({ title }) => title)).toEqual([
      "PROFESSIONAL EXPERIENCE", "SELECTED PROJECTS", "EDUCATION", "CERTIFICATIONS",
    ]);
    expect(resolved.sections[0]?.entries[0]?.name).toBe("Northstar Systems");
    expect(resolved.sections[0]?.entries[0]?.dateRange).toBe("Apr 2022 – Present");
    expect(resolved.summary[0]).toBe(application.resume.summary[0]?.text);
    expect(resolved.sections[0]?.entries[0]?.bullets[0]).toBe(
      application.resume.sections[0]?.items[0]?.bullets[0]?.text,
    );
    expect(resolved.basics.links[0]?.url).toBe("https://morgan.example.net");
    expect(resolved).not.toHaveProperty("evidence");
    expect(resolved).not.toHaveProperty("job");
    expect(JSON.stringify(application)).toBe(original);
  });

  test("preserves optional headline and groups skills by first category appearance", async () => {
    const application = await fixture("../examples/application.json");
    application.resume.basics.headline = "Full-Stack Engineer";
    application.resume.skills.push(
      { id: "skill-bun", label: "Bun", category: "Languages", evidenceIds: [] },
      { id: "skill-react", label: "React", category: "Frontend", evidenceIds: [] },
      { id: "skill-sql", label: "SQL", category: "Languages", evidenceIds: [] },
    );
    application.resume.basics.links.push({
      label: "https://example.com/profile",
      url: "https://example.com/profile",
    });
    const resolved = resolveResume(application);

    expect(resolved.basics.headline).toBe("Full-Stack Engineer");
    expect(resolved.skills).toEqual([
      { labels: ["TypeScript"] },
      { category: "Languages", labels: ["Bun", "SQL"] },
      { category: "Frontend", labels: ["React"] },
    ]);
    expect(resolved.basics.links[0]).toEqual({
      label: "example.com/profile",
      url: "https://example.com/profile",
    });
  });

  test("keeps existing example fixtures compatible", async () => {
    for (const name of ["application.json", "dense-application.json", "edge-application.json"]) {
      const application = await fixture(`../examples/${name}`);
      expect(applicationSchema.safeParse(application).success).toBe(true);
    }
  });
});
