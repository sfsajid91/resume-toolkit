export type PaperSize = "a4" | "letter";

export const DESIGN_VERSION = "2.0.0";
export const DESIGN = {
  fontFamily: "Carlito",
  fontFallbacks: { cjk: "Droid Sans Fallback", emoji: "Noto Emoji" },
  colors: { primary: "#000000", secondary: "#222222" },
  bodyFontPt: 10,
  nameFontPt: 20,
  headlineFontPt: 11,
  contactFontPt: 9.5,
  sectionHeadingFontPt: 11,
  entryHeadingFontPt: 10.5,
  entryDetailFontPt: 10,
  projectSubtitleFontPt: 9.5,
  marginsMm: { top: 15, right: 16, bottom: 15, left: 16 },
  typstLeadingEm: 0.55,
  docxLineSpacingTwips: 276,
  paragraphAfterPt: 3,
  nameAfterPt: 2,
  headlineAfterPt: 3,
  headerAfterPt: 8,
  bulletAfterPt: 2,
  entryAfterPt: 6,
  skillLineAfterPt: 2,
  sectionBeforePt: 9,
  sectionAfterPt: 4,
  bulletHangingIndentMm: 4.5,
  sectionRulePt: 0.6,
  papers: {
    a4: { widthMm: 210, heightMm: 297 },
    letter: { widthMm: 215.9, heightMm: 279.4 },
  },
} as const;
