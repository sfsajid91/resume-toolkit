export type PaperSize = "a4" | "letter";

export const DESIGN_VERSION = "1.0.0";
export const DESIGN = {
  fontFamily: "Carlito",
  fontFallbacks: { cjk: "Droid Sans Fallback", emoji: "Noto Emoji" },
  bodyFontPt: 11,
  nameFontPt: 18,
  sectionHeadingFontPt: 12,
  entryHeadingFontPt: 11,
  marginsMm: 18,
  paragraphAfterPt: 4,
  bulletAfterPt: 2,
  sectionBeforePt: 9,
  papers: {
    a4: { widthMm: 210, heightMm: 297 },
    letter: { widthMm: 215.9, heightMm: 279.4 },
  },
} as const;
