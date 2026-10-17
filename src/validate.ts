import { z } from "zod";
import {
  applicationSchema,
  type Application,
  type EvidenceLinkage,
  type ValidationIssue,
  type ValidationResult,
} from "./schema.ts";
import { lintApplication } from "./lint.ts";

type Evidence = NonNullable<Application["evidence"]>[number];
type IdLocation = { readonly id: string; readonly path: string };
type MutableLinkage = {
  missingEvidence: number;
  emptyReferences: number;
  unconfirmedEvidence: number;
  incomplete: boolean;
};

const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f-\u009f]/u;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u;

export function toJsonPointer(path: readonly PropertyKey[]): string {
  if (path.length === 0) return "";
  return `/${path.map((part) => String(part).replaceAll("~", "~0").replaceAll("/", "~1")).join("/")}`;
}

export function validateApplication(value: unknown): ValidationResult {
  const parsed = applicationSchema.safeParse(value);
  if (!parsed.success) {
    return {
      status: "invalid",
      evidenceLinkage: {
        status: "not_assessed",
        missingEvidence: 0,
        emptyReferences: 0,
        unconfirmedEvidence: 0,
      },
      issues: schemaIssues(parsed.error),
    };
  }

  const issues: ValidationIssue[] = [];
  const linkage: MutableLinkage = {
    missingEvidence: 0,
    emptyReferences: 0,
    unconfirmedEvidence: 0,
    incomplete: false,
  };
  const application = parsed.data;
  const entries: IdLocation[] = [];
  const claims: IdLocation[] = application.resume.summary.map((claim, index) => ({
    id: claim.id,
    path: `/resume/summary/${index}/id`,
  }));

  for (const [sectionIndex, section] of application.resume.sections.entries()) {
    for (const [entryIndex, entry] of section.items.entries()) {
      const path = `/resume/sections/${sectionIndex}/items/${entryIndex}`;
      entries.push({ id: entry.id, path: `${path}/id` });
      for (const [claimIndex, claim] of entry.bullets.entries()) {
        claims.push({ id: claim.id, path: `${path}/bullets/${claimIndex}/id` });
      }
    }
  }

  checkUniqueIds(entries, "entry.duplicate_id", issues);
  checkUniqueIds(claims, "claim.duplicate_id", issues);
  checkUniqueIds(
    application.resume.skills.map((skill, index) => ({ id: skill.id, path: `/resume/skills/${index}/id` })),
    "skill.duplicate_id",
    issues,
  );
  checkUniqueIds(
    (application.evidence ?? []).map((evidence, index) => ({ id: evidence.id, path: `/evidence/${index}/id` })),
    "evidence.duplicate_id",
    issues,
  );
  checkUniqueIds(
    (application.job?.requirements ?? []).map((requirement, index) => ({ id: requirement.id, path: `/job/requirements/${index}/id` })),
    "requirement.duplicate_id",
    issues,
  );
  checkUniqueValues(
    application.resume.sections.map((section, index) => ({ value: section.kind, path: `/resume/sections/${index}/kind` })),
    "section.duplicate_kind",
    issues,
  );

  if (entries.length === 0 && application.resume.skills.length === 0) {
    addIssue(issues, "/resume", "resume.content_required", "error", "Resume must contain at least one entry or skill.");
  }

  const entryIds = new Set(entries.map((entry) => entry.id));
  if (entryIds.size !== entries.length) linkage.incomplete = true;
  const evidenceById = new Map<string, Evidence>();
  for (const [index, evidence] of (application.evidence ?? []).entries()) {
    if (evidenceById.has(evidence.id)) {
      linkage.incomplete = true;
    } else {
      evidenceById.set(evidence.id, evidence);
    }
    if (!entryIds.has(evidence.entryId)) {
      addIssue(issues, `/evidence/${index}/entryId`, "evidence.unknown_entry", "error", "Evidence entryId does not identify a resume entry.", [evidence.entryId]);
      linkage.incomplete = true;
    }
  }

  validateBasics(application, issues);
  for (const [sectionIndex, section] of application.resume.sections.entries()) {
    for (const [entryIndex, entry] of section.items.entries()) {
      validateEntry(section.kind, entry, sectionIndex, entryIndex, issues);
      for (const [claimIndex, claim] of entry.bullets.entries()) {
        validateEvidenceReferences(
          claim.evidenceIds,
          `/resume/sections/${sectionIndex}/items/${entryIndex}/bullets/${claimIndex}/evidenceIds`,
          entry.id,
          application.evidence !== undefined,
          evidenceById,
          issues,
          linkage,
        );
      }
    }
  }

  for (const [claimIndex, claim] of application.resume.summary.entries()) {
    validateEvidenceReferences(
      claim.evidenceIds,
      `/resume/summary/${claimIndex}/evidenceIds`,
      undefined,
      application.evidence !== undefined,
      evidenceById,
      issues,
      linkage,
    );
  }
  for (const [skillIndex, skill] of application.resume.skills.entries()) {
    validateEvidenceReferences(
      skill.evidenceIds,
      `/resume/skills/${skillIndex}/evidenceIds`,
      undefined,
      application.evidence !== undefined,
      evidenceById,
      issues,
      linkage,
    );
  }

  if (application.evidence === undefined) {
    addIssue(issues, "/evidence", "evidence.unavailable", "warning", "Evidence records were not supplied; linkage cannot be assessed.");
  }
  if (application.job !== undefined) validateJob(application.job, issues);
  issues.push(...lintApplication(application));
  return {
    status: issues.some((issue) => issue.severity === "error") ? "invalid" : "valid",
    evidenceLinkage: getEvidenceLinkage(application, linkage),
    issues,
  };
}

function schemaIssues(error: z.ZodError): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  for (const issue of error.issues) {
    if (issue.code === "unrecognized_keys") {
      for (const key of issue.keys) {
        addIssue(issues, toJsonPointer([...issue.path, key]), "schema.unknown_key", "error", "Unknown field.");
      }
      continue;
    }

    let code = "schema.invalid_value";
    if (issue.code === "too_small") code = "schema.too_small";
    else if (issue.code === "too_big") code = "schema.too_big";
    else if (issue.code === "invalid_format") code = "schema.invalid_format";
    else if (issue.code === "custom") code = "schema.constraint";

    addIssue(issues, toJsonPointer(issue.path), code, "error", issue.message);
  }
  return issues;
}

function checkUniqueIds(locations: readonly IdLocation[], code: string, issues: ValidationIssue[]): void {
  const seen = new Set<string>();
  for (const location of locations) {
    if (seen.has(location.id)) {
      addIssue(issues, location.path, code, "error", "Identifier must be unique in its namespace.", [location.id]);
    } else {
      seen.add(location.id);
    }
  }
}

function checkUniqueValues(
  locations: readonly { readonly value: string; readonly path: string }[],
  code: string,
  issues: ValidationIssue[],
): void {
  const seen = new Set<string>();
  for (const location of locations) {
    if (seen.has(location.value)) {
      addIssue(issues, location.path, code, "error", "Value must be unique.", [location.value]);
    } else {
      seen.add(location.value);
    }
  }
}

function validateBasics(application: Application, issues: ValidationIssue[]): void {
  const email = application.resume.basics.email;
  if (email !== undefined && (email.trim() !== email || !EMAIL_PATTERN.test(email))) {
    addIssue(issues, "/resume/basics/email", "email.invalid", "error", "Email address has an invalid format.");
  }
  for (const [index, link] of application.resume.basics.links.entries()) {
    validateUrl(link.url, `/resume/basics/links/${index}/url`, issues);
  }
}

function validateEntry(
  kind: Application["resume"]["sections"][number]["kind"],
  entry: Application["resume"]["sections"][number]["items"][number],
  sectionIndex: number,
  entryIndex: number,
  issues: ValidationIssue[],
): void {
  const path = `/resume/sections/${sectionIndex}/items/${entryIndex}`;
  if ((kind === "experience" || kind === "education") && entry.title === undefined) {
    addIssue(issues, `${path}/title`, "entry.title_required", "error", `${kind} entries require a title.`, [entry.id]);
  }
  if (kind === "experience" && entry.start === undefined) {
    addIssue(issues, `${path}/start`, "entry.start_required", "error", "Experience entries require a start month.", [entry.id]);
  }
  if (kind === "certifications" && entry.issuer === undefined) {
    addIssue(issues, `${path}/issuer`, "entry.issuer_required", "error", "Certification entries require an issuer.", [entry.id]);
  }
  if (kind !== "certifications" && entry.expires !== undefined) {
    addIssue(issues, `${path}/expires`, "entry.expires_certification_only", "error", "Expiry dates are only valid for certifications.", [entry.id]);
  }

  if (entry.start !== undefined && !isValidMonth(entry.start)) {
    addIssue(issues, `${path}/start`, "date.invalid_month", "error", "Date must be a calendar-valid YYYY-MM month.", [entry.id]);
  }
  if (typeof entry.end === "string" && !isValidMonth(entry.end)) {
    addIssue(issues, `${path}/end`, "date.invalid_month", "error", "Date must be a calendar-valid YYYY-MM month.", [entry.id]);
  }
  if (entry.expires !== undefined && !isValidMonth(entry.expires)) {
    addIssue(issues, `${path}/expires`, "date.invalid_month", "error", "Date must be a calendar-valid YYYY-MM month.", [entry.id]);
  }
  if (entry.start !== undefined && typeof entry.end === "string" && isValidMonth(entry.start) && isValidMonth(entry.end) && entry.start > entry.end) {
    addIssue(issues, `${path}/end`, "date.inverted_range", "error", "Entry end month must not precede its start month.", [entry.id]);
  }
  if (entry.url !== undefined) validateUrl(entry.url, `${path}/url`, issues, [entry.id]);
}

function isValidMonth(value: string): boolean {
  if (value.length !== 7) return false;
  const parts = /^(\d{4})-(\d{2})$/u.exec(value);
  if (parts === null) return false;
  const year = Number(parts[1]);
  const month = Number(parts[2]);
  return year > 0 && month >= 1 && month <= 12;
}

function validateUrl(url: string, path: string, issues: ValidationIssue[], relatedIds: readonly string[] = []): void {
  if (CONTROL_CHARACTERS.test(url) || /\s/u.test(url)) {
    addIssue(issues, path, "url.invalid", "error", "URL must not contain whitespace or control characters.", relatedIds);
    return;
  }

  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      addIssue(issues, path, "url.unsafe_scheme", "error", "URL scheme must be http or https.", relatedIds);
    }
  } catch {
    addIssue(issues, path, "url.invalid", "error", "URL must be an absolute HTTP or HTTPS URL.", relatedIds);
  }
}

function validateEvidenceReferences(
  evidenceIds: readonly string[],
  path: string,
  ownerEntryId: string | undefined,
  evidencePresent: boolean,
  evidenceById: ReadonlyMap<string, Evidence>,
  issues: ValidationIssue[],
  linkage: MutableLinkage,
): void {
  if (evidenceIds.length === 0) {
    addIssue(issues, path, "evidence.empty_references", "warning", "No evidence references were supplied.");
    linkage.emptyReferences += 1;
    linkage.incomplete = true;
    return;
  }
  const seen = new Set<string>();
  for (const [index, evidenceId] of evidenceIds.entries()) {
    const referencePath = `${path}/${index}`;
    if (seen.has(evidenceId)) {
      addIssue(issues, referencePath, "evidence.duplicate_reference", "error", "Evidence reference must be unique within the claim or skill.", [evidenceId]);
      linkage.incomplete = true;
    }
    seen.add(evidenceId);
    if (!evidencePresent) continue;

    const evidence = evidenceById.get(evidenceId);
    if (evidence === undefined) {
      addIssue(issues, referencePath, "evidence.unknown_reference", "error", "Referenced evidence ID does not exist.", [evidenceId]);
      linkage.missingEvidence += 1;
      linkage.incomplete = true;
      continue;
    }
    if (ownerEntryId !== undefined && evidence.entryId !== ownerEntryId) {
      addIssue(issues, referencePath, "evidence.wrong_entry", "error", "Entry bullets may reference only evidence owned by that entry.", [evidenceId, ownerEntryId, evidence.entryId]);
      linkage.incomplete = true;
    }
    if (!evidence.confirmedByUser) {
      addIssue(issues, referencePath, "evidence.unconfirmed", "warning", "Referenced evidence has not been confirmed by the user.", [evidenceId]);
      linkage.unconfirmedEvidence += 1;
    }
  }
}

function validateJob(job: NonNullable<Application["job"]>, issues: ValidationIssue[]): void {
  if (job.sourceUrl !== undefined) validateUrl(job.sourceUrl, "/job/sourceUrl", issues);
  for (const [index, requirement] of job.requirements.entries()) {
    if (!job.rawText.includes(requirement.quote)) {
      addIssue(issues, `/job/requirements/${index}/quote`, "job.quote_not_found", "error", "Requirement quote must be an exact substring of job.rawText.", [requirement.id]);
    }
  }
}

function getEvidenceLinkage(application: Application, linkage: MutableLinkage): EvidenceLinkage {
  if (application.evidence === undefined) {
    return { status: "unavailable", ...linkageCounts(linkage) };
  }
  if (linkage.incomplete) return { status: "incomplete", ...linkageCounts(linkage) };
  if (linkage.unconfirmedEvidence > 0) return { status: "unconfirmed", ...linkageCounts(linkage) };
  return { status: "complete", ...linkageCounts(linkage) };
}

function linkageCounts(linkage: MutableLinkage): Pick<EvidenceLinkage, "missingEvidence" | "emptyReferences" | "unconfirmedEvidence"> {
  return {
    missingEvidence: linkage.missingEvidence,
    emptyReferences: linkage.emptyReferences,
    unconfirmedEvidence: linkage.unconfirmedEvidence,
  };
}

function addIssue(
  issues: ValidationIssue[],
  path: string,
  code: string,
  severity: ValidationIssue["severity"],
  message: string,
  relatedIds: readonly string[] = [],
): void {
  issues.push({ path, code, severity, message, relatedIds });
}
