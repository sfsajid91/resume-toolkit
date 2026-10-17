import { describe, expect, test } from "bun:test";
import type { Application } from "./schema.ts";
import { lintApplication } from "./lint.ts";

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

function addEntry(
 app: Application,
 kind: Kind,
 id: string,
 texts: readonly string[],
 dates: Dates = {},
): void {
 let section = app.resume.sections.find((item) => item.kind === kind);
 if (section === undefined) {
  section = { kind, items: [] };
  app.resume.sections.push(section);
 }
 section.items.push({
  id,
  name: `Company ${id}`,
  ...(kind === "experience" ? { title: "Engineer" } : {}),
  ...(kind === "certifications" ? { issuer: "Issuer" } : {}),
  ...dates,
  bullets: texts.map((text, index) => ({ id: `${id}-b${index}`, text, evidenceIds: [] })),
 });
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

 test("no number ignores entries with fewer than two bullets", () => {
  const bad = application();
  addEntry(bad, "experience", "bad", [longBullet("Built"), longBullet("Shipped")]);
  expect(has(bad, "no_number")).toBe(true);
  const good = application();
  addEntry(good, "experience", "one", ["Built systems"]);
  addEntry(good, "experience", "two", [longBullet("Built"), "Shipped 12 services across customer systems and engineering teams with clear operational results every quarter"]);
  expect(has(good, "no_number")).toBe(false);
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

 test("skills require useful categories and enough items", () => {
  const bad = application();
  bad.resume.skills = [{ id: "one", label: "TypeScript", category: "Developer platforms", evidenceIds: [] }];
  expect(has(bad, "skills_thin")).toBe(true);
  const good = application();
  good.resume.skills = Array.from({ length: 15 }, (_, index) => ({
   id: `skill-${index}`,
   label: `Skill ${index}`,
   category: `Category ${Math.floor(index / 5)}`,
   evidenceIds: [],
  }));
  expect(has(good, "skills_thin")).toBe(false);
 });

 test("technology used in multiple bullets appears in skills", () => {
  const bad = application();
  addEntry(bad, "experience", "bad", [longBullet("TypeScript"), longBullet("TypeScript")]);
  expect(has(bad, "skill_not_in_body")).toBe(true);
  const good = application();
  addEntry(good, "experience", "good", [longBullet("TypeScript"), longBullet("TypeScript")]);
  good.resume.skills = [{ id: "typescript", label: "TypeScript", evidenceIds: [] }];
  expect(has(good, "skill_not_in_body")).toBe(false);
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
});
