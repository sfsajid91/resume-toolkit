export type PaperSize = "a4" | "letter";

// Version tag included in PDF metadata and design-related output.
export const DESIGN_VERSION = "2.6.0";
export const DESIGN = {
	// DOCX-facing font name.
	fontFamily: "Cambria",
	// PDF font family; Caladea is metric-compatible with Cambria.
	typstFontFamily: "Caladea",
	// Fallback fonts used for CJK characters and emoji in the PDF.
	fontFallbacks: { cjk: "Droid Sans Fallback", emoji: "Noto Emoji" },
	// Main text color, subdued secondary text color, and hyperlink color.
	colors: { primary: "#000000", secondary: "#222222", link: "#004f9e" },
	// Default body text size in points.
	bodyFontPt: 11,
	// Resume bullet text size in points.
	bulletFontPt: 10.5,
	// Name in the resume header, in points.
	nameFontPt: 19,
	// Optional headline below the name, in points.
	headlineFontPt: 12,
	// Contact details and links in the header, in points.
	contactFontPt: 11,
	// Section titles, in points.
	sectionHeadingFontPt: 12,
	// Entry titles (such as job titles), in points.
	entryHeadingFontPt: 11,
	// Entry dates and supporting details, in points.
	entryDetailFontPt: 11,
	// Page margins for top, right, bottom, and left, in millimeters.
	marginsMm: { top: 18, right: 18, bottom: 18, left: 18 },
	// PDF line leading as a multiple of the text size.
	typstLeadingEm: 0.76,
	// Extra vertical gap as a multiple of text size in the PDF.
	typstTrailingGapEm: 0.7,
	// DOCX automatic line spacing, measured in 240ths of a point.
	docxAutoLineSpacing240ths: 276,
	// Space after body paragraphs, in points.
	paragraphAfterPt: 3,
	// Space after the name in the header, in points.
	nameAfterPt: 2,
	// Space after the headline in the header, in points.
	headlineAfterPt: 3,
	// Space after the complete header and before resume sections, in points.
	headerAfterPt: 8,
	// Space between bullet items, in points.
	bulletAfterPt: 2,
	// Space before each entry after the first in a section, in points.
	entryAfterPt: 4,
	// Space between skill-group lines, in points.
	skillLineAfterPt: 2,
	// Space before each section heading, in points.
	sectionBeforePt: 18,
	// Space between section heading text and its horizontal rule, in points.
	sectionRuleGapPt: 2,
	// Space after each section heading's rule before its content (Typst points).
	sectionAfterPt: 4,
	// Hanging indent for bullet text, in millimeters.
	bulletHangingIndentMm: 4.5,
	// Thickness of the horizontal rule under section headings (Typst points).
	sectionRulePt: 0.6,
	// Supported page sizes and their physical dimensions in millimeters.
	papers: {
		// ISO A4 page width and height.
		a4: { widthMm: 210, heightMm: 297 },
		// US Letter page width and height.
		letter: { widthMm: 215.9, heightMm: 279.4 },
	},
} as const;
