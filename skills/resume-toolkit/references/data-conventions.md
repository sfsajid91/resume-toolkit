# Snapshot data conventions

Use schema version 1. Generate or inspect the authoritative shape with `resume-toolkit schema --kind application --json`; validate each finished snapshot with the CLI.

- Keep a stable application `id`, positive integer `revision`, unique IDs, and only fields allowed by the strict schema.
- Use factual dates as `YYYY-MM`. A null `end` means `Present`; do not invent a current end date. Keep date display consistent as `Mon YYYY` in resume content.
- Certifications use `start` for issue date and optional `expires`; never represent a certification date as a date range. Drop expired certifications unless relevant.
- Use supplied `resume.basics.location` for the header; optional `entry.location` appends a city or location to that entry's italic detail line. Never infer either location.
- `resume.summary` is an array of claims and defaults to empty.
- Section kinds are `experience`, `projects`, `education`, and `certifications`; preserve their supplied order. Set optional `resume.skillsPosition` to `after-summary`, `after-experience`, or `end` to place the skills section; omission keeps the current default.
- Skills have `id`, `label`, optional `category`, and `evidenceIds`. Group them into named categories; use at least two skills per category. Do not put unsupported terms in skills.
- Claims have `id`, `text`, and `evidenceIds`; each entry bullet must stay within that entry's facts. Evidence records retain `entryId`, source kind and locator, text, and `confirmedByUser`.
- Only mode-A evaluation requires evidence IDs on every claim and skill and exact, nonempty job requirement quotes from `job.rawText`. Tailoring without evaluation, review, and render-only do not require them.
- Use no em dashes in any resume text (including summary, bullets, headings, skills, and labels). Use a hyphen only where grammar or a proper name requires it.
