import { readFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { execFile } from "node:child_process";
import { describe, expect, test } from "bun:test";
import { applicationSchema } from "./schema.ts";
import { resolveResume } from "./resume.ts";
import { exportPdf } from "./pdf.ts";

const execFileAsync = promisify(execFile);
const inspectionToolsAvailable = ["typst", "pdftotext", "pdfinfo"].every((tool) => Bun.which(tool) !== null);

async function fixture(name: string) {
  const raw: unknown = JSON.parse(await readFile(new URL(`../examples/${name}`, import.meta.url), "utf8")) as unknown;
  return resolveResume(applicationSchema.parse(raw));
}

async function command(program: string, args: string[]): Promise<string> {
  const { stdout } = await execFileAsync(program, args, { encoding: "utf8", maxBuffer: 2 * 1024 * 1024 });
  return stdout;
}

describe("PDF export", () => {
  test.skipIf(!inspectionToolsAvailable)("renders the shared examples as searchable PDFs with links and paper sizes", async () => {
    const directory = await mkdtemp(join(tmpdir(), "resume-pdf-test-"));
    try {
      const cases = [
        { fixture: "application.json", output: "compact.pdf", paper: "a4" as const },
        { fixture: "dense-application.json", output: "dense.pdf", paper: "a4" as const },
        { fixture: "edge-application.json", output: "edge.pdf", paper: "letter" as const },
      ];
      for (const item of cases) {
        const outputPath = join(directory, item.output);
        const version = await exportPdf(await fixture(item.fixture), {
          outputPath,
          paper: item.paper,
          force: false,
        });
        expect(version).toStartWith("typst 0.15.1 ");
        const [text, info, urls] = await Promise.all([
          command("pdftotext", [outputPath, "-"]),
          command("pdfinfo", [outputPath]),
          command("pdfinfo", ["-url", outputPath]),
        ]);
        expect(text.trim().length).toBeGreaterThan(0);
        expect(info.toLowerCase()).toContain(item.paper === "a4" ? "(a4)" : "(letter)");
        if (item.fixture === "application.json") {
          expect(text.replace(/\s+/gu, " ")).toContain("ALEX EXAMPLE");
          expect(text).toContain("PROFESSIONAL EXPERIENCE");
          expect(text).toContain("Implemented TypeScript API caching");
        } else if (item.fixture === "dense-application.json") {
          expect(text.replace(/\s+/gu, " ")).toContain("MORGAN EXAMPLE");
          expect(text).toContain("PROFESSIONAL SUMMARY");
          expect(text).toContain("OpenTelemetry");
          expect(Number(info.match(/Pages:\s+(\d+)/)?.[1] ?? 0)).toBe(2);
          const layout = await command("pdftotext", ["-bbox-layout", outputPath, "-"]);
          const lines = [...layout.matchAll(/<line\b([^>]*)>([\s\S]*?)<\/line>/gu)].map(([, attributes, content]) => ({
            y: Number(attributes?.match(/\byMin="([0-9.]+)"/u)?.[1]),
            text: [...(content ?? "").matchAll(/<word\b[^>]*>([\s\S]*?)<\/word>/gu)]
              .map(([, word]) => word ?? "")
              .join(" "),
          }));
          const nameY = lines.find(({ text: value }) => value === "MORGAN EXAMPLE")?.y;
          const contactY = lines.find(({ text: value }) => value.startsWith("Portland, OR |"))?.y;
          const linksY = lines.find(({ text: value }) => value === "morgan.example.net | github.com/morgan-example")?.y;
          const headingIndex = lines.findIndex(({ text: value }) => value === "PROFESSIONAL SUMMARY");
          const firstBodyIndex = lines.findIndex(({ text: value }) => value.startsWith("Product-minded"));
          const experienceIndex = lines.findIndex(({ text: value }) => value === "PROFESSIONAL EXPERIENCE");
          const skillsIndex = lines.findIndex(({ text: value }) => value === "TECHNICAL SKILLS");
          const projectsIndex = lines.findIndex(({ text: value }) => value === "SELECTED PROJECTS");
          const headingY = lines[headingIndex]?.y;
          const firstBodyY = lines[firstBodyIndex]?.y;
          if ([nameY, contactY, linksY, headingY, firstBodyY].some((value) => value === undefined)) {
            throw new Error("The dense PDF fixture is missing expected resume text rows.");
          }
          expect(contactY! - nameY!).toBeGreaterThanOrEqual(24);
          expect(linksY! - contactY!).toBeGreaterThanOrEqual(10);
          expect(firstBodyY! - headingY!).toBeGreaterThanOrEqual(20);
          expect(experienceIndex).toBeGreaterThan(-1);
          expect(experienceIndex).toBeLessThan(skillsIndex);
          expect(skillsIndex).toBeLessThan(projectsIndex);
          expect(text).toContain("Skills: TypeScript");
          const summaryParagraph = text.split(/\n\s*\n/u)
            .map((paragraph) => paragraph.replace(/\s+/gu, " "))
            .find((paragraph) => paragraph.includes("Product-minded") && paragraph.includes("Known for connecting"));
          expect(summaryParagraph).toContain("services. Known for connecting");
          for (const heading of [
            "PROFESSIONAL SUMMARY", "PROFESSIONAL EXPERIENCE", "TECHNICAL SKILLS",
            "SELECTED PROJECTS", "EDUCATION", "CERTIFICATIONS",
          ]) expect(lines.some(({ text: value }) => value === heading)).toBe(true);
          const headings = [
            "PROFESSIONAL SUMMARY", "PROFESSIONAL EXPERIENCE", "TECHNICAL SKILLS",
            "SELECTED PROJECTS", "EDUCATION", "CERTIFICATIONS",
          ];
          const pages = text.split("\f").filter((page) => page.trim().length > 0);
          for (const page of pages) {
            const lastLine = page.trim().split(/\r?\n/u).map((line) => line.trim()).filter(Boolean).at(-1);
            expect(headings).not.toContain(lastLine);
          }
          expect(text).not.toContain("PROFESSIONAL EXPERIENCETECHNICAL SKILLS");
          expect(text).not.toContain("TECHNICAL SKILLSSELECTED PROJECTS");
          expect(text).not.toContain("Senior Software EngineerNorthstar Systems");
          expect(urls).toContain("https://morgan.example.net");
        } else {
          expect(text).toContain("RENÉE");
          expect(text).toContain("Café & Co.");
          expect(text).toContain("李");
          expect(text).toContain("東京");
          expect(text).toContain("🧪");
          expect(text).toContain("#let secret = read(");
          expect(text).toContain("résumé");
          expect(text).not.toContain("root:x:");
          expect(urls).toContain("https://example.org/profile?view=work&lang=en");
        }
      }

      const existingPath = join(directory, "compact.pdf");
      const before = await readFile(existingPath);
      await expect(exportPdf(await fixture("application.json"), {
        outputPath: existingPath,
        paper: "a4",
        force: false,
      })).rejects.toThrow();
      expect(await readFile(existingPath)).toEqual(before);
      const compact = await fixture("application.json");
      await exportPdf({
        ...compact,
        basics: { ...compact.basics, name: "Forced replacement" },
      }, { outputPath: existingPath, paper: "a4", force: true });
      expect((await command("pdftotext", [existingPath, "-"])).replace(/\s+/gu, " ")).toContain("Forced replacement");
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
  test.skipIf(!inspectionToolsAvailable)("renders headline, clean URLs, grouped skills, and a cohesive summary", async () => {
    const application = applicationSchema.parse(JSON.parse(
      await readFile(new URL("../examples/application.json", import.meta.url), "utf8"),
    ) as unknown);
    application.resume.basics.headline = "Full-Stack Engineer";
    application.resume.basics.links.push(
      { label: "GitHub", url: "https://www.github.com/sfsajid91" },
      { label: "github.com/sfsajid91/issues", url: "https://github.com/sfsajid91/issues" },
    );
    application.resume.summary = [
      { id: "summary-api", text: "Built dependable APIs.", evidenceIds: [] },
      { id: "summary-team", text: "Mentored a team.", evidenceIds: [] },
    ];
    application.resume.skills[0]!.category = "Languages";
    application.resume.skills.push({ id: "skill-react", label: "React", category: "Frontend", evidenceIds: [] });
    application.resume.skillsPosition = "after-summary";
    const resume = resolveResume(application);
    const directory = await mkdtemp(join(tmpdir(), "resume-pdf-options-test-"));
    const outputPath = join(directory, "resume.pdf");
    try {
      await exportPdf(resume, { outputPath, paper: "letter", force: false });
      const [text, urls] = await Promise.all([
        command("pdftotext", [outputPath, "-"]),
        command("pdfinfo", ["-url", outputPath]),
      ]);
      const normalized = text.replace(/\s+/gu, " ");
      expect(normalized).toContain("Full-Stack Engineer");
      expect(normalized).toContain("github.com/sfsajid91 | github.com/sfsajid91/issues");
      expect(urls).toContain("https://www.github.com/sfsajid91");
      expect(urls).toContain("https://github.com/sfsajid91/issues");
      expect(text.split(/\r?\n/u).map((line) => line.trim())).toContain("Built dependable APIs. Mentored a team.");
      expect(normalized).toContain("Languages: TypeScript");
      expect(normalized).toContain("Frontend: React");
      expect(normalized.indexOf("TECHNICAL SKILLS")).toBeLessThan(normalized.indexOf("PROFESSIONAL EXPERIENCE"));
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  test.skipIf(!inspectionToolsAvailable)("keeps long project titles independent of URLs and formats location and certification dates", async () => {
    const resume = await fixture("lint-bad-application.json");
    const directory = await mkdtemp(join(tmpdir(), "resume-pdf-layout-test-"));
    const outputPath = join(directory, "lint-layout.pdf");
    const projectTitle = "Multi Region Incident Response and Deployment Recovery Readiness Toolkit";
    try {
      await exportPdf(resume, { outputPath, paper: "a4", force: false });
      const [text, layout, urls] = await Promise.all([
        command("pdftotext", [outputPath, "-"]),
        command("pdftotext", ["-bbox-layout", outputPath, "-"]),
        command("pdfinfo", ["-url", outputPath]),
      ]);
      const lines = [...layout.matchAll(/<line\b[^>]*>([\s\S]*?)<\/line>/gu)].map(([, content]) =>
        [...(content ?? "").matchAll(/<word\b[^>]*>([\s\S]*?)<\/word>/gu)]
          .map(([, word]) => word ?? "")
          .join(" "),
      );
      const projectHeader = lines.find((line) => line.startsWith(projectTitle));
      if (projectHeader === undefined) throw new Error("Long project title wrapped or disappeared from its header line.");
      expect(projectHeader).toContain("Apr 2019 – Apr 2020");
      expect(projectHeader).not.toContain("example.org");
      expect(lines.some((line) => line.includes("example.org/projects/recovery-readiness-toolkit"))).toBe(true);
      expect(text).toContain("Northstar — Recovery Systems, Portland, OR");
      expect(text).toContain("Issued Mar 2018 · Expires Mar 2021");
      expect(urls).toContain("https://example.org/projects/recovery-readiness-toolkit");
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
