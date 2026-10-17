# Engineering Resume Writing Guide

Apply these rules when drafting or revising summaries, bullets, dates, skills, and layout. This guide is editorial advice, not a schema guarantee or promise of a Jev score. Research basis: [writing-guide-research.md](../../docs/writing-guide-research.md).

## Before drafting

### Establish facts before borrowing phrasing

Use supplied career records and user-confirmed statements as fact sources. A previous tailored resume is a phrasing reference, not independent proof of its claims. Check reused claims against their underlying sources; if sources conflict on dates, ownership, metrics, or credential status, ask once in a consolidated message and omit unresolved claims. Keep source locators and entry associations; never move one role's result into another.

For the strongest relevant work, establish the problem, the candidate's action, tools, users or system scope, and observed outcome. Ask for missing facts that would materially improve the resume, not a metric for every bullet. Distinguish measured results from estimates and team outcomes from personal contribution. Do not turn an estimate into a precise measurement.

### Map the target to evidence (mode A)

Check that the supplied posting identifies the intended employer, role, seniority, and full qualification text. If it is a truncated snippet or a listing page, use available tools to locate the employer's full posting or request the missing text; do not draft a job-targeted resume from a title alone. Surface material discrepancies instead of silently merging different postings.

Before writing, make a compact working table: exact requirement quote, required/preferred/unspecified importance, supporting source or evidence ID, direct/transferable/missing support, and the entry or claim that will show it. Use the posting's stated importance; do not promote an inferred priority to a mandatory qualification. Keep this table outside the strict snapshot schema.

- Prioritize the employer's core tasks and required qualifications, then preferred ones. Preserve `job.rawText` verbatim when creating a job record; requirements use exact nonempty quotes.
- Use the posting's terminology only when it describes the actual work. An adjacent tool, coursework, or a personal project is not equivalent to professional production experience with the requested technology.
- For a career or domain change, explain the supported bridge (shared methods, problems, or tools), not invented experience in the new domain. A short factual summary can provide this orientation; otherwise leave it empty.
- Keep missing qualifications visible in the conversation. Ask only about plausible missing evidence; never fill a gap by adding unsupported skills or changing a historical job title.
- In mode B, use the supplied resume's purpose and confirmed facts; do not invent a target posting or require job matching.

## Rules

### Select only relevant, supported material

- Prioritize evidence for required job requirements, then preferred requirements, then other relevant evidence. Never imply an unsupported qualification.
- Target one page for up to about 10 years of experience; never exceed two pages. Roles more than 10 years old get one or two bullets, or one line. Projects more than four years old without adoption evidence get one or two bullets or are dropped.
- Use at most three bullets per project. Include fewer bullets when evidence does not support distinct, relevant accomplishments.
- Avoid near-duplicate bullets. Do not repeat rollback, retry, recovery, or “safe” themes across unrelated roles; show those themes only where they are genuinely distinct and relevant.
- Default the summary to empty. If useful, include one or two factual claims, including one concrete, evidenced result. A years-of-experience claim must match the earliest supported start date. Avoid self-praise.
- Use specific supported technical terms in context; do not keyword-stuff or infer proficiency from a title, job description, or tool name.
- Keep entries reverse chronological within each section. Reorder bullets within a role and skill categories by relevance; do not reorder employment dates to put a preferred role first.
- When space is tight, cut duplicate claims and low-relevance lines across sections before cutting by age alone. Preserve the only concrete evidence for an important requirement, even when older. Cut content rather than shrinking typography or crowding the layout; do not pad to fill a page.

### Write bullets with a clear contribution

- Target **12–30 words** per bullet. One-line and two-line bullets are both expected; do not pad or compress merely to force uniform line lengths.
- State **X** (the outcome or change) and **Z** (the candidate's action/mechanism). Include **Y** only when evidence supplies a number, scale, scope, or boundary. Never invent a metric or imply unsupported causality.
- Keep action, context, and outcome precise. Use a concrete before/after or system boundary when no numeric result exists. If evidence does not establish an outcome, ask the user or omit the claim.
- Use past tense for completed work and present tense only for an ongoing state. Vary openings; make personal contribution distinct from team outcomes. Attribute team results to the team. Say “Led” only when evidence establishes leadership.
- Never force “by doing” or “while” tails. Avoid generic filler and “without X” tails unless the contrast is material, factual, and necessary.
- Never use em dashes; do not use en dashes outside date ranges. Avoid decorative punctuation and formulaic tails. Use ordinary hyphens only when required by a proper name or compound term.

### No hedging in resume text

- If a fact is uncertain, ask once, then write the confirmed fact plainly or omit. Keep confirmation status and apologetic effort qualifiers out of resume text. Preserve material scope: a prototype, academic project, or in-progress credential must not read as a production deployment, paid role, or completed qualification. State that scope directly rather than hiding it as a caveat.

### Describe the work, not the transaction

- Focus on technical implementation and outcomes rather than commercial transactions or marketplace platforms. Avoid phrasing centered on `paid`, `delivery`, `delivered through`, or platform names in bullet claims.

### Freelancers

- List work as experience (title, `Freelance`, date range), with 3–5 bullets for strongest builds; platform names belong in that entry, not header.

### Project selection

- Choose three projects with strongest stack depth and outcome, prefer client/user-facing linked projects.

### Summary, skills, dates, and credentials

- For engineering roles, include a concise 1–2 claim professional summary that acts as a technical elevator pitch: state core engineering specialization, primary languages/frameworks, and key technical domains. Ground every claim in confirmed evidence and concrete tools. Avoid empty buzzwords, generic adjectives, and self-praise. A years-of-experience claim must match the earliest supported start date.
- Use **3–5 skill category lines** with **5–8 items per category**. Use real tools and technologies, not broad domains such as “developer platforms.” Every skill implied by two or more bullets must appear in skills. Place skills after the summary for engineering roles using `resume.sectionOrder: ["summary", "skills", "experience", "projects", "education"]`.
- Keep dates consistent in display as `Mon YYYY`; snapshot dates use `YYYY-MM`, and null end dates display as `Present`.
- Certifications show `Issued Mon YYYY` or `Expires Mon YYYY`, never a date range. Drop expired certifications unless relevant.
- State in-progress education explicitly in the entry's title; add a confirmed expected completion date there, for example `MSc Computing (in progress, expected Jun 2027)`. Do not create a short date-only bullet or pad it to meet bullet-length guidance. Do not put a future expected date in `end` as though the credential were awarded; use `end: null` for ongoing education. Do not list an in-progress certification as held or use an expected date as its issue date.
- Use actual project participation dates, not automatically the enclosing employment dates. Keep overlapping roles and gaps truthful; never shorten dates or describe a gap as deliberate training without confirmation.
- Omit education dates only when the education is more than 10 years old and the user agrees.
- Include the user's supplied location in the location field; never infer one. In experience entries, the organization/employer is positioned first, followed by location and stack (`Company | Location | Stack`). In projects, empty slots are omitted without stray delimiter pipes. Choose section order with `resume.sectionOrder`.

### Banned language and patterns

Avoid all listed terms and phrases case-insensitively, including obvious tense, plural, and spelling variants. Preserve proper names and source evidence; revise generated resume text, not the facts. The list is a strict editing convention, not evidence that a word automatically triggers rejection by recruiters or ATS.

Banned terms (lint terms): `spearhead`, `spearheads`, `spearheaded`, `spearheading`, `orchestrate`, `orchestrates`, `orchestrated`, `orchestrating`, `leverage`, `leverages`, `leveraged`, `leveraging`, `utilize`, `utilizes`, `utilized`, `utilizing`, `catalyze`, `catalyzes`, `catalyzed`, `catalyzing`, `synergize`, `synergizes`, `synergized`, `synergizing`, `revolutionize`, `revolutionizes`, `revolutionized`, `revolutionizing`, `pioneer`, `pioneers`, `pioneered`, `pioneering`, `champion`, `champions`, `championed`, `championing`, `foster`, `fosters`, `fostered`, `fostering`, `delve`, `delves`, `delved`, `delving`, `harness`, `harnesses`, `harnessed`, `harnessing`, `empower`, `empowers`, `empowered`, `empowering`, `elevate`, `elevates`, `elevated`, `elevating`, `unveil`, `unveils`, `unveiled`, `unveiling`, `seamless`, `seamlessly`, `robust`, `robustly`, `robustness`, `cutting-edge`, `cutting edge`, `state-of-the-art`, `state of the art`, `dynamic`, `dynamically`, `results-driven`, `result-driven`, `results driven`, `result driven`, `passionate`, `passionately`, `detail-oriented`, `detail oriented`, `team player`, `team players`, `thought leader`, `thought leaders`, `fast-paced`, `fast paced`, `paradigm-shifting`, `paradigm shifting`, `responsible for`, `duties included`, `worked on`, `helped with`, `assisted in`, `enhancing operational efficiency`, `driving business growth`, `ensuring seamless user experience`, `proven track record`, `proven track records`, `small`, `smaller`, `smallest`, `dependable`, `dependably`, `dependability`, `product-minded`, `product minded`, `significantly improved performance`, `significantly improves performance`, `significantly improving performance`.

Limit trailing “without …” clauses to one per resume and rule-of-three lists to two per resume. Avoid weak openers “Partnered with,” “Collaborated with,” “Worked with,” “Coordinated,” and “Contributed to” unless they name the true scope. Also avoid repetitive sentence openings, inflated unmeasured impact, unsubstantiated disclaimers, dangling fluff tails, and generic claims with no candidate-specific detail. Lint's clean result does not imply Jev clarity or relevance 2/2.
### Gaps to ask the user about

Review inputs against this checklist once before rewriting, and ask missing items in a single message:
- **Missing contact:** basics has neither email nor phone.
- **Freelance work not listed:** marketplace header link present without corresponding experience entry.
- **One-bullet roles:** roles lacking sufficient accomplishment depth.
- **Projects without stack or link:** project entries missing both URL and technical stack.
- **Skills missing tools used in bullets:** technologies mentioned multiple times in bullets but absent from skills.
- **Thin coverage of a long role:** ask about other real work, phases, maintenance, or validation cycles; show confirmed scope rather than padding with invented projects.
- **Unclear accomplishment:** ask what changed, who used it, what the candidate personally did, and whether the outcome was observed or estimated.
- **Unclear status or chronology:** reconcile conflicting source dates, project participation, ongoing credentials, and overlapping roles without inventing dates or gap explanations.
- **Missing requirement evidence (mode A):** ask about relevant work that could support an important uncovered requirement; if none exists, leave the qualification unclaimed.

### Final review

- Can each claim be traced to confirmed facts without claiming more than they establish?
- Does every bullet state X and Z, and include Y only when evidence supports its measure or scope?
- Are team ownership, dates, tools, and outcomes accurate?
- Are relevance, length, page count, and skill-category limits respected?
- Have all lint findings been fixed and lint rerun to clean?
- Could the candidate explain every claim in an interview without backtracking on ownership, domain, scale, completion, or measured versus estimated results?
- In mode A, does each supported core requirement have visible evidence, and are transferable and missing qualifications still distinguished honestly? Review meaning even when lint is clean; lint does not perform this comparison.
- Separate draft coverage from candidate qualifications: mark requirements as covered, synonym-only, supported but omitted, or a genuine gap. Restore omitted supported evidence where useful; use an exact job term only when equivalent, never to disguise a transferable-only match. Do not mistake a missing phrase for missing experience.
- Do summary, entry titles, dates, skills, and linked artifacts agree? Prior drafts must not override the confirmed source facts.

## Synthetic before-and-after examples

Every example below uses synthetic evidence, not candidate facts.

Synthetic summary examples:

- **Bad:** “Product-minded engineer with a proven track record of transforming teams and delivering innovative solutions.” Empty self-praise, unsupported broad claims, and banned language.
- **Good:** “Software engineer with 8 years of experience; reduced a documented deployment workflow from 30 minutes to 8.” Synthetic facts: earliest role began January 2018; evidence records the before-and-after duration. The single result is concrete and the years claim matches the start date.

| Weak draft | Synthetic evidence | Rewrite |
|---|---|---|
| “Responsible for backend services.” | Replaced 14 REST polling hooks in a dashboard with one WebSocket connection; dashboard updates use that connection. | Replaced 14 REST polling hooks with one WebSocket connection, consolidating dashboard updates into a single transport. |
| “Spearheaded a robust, cutting-edge modernization that significantly improved performance.” | On a three-engineer team, the candidate wrote Playwright integration tests for 12 checkout flows; release notes recorded coverage for all 12. Candidate did not lead. | Implemented Playwright integration tests for 12 checkout flows on a three-engineer team; release notes recorded coverage across all 12 flows. |
| “Built a small dependable service that was easy to use.” | Candidate built an API service; no user feedback or service-size measure was recorded. | Built an API service that exposes order status through a documented endpoint. |
| “Led a complete platform migration that transformed deployment.” | Candidate migrated the billing worker with two teammates; the team shipped it to production. No leadership role was recorded. | Migrated the billing worker with two teammates and shipped it to production as a team. |
| “Reduced nightly import failures by adding retries, without any data loss.” | Candidate added bounded retries to the nightly import; the failure count fell from 20 to 4 per week. No data-loss comparison was recorded. | Added bounded retries to the nightly import, reducing recorded failures from 20 to 4 per week. |
| “Worked on the search service and improved its performance.” | Candidate replaced a per-result lookup with one batched query in the search service; the query path now makes one database request. | Replaced per-result lookups with one batched query, reducing the search service's database request path to one call. |
| “Completed a paid delivery through Fiverr” | Candidate built a telemetry pipeline using TypeScript and Redis to collect application events. | Built a telemetry pipeline using TypeScript and Redis to collect application events. |

The examples demonstrate concise claims, evidence-bounded outcomes, attribution, and direct openings. Do not copy their facts into a resume.
