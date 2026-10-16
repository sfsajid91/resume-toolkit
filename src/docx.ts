import { writeFile } from "node:fs/promises";
import {
  AlignmentType,
  Document,
  ExternalHyperlink,
  LevelFormat,
  LineRuleType,
  Packer,
  Paragraph,
  Tab,
  TabStopType,
  TextRun,
} from "docx";
import { DESIGN, DESIGN_VERSION, type PaperSize } from "./design.ts";
import { displayUrl, type ResolvedResume } from "./resume.ts";
import { writeStagedOutput } from "./io.ts";

const rendererVersion = "docx@9.10.0";
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

function hyperlink(url: string, label: string, options: RunOptions = {}): ExternalHyperlink {
  return new ExternalHyperlink({
    link: url,
    children: [text(label, { ...options, color: DESIGN.colors.primary })],
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
        space: 1,
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

function resumeParagraphs(resume: ResolvedResume, printableWidthTwips: number): Paragraph[] {
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
  if (hasLinks) {
    const linkRuns = resume.basics.links.flatMap(({ label, url }, index) => [
      ...(index === 0 ? [] : [text(" | ", { sizePt: DESIGN.contactFontPt, color: DESIGN.colors.secondary })]),
      hyperlink(url, label, { sizePt: DESIGN.contactFontPt }),
    ]);
    children.push(paragraph(linkRuns, "ResumeContact", { spacingAfterPt: DESIGN.headerAfterPt }));
  }

  if (resume.summary.length > 0) {
    children.push(sectionHeading("PROFESSIONAL SUMMARY"));
    for (const item of resume.summary) {
      children.push(paragraph([text(item)], "ResumeBody"));
    }
  }

  for (const section of resume.sections) {
    if (section.entries.length === 0) continue;
    children.push(sectionHeading(section.title));
    for (const [entryIndex, entry] of section.entries.entries()) {
      const spacingBeforePt = entryIndex === 0 ? 0 : DESIGN.entryAfterPt;
      const dateRun = entry.dateRange === ""
        ? []
        : [text(entry.dateRange, { sizePt: DESIGN.entryDetailFontPt, color: DESIGN.colors.secondary, bold: false })];

      if (section.kind === "experience" || section.kind === "education") {
        const role = entry.title ?? entry.name;
        children.push(tabbedParagraph(
          [text(role, { sizePt: DESIGN.entryHeadingFontPt, bold: true, color: DESIGN.colors.primary })],
          dateRun,
          printableWidthTwips,
          { keepNext: true, spacingBeforePt },
        ));
        children.push(paragraph(
          [entry.url
            ? hyperlink(entry.url, entry.name, { sizePt: DESIGN.entryDetailFontPt, italic: true })
            : text(entry.name, { sizePt: DESIGN.entryDetailFontPt, italic: true, color: DESIGN.colors.secondary })],
          "ResumeEntryDetail",
          { keepNext: entry.bullets.length > 0 },
        ));
      } else if (section.kind === "projects") {
        const projectRight: (TextRun | ExternalHyperlink)[] = [];
        if (entry.url !== undefined) {
          projectRight.push(hyperlink(entry.url, displayUrl(entry.url), { sizePt: DESIGN.entryDetailFontPt, bold: false }));
        }
        if (entry.dateRange !== "") {
          if (projectRight.length > 0) projectRight.push(text(" | ", { sizePt: DESIGN.entryDetailFontPt, bold: false }));
          projectRight.push(text(entry.dateRange, { sizePt: DESIGN.entryDetailFontPt, color: DESIGN.colors.secondary, bold: false }));
        }
        children.push(tabbedParagraph(
          [text(entry.name, { sizePt: DESIGN.entryHeadingFontPt, bold: true, color: DESIGN.colors.primary })],
          projectRight,
          printableWidthTwips,
          { keepNext: entry.title !== undefined || entry.bullets.length > 0, spacingBeforePt },
        ));
        if (entry.title !== undefined) {
          children.push(paragraph(
            [text(entry.title, { sizePt: DESIGN.projectSubtitleFontPt, italic: true, color: DESIGN.colors.secondary })],
            "ResumeProjectSubtitle",
            { keepNext: entry.bullets.length > 0 },
          ));
        }
      } else {
        children.push(tabbedParagraph(
          [text(entry.name, { sizePt: DESIGN.entryHeadingFontPt, bold: true, color: DESIGN.colors.primary })],
          dateRun,
          printableWidthTwips,
          { keepNext: entry.issuer !== undefined || entry.bullets.length > 0, spacingBeforePt },
        ));
        if (entry.issuer !== undefined) {
          children.push(paragraph(
            [text(entry.issuer, { sizePt: DESIGN.entryDetailFontPt, italic: true, color: DESIGN.colors.secondary })],
            "ResumeEntryDetail",
            { keepNext: entry.bullets.length > 0 },
          ));
        }
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

  if (resume.skills.length > 0) {
    children.push(sectionHeading("TECHNICAL SKILLS"));
    for (const group of resume.skills) {
      const label = group.category ?? "Skills";
      children.push(paragraph([
        text(`${label}: `, { bold: true, color: DESIGN.colors.primary }),
        text(group.labels.join(", ")),
      ], "ResumeSkill"));
    }
  }
  return children;
}

function createDocument(resume: ResolvedResume, paper: PaperSize): Document {
  const paperDimensions = DESIGN.papers[paper];
  const leftMarginTwips = Math.round(DESIGN.marginsMm.left * twipsPerMm);
  const rightMarginTwips = Math.round(DESIGN.marginsMm.right * twipsPerMm);
  const printableWidthTwips = Math.round(paperDimensions.widthMm * twipsPerMm) - leftMarginTwips - rightMarginTwips;
  const lineSpacing = { line: DESIGN.docxLineSpacingTwips, lineRule: LineRuleType.AUTO };
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
        { id: "ResumeProjectSubtitle", name: "Resume Project Subtitle", basedOn: "Normal", next: "ResumeBody", run: { font: DESIGN.fontFamily, size: DESIGN.projectSubtitleFontPt * 2, italics: true, color: DESIGN.colors.secondary.slice(1) }, paragraph: { spacing: spacing(0, DESIGN.paragraphAfterPt) } },
        { id: "ResumeBody", name: "Resume Body", basedOn: "Normal", next: "ResumeBody", run: { font: DESIGN.fontFamily, size: DESIGN.bodyFontPt * 2, color: DESIGN.colors.primary.slice(1) }, paragraph: { spacing: spacing(0, DESIGN.paragraphAfterPt) } },
        { id: "ResumeBullet", name: "Resume Bullet", basedOn: "Normal", next: "ResumeBullet", run: { font: DESIGN.fontFamily, size: DESIGN.bodyFontPt * 2, color: DESIGN.colors.primary.slice(1) }, paragraph: { spacing: spacing(0, DESIGN.bulletAfterPt) } },
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
      children: resumeParagraphs(resume, printableWidthTwips),
    }],
  });
}

export async function exportDocx(
  resume: ResolvedResume,
  options: { readonly outputPath: string; readonly paper: PaperSize; readonly force: boolean },
): Promise<string> {
  const document = createDocument(resume, options.paper);
  await writeStagedOutput(options.outputPath, options.force, async (stagedPath) => {
    await writeFile(stagedPath, await Packer.toBuffer(document));
  });
  return rendererVersion;
}
