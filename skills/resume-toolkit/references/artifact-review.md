# Rendered artifact review

After every render, inspect the actual output, not just the renderer's exit code. For PDFs, rasterize all pages with `pdftoppm` (for example, `pdftoppm -png resume.pdf /tmp/resume-page`) and open every generated page image. `pdftotext` can help spot missing text, but cannot replace visual inspection. Review DOCX in a renderer capable of showing its actual page layout; if converted to PDF for review, inspect those rasterized pages too.

Check every item:

- **Page count:** fits the intended one-page or two-page limit; no accidental blank or extra pages.
- **Entry titles:** no wrapped entry titles or awkward title/date collisions.
- **Heading spacing:** consistent spacing and hierarchy between headings, entries, and body text; ensure no tight heading spacing (heading gap should be at least 2x the entry gap).
- **Entry subtitles:** no inconsistent entry subtitles; check that location, stack, and link slots remain consistent and aligned across entries within each section.
- **Dates:** consistent `Mon YYYY` format, correct ranges, and `Present` for current roles.
- **Link text and header links:** visible labels are descriptive and readable, not raw or misleading URLs; no orphaned header link stranded on a line alone; verify no unwanted trailing slash URLs in displayed links.
- **Stranded headings:** no section heading left at a page bottom without its content.
- **Bullet alignment:** consistent indentation, hanging alignment, and spacing; no clipped or misaligned bullets.
- **Skills layout:** categories and items are legible, aligned, and not crowded or split confusingly.
- **Text layer:** also extract PDF text with `pdftotext -enc UTF-8 resume.pdf resume.txt`. Check reading order, literal contact details, dates, credential status, technical terms, and accented characters against the final snapshot. Look for missing text and replacement glyphs; working links and page images alone cannot prove that text survived export. Check truthful target terms, not keyword coverage achieved by adding unsupported claims. If extraction is unavailable, disclose that limit rather than claiming it passed.
Also check for clipping, overlaps, broken glyphs, orphan lines, missing content, and unexpected page breaks. Fix any issue and render again; inspect every new render. Report unresolved issues plainly. A visual check is not an ATS compatibility guarantee.
