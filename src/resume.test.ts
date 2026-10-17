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
      "PROFESSIONAL EXPERIENCE", "TECHNICAL SKILLS", "SELECTED PROJECTS", "EDUCATION", "CERTIFICATIONS",
    ]);
    const experience = resolved.sections.find((section) => section.kind === "experience");
    if (experience === undefined || experience.kind === "skills") throw new Error("Dense fixture is missing experience.");
    expect(experience.entries[0]?.heading).toBe("Senior Software Engineer");
    expect(experience.entries[0]?.urlLabel).toBe("Northstar Systems");
    expect(experience.entries[0]?.detail).toBe("");
    expect(resolved.summary[0]).toBe(application.resume.summary[0]?.text);
    expect(experience.entries[0]?.bullets[0]).toBe(application.resume.sections[0]?.items[0]?.bullets[0]?.text);
    expect(resolved.basics.links.map(({ label }) => label)).toEqual([
      "morgan.example.net", "github.com/morgan-example",
    ]);
    expect(resolved.basics.links.map(({ url }) => url)).toEqual([
      "https://morgan.example.net", "https://github.com/morgan-example",
    ]);
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
    application.resume.basics.links.push(
      { label: "github.com/sfsajid91", url: "https://github.com/sfsajid91" },
      { label: "github.com", url: "https://www.github.com/sfsajid91" },
    );
    const resolved = resolveResume(application);

    expect(resolved.basics.headline).toBe("Full-Stack Engineer");
    expect(resolved.skills).toEqual([
      { labels: ["TypeScript"] },
      { category: "Languages", labels: ["Bun", "SQL"] },
      { category: "Frontend", labels: ["React"] },
    ]);
    expect(resolved.basics.links[0]).toEqual({
      label: "github.com/sfsajid91",
      url: "https://github.com/sfsajid91",
    });
    expect(resolved.basics.links[1]).toEqual({
      label: "github.com/sfsajid91",
      url: "https://www.github.com/sfsajid91",
    });
    expect(resolved.sections.findIndex(({ kind }) => kind === "skills")).toBe(
      resolved.sections.findIndex(({ kind }) => kind === "experience") + 1,
    );
  });

  test("keeps existing example fixtures compatible", async () => {
    for (const name of ["application.json", "dense-application.json", "edge-application.json"]) {
      const application = await fixture(`../examples/${name}`);
      expect(applicationSchema.safeParse(application).success).toBe(true);
    }
  });
});
describe("optional rendering fields", () => {
  test("uses short month names and supports all skill positions", async () => {
    const application = await fixture("../examples/dense-application.json");
    const entry = application.resume.sections[0]!.items[0]!;
    const expected = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    for (const [index, month] of expected.entries()) {
      entry.start = `2024-${String(index + 1).padStart(2, "0")}`;
      entry.end = entry.start;
      const resolved = resolveResume(application);
      const experience = resolved.sections.find((section) => section.kind === "experience");
      if (experience === undefined || experience.kind === "skills") throw new Error("Missing experience section.");
      expect(experience.entries[0]?.dateText).toBe(`${month} 2024 – ${month} 2024`);
    }

    application.resume.skillsPosition = "after-summary";
    expect(resolveResume(application).sections[0]?.kind).toBe("skills");
    application.resume.skillsPosition = "end";
    expect(resolveResume(application).sections.at(-1)?.kind).toBe("skills");
    delete application.resume.skillsPosition;
    expect(resolveResume(application).sections[1]?.kind).toBe("skills");
  });

  test("renders location and certification issue/expiry dates", async () => {
    const application = await fixture("../examples/dense-application.json");
    application.resume.sections[0]!.items[0]!.location = "Seattle, WA";
    const experience = resolveResume(application).sections.find((section) => section.kind === "experience");
    if (experience === undefined || experience.kind === "skills") throw new Error("Missing experience section.");
    expect(experience.entries[0]?.urlLabel).toBe("Northstar Systems, Seattle, WA");
    expect(experience.entries[0]?.detail).toBe("");

    const certificationSection = application.resume.sections.find((section) => section.kind === "certifications");
    if (certificationSection === undefined) throw new Error("Missing certification section.");
    const certification = certificationSection.items[0]!;
    certification.expires = "2027-06";
    delete certification.end;
    const resolved = resolveResume(application).sections.find((section) => section.kind === "certifications");
    if (resolved === undefined || resolved.kind === "skills") throw new Error("Missing resolved certification section.");
    expect(resolved.entries[0]?.dateText).toBe("Issued Feb 2023 · Expires Jun 2027");
    delete certification.expires;
    const issuedOnly = resolveResume(application).sections.find((section) => section.kind === "certifications");
    if (issuedOnly === undefined || issuedOnly.kind === "skills") throw new Error("Missing resolved certification section.");
    expect(issuedOnly.entries[0]?.dateText).toBe("Issued Feb 2023");
  });
});
