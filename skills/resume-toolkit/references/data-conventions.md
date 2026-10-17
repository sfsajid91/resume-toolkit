# Snapshot data conventions

Use schema version 1. Generate or inspect the authoritative shape with `resume-toolkit schema --kind application --json`; validate each finished snapshot with the CLI.

- Keep a stable application `id`, positive integer `revision`, unique IDs, and only fields allowed by the strict schema.
- Use factual dates as `YYYY-MM`. A null `end` means `Present`; do not invent a current end date. Keep date display consistent as `Mon YYYY` in resume content.
- Certifications use `start` for issue date and optional `expires`; never represent a certification date as a date range. Drop expired certifications unless relevant.
- Use supplied `resume.basics.location` for the header; optional `entry.location` appends a city or location to that entry's italic detail line. Never infer either location. Header links in `resume.basics.links` have required `label` and optional `url`.
- `resume.summary` is an array of claims and defaults to empty.
- Section kinds are `experience`, `projects`, `education`, and `certifications`. Optional `stack: string[]` is accepted on `experience` and `projects` entries to list technologies in the subtitle. Set optional `resume.sectionOrder` to an array of section IDs (`summary`, `skills`, `experience`, `projects`, `education`, `certifications`) to control section ordering; explicitly listed sections appear first in that order, followed by omitted section IDs in default order. Students and early-career profiles should place education before projects. Omission keeps default order.
- Skills have `id`, `label`, optional `category`, and `evidenceIds`. Group them into named categories; use at least two skills per category. Do not put unsupported terms in skills.
- Claims have `id`, `text`, and `evidenceIds`; each entry bullet must stay within that entry's facts. Evidence records retain `entryId`, source kind and locator, text, and `confirmedByUser`.
- Only mode-A evaluation requires evidence IDs on every claim and skill and exact, nonempty job requirement quotes from `job.rawText`. Tailoring without evaluation, review, and render-only do not require them.
- For mode-A job records, preserve the supplied posting in `job.rawText`, use exact nonempty requirement quotes, and set `importance` from explicit wording (`required`, `preferred`, or `unspecified`). Keep the agent's support/coverage working table outside the snapshot; do not add unsupported schema fields.
- For ongoing education use `end: null`; make in-progress status and any confirmed expected completion date explicit in `title`, for example `MSc Computing (in progress, expected Jun 2027)`. Do not use a date-only bullet or put the expected date in `end` as an award date. A certification `start` is an actual issue date, not an expected one.
- Preserve actual employment and project participation dates separately. Reuse source locators and evidence IDs only for the entry they support; a previous draft does not confirm its own claims.
- Use no em dashes in any resume text (including summary, bullets, headings, skills, and labels). Use a hyphen only where grammar or a proper name requires it.
