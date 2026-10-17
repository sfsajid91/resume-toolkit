import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "bun:test";
import { applicationSchema } from "./schema.ts";
import { resolveResume, type ResolvedResume } from "./resume.ts";
import { exportDocx } from "./docx.ts";

async function fixture(path: string): Promise<ResolvedResume> {
  const source = await readFile(new URL(path, import.meta.url), "utf8");
  return resolveResume(applicationSchema.parse(JSON.parse(source)));
}

async function temporaryDirectory(): Promise<string> {
  return mkdtemp(join(tmpdir(), "resume-toolkit-docx-"));
}

async function zipPart(path: string, part: string): Promise<string> {
  const process = Bun.spawn(["unzip", "-p", path, part], { stdout: "pipe", stderr: "pipe" });
  const [stdout, stderr] = await Promise.all([new Response(process.stdout).text(), new Response(process.stderr).text()]);
  const exitCode = await process.exited;
  if (exitCode !== 0) throw new Error(`Could not read DOCX part ${part}: ${stderr}`);
  return stdout;
}

function xmlText(xml: string): string[] {
  return [...xml.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/gu)].map(([, value]) =>
    (value ?? "").replaceAll("&amp;", "&").replaceAll("&lt;", "<").replaceAll("&gt;", ">").replaceAll("&quot;", '"').replaceAll("&apos;", "'").replaceAll("\u2060", ""),
  );
}
function paragraphTexts(xml: string): string[] {
  return [...xml.matchAll(/<w:p(?:\s[^>]*)?>([\s\S]*?)<\/w:p>/gu)].map(([, paragraph]) =>
    xmlText((paragraph ?? "").replace(/<w:tab\b[^>]*\/>/gu, "<w:t> </w:t>")).join("").trim(),
  );
}

function paragraphStyle(xml: string, styleId: string): string {
  const match = [...xml.matchAll(/<w:style\b([^>]*)>[\s\S]*?<\/w:style>/gu)]
    .find(([, attributes]) => attributes?.includes(`w:styleId="${styleId}"`));
  return match?.[0] ?? "";
}


describe("editable DOCX export", () => {
  test("preserves ordered content, native editable paragraphs/lists, styles, links and paper setup", async () => {
    const resume = await fixture("../examples/dense-application.json");
    const directory = await temporaryDirectory();
    const output = join(directory, "resume.docx");
    try {
      expect(await exportDocx(resume, { outputPath: output, paper: "a4", force: false })).toBe("docx@9.10.0");
      const body = await zipPart(output, "word/document.xml");
      const styles = await zipPart(output, "word/styles.xml");
      const numbering = await zipPart(output, "word/numbering.xml");
      const relationships = await zipPart(output, "word/_rels/document.xml.rels");
      const visible = xmlText(body);
      const paragraphs = paragraphTexts(body);
      const tabbedParagraphs = [...body.matchAll(/<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/gu)]
        .map(([xml]) => xml ?? "")
        .filter((xml) => /<w:tab\s/u.test(xml));
      expect(visible[0]).toBe(resume.basics.name);
      const headings = [
        "PROFESSIONAL SUMMARY", "PROFESSIONAL EXPERIENCE", "TECHNICAL SKILLS",
        "SELECTED PROJECTS", "EDUCATION", "CERTIFICATIONS",
      ];
      for (const heading of headings) expect(paragraphs).toContain(heading);
      expect(paragraphs.indexOf("PROFESSIONAL EXPERIENCE")).toBeLessThan(paragraphs.indexOf("TECHNICAL SKILLS"));
      expect(paragraphs.indexOf("TECHNICAL SKILLS")).toBeLessThan(paragraphs.indexOf("SELECTED PROJECTS"));
      expect(paragraphs.indexOf("SELECTED PROJECTS")).toBeLessThan(paragraphs.indexOf("EDUCATION"));
      expect(paragraphs.join(" ")).toContain("Skills: TypeScript");
      const summaryText = resume.summary.join(" ");
      expect(paragraphs.filter((value) => value === summaryText)).toHaveLength(1);
      expect(paragraphs).not.toContain("PROFESSIONAL EXPERIENCETECHNICAL SKILLS");
      expect(paragraphs).toContain("morgan.example.net | github.com/morgan-example");
      expect(relationships).toContain("https://morgan.example.net");
      expect(relationships).toContain("https://github.com/morgan-example");
      const experience = resume.sections.find((section) => section.kind === "experience");
      if (experience === undefined || experience.kind === "skills" || experience.kind === "summary") throw new Error("Dense fixture is missing experience.");
      const firstBullet = experience.entries[0]?.bullets[0];
      if (firstBullet === undefined) throw new Error("Dense fixture is missing its first bullet.");
      expect(paragraphs.some((value) => value.startsWith("Senior Software Engineer"))).toBe(true);
      expect(paragraphs).not.toContain("Senior Software EngineerNorthstar Systems");
      expect(visible).toContain(firstBullet);
      expect((body.match(/<w:p(?:\s|>)/gu) ?? []).length).toBeGreaterThan(20);
      expect(body).toContain("<w:numPr>");
      expect(numbering).toContain('w:numFmt w:val="bullet"');
      expect(body).not.toContain("<w:tbl");
      expect(body).not.toContain("<w:txbxContent");
      expect(visible.join(" ")).not.toContain("Synthetic source note");
      for (const style of ["ResumeName", "ResumeContact", "ResumeSectionHeading", "ResumeEntryHeading", "ResumeBody", "ResumeBullet"]) {
        expect(styles).toContain(`w:styleId="${style}"`);
      }
      const expectedFontSizes = {
        ResumeName: 38,
        ResumeHeadline: 24,
        ResumeContact: 22,
        ResumeSectionHeading: 24,
        ResumeEntryHeading: 22,
        ResumeEntryDetail: 22,
        ResumeBody: 22,
        ResumeBullet: 21,
        ResumeSkill: 22,
      };
      for (const [styleId, halfPoints] of Object.entries(expectedFontSizes)) {
        const style = paragraphStyle(styles, styleId);
        expect(style).toContain('w:ascii="Cambria"');
        expect(style).toContain(`<w:sz w:val="${halfPoints}"/>`);
      }
      expect(body).toContain("<w:keepNext");
      expect(styles).toContain('<w:jc w:val="center"/>');
      expect(paragraphStyle(styles, "ResumeHeadline")).toContain('<w:jc w:val="center"/>');
      expect(styles).toContain('w:line="276"');
      expect(body).toContain("<w:pBdr>");
      expect(body).toContain('w:sz="5"');
      expect(body).toContain('<w:tab w:val="right" w:pos="9866"/>');
      expect(tabbedParagraphs.length).toBeGreaterThan(0);
      expect(tabbedParagraphs.every((value) =>
        (value.match(/<w:tab\/>/gu) ?? []).length === 1 && (value.match(/<w:tab\s[^>]*\/>/gu) ?? []).length === 1,
      )).toBe(true);
      expect(body).toContain('w:w="11906"');
      expect(body).toContain('w:h="16838"');
      expect(body).toContain('w:top="1020"');
      expect(body).toContain('w:right="1020"');
      expect(body).toContain('w:left="1020"');
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  test("renders headline, URL labels, grouped skills, and one summary paragraph", async () => {
    const base = await fixture("../examples/application.json");
    const resume: ResolvedResume = {
      ...base,
      basics: {
        ...base.basics,
        headline: "Full-Stack Engineer",
        links: [{ label: "github.com/sfsajid91", url: "https://github.com/sfsajid91" }],
        linkLines: [[{ label: "github.com/sfsajid91", url: "https://github.com/sfsajid91" }]],
      },
      summary: ["Built dependable APIs.", "Mentored a team."],
      sections: [
        ...base.sections.filter(({ kind }) => kind !== "summary"),
        { kind: "summary", title: "PROFESSIONAL SUMMARY" },
      ],
      skills: [
        { category: "Languages", labels: ["TypeScript", "Bun"] },
        { category: "Frontend", labels: ["React"] },
      ],
    };
    const directory = await temporaryDirectory();
    const output = join(directory, "resume.docx");
    try {
      await exportDocx(resume, { outputPath: output, paper: "a4", force: false });
      const body = await zipPart(output, "word/document.xml");
      const relationships = await zipPart(output, "word/_rels/document.xml.rels");
      const paragraphs = paragraphTexts(body);
      expect(paragraphs.indexOf("Full-Stack Engineer")).toBe(paragraphs.indexOf(base.basics.name) + 1);
      expect(paragraphs).toContain("github.com/sfsajid91");
      expect(relationships).toContain("https://github.com/sfsajid91");
      expect(paragraphs.filter((value) => value === "Built dependable APIs. Mentored a team.")).toHaveLength(1);
      expect(paragraphs).toContain("Languages: TypeScript, Bun");
      expect(paragraphs).toContain("Frontend: React");
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  test("writes long Unicode and template-looking strings as inert editable text", async () => {
    const base = await fixture("../examples/application.json");
    const hostileLooking = "{{#resume}} ${process.env.SECRET} <script> résumé 東京 🧪 ".repeat(320);
    const resume: ResolvedResume = {
      ...base,
      summary: [hostileLooking],
      sections: [{ kind: "summary", title: "PROFESSIONAL SUMMARY" }],
      skills: [],
    };
    const directory = await temporaryDirectory();
    const output = join(directory, "resume.docx");
    try {
      await exportDocx(resume, { outputPath: output, paper: "letter", force: false });
      const body = await zipPart(output, "word/document.xml");
      const visible = xmlText(body).join("");
      expect(visible).toContain(hostileLooking);
      expect(body).toContain('w:w="12240"');
      expect(body).toContain('w:h="15840"');
      expect(body).not.toContain("<script>");
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  test("refuses clobbering, replaces with force, and preserves output on generation failure", async () => {
    const resume = await fixture("../examples/application.json");
    const directory = await temporaryDirectory();
    const output = join(directory, "resume.docx");
    try {
      await exportDocx(resume, { outputPath: output, paper: "a4", force: false });
      const first = await readFile(output);
      await expect(exportDocx(resume, { outputPath: output, paper: "a4", force: false })).rejects.toMatchObject({ code: "EEXIST" });
      expect(await readFile(output)).toEqual(first);
      await exportDocx(resume, { outputPath: output, paper: "letter", force: true });
      expect(await zipPart(output, "word/document.xml")).toContain('w:w="12240"');

      const broken = { ...resume, basics: undefined } as unknown as ResolvedResume;
      await expect(exportDocx(broken, { outputPath: output, paper: "a4", force: true })).rejects.toThrow();
      expect(await zipPart(output, "word/document.xml")).toContain('w:w="12240"');
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
  test("keeps project links on the subtitle line and renders locations and certification dates", async () => {
    const resume = await fixture("../examples/lint-bad-application.json");
    const directory = await temporaryDirectory();
    const output = join(directory, "lint-layout.docx");
    const projectTitle = "Multi Region Incident Response and Deployment Recovery Readiness Toolkit";
    try {
      await exportDocx(resume, { outputPath: output, paper: "a4", force: false });
      const [body, styles] = await Promise.all([
        zipPart(output, "word/document.xml"),
        zipPart(output, "word/styles.xml"),
      ]);
      const paragraphs = paragraphTexts(body);
      const projectHeader = paragraphs.find((value) => value.startsWith(projectTitle));
      expect(projectHeader).toContain("Apr 2019 – Apr 2020");
      expect(projectHeader).not.toContain("example.org");
      expect(paragraphs.some((value) => value.includes("example.org/projects/recovery-readiness-toolkit"))).toBe(true);
      expect(paragraphs.some((value) =>
        value.replace(/\s+/gu, " ") === "Northstar — Recovery Systems | Portland, OR",
      )).toBe(true);
      expect(paragraphs.some((value) => value.includes("Issued Mar 2018 · Expires Mar 2021"))).toBe(true);
      const headingStyle = paragraphStyle(styles, "ResumeSectionHeading");
      expect(headingStyle).toContain('w:before="360"');
      expect(headingStyle).toContain('w:after="80"');
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
  test("serializes Phase 7 header links and section-wide subtitle slots", async () => {
    const resume = await fixture("../examples/phase7-render-application.json");
    const directory = await temporaryDirectory();
    const output = join(directory, "phase7.docx");
    try {
      await exportDocx(resume, { outputPath: output, paper: "a4", force: false });
      const [body, relationships, styles] = await Promise.all([
        zipPart(output, "word/document.xml"),
        zipPart(output, "word/_rels/document.xml.rels"),
        zipPart(output, "word/styles.xml"),
      ]);
      const paragraphs = paragraphTexts(body).map((value) => value.replaceAll("\u2060", ""));
      const linkParagraphs = paragraphs.filter((value) => /linkedin\.com|research\.example|Open profile/u.test(value));
      expect(linkParagraphs).toHaveLength(2);
      expect(linkParagraphs.map((value) => value.split(" | ").length)).toEqual([3, 5]);
      expect(relationships).toContain("https://linkedin.com/in/jordan-example/");
      expect(relationships).not.toContain("Open profile");
      expect(paragraphs).toContain("Sample Research Lab | North Sample | TypeScript, PostgreSQL, Docker");
      expect(paragraphs).toContain("Example Studio | Python, FastAPI");
      expect(paragraphs).toContain("Community Workshop | West Example");
      expect(paragraphs).toContain("Personal scheduling application");
      expect(paragraphs).toContain("Open data explorer");
      expect(paragraphs).toContain("Accessibility audit helper");
      expect(paragraphs).toContain("Remote | React, SQLite | projects.example.test/orbit-planner");
      expect(paragraphs).toContain("Svelte, MapLibre, Vite");
      expect(paragraphs.some((value) =>
        value.replace(/\s+/gu, " ") === "Sample City | tools.example.test/access-check",
      )).toBe(true);
      expect(paragraphStyle(styles, "ResumeSectionHeading")).toContain('w:before="360"');
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
  test("places sections in requested partial order and preserves the default omitted order", async () => {
    const raw = JSON.parse(await readFile(new URL("../examples/dense-application.json", import.meta.url), "utf8")) as unknown;
    const application = applicationSchema.parse(raw);
    const directory = await temporaryDirectory();
    try {
      const cases: { order?: ("summary" | "skills" | "experience" | "projects" | "education" | "certifications")[]; expectedPrefix: string[] }[] = [
        { order: ["education", "projects"], expectedPrefix: ["EDUCATION", "SELECTED PROJECTS", "PROFESSIONAL SUMMARY"] },
        { expectedPrefix: ["PROFESSIONAL SUMMARY", "PROFESSIONAL EXPERIENCE", "TECHNICAL SKILLS"] },
      ];
      for (const { order, expectedPrefix } of cases) {
        if (order === undefined) delete application.resume.sectionOrder;
        else application.resume.sectionOrder = [...order];
        const output = join(directory, "section-order.docx");
        await exportDocx(resolveResume(application), { outputPath: output, paper: "a4", force: true });
        const paragraphs = paragraphTexts(await zipPart(output, "word/document.xml"));
        expect(paragraphs.filter((value) => expectedPrefix.includes(value)).slice(0, expectedPrefix.length)).toEqual(expectedPrefix);
      }
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
