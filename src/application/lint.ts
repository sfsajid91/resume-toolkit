import type { Application, ValidationIssue } from "./schema.ts";
import {
 BANNED_TERMS,
 DOMAIN_LIKE_SKILL_LABELS,
 REPEATED_THEMES,
 SKILLS_DOMAIN_LABELS,
 TECHNOLOGY_TERMS,
} from "./lint-terms.ts";

type Section = Application["resume"]["sections"][number];
type Entry = Section["items"][number];
type ClaimTarget = {
 readonly id: string;
 readonly text: string;
 readonly path: string;
 readonly entryId?: string;
};
type EntryTarget = {
 readonly entry: Entry;
 readonly kind: Section["kind"];
 readonly path: string;
};
type TextTarget = { readonly text: string; readonly path: string; readonly id?: string };

function pointer(parts: readonly (string | number)[]): string {
 return `/${parts.map((part) => String(part).replaceAll("~", "~0").replaceAll("/", "~1")).join("/")}`;
}

function makeIssue(code: string, path: string, message: string, relatedIds: readonly string[] = []): ValidationIssue {
 return { path, code: `lint.${code}`, severity: "warning", message, relatedIds: [...new Set(relatedIds)] };
}

function entryTargets(application: Application): EntryTarget[] {
 return application.resume.sections.flatMap((section, sectionIndex) => section.items.map((entry, entryIndex) => ({
  entry,
  kind: section.kind,
  path: pointer(["resume", "sections", sectionIndex, "items", entryIndex]),
 })));
}

function bulletTargets(application: Application): ClaimTarget[] {
 return application.resume.sections.flatMap((section, sectionIndex) => section.items.flatMap((entry, entryIndex) =>
  entry.bullets.map((bullet, bulletIndex) => ({
   id: bullet.id,
   text: bullet.text,
   entryId: entry.id,
   path: pointer(["resume", "sections", sectionIndex, "items", entryIndex, "bullets", bulletIndex]),
  })),
 ));
}

function claimTargets(application: Application): ClaimTarget[] {
 return [
  ...application.resume.summary.map((claim, index) => ({
   id: claim.id,
   text: claim.text,
   path: pointer(["resume", "summary", index]),
  })),
  ...bulletTargets(application),
 ];
}

function textTargets(application: Application): TextTarget[] {
 const entries = entryTargets(application);
 return [
  ...claimTargets(application),
  ...(application.resume.basics.headline === undefined ? [] : [{
   text: application.resume.basics.headline,
   path: "/resume/basics/headline",
  }]),
  ...application.resume.basics.links.map((link, index) => ({
   text: link.label,
   path: pointer(["resume", "basics", "links", index, "label"]),
  })),
  ...application.resume.skills.flatMap((skill, index) => [
   { text: skill.label, path: pointer(["resume", "skills", index, "label"]), id: skill.id },
   ...(skill.category === undefined ? [] : [{
    text: skill.category,
    path: pointer(["resume", "skills", index, "category"]),
    id: skill.id,
   }]),
  ]),
  ...entries.flatMap(({ entry, path }) => [
   { text: entry.name, path: `${path}/name`, id: entry.id },
   ...(entry.title === undefined ? [] : [{ text: entry.title, path: `${path}/title`, id: entry.id }]),
   ...(entry.issuer === undefined ? [] : [{ text: entry.issuer, path: `${path}/issuer`, id: entry.id }]),
   ...(entry.location === undefined ? [] : [{ text: entry.location, path: `${path}/location`, id: entry.id }]),
  ]),
 ];
}

function escapeRegex(value: string): string {
 return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}

function termPattern(term: string): RegExp {
 const phrase = term.split(/\s+/u).map(escapeRegex).join("\\s+");
 return new RegExp(`(^|[^\\p{L}\\p{N}])${phrase}(?=$|[^\\p{L}\\p{N}])`, "iu");
}
const TECHNOLOGY_PATTERNS = TECHNOLOGY_TERMS.map(termPattern);

function hasTechnologyTerm(text: string): boolean {
 for (const pattern of TECHNOLOGY_PATTERNS) {
  if (pattern.test(text)) return true;
 }
 return false;
}

function lintBannedWord(application: Application): ValidationIssue[] {
 const issues: ValidationIssue[] = [];
 for (const target of textTargets(application)) {
  for (const term of BANNED_TERMS) {
   if (termPattern(term).test(target.text)) {
    issues.push(makeIssue("banned_word", target.path, `Contains banned term: ${term}.`, target.id === undefined ? [] : [target.id]));
   }
  }
 }
 return issues;
}

function lintDash(application: Application): ValidationIssue[] {
 const prose: TextTarget[] = [
  ...textTargets(application),
  { text: application.resume.basics.name, path: "/resume/basics/name" },
  ...(application.resume.basics.headline === undefined ? [] : [{
   text: application.resume.basics.headline,
   path: "/resume/basics/headline",
  }]),
  ...(application.resume.basics.location === undefined ? [] : [{
   text: application.resume.basics.location,
   path: "/resume/basics/location",
  }]),
  ...application.resume.basics.links.map((link, index) => ({
   text: link.label,
   path: pointer(["resume", "basics", "links", index, "label"]),
  })),
 ];
 return prose
  .filter(({ text }) => /[—–]/u.test(text))
  .map(({ path, id }) => makeIssue("dash", path, "Avoid em and en dashes in prose.", id === undefined ? [] : [id]));
}

function lintWithoutTail(application: Application): ValidationIssue[] {
 const matches = claimTargets(application).filter(({ text }) => /\bwithout\s+[^.!?]+[.!?]?\s*$/iu.test(text));
 return matches.slice(1).map(({ id, path }) => makeIssue(
  "without_tail", path, "Use at most one trailing without-clause per resume.", [id],
 ));
}

function lintRuleOfThree(application: Application): ValidationIssue[] {
 const listOfThree = /(?:^|[,;])\s*[^,;.!?]+,\s*[^,;.!?]+,\s*(?:(?:and|or)\s+)?[^,;.!?]+/iu;
 const matches = claimTargets(application).filter(({ text }) => listOfThree.test(text));
 return matches.slice(2).map(({ id, path }) => makeIssue(
  "rule_of_three", path, "Limit rule-of-three lists to two per resume.", [id],
 ));
}

function lintWeakOpener(application: Application): ValidationIssue[] {
 const weak = /^(?:Partnered with|Collaborated with|Worked with|Coordinated|Contributed to)\b/iu;
 const trueCoordinationScope = /^Coordinated\s+(?:a\s+)?(?:cross-team|multi-team)\b/iu;
 return claimTargets(application)
  .filter(({ text }) => weak.test(text) && !trueCoordinationScope.test(text))
  .map(({ id, path }) => makeIssue("weak_opener", path, "Lead with the concrete action and scope.", [id]));
}

function wordCount(text: string): number {
 return text.trim().split(/\s+/u).filter(Boolean).length;
}

function lintBulletLength(application: Application): ValidationIssue[] {
 return bulletTargets(application)
  .filter(({ text }) => wordCount(text) < 12 || wordCount(text) > 30)
  .map(({ id, path }) => makeIssue("bullet_length", path, "Bullets should contain 12–30 words.", [id]));
}

function monthIndex(value: string | null | undefined): number | undefined {
 if (value === null || value === undefined) return undefined;
 const match = /^(\d{4})-(\d{2})$/u.exec(value);
 if (match === null) return undefined;
 const year = Number(match[1]);
 const month = Number(match[2]);
 return year > 0 && month >= 1 && month <= 12 ? year * 12 + month - 1 : undefined;
}

function currentMonthIndex(): number {
 const now = new Date();
 return now.getFullYear() * 12 + now.getMonth();
}

function lintBulletCount(application: Application, now: number): ValidationIssue[] {
 const entries = entryTargets(application);
 const experiences = entries.filter(({ kind }) => kind === "experience");
 let newest: EntryTarget | undefined;
 let newestStart = -Infinity;
 for (const target of experiences) {
  const start = monthIndex(target.entry.start);
  if (start !== undefined && start > newestStart) {
   newest = target;
   newestStart = start;
  }
 }

 const issues: ValidationIssue[] = [];
 for (const target of entries) {
  const count = target.entry.bullets.length;
  const end = monthIndex(target.entry.end);
  const isOld = target.entry.end !== null && end !== undefined && now - end >= 60;
  const tooMany = target.kind === "projects"
   ? count > 3
   : target === newest ? count > 5 : isOld && count > 3;
  if (tooMany) {
   issues.push(makeIssue(
    "bullet_count",
    `${target.path}/bullets`,
    "Entry has too many bullets.",
    [target.entry.id, ...target.entry.bullets.map(({ id }) => id)],
   ));
  }
 }
 return issues;
}

function firstWord(text: string): string {
 return text.trim().match(/^[\p{L}\p{N}]+/u)?.[0]?.toLocaleLowerCase() ?? "";
}

function lintOpenerRepeat(application: Application): ValidationIssue[] {
 const issues: ValidationIssue[] = [];
 for (const target of entryTargets(application)) {
  const bullets = target.entry.bullets;
  if (bullets.length < 2) continue;
  const openers = bullets.map(({ text }) => firstWord(text));
  let repeats = false;
  for (let index = 1; index < openers.length; index++) {
   if (openers[index] !== "" && openers[index] === openers[index - 1]) repeats = true;
  }
  const counts = new Map<string, number>();
  for (const opener of openers) {
   if (opener !== "") counts.set(opener, (counts.get(opener) ?? 0) + 1);
  }
  if ([...counts.values()].some((count) => count >= 2 && count / bullets.length > 0.3)) repeats = true;
  if (repeats) {
   issues.push(makeIssue(
    "opener_repeat",
    `${target.path}/bullets`,
    "Vary repeated bullet openers.",
    [target.entry.id, ...bullets.map(({ id }) => id)],
   ));
  }
 }
 return issues;
}


function tokens(text: string): Set<string> {
 return new Set(text.toLocaleLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []);
}

function lintDuplicateBullet(application: Application): ValidationIssue[] {
 const bullets = bulletTargets(application);
 const issues: ValidationIssue[] = [];
 for (let later = 0; later < bullets.length; later++) {
  const current = bullets[later]!;
  const currentTokens = tokens(current.text);
  for (let earlier = 0; earlier < later; earlier++) {
   const previous = bullets[earlier]!;
   if (current.entryId === previous.entryId) continue;
   const previousTokens = tokens(previous.text);
   const union = new Set([...currentTokens, ...previousTokens]);
   const common = [...currentTokens].filter((token) => previousTokens.has(token)).length;
   if (union.size > 0 && common / union.size > 0.6) {
    issues.push(makeIssue(
     "duplicate_bullet",
     current.path,
     "Bullet closely duplicates another entry.",
     [current.id, current.entryId!, previous.id, previous.entryId!],
    ));
   }
  }
 }
 return issues;
}

function lintRepeatedTheme(application: Application, themes: readonly string[]): ValidationIssue[] {
 const entries = entryTargets(application);
 const issues: ValidationIssue[] = [];
 for (const theme of themes) {
  const pattern = termPattern(theme);
  const hits = entries.filter(({ entry }) => entry.bullets.some(({ text }) => pattern.test(text)));
  if (hits.length < 3) continue;
  const relatedIds = hits.flatMap(({ entry }) => [
   entry.id,
   ...entry.bullets.filter(({ text }) => pattern.test(text)).map(({ id }) => id),
  ]);
  for (const hit of hits.slice(2)) {
   issues.push(makeIssue("repeated_theme", hit.path, `Theme “${theme}” appears across multiple entries.`, relatedIds));
  }
 }
 return issues;
}

const SUMMARY_BANNED_ADJECTIVES = [
 "seamless", "seamlessly", "robust", "robustly", "cutting-edge", "state-of-the-art", "dynamic", "dynamically",
 "results-driven", "passionate", "passionately", "detail-oriented", "team player", "thought leader", "fast-paced",
 "paradigm-shifting", "small", "dependable", "product-minded",
] as const;
const NUMBER_WORDS: Readonly<Record<string, number>> = {
 one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
 eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18,
 nineteen: 19, twenty: 20,
};
const NUMBER_WORD_PATTERNS = Object.keys(NUMBER_WORDS).map(termPattern);

function hasNumber(text: string): boolean {
 if (/\d/u.test(text)) return true;
 for (const pattern of NUMBER_WORD_PATTERNS) {
  if (pattern.test(text)) return true;
 }
 return false;
}


function yearsClaim(text: string): number | undefined {
 const numeric = /\b(\d+)\+?\s+years?\b/iu.exec(text);
 if (numeric !== null) return Number(numeric[1]);
 const words = /\b([a-z]+)\s+years?\b/iu.exec(text);
 if (words !== null) return NUMBER_WORDS[words[1]!.toLowerCase()];
 return /\b(?:a|one)\s+decade\b/iu.test(text) ? 10 : undefined;
}

function lintSummary(application: Application, now: number): ValidationIssue[] {
 const claims = application.resume.summary;
 const issues: ValidationIssue[] = [];
 if (claims.length > 2) {
  issues.push(makeIssue("summary", "/resume/summary", "Keep the summary to at most two claims.", claims.map(({ id }) => id)));
 }
 const adjectivePatterns = SUMMARY_BANNED_ADJECTIVES.map(termPattern);
 for (const [index, claim] of claims.entries()) {
  if (adjectivePatterns.some((pattern) => pattern.test(claim.text))) {
   issues.push(makeIssue("summary", pointer(["resume", "summary", index]), "Avoid generic or banned adjectives in the summary.", [claim.id]));
  }
 }
 const starts = entryTargets(application)
  .filter(({ kind }) => kind === "experience")
  .map(({ entry }) => monthIndex(entry.start))
  .filter((value): value is number => value !== undefined);
 if (starts.length === 0) return issues;
 const elapsedYears = Math.floor((now - Math.min(...starts)) / 12);
 for (const [index, claim] of claims.entries()) {
  const claimed = yearsClaim(claim.text);
  if (claimed !== undefined && claimed !== elapsedYears) {
   issues.push(makeIssue("summary", pointer(["resume", "summary", index]), "Years-of-experience claim does not match dated experience.", [claim.id]));
  }
 }
 return issues;
}

function lintSkillsThin(application: Application): ValidationIssue[] {
 const skills = application.resume.skills;
 const domainLabels = DOMAIN_LIKE_SKILL_LABELS.map((label) => label.toLocaleLowerCase());
 const vague = skills.filter(({ category, label }) =>
  domainLabels.includes(label.trim().toLocaleLowerCase())
  || (category !== undefined && domainLabels.includes(category.trim().toLocaleLowerCase())),
 );
 return vague.length > 0
  ? [makeIssue("skills_thin", "/resume/skills", "Replace domain-like labels with specific skills.", vague.map(({ id }) => id))]
  : [];
}


function intervalEnd(entry: Entry, now: number): number | undefined {
 if (entry.end === null) return now;
 return monthIndex(entry.end);
}

function lintDateOverlap(application: Application, now: number): ValidationIssue[] {
 const experiences = entryTargets(application).filter(({ kind }) => kind === "experience");
 const issues: ValidationIssue[] = [];
 for (let later = 0; later < experiences.length; later++) {
  const current = experiences[later]!;
  const currentStart = monthIndex(current.entry.start);
  const currentEnd = intervalEnd(current.entry, now);
  if (currentStart === undefined || currentEnd === undefined) continue;
  for (let earlier = 0; earlier < later; earlier++) {
   const previous = experiences[earlier]!;
   const previousStart = monthIndex(previous.entry.start);
   const previousEnd = intervalEnd(previous.entry, now);
   if (previousStart === undefined || previousEnd === undefined) continue;
   const overlap = Math.min(currentEnd, previousEnd) - Math.max(currentStart, previousStart) + 1;
   if (overlap > 3) {
    issues.push(makeIssue(
     "date_overlap",
     current.path,
     "Experience ranges overlap by more than three calendar months.",
     [previous.entry.id, current.entry.id],
    ));
   }
  }
 }
 return issues;
}

function lintCertExpired(application: Application, now: number): ValidationIssue[] {
 const issues: ValidationIssue[] = [];
 for (const target of entryTargets(application).filter(({ kind }) => kind === "certifications")) {
  const expiry = target.entry.expires ?? (typeof target.entry.end === "string" ? target.entry.end : undefined);
  const month = monthIndex(expiry);
  if (month !== undefined && month < now) {
   const field = target.entry.expires === undefined ? "end" : "expires";
   issues.push(makeIssue("cert_expired", `${target.path}/${field}`, "Certification has expired.", [target.entry.id]));
  }
 }
 return issues;
}

const HEDGE_PATTERNS: readonly RegExp[] = [
 /\bnot\s+confirmed\b/iu,
 /\bunconfirmed\b/iu,
 /\bno\s+[^,;.!?]{1,60}\bconfirmed\b/iu,
 /\bunverified\b/iu,
 /\bif\s+confirmed\b/iu,
 /\bprimarily\b/iu,
 /\bmostly\b/iu,
 /\bpartially\b/iu,
 /\bwith\s+some\b/iu,
 /\b(?:only\s+(?:a\s+)?prototype|prototype\s+only|just\s+(?:a\s+)?prototype|as\s+(?:a\s+)?prototype|prototype\s+(?:stage|phase|status|limitation)|limited\s+prototype)\b/iu,
 /\bprototype\s*(?:[,:;(-]\s*|\s+)(?:not\s+(?:in\s+)?production|unreleased|never\s+(?:deployed|released|shipped)|no\s+handover|limited\s+scope)/iu,
 /\bprototype\s+(?:with\s+no\s+handover|never\s+deployed|without\s+(?:a\s+)?production)\b/iu,
];

function lintHedgeText(application: Application): ValidationIssue[] {
 const issues: ValidationIssue[] = [];
 for (const target of claimTargets(application)) {
  if (HEDGE_PATTERNS.some((pattern) => pattern.test(target.text))) {
   issues.push(makeIssue(
    "hedge_text",
    target.path,
    "Caveats belong in the conversation or evidence, not resume text. Ask the user or omit the claim.",
    [target.id],
   ));
  }
 }
 return issues;
}

const TRANSACTION_PATTERN = /\b(?:paid|delivery|delivered\s+through|through\s+(?:fiverr|upwork|freelancer(?:\.com)?))\b/iu;

function lintTransactionBullet(application: Application): ValidationIssue[] {
 const issues: ValidationIssue[] = [];
 for (const target of bulletTargets(application)) {
  if (TRANSACTION_PATTERN.test(target.text) && !hasTechnologyTerm(target.text)) {
   issues.push(makeIssue(
    "transaction_bullet",
    target.path,
    "Describe the work and outcome rather than the transaction or marketplace delivery.",
    [target.id],
   ));
  }
 }
 return issues;
}

const VAGUE_VERB_OPENER = /^(?:Developed across|Published|Completed|Measured and trialed|Contributed)\b/iu;

function lintVagueVerb(application: Application): ValidationIssue[] {
 const issues: ValidationIssue[] = [];
 for (const target of bulletTargets(application)) {
  if (VAGUE_VERB_OPENER.test(target.text) && !hasTechnologyTerm(target.text) && !hasNumber(target.text)) {
   issues.push(makeIssue(
    "vague_verb",
    target.path,
    "Lead with a concrete action, technical tool, or quantified outcome.",
    [target.id],
   ));
  }
 }
 return issues;
}

function lintNoStack(application: Application): ValidationIssue[] {
 const issues: ValidationIssue[] = [];
 for (const target of entryTargets(application)) {
  if (target.kind !== "experience" && target.kind !== "projects") continue;
  const bulletsHaveTech = target.entry.bullets.some((b) => hasTechnologyTerm(b.text));
  const stack = "stack" in target.entry && Array.isArray(target.entry.stack) ? target.entry.stack : undefined;
  const stackHasTech = stack !== undefined && stack.some((item) => hasTechnologyTerm(item));
  if (!bulletsHaveTech && !stackHasTech) {
   issues.push(makeIssue(
    "no_stack",
    target.path,
    "Entry should reference at least one recognized tool or technology in its stack or bullets.",
    [target.entry.id],
   ));
  }
 }
 return issues;
}

function lintThinExperience(application: Application, now: number): ValidationIssue[] {
 const experiences = entryTargets(application).filter(({ kind }) => kind === "experience");
 let newest: EntryTarget | undefined;
 let newestStart = -Infinity;
 for (const target of experiences) {
  const start = monthIndex(target.entry.start);
  if (start !== undefined && start > newestStart) {
   newest = target;
   newestStart = start;
  }
 }
 if (newest === undefined) return [];
 const start = monthIndex(newest.entry.start);
 const end = newest.entry.end === null ? now : monthIndex(newest.entry.end);
 if (start === undefined || end === undefined) return [];
 const duration = end - start;
 if (duration > 6 && newest.entry.bullets.length < 3) {
  return [
   makeIssue(
    "thin_experience",
    `${newest.path}/bullets`,
    "Most recent role spanning more than 6 months should have at least 3 bullets.",
    [newest.entry.id, ...newest.entry.bullets.map((b) => b.id)],
   ),
  ];
 }
 return [];
}

function lintMissingContact(application: Application): ValidationIssue[] {
 const { email, phone } = application.resume.basics;
 const hasEmail = email !== undefined && email.trim().length > 0;
 const hasPhone = phone !== undefined && phone.trim().length > 0;
 if (!hasEmail && !hasPhone) {
  return [
   makeIssue(
    "missing_contact",
    "/resume/basics",
    "Basics should include at least an email or phone number.",
   ),
  ];
 }
 return [];
}

function lintHeaderLinks(application: Application): ValidationIssue[] {
 const issues: ValidationIssue[] = [];
 const links = application.resume.basics.links;
 if (links.length > 5) {
  issues.push(makeIssue("header_links", "/resume/basics/links", "Include at most five header links."));
 }
 for (const [index, link] of links.entries()) {
  if (link.url === undefined || link.url.trim().length === 0) {
   issues.push(makeIssue(
    "header_links",
    pointer(["resume", "basics", "links", index]),
    `Header link “${link.label}” must include a URL.`,
   ));
  }
 }
 return issues;
}

function lintSkillsDomain(application: Application, domainLabels: readonly string[]): ValidationIssue[] {
 const issues: ValidationIssue[] = [];
 const normalized = domainLabels.map((l) => l.trim().toLocaleLowerCase());
 for (const [index, skill] of application.resume.skills.entries()) {
  const labelMatch = normalized.includes(skill.label.trim().toLocaleLowerCase());
  const categoryMatch = skill.category !== undefined && normalized.includes(skill.category.trim().toLocaleLowerCase());
  if (labelMatch || categoryMatch) {
   issues.push(makeIssue(
    "skills_domain",
    pointer(["resume", "skills", index]),
    `Replace broad domain label “${skill.label}” with specific skills.`,
    [skill.id],
   ));
  }
 }
 return issues;
}

const FREELANCE_LINK_PATTERN = /\b(?:upwork|fiverr|freelancer(?:\.com)?)\b/iu;
const FREELANCE_ROLE_PATTERN = /\b(?:freelance|contract)\b/iu;

function lintFreelanceGap(application: Application): ValidationIssue[] {
 const links = application.resume.basics.links;
 const freelanceLinks = links
  .map((link, index) => ({ link, index }))
  .filter(({ link }) => FREELANCE_LINK_PATTERN.test(link.label) || (link.url !== undefined && FREELANCE_LINK_PATTERN.test(link.url)));
 if (freelanceLinks.length === 0) return [];
 const experiences = entryTargets(application).filter(({ kind }) => kind === "experience");
 const hasFreelanceRole = experiences.some(({ entry }) =>
  (entry.title !== undefined && FREELANCE_ROLE_PATTERN.test(entry.title)) || FREELANCE_ROLE_PATTERN.test(entry.name),
 );
 if (hasFreelanceRole) return [];
 return freelanceLinks.map(({ link, index }) => makeIssue(
  "freelance_gap",
  pointer(["resume", "basics", "links", index]),
  "Freelance marketplace link provided, but experience section does not list freelance or contract work.",
 ));
}

function lintProjectUnlinked(application: Application): ValidationIssue[] {
 const issues: ValidationIssue[] = [];
 for (const target of entryTargets(application).filter(({ kind }) => kind === "projects")) {
  const hasUrl = target.entry.url !== undefined && target.entry.url.trim().length > 0;
  const stack = "stack" in target.entry && Array.isArray(target.entry.stack) ? target.entry.stack : undefined;
  const hasStack = stack !== undefined && stack.length > 0;
  if (!hasUrl && !hasStack) {
   issues.push(makeIssue(
    "project_unlinked",
    target.path,
    "Project must include a URL or a technical stack.",
    [target.entry.id],
   ));
  }
 }
 return issues;
}

export function lintApplication(
 application: Application,
 options?: {
  readonly repeatedThemes?: readonly string[];
  readonly skillDomainLabels?: readonly string[];
  readonly now?: number;
 },
): ValidationIssue[] {
 const now = options?.now ?? currentMonthIndex();
 return [
  ...lintBannedWord(application),
  ...lintDash(application),
  ...lintWithoutTail(application),
  ...lintRuleOfThree(application),
  ...lintWeakOpener(application),
  ...lintBulletLength(application),
  ...lintBulletCount(application, now),
  ...lintOpenerRepeat(application),
  ...lintDuplicateBullet(application),
  ...lintRepeatedTheme(application, options?.repeatedThemes ?? REPEATED_THEMES),
  ...lintSummary(application, now),
  ...lintSkillsThin(application),
  ...lintDateOverlap(application, now),
  ...lintCertExpired(application, now),
  ...lintHedgeText(application),
  ...lintTransactionBullet(application),
  ...lintVagueVerb(application),
  ...lintNoStack(application),
  ...lintThinExperience(application, now),
  ...lintMissingContact(application),
  ...lintHeaderLinks(application),
  ...lintSkillsDomain(application, options?.skillDomainLabels ?? SKILLS_DOMAIN_LABELS),
  ...lintFreelanceGap(application),
  ...lintProjectUnlinked(application),
 ];
}
