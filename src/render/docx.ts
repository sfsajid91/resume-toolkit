import { readFile, writeFile } from "node:fs/promises";
import {
  AlignmentType,
  Document,
  ExternalHyperlink,
  ImageRun,
  LevelFormat,
  LineRuleType,
  Packer,
  Paragraph,
  Tab,
  TabStopType,
  TextRun,
} from "docx";
import { DESIGN, DESIGN_VERSION, type PaperSize } from "../resume/design.ts";
import type { ResolvedResume } from "../resume/resume.ts";
import { writeStagedOutput } from "../application/io.ts";

const rendererVersion = "docx@9.10.0";
const ICONS_DIR = new URL("../../assets/icons/", import.meta.url);
type LinkIcon = "globe" | "github";
type IconAsset = { readonly svg: Uint8Array; readonly png: Uint8Array };
type IconData = Readonly<Record<LinkIcon, IconAsset>>;
const twipsPerMm = 1440 / 25.4;
const pointsToTwips = (points: number) => points * 20;

type RunOptions = {
  readonly bold?: boolean;
  readonly italic?: boolean;
  readonly sizePt?: number;
  readonly color?: string;
};

type ParagraphOptions = {
  readonly keepNext?: boolean;
  readonly spacingBeforePt?: number;
  readonly spacingAfterPt?: number;
};

function text(value: string, options: RunOptions = {}): TextRun {
  return new TextRun({
    text: value,
    font: DESIGN.fontFamily,
    ...(options.bold === undefined ? {} : { bold: options.bold }),
    ...(options.italic === undefined ? {} : { italics: options.italic }),
    ...(options.sizePt === undefined ? {} : { size: options.sizePt * 2 }),
    ...(options.color === undefined ? {} : { color: options.color.slice(1) }),
  });
}

function hyperlink(url: string, label: string, icon: LinkIcon, icons: IconData, options: RunOptions = {}, noBreak = false): ExternalHyperlink {
  return new ExternalHyperlink({
    link: url,
    children: [
      new ImageRun({
        type: "svg",
        data: icons[icon].svg,
        fallback: { type: "png", data: icons[icon].png },
        transformation: { width: 10, height: 10 },
        altText: { name: "", description: "" },
      }),
      text(` ${noBreak ? label.split("").join("\u2060") : label}`, { ...options, color: DESIGN.colors.link }),
    ],
  });
}

function paragraph(
  children: (TextRun | ExternalHyperlink)[],
  style: string,
  options: ParagraphOptions = {},
): Paragraph {
  const spacing = {
    ...(options.spacingBeforePt === undefined ? {} : { before: pointsToTwips(options.spacingBeforePt) }),
    ...(options.spacingAfterPt === undefined ? {} : { after: pointsToTwips(options.spacingAfterPt) }),
  };
  return new Paragraph({
    children,
    style,
    ...(options.keepNext ? { keepNext: true } : {}),
    ...(Object.keys(spacing).length === 0 ? {} : { spacing }),
  });
}

function sectionHeading(value: string): Paragraph {
  return new Paragraph({
    children: [text(value, { sizePt: DESIGN.sectionHeadingFontPt, bold: true, color: DESIGN.colors.primary })],
    style: "ResumeSectionHeading",
    keepNext: true,
    border: {
      bottom: {
        color: DESIGN.colors.primary.slice(1),
        space: DESIGN.sectionRuleGapPt,
        style: "single",
        size: Math.round(DESIGN.sectionRulePt * 8),
      },
    },
  });
}

function tabbedParagraph(
  left: (TextRun | ExternalHyperlink)[],
  right: (TextRun | ExternalHyperlink)[],
  printableWidthTwips: number,
  options: ParagraphOptions = {},
): Paragraph {
  return new Paragraph({
    children: [...left, ...(right.length === 0 ? [] : [new TextRun({ children: [new Tab()], font: DESIGN.fontFamily }), ...right])],
    style: "ResumeEntryHeading",
    ...(options.keepNext ? { keepNext: true } : {}),
    ...(options.spacingBeforePt === undefined ? {} : { spacing: { before: pointsToTwips(options.spacingBeforePt) } }),
    ...(right.length === 0 ? {} : {
      tabStops: [{ type: TabStopType.RIGHT, position: printableWidthTwips }],
    }),
  });
}

function resumeParagraphs(resume: ResolvedResume, printableWidthTwips: number, icons: IconData): Paragraph[] {
  const children: Paragraph[] = [];
  const contactValues = [resume.basics.location, resume.basics.phone, resume.basics.email]
    .filter((value): value is string => value !== undefined);
  const hasHeadline = resume.basics.headline !== undefined;
  const hasContacts = contactValues.length > 0;
  const hasLinks = resume.basics.links.length > 0;

  children.push(paragraph(
    [text(resume.basics.name, { sizePt: DESIGN.nameFontPt, bold: true, color: DESIGN.colors.primary })],
    "ResumeName",
    { keepNext: hasHeadline || hasContacts || hasLinks, spacingAfterPt: hasHeadline || hasContacts || hasLinks ? DESIGN.nameAfterPt : DESIGN.headerAfterPt },
  ));
  if (resume.basics.headline !== undefined) {
    children.push(paragraph(
      [text(resume.basics.headline, { sizePt: DESIGN.headlineFontPt, color: DESIGN.colors.secondary })],
      "ResumeHeadline",
      { keepNext: hasContacts || hasLinks, spacingAfterPt: hasContacts || hasLinks ? DESIGN.headlineAfterPt : DESIGN.headerAfterPt },
    ));
  }
  if (hasContacts) {
    children.push(paragraph(
      [text(contactValues.join(" | "), { sizePt: DESIGN.contactFontPt, color: DESIGN.colors.secondary })],
      "ResumeContact",
      { keepNext: hasLinks, spacingAfterPt: hasLinks ? 0 : DESIGN.headerAfterPt },
    ));
  }
  for (const [lineIndex, line] of resume.basics.linkLines.entries()) {
    const linkRuns = line.flatMap(({ label, url, icon }, index) => [
      ...(index === 0 ? [] : [text(" | ", { sizePt: DESIGN.contactFontPt, color: DESIGN.colors.secondary })]),
      ...(url === undefined
        ? [text(label, { sizePt: DESIGN.contactFontPt, color: DESIGN.colors.secondary })]
        : [hyperlink(url, label, icon ?? "globe", icons, { sizePt: DESIGN.contactFontPt }, true)]),
    ]);
    children.push(paragraph(linkRuns, "ResumeContact", {
      keepNext: lineIndex < resume.basics.linkLines.length - 1,
      spacingAfterPt: lineIndex === resume.basics.linkLines.length - 1 ? DESIGN.headerAfterPt : 0,
    }));
  }

  for (const section of resume.sections) {
    if (section.kind === "summary") {
      children.push(sectionHeading(section.title));
      children.push(paragraph([text(resume.summary.join(" "))], "ResumeBody"));
      continue;
    }
    if (section.kind === "skills") {
      children.push(sectionHeading(section.title));
      for (const group of resume.skills) {
        const label = group.category ?? "Skills";
        children.push(paragraph([
          text(`${label}: `, { bold: true, color: DESIGN.colors.primary }),
          text(group.labels.join(", ")),
        ], "ResumeSkill"));
      }
      continue;
    }
    if (section.entries.length === 0) continue;
    children.push(sectionHeading(section.title));
    for (const [entryIndex, entry] of section.entries.entries()) {
      const spacingBeforePt = entryIndex === 0 ? 0 : DESIGN.entryAfterPt;
      const dateRun = entry.dateText === ""
        ? []
        : [text(entry.dateText, { sizePt: DESIGN.entryDetailFontPt, color: DESIGN.colors.secondary, bold: false })];
      const headingRuns: (TextRun | ExternalHyperlink)[] = [
        text(entry.heading, { sizePt: DESIGN.entryHeadingFontPt, bold: true, color: DESIGN.colors.primary }),
      ];
      if (section.kind === "projects" && entry.dateText === "" && entry.url !== undefined) {
        headingRuns.push(text("  "));
        headingRuns.push(hyperlink(entry.url, entry.urlLabel ?? "Live", entry.urlIcon ?? "globe", icons, { sizePt: DESIGN.entryDetailFontPt }));
      }
      const detailRuns: (TextRun | ExternalHyperlink)[] = [];
      if (section.subtitleSlots) {
        const visibleSlots = entry.subtitle.filter((slot) => slot !== "");
        for (const [index, slot] of visibleSlots.entries()) {
          if (index > 0) detailRuns.push(text(" | ", { sizePt: DESIGN.entryDetailFontPt, italic: true, color: DESIGN.colors.secondary }));
          detailRuns.push(entry.url !== undefined && slot === entry.urlLabel
            ? hyperlink(entry.url, slot, entry.urlIcon ?? "globe", icons, { sizePt: DESIGN.entryDetailFontPt, italic: true }, true)
            : text(slot, { sizePt: DESIGN.entryDetailFontPt, italic: true, color: DESIGN.colors.secondary }));
        }
      } else {
        if (entry.detail !== "") {
          detailRuns.push(text(entry.detail, { sizePt: DESIGN.entryDetailFontPt, italic: true, color: DESIGN.colors.secondary }));
        }
        if (entry.url !== undefined && section.kind !== "projects") {
          if (detailRuns.length > 0) detailRuns.push(text(" | ", { sizePt: DESIGN.entryDetailFontPt, italic: true, color: DESIGN.colors.secondary }));
          detailRuns.push(hyperlink(entry.url, entry.urlLabel ?? entry.url, entry.urlIcon ?? "globe", icons, { sizePt: DESIGN.entryDetailFontPt, italic: true }));
        }
      }
      if (section.kind === "projects" && entry.dateText !== "" && entry.url !== undefined) {
        if (detailRuns.length > 0) detailRuns.push(text(" | ", { sizePt: DESIGN.entryDetailFontPt, color: DESIGN.colors.secondary }));
        detailRuns.push(hyperlink(entry.url, entry.urlLabel ?? "Live", entry.urlIcon ?? "globe", icons, { sizePt: DESIGN.entryDetailFontPt }));
      }
      children.push(tabbedParagraph(
        headingRuns,
        dateRun,
        printableWidthTwips,
        { keepNext: detailRuns.length > 0 || entry.detail !== "" || entry.bullets.length > 0, spacingBeforePt },
      ));
      if (section.subtitleSlots && entry.detail !== "") {
        children.push(paragraph([
          text(entry.detail, { sizePt: DESIGN.entryDetailFontPt, italic: true, color: DESIGN.colors.secondary }),
        ], "ResumeEntryDetail", { keepNext: true }));
      }
      if (detailRuns.length > 0) {
        children.push(paragraph(detailRuns, "ResumeEntryDetail", { keepNext: entry.bullets.length > 0 }));
      }

      for (const bullet of entry.bullets) {
        children.push(new Paragraph({
          style: "ResumeBullet",
          numbering: { reference: "resume-bullets", level: 0 },
          children: [text(bullet)],
        }));
      }
    }
  }

  return children;
}

function createDocument(resume: ResolvedResume, paper: PaperSize, icons: IconData): Document {
  const paperDimensions = DESIGN.papers[paper];
  const leftMarginTwips = Math.round(DESIGN.marginsMm.left * twipsPerMm);
  const rightMarginTwips = Math.round(DESIGN.marginsMm.right * twipsPerMm);
  const printableWidthTwips = Math.round(paperDimensions.widthMm * twipsPerMm) - leftMarginTwips - rightMarginTwips;
  const lineSpacing = { line: DESIGN.docxAutoLineSpacing240ths, lineRule: LineRuleType.AUTO };
  const spacing = (before: number, after: number) => ({
    before: pointsToTwips(before),
    after: pointsToTwips(after),
    ...lineSpacing,
  });
  return new Document({
    creator: `Resume Toolkit design ${DESIGN_VERSION}`,
    styles: {
      default: {
        document: {
          run: { font: DESIGN.fontFamily, size: DESIGN.bodyFontPt * 2, color: DESIGN.colors.primary.slice(1) },
        },
      },
      paragraphStyles: [
        { id: "ResumeName", name: "Resume Name", basedOn: "Normal", next: "ResumeContact", run: { font: DESIGN.fontFamily, size: DESIGN.nameFontPt * 2, bold: true, color: DESIGN.colors.primary.slice(1) }, paragraph: { alignment: AlignmentType.CENTER, spacing: spacing(0, DESIGN.nameAfterPt) } },
        { id: "ResumeHeadline", name: "Resume Headline", basedOn: "Normal", next: "ResumeContact", run: { font: DESIGN.fontFamily, size: DESIGN.headlineFontPt * 2, color: DESIGN.colors.secondary.slice(1) }, paragraph: { alignment: AlignmentType.CENTER, spacing: spacing(0, DESIGN.headlineAfterPt) } },
        { id: "ResumeContact", name: "Resume Contact", basedOn: "Normal", next: "ResumeBody", run: { font: DESIGN.fontFamily, size: DESIGN.contactFontPt * 2, color: DESIGN.colors.secondary.slice(1) }, paragraph: { alignment: AlignmentType.CENTER, spacing: spacing(0, 0) } },
        { id: "ResumeSectionHeading", name: "Resume Section Heading", basedOn: "Normal", next: "ResumeBody", run: { font: DESIGN.fontFamily, size: DESIGN.sectionHeadingFontPt * 2, bold: true, color: DESIGN.colors.primary.slice(1) }, paragraph: { spacing: spacing(DESIGN.sectionBeforePt, DESIGN.sectionAfterPt) } },
        { id: "ResumeEntryHeading", name: "Resume Entry Heading", basedOn: "Normal", next: "ResumeEntryDetail", run: { font: DESIGN.fontFamily, size: DESIGN.entryHeadingFontPt * 2, bold: true, color: DESIGN.colors.primary.slice(1) }, paragraph: { spacing: spacing(0, 0) } },
        { id: "ResumeEntryDetail", name: "Resume Entry Detail", basedOn: "Normal", next: "ResumeBody", run: { font: DESIGN.fontFamily, size: DESIGN.entryDetailFontPt * 2, color: DESIGN.colors.secondary.slice(1) }, paragraph: { spacing: spacing(0, DESIGN.paragraphAfterPt) } },
        { id: "ResumeBody", name: "Resume Body", basedOn: "Normal", next: "ResumeBody", run: { font: DESIGN.fontFamily, size: DESIGN.bodyFontPt * 2, color: DESIGN.colors.primary.slice(1) }, paragraph: { spacing: spacing(0, DESIGN.paragraphAfterPt) } },
        { id: "ResumeBullet", name: "Resume Bullet", basedOn: "Normal", next: "ResumeBullet", run: { font: DESIGN.fontFamily, size: DESIGN.bulletFontPt * 2, color: DESIGN.colors.primary.slice(1) }, paragraph: { spacing: spacing(0, DESIGN.bulletAfterPt) } },
        { id: "ResumeSkill", name: "Resume Skill", basedOn: "Normal", next: "ResumeSkill", run: { font: DESIGN.fontFamily, size: DESIGN.bodyFontPt * 2, color: DESIGN.colors.primary.slice(1) }, paragraph: { spacing: spacing(0, DESIGN.skillLineAfterPt) } },
      ],
    },
    numbering: {
      config: [{
        reference: "resume-bullets",
        levels: [{
          level: 0,
          format: LevelFormat.BULLET,
          text: "•",
          alignment: AlignmentType.LEFT,
          style: {
            paragraph: {
              indent: {
                left: Math.round(DESIGN.bulletHangingIndentMm * twipsPerMm),
                hanging: Math.round(DESIGN.bulletHangingIndentMm * twipsPerMm),
              },
            },
          },
        }],
      }],
    },
    sections: [{
      properties: {
        page: {
          size: {
            width: Math.round(paperDimensions.widthMm * twipsPerMm),
            height: Math.round(paperDimensions.heightMm * twipsPerMm),
          },
          margin: {
            top: Math.round(DESIGN.marginsMm.top * twipsPerMm),
            right: rightMarginTwips,
            bottom: Math.round(DESIGN.marginsMm.bottom * twipsPerMm),
            left: leftMarginTwips,
          },
        },
      },
      children: resumeParagraphs(resume, printableWidthTwips, icons),
    }],
  });
}

export async function exportDocx(
  resume: ResolvedResume,
  options: { readonly outputPath: string; readonly paper: PaperSize; readonly force: boolean },
): Promise<string> {
  const icons: IconData = {
    globe: {
      svg: await readFile(new URL("globe.svg", ICONS_DIR)),
      png: await readFile(new URL("globe.png", ICONS_DIR)),
    },
    github: {
      svg: await readFile(new URL("github.svg", ICONS_DIR)),
      png: await readFile(new URL("github.png", ICONS_DIR)),
    },
  };
  const document = createDocument(resume, options.paper, icons);
  await writeStagedOutput(options.outputPath, options.force, async (stagedPath) => {
    await writeFile(stagedPath, await Packer.toBuffer(document));
  });
  return rendererVersion;
}
