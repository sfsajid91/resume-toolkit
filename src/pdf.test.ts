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
          const linksY = lines.find(({ text: value }) => value === "Portfolio | GitHub")?.y;
          const headingIndex = lines.findIndex(({ text: value }) => value === "PROFESSIONAL SUMMARY");
          const firstBodyIndex = lines.findIndex(({ text: value }) => value.startsWith("Product-minded"));
          const nextParagraphIndex = lines.findIndex(({ text: value }) => value.startsWith("Known for"));
          const headingY = lines[headingIndex]?.y;
          const firstBodyY = lines[firstBodyIndex]?.y;
          const secondBodyY = lines[nextParagraphIndex - 1]?.y;
          const nextParagraphY = lines[nextParagraphIndex]?.y;
          if ([nameY, contactY, linksY, headingY, firstBodyY, secondBodyY, nextParagraphY].some((value) => value === undefined)) {
            throw new Error("The dense PDF fixture is missing expected resume text rows.");
          }
          expect(contactY! - nameY!).toBeGreaterThanOrEqual(24);
          expect(linksY! - contactY!).toBeGreaterThanOrEqual(10);
          expect(firstBodyY! - headingY!).toBeGreaterThanOrEqual(20);
          expect(secondBodyY! - firstBodyY!).toBeGreaterThanOrEqual(14);
          expect(nextParagraphY! - secondBodyY!).toBeGreaterThanOrEqual(16);
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
  test.skipIf(!inspectionToolsAvailable)("renders optional headline and category-grouped skills", async () => {
    const base = await fixture("application.json");
    const resume = {
      ...base,
      basics: { ...base.basics, headline: "Full-Stack Engineer" },
      skills: [
        { category: "Languages", labels: ["TypeScript", "Bun"] },
        { category: "Frontend", labels: ["React"] },
      ],
    };
    const directory = await mkdtemp(join(tmpdir(), "resume-pdf-options-test-"));
    const outputPath = join(directory, "resume.pdf");
    try {
      await exportPdf(resume, { outputPath, paper: "letter", force: false });
      const text = await command("pdftotext", [outputPath, "-"]);
      expect(text).toContain("Full-Stack Engineer");
      expect(text.replace(/\s+/gu, " ")).toContain("Languages: TypeScript, Bun");
      expect(text.replace(/\s+/gu, " ")).toContain("Frontend: React");
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

});
