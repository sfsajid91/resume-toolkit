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
    (value ?? "").replaceAll("&amp;", "&").replaceAll("&lt;", "<").replaceAll("&gt;", ">").replaceAll("&quot;", '"').replaceAll("&apos;", "'"),
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
      const tabbedParagraphs = [...body.matchAll(/<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/gu)]
        .map(([xml]) => xml ?? "")
        .filter((xml) => /<w:tab\s/u.test(xml));
      expect(visible[0]).toBe(resume.basics.name);
      expect(visible).toContain("PROFESSIONAL SUMMARY");
      expect(visible).toContain("PROFESSIONAL EXPERIENCE");
      expect(visible).toContain("SELECTED PROJECTS");
      expect(visible).toContain("EDUCATION");
      expect(visible).toContain("CERTIFICATIONS");
      expect(visible.join("")).toContain("Skills: TypeScript");
      expect(visible.indexOf("PROFESSIONAL EXPERIENCE")).toBeLessThan(visible.indexOf("SELECTED PROJECTS"));
      expect(visible.indexOf("SELECTED PROJECTS")).toBeLessThan(visible.indexOf("EDUCATION"));
      const firstBullet = resume.sections[0]?.entries[0]?.bullets[0];
      if (firstBullet === undefined) throw new Error("Dense fixture is missing its first bullet.");
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
        ResumeProjectSubtitle: 22,
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

  test("renders optional headline and category-grouped skills", async () => {
    const base = await fixture("../examples/application.json");
    const resume: ResolvedResume = {
      ...base,
      basics: { ...base.basics, headline: "Full-Stack Engineer" },
      skills: [
        { category: "Languages", labels: ["TypeScript", "Bun"] },
        { category: "Frontend", labels: ["React"] },
      ],
    };
    const directory = await temporaryDirectory();
    const output = join(directory, "resume.docx");
    try {
      await exportDocx(resume, { outputPath: output, paper: "a4", force: false });
      const visible = xmlText(await zipPart(output, "word/document.xml")).join("");
      expect(visible).toContain("Full-Stack Engineer");
      expect(visible).toContain("Languages: TypeScript, Bun");
      expect(visible).toContain("Frontend: React");
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
      sections: [],
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
});
