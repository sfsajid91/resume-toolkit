import { createHash } from "node:crypto";
import { readFile, link, symlink, mkdtemp, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { describe, expect, test } from "bun:test";
import { loadSnapshot, MAX_INPUT_BYTES, pathsAlias } from "./io.ts";
import { applicationSchema, generateJsonSchema, type Application } from "./schema.ts";
import { validateApplication } from "./validate.ts";

const fixturePath = new URL("../examples/application.json", import.meta.url);
const fixtureText = await readFile(fixturePath, "utf8");

function fixture(): Application {
  return applicationSchema.parse(JSON.parse(fixtureText) as unknown);
}

describe("application contract and validation", () => {
  test("accepts the synthetic fixture and hashes the exact input bytes", async () => {
    const result = validateApplication(fixture());
    expect(result.status).toBe("valid");
    expect(result.evidenceLinkage.status).toBe("complete");
    expect(result.issues).toEqual([]);

    const bytes = await readFile(fixturePath);
    const loaded = await loadSnapshot(fixturePath.pathname);
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) throw new Error("Expected the fixture to load.");
    expect(loaded.inputHash).toBe(`sha256:${createHash("sha256").update(bytes).digest("hex")}`);
  });

  test("rejects unknown keys, unsupported versions, and whitespace-only strings at exact pointers", () => {
    const unknown = fixture() as unknown as Record<string, unknown>;
    unknown["bad/key~"] = true;
    expect(validateApplication(unknown).issues).toContainEqual(expect.objectContaining({
      path: "/bad~1key~0",
      code: "schema.unknown_key",
    }));

    const version = fixture() as unknown as Record<string, unknown>;
    version.schemaVersion = 2;
    expect(validateApplication(version).issues).toContainEqual(expect.objectContaining({
      path: "/schemaVersion",
      code: "schema.invalid_value",
    }));

    const blank = fixture();
    blank.resume.basics.name = " \t ";
    expect(validateApplication(blank).issues).toContainEqual(expect.objectContaining({
      path: "/resume/basics/name",
      code: "schema.invalid_format",
    }));
  });

  test("enforces aggregate claim and entry limits", () => {
    const tooManyClaims = fixture();
    tooManyClaims.resume.summary = Array.from({ length: 100 }, (_, index) => ({
      id: `summary-${index}`,
      text: "Summary claim",
      evidenceIds: [],
    }));
    expect(validateApplication(tooManyClaims).issues).toContainEqual(expect.objectContaining({
      path: "/resume",
      code: "schema.constraint",
    }));

    const tooManyEntries = fixture();
    const makeEntry = (index: number) => ({
      id: `entry-${index}`,
      name: `Company ${index}`,
      title: "Engineer",
      start: "2025-01",
      bullets: [],
    });
    tooManyEntries.resume.sections = [
      { kind: "experience", items: Array.from({ length: 51 }, (_, index) => makeEntry(index)) },
      { kind: "projects", items: Array.from({ length: 50 }, (_, index) => makeEntry(index + 51)) },
    ];
    tooManyEntries.evidence = [];
    expect(validateApplication(tooManyEntries).issues).toContainEqual(expect.objectContaining({
      path: "/resume/sections",
      code: "schema.constraint",
    }));
  });

  test("rejects invalid months and inverted date ranges", () => {
    const invalidMonth = fixture();
    invalidMonth.resume.sections[0]!.items[0]!.start = "2025-13";
    expect(validateApplication(invalidMonth).issues).toContainEqual(expect.objectContaining({
      path: "/resume/sections/0/items/0/start",
      code: "date.invalid_month",
    }));

    const trailingNewline = fixture();
    trailingNewline.resume.sections[0]!.items[0]!.start = "2025-01\n";
    expect(validateApplication(trailingNewline).issues).toContainEqual(expect.objectContaining({
      path: "/resume/sections/0/items/0/start",
      code: "date.invalid_month",
    }));

    const inverted = fixture();
    inverted.resume.sections[0]!.items[0]!.start = "2026-01";
    inverted.resume.sections[0]!.items[0]!.end = "2025-12";
    expect(validateApplication(inverted).issues).toContainEqual(expect.objectContaining({
      path: "/resume/sections/0/items/0/end",
      code: "date.inverted_range",
    }));
  });

  test("enforces kind-specific entry fields", () => {
    const experience = fixture();
    delete experience.resume.sections[0]!.items[0]!.title;
    delete experience.resume.sections[0]!.items[0]!.start;
    const experienceIssues = validateApplication(experience).issues;
    expect(experienceIssues).toContainEqual(expect.objectContaining({
      path: "/resume/sections/0/items/0/title",
      code: "entry.title_required",
    }));
    expect(experienceIssues).toContainEqual(expect.objectContaining({
      path: "/resume/sections/0/items/0/start",
      code: "entry.start_required",
    }));

    const education = fixture();
    education.resume.sections.push({ kind: "education", items: [{ id: "edu-one", name: "Example University", bullets: [] }] });
    expect(validateApplication(education).issues).toContainEqual(expect.objectContaining({
      path: "/resume/sections/1/items/0/title",
      code: "entry.title_required",
    }));

    const certification = fixture();
    certification.resume.sections.push({ kind: "certifications", items: [{ id: "cert-one", name: "Cloud Credential", bullets: [] }] });
    expect(validateApplication(certification).issues).toContainEqual(expect.objectContaining({
      path: "/resume/sections/1/items/0/issuer",
      code: "entry.issuer_required",
    }));
  });

  test("rejects unsafe URLs and validates email separately", () => {
    for (const [url, code] of [["javascript:alert(1)", "url.unsafe_scheme"], ["file:///etc/passwd", "url.unsafe_scheme"]] as const) {
      const application = fixture();
      application.resume.basics.links = [{ label: "unsafe", url }];
      expect(validateApplication(application).issues).toContainEqual(expect.objectContaining({
        path: "/resume/basics/links/0/url",
        code,
      }));
    }

    const badEmail = fixture();
    badEmail.resume.basics.email = "not-an-email";
    expect(validateApplication(badEmail).issues).toContainEqual(expect.objectContaining({
      path: "/resume/basics/email",
      code: "email.invalid",
    }));
  });

  test("rejects duplicate IDs, duplicate references, and unknown evidence IDs", () => {
    const duplicateClaim = fixture();
    duplicateClaim.resume.summary = [{ id: "claim-cache", text: "Summary", evidenceIds: ["fact-cache"] }];
    expect(validateApplication(duplicateClaim).issues).toContainEqual(expect.objectContaining({
      path: "/resume/sections/0/items/0/bullets/0/id",
      code: "claim.duplicate_id",
      relatedIds: ["claim-cache"],
    }));

    const duplicateReference = fixture();
    duplicateReference.resume.sections[0]!.items[0]!.bullets[0]!.evidenceIds = ["fact-cache", "fact-cache"];
    expect(validateApplication(duplicateReference).issues).toContainEqual(expect.objectContaining({
      path: "/resume/sections/0/items/0/bullets/0/evidenceIds/1",
      code: "evidence.duplicate_reference",
    }));

    const unknownEvidence = fixture();
    unknownEvidence.resume.sections[0]!.items[0]!.bullets[0]!.evidenceIds = ["does-not-exist"];
    expect(validateApplication(unknownEvidence).issues).toContainEqual(expect.objectContaining({
      path: "/resume/sections/0/items/0/bullets/0/evidenceIds/0",
      code: "evidence.unknown_reference",
    }));
  });
  test("enforces uniqueness in entry, skill, evidence, requirement, and section namespaces", () => {
    const duplicateEntry = fixture();
    duplicateEntry.resume.sections.push({ kind: "projects", items: [{ id: "exp-api", name: "Project", bullets: [] }] });
    expect(validateApplication(duplicateEntry).issues).toContainEqual(expect.objectContaining({
      path: "/resume/sections/1/items/0/id",
      code: "entry.duplicate_id",
    }));

    const duplicateSkill = fixture();
    duplicateSkill.resume.skills.push({ id: "skill-ts", label: "TypeScript", evidenceIds: ["fact-cache"] });
    expect(validateApplication(duplicateSkill).issues).toContainEqual(expect.objectContaining({
      path: "/resume/skills/1/id",
      code: "skill.duplicate_id",
    }));

    const duplicateEvidence = fixture();
    duplicateEvidence.evidence!.push(structuredClone(duplicateEvidence.evidence![0]!));
    expect(validateApplication(duplicateEvidence).issues).toContainEqual(expect.objectContaining({
      path: "/evidence/1/id",
      code: "evidence.duplicate_id",
    }));

    const duplicateRequirement = fixture();
    duplicateRequirement.job!.requirements.push(structuredClone(duplicateRequirement.job!.requirements[0]!));
    expect(validateApplication(duplicateRequirement).issues).toContainEqual(expect.objectContaining({
      path: "/job/requirements/2/id",
      code: "requirement.duplicate_id",
    }));

    const duplicateSection = fixture();
    duplicateSection.resume.sections.push({ kind: "experience", items: [] });
    expect(validateApplication(duplicateSection).issues).toContainEqual(expect.objectContaining({
      path: "/resume/sections/1/kind",
      code: "section.duplicate_kind",
    }));
  });

  test("rejects entry bullets linked to evidence owned by another entry", () => {
    const application = fixture();
    application.resume.sections.push({
      kind: "projects",
      items: [{
        id: "project-one",
        name: "Project One",
        bullets: [{ id: "claim-other", text: "Built an API.", evidenceIds: ["fact-cache"] }],
      }],
    });
    expect(validateApplication(application).issues).toContainEqual(expect.objectContaining({
      path: "/resume/sections/1/items/0/bullets/0/evidenceIds/0",
      code: "evidence.wrong_entry",
      relatedIds: ["fact-cache", "project-one", "exp-api"],
    }));
  });

  test("requires requirement quotes to match exact job text", () => {
    const application = fixture();
    application.job!.requirements[0]!.quote = "Production TypeScript API experience";
    expect(validateApplication(application).issues).toContainEqual(expect.objectContaining({
      path: "/job/requirements/0/quote",
      code: "job.quote_not_found",
    }));
  });

  test("reports absent, empty, and unconfirmed evidence without failing validation", () => {
    const absent = fixture();
    delete absent.evidence;
    const absentResult = validateApplication(absent);
    expect(absentResult.status).toBe("valid");
    expect(absentResult.evidenceLinkage.status).toBe("unavailable");
    expect(absentResult.issues).toContainEqual(expect.objectContaining({
      path: "/evidence",
      code: "evidence.unavailable",
      severity: "warning",
    }));

    const emptyRefs = fixture();
    emptyRefs.resume.sections[0]!.items[0]!.bullets[0]!.evidenceIds = [];
    const emptyResult = validateApplication(emptyRefs);
    expect(emptyResult.status).toBe("valid");
    expect(emptyResult.evidenceLinkage.status).toBe("incomplete");
    expect(emptyResult.issues).toContainEqual(expect.objectContaining({ code: "evidence.empty_references", severity: "warning" }));

    const unconfirmed = fixture();
    unconfirmed.evidence![0]!.confirmedByUser = false;
    const unconfirmedResult = validateApplication(unconfirmed);
    expect(unconfirmedResult.status).toBe("valid");
    expect(unconfirmedResult.evidenceLinkage.status).toBe("unconfirmed");
    expect(unconfirmedResult.evidenceLinkage.status).not.toBe("verified");
    expect(unconfirmedResult.issues).toContainEqual(expect.objectContaining({ code: "evidence.unconfirmed", severity: "warning" }));
  });

  test("accepts optional headline and skill categories but rejects blank values", () => {
    const withOptionalFields = fixture();
    withOptionalFields.resume.basics.headline = "Senior Engineer";
    withOptionalFields.resume.skills[0]!.category = "Languages";
    expect(applicationSchema.safeParse(withOptionalFields).success).toBe(true);

    const blankHeadline = fixture();
    blankHeadline.resume.basics.headline = " ";
    expect(applicationSchema.safeParse(blankHeadline).success).toBe(false);

    const blankCategory = fixture();
    blankCategory.resume.skills[0]!.category = " ";
    expect(applicationSchema.safeParse(blankCategory).success).toBe(false);
  });

  test("detects missing resume content and exposes schema generation", () => {
    const application = fixture();
    application.resume.sections = [];
    application.resume.skills = [];
    expect(validateApplication(application).issues).toContainEqual(expect.objectContaining({
      path: "/resume",
      code: "resume.content_required",
    }));

    const generated = JSON.stringify(generateJsonSchema("application"));
    expect(generated).toContain('"additionalProperties":false');
    expect(generated).toContain('"maxLength":4000');
    expect(generated).toContain('"headline"');
    expect(generated).toContain('"category"');
  });
});

describe("snapshot I/O", () => {
  test("rejects oversized files and detects symlink and hard-link aliases", async () => {
    const directory = await mkdtemp(join(dirname(fixturePath.pathname), ".resume-toolkit-"));
    try {
      const oversizedPath = join(directory, "oversized.json");
      await writeFile(oversizedPath, Buffer.alloc(MAX_INPUT_BYTES + 1, 0x20));
      const oversized = await loadSnapshot(oversizedPath);
      expect(oversized).toEqual({
        ok: false,
        error: { code: "input_too_large", message: "Input exceeds the 2 MiB limit." },
      });

      const aliasPath = join(directory, "fixture-alias.json");
      await symlink(fixturePath, aliasPath);
      expect(await pathsAlias(fixturePath.pathname, aliasPath)).toBe(true);
      const hardLinkPath = join(directory, "fixture-hard-link.json");
      await link(fixturePath, hardLinkPath);
      expect(await pathsAlias(fixturePath.pathname, hardLinkPath)).toBe(true);
      expect(await pathsAlias(fixturePath.pathname, join(directory, "future-output.json"))).toBe(false);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
