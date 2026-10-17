import { describe, expect, test } from "bun:test";
import type { Application } from "../src/application/schema.ts";
import { lintApplication } from "../src/application/lint.ts";

type Kind = Application["resume"]["sections"][number]["kind"];
type Dates = { readonly start?: string; readonly end?: string | null; readonly expires?: string };

function application(): Application {
 return {
  schemaVersion: 1,
  id: "lint-test",
  revision: 1,
  resume: { basics: { name: "Candidate", links: [] }, summary: [], sections: [], skills: [] },
 };
}

type Extra = { readonly stack?: readonly string[]; readonly url?: string; readonly title?: string };

function addEntry(
 app: Application,
 kind: Kind,
 id: string,
 texts: readonly string[],
 dates: Dates = {},
 extra: Extra = {},
): void {
 const item = {
  id,
  name: `Company ${id}`,
  ...(kind === "experience" ? { title: "Engineer" } : {}),
  ...(kind === "certifications" ? { issuer: "Issuer" } : {}),
  ...dates,
  ...extra,
  bullets: texts.map((text, index) => ({ id: `${id}-b${index}`, text, evidenceIds: [] })),
 };
 const section = app.resume.sections.find((entry) => entry.kind === kind);
 if (section !== undefined) {
  (section.items as unknown[]).push(item);
 } else {
  app.resume.sections.push({ kind, items: [item] } as unknown as Application["resume"]["sections"][number]);
 }
}

function has(app: Application, code: string): boolean {
 return lintApplication(app).some((issue) => issue.code === `lint.${code}`);
}

const longBullet = (opener: string) => `${opener} production services across customer systems and engineering teams with clear operational results every quarter`;

describe("resume lint rules", () => {
 test("banned words detect variants and permit clean wording", () => {
  const bad = application();
  addEntry(bad, "experience", "bad", [longBullet("Leveraging")]);
  expect(has(bad, "banned_word")).toBe(true);
  const good = application();
  addEntry(good, "experience", "good", [longBullet("Built")]);
  expect(has(good, "banned_word")).toBe(false);
 });

 test("dash scans resume prose but not date fields", () => {
  const bad = application();
  addEntry(bad, "experience", "bad", ["Built—shipped production systems with clear ownership across five engineering teams each year"]);
  expect(has(bad, "dash")).toBe(true);
  const skillDash = application();
  skillDash.resume.skills = [{ id: "skill", label: "Data—platforms", evidenceIds: [] }];
  expect(has(skillDash, "dash")).toBe(true);
  const good = application();
  addEntry(good, "experience", "good", ["Built and shipped production systems with clear ownership across five engineering teams each year"], { start: "2020-01", end: "2021-01" });
  expect(has(good, "dash")).toBe(false);
 });

 test("without tails allow only one occurrence per resume", () => {
  const bad = application();
  addEntry(bad, "experience", "bad", ["Built systems without downtime", "Shipped services without interruptions"]);
  expect(has(bad, "without_tail")).toBe(true);
  const good = application();
  addEntry(good, "experience", "good", ["Built systems without downtime"]);
  expect(has(good, "without_tail")).toBe(false);
 });

 test("rule of three warns after two lists", () => {
  const bad = application();
  addEntry(bad, "experience", "bad", ["Built APIs, services, and tools for teams", "Designed databases, queues, and dashboards", "Shipped tests, alerts, and deployment pipelines"]);
  expect(has(bad, "rule_of_three")).toBe(true);
  const good = application();
  addEntry(good, "experience", "good", ["Built APIs and services for customer teams across production systems"]);
  expect(has(good, "rule_of_three")).toBe(false);
 });

 test("weak openers flag vague attribution but retain true coordination scope", () => {
  const bad = application();
  addEntry(bad, "experience", "bad", [longBullet("Partnered with")]);
  expect(has(bad, "weak_opener")).toBe(true);
  const good = application();
  addEntry(good, "experience", "good", [longBullet("Coordinated cross-team")]);
  expect(has(good, "weak_opener")).toBe(false);
 });

 test("bullet length accepts 12 through 30 words", () => {
  const bad = application();
  addEntry(bad, "experience", "bad", ["Built APIs"]);
  expect(has(bad, "bullet_length")).toBe(true);
  const good = application();
  addEntry(good, "experience", "good", ["Built production APIs for 12 teams, reducing response time with indexed queries and documented request handling."]);
  expect(has(good, "bullet_length")).toBe(false);
 });

 test("bullet counts cover newest, old, and project limits", () => {
  const bad = application();
  addEntry(bad, "experience", "newest", Array.from({ length: 6 }, (_, index) => longBullet(`Built${index}`)), { start: "2024-01", end: null });
  addEntry(bad, "experience", "old", Array.from({ length: 4 }, (_, index) => longBullet(`Shipped${index}`)), { start: "2010-01", end: "2018-01" });
  addEntry(bad, "projects", "project", Array.from({ length: 4 }, (_, index) => longBullet(`Created${index}`)));
  expect(has(bad, "bullet_count")).toBe(true);
  const good = application();
  addEntry(good, "experience", "newest", Array.from({ length: 5 }, (_, index) => longBullet(`Built${index}`)), { start: "2024-01", end: null });
  addEntry(good, "experience", "old", Array.from({ length: 3 }, (_, index) => longBullet(`Shipped${index}`)), { start: "2010-01", end: "2018-01" });
  addEntry(good, "projects", "project", Array.from({ length: 3 }, (_, index) => longBullet(`Created${index}`)));
  expect(has(good, "bullet_count")).toBe(false);
 });

 test("opener repetition checks adjacent and dominant first words", () => {
  const bad = application();
  addEntry(bad, "experience", "bad", [longBullet("Built"), longBullet("Built"), longBullet("Shipped")]);
  expect(has(bad, "opener_repeat")).toBe(true);
  const good = application();
  addEntry(good, "experience", "good", [longBullet("Built"), longBullet("Shipped")]);
  expect(has(good, "opener_repeat")).toBe(false);
 });


 test("duplicate bullets compare only across entries", () => {
  const bad = application();
  const duplicate = "Built reliable APIs and services for customer facing production systems across four engineering teams each year";
  addEntry(bad, "experience", "one", [duplicate]);
  addEntry(bad, "experience", "two", [duplicate]);
  expect(has(bad, "duplicate_bullet")).toBe(true);
  const good = application();
  addEntry(good, "experience", "one", ["Built a TypeScript API cache with an indexed lookup, cutting p95 response time from 250 ms to 200 ms for account requests."]);
  addEntry(good, "experience", "two", ["Documented release verification procedures for support engineers after a billing workflow changed its review steps."]);
  expect(has(good, "duplicate_bullet")).toBe(false);
 });

 test("repeated themes use the configurable list across entries", () => {
  const bad = application();
  for (let index = 0; index < 3; index++) addEntry(bad, "experience", `bad-${index}`, [longBullet("rollback")]);
  expect(lintApplication(bad, { repeatedThemes: ["rollback"] }).some(({ code }) => code === "lint.repeated_theme")).toBe(true);
  expect(lintApplication(bad, { repeatedThemes: ["recovery"] }).some(({ code }) => code === "lint.repeated_theme")).toBe(false);
 });

 test("summary limits claims, adjectives, and dated years", () => {
  const bad = application();
  bad.resume.summary = Array.from({ length: 3 }, (_, index) => ({ id: `summary-${index}`, text: "Passionate engineer with 900 years experience", evidenceIds: [] }));
  addEntry(bad, "experience", "bad", [], { start: "2010-01", end: null });
  expect(has(bad, "summary")).toBe(true);
  const now = new Date();
  const prior = `${now.getFullYear() - 4}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const good = application();
  good.resume.summary = [{ id: "summary", text: "Engineer with 4 years experience", evidenceIds: [] }];
  addEntry(good, "experience", "good", [], { start: prior, end: null });
  expect(has(good, "summary")).toBe(false);
 });

 test("skills flag broad domain labels without enforcing quotas or repetition", () => {
  const broad = application();
  broad.resume.skills = [{ id: "one", label: "Developer platforms", category: "Developer platforms", evidenceIds: [] }];
  expect(has(broad, "skills_domain")).toBe(true);

  const selective = application();
  selective.resume.skills = [{ id: "typescript", label: "TypeScript", category: "Languages", evidenceIds: [] }];
  addEntry(selective, "experience", "work", [longBullet("TypeScript"), longBullet("TypeScript")]);
  expect(has(selective, "skills_thin")).toBe(false);
 });

 test("date overlap threshold is greater than three months", () => {
  const bad = application();
  addEntry(bad, "experience", "old", [], { start: "2020-01", end: "2020-06" });
  addEntry(bad, "experience", "new", [], { start: "2020-03", end: "2020-12" });
  expect(has(bad, "date_overlap")).toBe(true);
  const good = application();
  addEntry(good, "experience", "old", [], { start: "2020-01", end: "2020-03" });
  addEntry(good, "experience", "new", [], { start: "2020-03", end: "2020-12" });
  expect(has(good, "date_overlap")).toBe(false);
 });

 test("expired certification dates warn only after expiry", () => {
  const bad = application();
  addEntry(bad, "certifications", "bad", [], { start: "2018-01", expires: "2000-01" });
  expect(has(bad, "cert_expired")).toBe(true);
  const good = application();
  addEntry(good, "certifications", "good", [], { start: "2025-01", expires: "2999-01" });
  expect(has(good, "cert_expired")).toBe(false);
 });

 test("lint does not mutate the input snapshot", () => {
  const app = application();
  addEntry(app, "experience", "entry", [longBullet("Leveraged")]);
  const original = JSON.stringify(app);
  lintApplication(app);
  expect(JSON.stringify(app)).toBe(original);
 });

 test("hedge_text warns on caveats and unconfirmed claims across all trigger phrases", () => {
  const triggers = [
   "Built order service; metrics not confirmed by client.",
   "Developed unconfirmed migration path.",
   "Delivered pipeline with no metrics confirmed.",
   "Maintained unverified database replication replica.",
   "Will deploy to production if confirmed by team lead.",
   "Worked primarily on query optimization.",
   "Implemented mostly frontend components.",
   "Achieved partially automated releases.",
   "Shipped service with some latency issues remaining.",
   "Shipped payment service as a prototype.",
   "Built internal tooling prototype with no handover.",
  ];
  for (const text of triggers) {
   const app = application();
   addEntry(app, "experience", "h", [text]);
   expect(has(app, "hedge_text")).toBe(true);
  }
  const sentenceBoundary = application();
  addEntry(sentenceBoundary, "experience", "h5", ["Recorded no bugs in 2021; confirmed production stability in 2022."]);
  expect(has(sentenceBoundary, "hedge_text")).toBe(false);
  const good = application();
  addEntry(good, "experience", "clean", ["Shipped payment service handling 10,000 requests per minute."]);
  expect(has(good, "hedge_text")).toBe(false);
  const bad = application();
  addEntry(bad, "experience", "hedge1", ["Built order service; metrics not confirmed by client."]);
  const issue = lintApplication(bad).find((i) => i.code === "lint.hedge_text");
  expect(issue?.severity).toBe("warning");
  expect(issue?.message).toBe("Caveats belong in the conversation or evidence, not resume text. Ask the user or omit the claim.");
 });

 test("transaction_bullet flags transaction language across all triggers without tech nouns and suppresses with tech nouns", () => {
  const triggers = [
   "Handled paid client requests for internal tooling.",
   "Handled delivery of customer onboarding features.",
   "Managed system delivered through third-party services.",
   "Completed delivery through Fiverr for the release workflow.",
   "Completed client tasks through Upwork for small businesses.",
   "Completed engineering tasks through freelancer.com for web clients.",
  ];
  for (const text of triggers) {
   const app = application();
   addEntry(app, "experience", "tx", [text]);
   expect(has(app, "transaction_bullet")).toBe(true);
  }
  const goodTech = application();
  addEntry(goodTech, "experience", "tx-tech", ["Completed delivery of the TypeScript service through Fiverr."]);
  expect(has(goodTech, "transaction_bullet")).toBe(false);
  const good = application();
  addEntry(good, "experience", "clean", ["Shipped release workflow across three development environments."]);
  expect(has(good, "transaction_bullet")).toBe(false);
  const bad = application();
  addEntry(bad, "experience", "tx", ["Completed paid delivery through Fiverr for the release workflow."]);
  expect(lintApplication(bad).find((i) => i.code === "lint.transaction_bullet")?.severity).toBe("warning");
 });

 test("vague_verb warns on all weak openers unless suppressed by tech noun or number", () => {
  const vagueOpeners = [
   "Developed across customer systems and team workflows.",
   "Published the project dashboard for internal contributors.",
   "Completed service setup across staging environments.",
   "Measured and trialed the service in staging environments.",
   "Contributed to internal documentation and release checklists.",
  ];
  for (const text of vagueOpeners) {
   const app = application();
   addEntry(app, "experience", "vv", [text]);
   expect(has(app, "vague_verb")).toBe(true);
  }
  const suppressedByTech = application();
  addEntry(suppressedByTech, "experience", "vv-tech", ["Published the Go dashboard for internal contributors."]);
  expect(has(suppressedByTech, "vague_verb")).toBe(false);
  const suppressedByDigits = application();
  addEntry(suppressedByDigits, "experience", "vv-num", ["Published 3 project dashboards for internal contributors."]);
  expect(has(suppressedByDigits, "vague_verb")).toBe(false);
  const suppressedByWord = application();
  addEntry(suppressedByWord, "experience", "vv-word", ["Published three project dashboards for internal contributors."]);
  expect(has(suppressedByWord, "vague_verb")).toBe(false);
  const regularOpener = application();
  addEntry(regularOpener, "experience", "vv-reg", ["Built internal project dashboard."]);
  expect(has(regularOpener, "vague_verb")).toBe(false);
  const bad = application();
  addEntry(bad, "experience", "vv", ["Published the project dashboard for internal contributors."]);
  expect(lintApplication(bad).find((i) => i.code === "lint.vague_verb")?.severity).toBe("warning");
 });

 test("no_stack requires a recognized tech noun in bullets or stack, rejecting non-tech stack", () => {
  const badNoTech = application();
  addEntry(badNoTech, "experience", "exp1", ["Led migration of customer workflows to production."]);
  expect(has(badNoTech, "no_stack")).toBe(true);
  const badNonTechStack = application();
  addEntry(badNonTechStack, "experience", "exp2", ["Led migration of customer workflows to production."], {}, { stack: ["Agile", "Scrum"] });
  expect(has(badNonTechStack, "no_stack")).toBe(true);
  const goodBulletTech = application();
  addEntry(goodBulletTech, "experience", "exp3", ["Led migration using Docker to production."]);
  expect(has(goodBulletTech, "no_stack")).toBe(false);
  const goodStackTech = application();
  addEntry(goodStackTech, "experience", "exp4", ["Led migration of customer workflows to production."], {}, { stack: ["Docker"] });
  expect(has(goodStackTech, "no_stack")).toBe(false);
  expect(lintApplication(badNoTech).find((i) => i.code === "lint.no_stack")?.severity).toBe("warning");
 });

 test("thin_experience checks >6 month boundary on newest role", () => {
  const baseNow = 2024 * 12 + 7; // 2024-08
  const badOverSix = application();
  addEntry(badOverSix, "experience", "exp1", ["Built service.", "Tested service."], { start: "2024-01", end: "2024-08" }); // 7 months (>6)
  expect(lintApplication(badOverSix, { now: baseNow }).some((i) => i.code === "lint.thin_experience")).toBe(true);

  const goodExactSix = application();
  addEntry(goodExactSix, "experience", "exp2", ["Built service.", "Tested service."], { start: "2024-01", end: "2024-07" }); // 6 months (exact, not >6)
  expect(lintApplication(goodExactSix, { now: baseNow }).some((i) => i.code === "lint.thin_experience")).toBe(false);

  const goodThreeBullets = application();
  addEntry(goodThreeBullets, "experience", "exp3", ["Built service.", "Tested service.", "Deployed service."], { start: "2024-01", end: "2024-09" }); // >6 but 3 bullets
  expect(lintApplication(goodThreeBullets, { now: baseNow }).some((i) => i.code === "lint.thin_experience")).toBe(false);

  const staleOlderRole = application();
  addEntry(staleOlderRole, "experience", "older", ["Old bullet 1.", "Old bullet 2."], { start: "2020-01", end: "2022-01" });
  addEntry(staleOlderRole, "experience", "newest", ["Recent 1.", "Recent 2."], { start: "2024-05", end: "2024-08" }); // newest is 3 months
  expect(lintApplication(staleOlderRole, { now: baseNow }).some((i) => i.code === "lint.thin_experience")).toBe(false);
  expect(lintApplication(badOverSix, { now: baseNow }).find((i) => i.code === "lint.thin_experience")?.severity).toBe("warning");
 });

 test("missing_contact requires either email or phone", () => {
  const badNeither = application();
  delete badNeither.resume.basics.email;
  delete badNeither.resume.basics.phone;
  expect(has(badNeither, "missing_contact")).toBe(true);

  const goodEmail = application();
  goodEmail.resume.basics.email = "test@example.com";
  delete goodEmail.resume.basics.phone;
  expect(has(goodEmail, "missing_contact")).toBe(false);

  const goodPhone = application();
  delete goodPhone.resume.basics.email;
  goodPhone.resume.basics.phone = "+1 555 0100";
  expect(has(goodPhone, "missing_contact")).toBe(false);

  const goodBoth = application();
  goodBoth.resume.basics.email = "test@example.com";
  goodBoth.resume.basics.phone = "+1 555 0100";
  expect(has(goodBoth, "missing_contact")).toBe(false);
  expect(lintApplication(badNeither).find((i) => i.code === "lint.missing_contact")?.severity).toBe("warning");
 });

 test("header_links checks count (5 vs 6) and absent URL", () => {
  const badSixLinks = application();
  badSixLinks.resume.basics.links = [
   { label: "L1", url: "https://example.com/1" },
   { label: "L2", url: "https://example.com/2" },
   { label: "L3", url: "https://example.com/3" },
   { label: "L4", url: "https://example.com/4" },
   { label: "L5", url: "https://example.com/5" },
   { label: "L6", url: "https://example.com/6" },
  ];
  expect(has(badSixLinks, "header_links")).toBe(true);

  const goodFiveLinks = application();
  goodFiveLinks.resume.basics.links = [
   { label: "L1", url: "https://example.com/1" },
   { label: "L2", url: "https://example.com/2" },
   { label: "L3", url: "https://example.com/3" },
   { label: "L4", url: "https://example.com/4" },
   { label: "L5", url: "https://example.com/5" },
  ];
  expect(has(goodFiveLinks, "header_links")).toBe(false);

  const badAbsentUrl = application();
  badAbsentUrl.resume.basics.links = [{ label: "Portfolio" }];
  expect(has(badAbsentUrl, "header_links")).toBe(true);
  expect(lintApplication(badAbsentUrl).find((i) => i.code === "lint.header_links")?.severity).toBe("warning");
 });

 test("skills_domain flags curated broad domain labels and allows configuration", () => {
  const curatedLabels = [
   "APIs",
   "data/workflow automation",
   "web scraping",
   "developer platforms",
  ];
  for (const label of curatedLabels) {
   const appLabel = application();
   appLabel.resume.skills = [
    { id: "s1", label, evidenceIds: [] },
    { id: "s2", label: "TypeScript", evidenceIds: [] },
   ];
   expect(has(appLabel, "skills_domain")).toBe(true);

   const appCategory = application();
   appCategory.resume.skills = [
    { id: "s1", label: "TypeScript", category: label, evidenceIds: [] },
   ];
   expect(has(appCategory, "skills_domain")).toBe(true);
  }

  const good = application();
  good.resume.skills = [
   { id: "s1", label: "TypeScript", category: "Languages", evidenceIds: [] },
   { id: "s2", label: "PostgreSQL", category: "Data Stores", evidenceIds: [] },
   { id: "s3", label: "FastAPI", category: "Frameworks", evidenceIds: [] },
   { id: "s4", label: "Docker", category: "Infrastructure", evidenceIds: [] },
  ];
  expect(has(good, "skills_domain")).toBe(false);

  const customConfig = application();
  customConfig.resume.skills = [{ id: "s1", label: "CustomDomain", evidenceIds: [] }];
  expect(lintApplication(customConfig, { skillDomainLabels: ["CustomDomain"] }).some((i) => i.code === "lint.skills_domain")).toBe(true);
  const badSample = application();
  badSample.resume.skills = [{ id: "s1", label: "APIs", evidenceIds: [] }];
  expect(lintApplication(badSample).find((i) => i.code === "lint.skills_domain")?.severity).toBe("warning");
 });

 test("freelance_gap checks for marketplace links without freelance experience", () => {
  const bad = application();
  bad.resume.basics.links = [{ label: "Upwork", url: "https://upwork.com/freelancers/~example" }];
  addEntry(bad, "experience", "exp1", ["Built software for clients."]);
  expect(has(bad, "freelance_gap")).toBe(true);

  const goodTitle = application();
  goodTitle.resume.basics.links = [{ label: "Upwork", url: "https://upwork.com/freelancers/~example" }];
  addEntry(goodTitle, "experience", "exp2", ["Built software for clients."], {}, { title: "Freelance Software Engineer" });
  expect(has(goodTitle, "freelance_gap")).toBe(false);

  const goodName = application();
  goodName.resume.basics.links = [{ label: "Fiverr", url: "https://fiverr.com/example" }];
  const item = {
   id: "exp3",
   name: "Freelance Consulting",
   title: "Engineer",
   bullets: [{ id: "b1", text: "Built software.", evidenceIds: [] }],
  };
  goodName.resume.sections.push({ kind: "experience", items: [item] } as unknown as Application["resume"]["sections"][number]);
  expect(has(goodName, "freelance_gap")).toBe(false);

  const goodNoLink = application();
  goodNoLink.resume.basics.links = [{ label: "GitHub", url: "https://github.com/example" }];
  addEntry(goodNoLink, "experience", "exp4", ["Built software for clients."]);
  expect(has(goodNoLink, "freelance_gap")).toBe(false);
  expect(lintApplication(bad).find((i) => i.code === "lint.freelance_gap")?.severity).toBe("warning");
 });

 test("project_unlinked warns when project lacks both URL and stack", () => {
  const bad = application();
  addEntry(bad, "projects", "p1", ["Built an application."]);
  expect(has(bad, "project_unlinked")).toBe(true);

  const goodUrlOnly = application();
  addEntry(goodUrlOnly, "projects", "p2", ["Built an application."], {}, { url: "https://example.org/project" });
  expect(has(goodUrlOnly, "project_unlinked")).toBe(false);

  const goodStackOnly = application();
  addEntry(goodStackOnly, "projects", "p3", ["Built an application."], {}, { stack: ["TypeScript", "Docker"] });
  expect(has(goodStackOnly, "project_unlinked")).toBe(false);

  const goodBoth = application();
  addEntry(goodBoth, "projects", "p4", ["Built an application."], {}, { url: "https://example.org/project", stack: ["TypeScript"] });
  expect(has(goodBoth, "project_unlinked")).toBe(false);
  expect(lintApplication(bad).find((i) => i.code === "lint.project_unlinked")?.severity).toBe("warning");
 });

 test("new lint rules produce warning-only issues without affecting validation", () => {
  const app = application();
  delete app.resume.basics.email;
  delete app.resume.basics.phone;
  app.resume.basics.links = [
   { label: "Upwork", url: "https://upwork.com/freelancer" },
   { label: "NoUrl" },
  ];
  app.resume.skills = [{ id: "sk1", label: "APIs", evidenceIds: [] }];
  addEntry(app, "experience", "e1", [
   "Completed paid delivery through Fiverr for the release workflow.",
   "Published the project dashboard with metrics not confirmed.",
  ], { start: "2024-01", end: "2024-09" });
  addEntry(app, "projects", "p1", ["Published project utility."]);

  const issues = lintApplication(app);
  expect(issues.length).toBeGreaterThan(0);
  expect(issues.every((i) => i.severity === "warning")).toBe(true);
 });
});
