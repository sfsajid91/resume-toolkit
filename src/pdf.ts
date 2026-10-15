import { copyFile, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { ResolvedResume } from "./resume.ts";
import { DESIGN, DESIGN_VERSION, type PaperSize } from "./design.ts";
import { writeStagedOutput } from "./io.ts";

const REQUIRED_TYPST_VERSION = "0.15.1";
const COMPILATION_TIMEOUT_MS = 30_000;
const VERSION_TIMEOUT_MS = 5_000;
const ASSETS_DIR = fileURLToPath(new URL("../assets/", import.meta.url));
const FONT_FILES = [
  "Carlito-Regular.ttf",
  "Carlito-Bold.ttf",
  "Carlito-Italic.ttf",
  "Carlito-BoldItalic.ttf",
  "DroidSansFallbackFull.ttf",
  "NotoEmoji-Regular.ttf",
  "OFL.txt",
  "DroidSansFallback-NOTICE.txt",
  "Apache-2.0.txt",
] as const;

function cleanEnvironment(home: string): NodeJS.ProcessEnv {
  return {
    PATH: process.env.PATH ?? "",
    HOME: home,
    TMPDIR: home,
    LANG: "C.UTF-8",
    LC_ALL: "C.UTF-8",
  };
}

function runTypst(args: readonly string[], timeoutMs: number, env: NodeJS.ProcessEnv): Promise<string> {
  const { promise, resolve, reject } = Promise.withResolvers<string>();
  let stdout = "";
  let settled = false;
  let timedOut = false;
  const child = spawn("typst", [...args], { env, stdio: ["ignore", "pipe", "ignore"] });
  const timer = setTimeout(() => {
    timedOut = true;
    child.kill("SIGKILL");
  }, timeoutMs);
  child.stdout.setEncoding("utf8");
  child.stdout.on("data", (chunk: string) => {
    if (stdout.length < 1024) stdout += chunk.slice(0, 1024 - stdout.length);
  });
  child.once("error", () => {
    if (settled) return;
    settled = true;
    clearTimeout(timer);
    reject(new Error(`Typst ${REQUIRED_TYPST_VERSION} could not be started.`));
  });
  child.once("close", (code) => {
    if (settled) return;
    settled = true;
    clearTimeout(timer);
    if (timedOut) reject(new Error(`Typst compilation exceeded ${COMPILATION_TIMEOUT_MS / 1000} seconds.`));
    else if (code !== 0) reject(new Error("Typst could not generate the PDF."));
    else resolve(stdout.trim());
  });
  return promise;
}

async function verifyTypstVersion(home: string): Promise<string> {
  let version: string;
  try {
    version = await runTypst(["--version"], VERSION_TIMEOUT_MS, cleanEnvironment(home));
  } catch {
    throw new Error(`Typst ${REQUIRED_TYPST_VERSION} is required for PDF export.`);
  }
  if (!version.startsWith(`typst ${REQUIRED_TYPST_VERSION} `)) {
    throw new Error(`Typst ${REQUIRED_TYPST_VERSION} is required for PDF export.`);
  }
  return version;
}

export async function exportPdf(
  resume: ResolvedResume,
  options: { readonly outputPath: string; readonly paper: PaperSize; readonly force: boolean },
): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "resume-toolkit-pdf-"));
  try {
    const version = await verifyTypstVersion(root);
    await writeStagedOutput(options.outputPath, options.force, async (stagedPath) => {
      const fontDir = join(root, "fonts");
      await mkdir(fontDir);
      await Promise.all([
        copyFile(join(ASSETS_DIR, "resume.typ"), join(root, "resume.typ")),
        ...FONT_FILES.map((file) => copyFile(join(ASSETS_DIR, "fonts", file), join(fontDir, file))),
        writeFile(join(root, "resume.json"), JSON.stringify(resume), { flag: "wx" }),
      ]);
      await runTypst([
        "compile",
        "--root", root,
        "--font-path", fontDir,
        "--ignore-system-fonts",
        "--diagnostic-format", "short",
        "--jobs", "1",
        "--input", `paper=${options.paper}`,
        "--input", `paper-width-mm=${DESIGN.papers[options.paper].widthMm}`,
        "--input", `paper-height-mm=${DESIGN.papers[options.paper].heightMm}`,
        "--input", `font-family=${DESIGN.fontFamily}`,
        "--input", `font-fallback-cjk=${DESIGN.fontFallbacks.cjk}`,
        "--input", `font-fallback-emoji=${DESIGN.fontFallbacks.emoji}`,
        "--input", `body-font-pt=${DESIGN.bodyFontPt}`,
        "--input", `name-font-pt=${DESIGN.nameFontPt}`,
        "--input", `section-heading-font-pt=${DESIGN.sectionHeadingFontPt}`,
        "--input", `entry-heading-font-pt=${DESIGN.entryHeadingFontPt}`,
        "--input", `margins-mm=${DESIGN.marginsMm}`,
        "--input", `paragraph-after-pt=${DESIGN.paragraphAfterPt}`,
        "--input", `bullet-after-pt=${DESIGN.bulletAfterPt}`,
        "--input", `section-before-pt=${DESIGN.sectionBeforePt}`,
        "--input", `design-version=${DESIGN_VERSION}`,
        join(root, "resume.typ"),
        stagedPath,
      ], COMPILATION_TIMEOUT_MS, cleanEnvironment(root));
    });
    return version;
  } catch (error) {
    if (error instanceof Error && /Typst (?:0\.15\.1|compilation)/.test(error.message)) throw error;
    throw new Error("PDF export failed; the existing output was left unchanged.");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}
