# Rendered artifact review

After every render, inspect the actual output, not just the renderer's exit code. For PDFs, rasterize all pages with `pdftoppm` (for example, `pdftoppm -png resume.pdf /tmp/resume-page`) and open every generated page image. `pdftotext` can help spot missing text, but cannot replace visual inspection. Review DOCX in a renderer capable of showing its actual page layout; if converted to PDF for review, inspect those rasterized pages too.

Check every item:

- **Page count:** fits the intended one-page or two-page limit; no accidental blank or extra pages.
- **Entry titles:** no wrapped entry titles or awkward title/date collisions.
- **Heading spacing:** consistent spacing and hierarchy between headings, entries, and body text.
- **Dates:** consistent `Mon YYYY` format, correct ranges, and `Present` for current roles.
- **Link text:** visible labels are descriptive and readable, not raw or misleading URLs; links point to their intended destinations.
- **Stranded headings:** no section heading left at a page bottom without its content.
- **Bullet alignment:** consistent indentation, hanging alignment, and spacing; no clipped or misaligned bullets.
- **Skills layout:** categories and items are legible, aligned, and not crowded or split confusingly.

Also check for clipping, overlaps, broken glyphs, orphan lines, missing content, and unexpected page breaks. Fix any issue and render again; inspect every new render. Report unresolved issues plainly. A visual check is not an ATS compatibility guarantee.
