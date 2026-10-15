import { writeFile } from "node:fs/promises";
import {
  AlignmentType,
  Document,
  ExternalHyperlink,
  LevelFormat,
  Packer,
  Paragraph,
  TextRun,
} from "docx";
import { DESIGN, DESIGN_VERSION, type PaperSize } from "./design.ts";
import type { ResolvedResume } from "./resume.ts";
import { writeStagedOutput } from "./io.ts";

const rendererVersion = "docx@9.10.0";
const twipsPerMm = 1440 / 25.4;
const pointsToTwips = (points: number) => points * 20;

function text(value: string, bold = false): TextRun {
  return new TextRun({ text: value, ...(bold ? { bold: true } : {}), font: DESIGN.fontFamily });
}

function paragraph(value: string, style: string, options: { keepNext?: boolean } = {}): Paragraph {
  return new Paragraph({
    children: [text(value)],
    style,
    ...(options.keepNext ? { keepNext: true } : {}),
  });
}

function resumeParagraphs(resume: ResolvedResume): Paragraph[] {
  const children: Paragraph[] = [paragraph(resume.basics.name, "ResumeName", { keepNext: true })];
  const contacts = [resume.basics.email, resume.basics.phone, resume.basics.location]
    .filter((value): value is string => value !== undefined);
  if (contacts.length) children.push(paragraph(contacts.join(" · "), "ResumeContact", { keepNext: resume.basics.links.length > 0 }));
  if (resume.basics.links.length) {
    children.push(new Paragraph({
      style: "ResumeContact",
      children: resume.basics.links.flatMap(({ label, url }, index) => [
        ...(index ? [text(" · ")] : []),
        new ExternalHyperlink({
          link: url,
          children: [new TextRun({ text: label, style: "Hyperlink", font: DESIGN.fontFamily })],
        }),
      ]),
    }));
  }

  if (resume.summary.length) {
    children.push(paragraph("Summary", "ResumeSectionHeading", { keepNext: true }));
    for (const item of resume.summary) children.push(paragraph(item, "ResumeBody"));
  }

  for (const section of resume.sections) {
    children.push(paragraph(section.title, "ResumeSectionHeading", { keepNext: true }));
    for (const entry of section.entries) {
      const heading = [entry.name, entry.title, entry.issuer, entry.dateRange].filter(Boolean).join(" | ");
      if (entry.url) {
        children.push(new Paragraph({
          style: "ResumeEntryHeading",
          keepNext: entry.bullets.length > 0,
          children: [new ExternalHyperlink({
            link: entry.url,
            children: [new TextRun({ text: heading, style: "Hyperlink", font: DESIGN.fontFamily, bold: true })],
          })],
        }));
      } else {
        children.push(paragraph(heading, "ResumeEntryHeading", { keepNext: entry.bullets.length > 0 }));
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

  if (resume.skills.length) {
    children.push(paragraph("Skills", "ResumeSectionHeading", { keepNext: true }));
    children.push(paragraph(resume.skills.join(" · "), "ResumeBody"));
  }
  return children;
}

function createDocument(resume: ResolvedResume, paper: PaperSize): Document {
  const paperDimensions = DESIGN.papers[paper];
  return new Document({
    creator: `Resume Toolkit design ${DESIGN_VERSION}`,
    styles: {
      default: {
        document: { run: { font: DESIGN.fontFamily, size: DESIGN.bodyFontPt * 2 } },
      },
      paragraphStyles: [
        { id: "ResumeName", name: "Resume Name", basedOn: "Normal", next: "ResumeContact", run: { font: DESIGN.fontFamily, size: DESIGN.nameFontPt * 2, bold: true }, paragraph: { spacing: { after: pointsToTwips(DESIGN.paragraphAfterPt) } } },
        { id: "ResumeContact", name: "Resume Contact", basedOn: "Normal", next: "ResumeBody", run: { font: DESIGN.fontFamily, size: DESIGN.bodyFontPt * 2 }, paragraph: { spacing: { after: pointsToTwips(DESIGN.paragraphAfterPt) } } },
        { id: "ResumeSectionHeading", name: "Resume Section Heading", basedOn: "Normal", next: "ResumeBody", run: { font: DESIGN.fontFamily, size: DESIGN.sectionHeadingFontPt * 2, bold: true }, paragraph: { spacing: { before: pointsToTwips(DESIGN.sectionBeforePt), after: pointsToTwips(DESIGN.paragraphAfterPt) } } },
        { id: "ResumeEntryHeading", name: "Resume Entry Heading", basedOn: "Normal", next: "ResumeBody", run: { font: DESIGN.fontFamily, size: DESIGN.entryHeadingFontPt * 2, bold: true }, paragraph: { spacing: { after: pointsToTwips(DESIGN.paragraphAfterPt) } } },
        { id: "ResumeBody", name: "Resume Body", basedOn: "Normal", next: "ResumeBody", run: { font: DESIGN.fontFamily, size: DESIGN.bodyFontPt * 2 }, paragraph: { spacing: { after: pointsToTwips(DESIGN.paragraphAfterPt) } } },
        { id: "ResumeBullet", name: "Resume Bullet", basedOn: "Normal", next: "ResumeBullet", run: { font: DESIGN.fontFamily, size: DESIGN.bodyFontPt * 2 }, paragraph: { spacing: { after: pointsToTwips(DESIGN.bulletAfterPt) } } },
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
          style: { paragraph: { indent: { left: 360, hanging: 240 } } },
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
            top: Math.round(DESIGN.marginsMm * twipsPerMm),
            right: Math.round(DESIGN.marginsMm * twipsPerMm),
            bottom: Math.round(DESIGN.marginsMm * twipsPerMm),
            left: Math.round(DESIGN.marginsMm * twipsPerMm),
          },
        },
      },
      children: resumeParagraphs(resume),
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

