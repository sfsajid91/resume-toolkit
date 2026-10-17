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
- For a career or domain change, explain the supported bridge (shared methods, problems, or tools), not invented experience in the new domain. In a general resume without a job posting, use a supported developer positioning rather than inventing an employer or target role.
- In mode B, use the supplied resume's purpose and confirmed facts; do not invent a target posting or require job matching.


### Select only relevant, supported material

- Prioritize evidence for required job requirements, then preferred requirements, then other relevant evidence. For a general resume without a job, lead with the candidate's strongest relevant work evidence. Never imply an unsupported qualification.
- Target one page for up to about 10 years of experience; never exceed two pages. Roles more than 10 years old get one or two bullets, or one line. Projects more than four years old without adoption evidence get one or two bullets or are dropped.
- Use at most three bullets per project. Include fewer bullets when evidence does not support distinct, relevant accomplishments.
- Avoid near-duplicate bullets. Do not repeat rollback, retry, recovery, or “safe” themes across unrelated roles; show those themes only where they are genuinely distinct and relevant.
- A summary is optional. Use at most one or two concise, factual sentences only when they add identity or context beyond the headline and skill list. For a general resume, a supported developer positioning can orient the reader. Keep it evidence-based; do not force a result, metric, years claim, or summary when it adds no information. Any years-of-experience claim must match the earliest supported start date.
- Use specific supported technical terms in context; do not keyword-stuff or infer proficiency from a title, job description, or tool name.
- Keep entries reverse chronological within each section. Order sections by the candidate's strongest relevant evidence and the resume's purpose; do not force a universal section order or reorder employment dates to put a preferred role first. Relevant work can precede skills; students may lead with education.
- When space is tight, cut duplicate claims and low-relevance lines across sections before cutting by age alone. Preserve the only concrete evidence for an important requirement, even when older. Cut content rather than shrinking typography or crowding the layout; do not pad to fill a page.

### Write bullets with a clear contribution

- Target concise bullets, usually 12–30 words. One-line and two-line bullets are both expected; do not pad or compress merely to force uniform line lengths.
- State the concrete change or artifact and the candidate's true action. Include numbers, users, scope, or other boundaries only when evidence supplies them; never invent a metric or imply unsupported causality.
- Name the specific object, problem, or system changed and the candidate's contribution. An implemented behavior or verified artifact is a valid outcome without measured business impact. Do not require a metric or ask for one when it adds no material information.
- Keep action, context, and outcome precise. If evidence does not establish an outcome, describe only the implemented work or ask about materially important missing facts.
- Use past tense for completed work and present tense only for an ongoing state. Vary openings; make personal contribution distinct from team outcomes. Attribute team results to the team. Say “Led” only when evidence establishes leadership.
- Describe the level of work accurately: investigated is not implemented, contributed is not owned, and a prototype is not production. Avoid inflated verbs such as “engineered” or “architected” when “built” or “implemented” states the work accurately.
- Avoid repetitive “X using A, B, and C” constructions, especially when they merely enumerate tools. Put technologies in concrete bullets where they clarify the work and in a concise categorized skills section, not as a stack dump on every entry.
- Never force “by doing” or “while” tails. Avoid generic filler and “without X” tails unless the contrast is material, factual, and necessary.
- Never use em dashes; do not use en dashes outside date ranges. Avoid decorative punctuation and formulaic tails. Use ordinary hyphens only when required by a proper name or compound term.

### Factual scope

- Treat “investigated,” “implemented,” “contributed,” “owned,” “prototype,” and “production” as distinct factual claims. Use only the level supported by source evidence.
- Avoid generic specialization statements, self-praise, inflated ownership, and claims of production use or business impact that the evidence does not establish. Keep unresolved facts out of the resume; ask only about missing facts that materially affect a claim.

### No hedging in resume text

- If a fact is uncertain, ask once, then write the confirmed fact plainly or omit. Keep confirmation status and apologetic effort qualifiers out of resume text. Preserve material scope: a prototype, academic project, or in-progress credential must not read as a production deployment, paid role, or completed qualification. State that scope directly rather than hiding it as a caveat.

### Describe the work, not the transaction

- Focus on technical implementation and outcomes rather than commercial transactions or marketplace platforms. Avoid phrasing centered on `paid`, `delivery`, `delivered through`, or platform names in bullet claims.

### Freelancers

- List freelance work as experience (title, `Freelance`, date range); platform names belong in that entry, not the header.

### Project selection

- Select projects for distinct, relevant evidence and useful technical depth. Include only those that strengthen the resume; do not force a project count or pad projects to meet a quota.

### Summary, skills, dates, and credentials

- Keep skills selective: include supported tools and technologies that help the reader understand the candidate's work. Do not fill category quotas or repeat every tool merely because it appears in multiple bullets. Categories are useful when they improve scanning; there is no fixed number of categories or items.
- Use real tools and technologies, not broad domains such as “developer platforms.” Place tools in concrete experience or project bullets when they clarify the work, and in concise skill categories when useful. A skills list does not replace evidence in the work section.
- Keep dates consistent in display as `Mon YYYY`; snapshot dates use `YYYY-MM`, and null end dates display as `Present`.
- Certifications show `Issued Mon YYYY` or `Expires Mon YYYY`, never a date range. Drop expired certifications unless relevant.
- State in-progress education explicitly in the entry's title; add a confirmed expected completion date there, for example `MSc Computing (in progress, expected Jun 2027)`. Do not create a short date-only bullet or pad it to meet bullet-length guidance. Do not put a future expected date in `end` as though the credential were awarded; use `end: null` for ongoing education. Do not list an in-progress certification as held or use an expected date as its issue date.
- Use actual project participation dates, not automatically the enclosing employment dates. Keep overlapping roles and gaps truthful; never shorten dates or describe a gap as deliberate training without confirmation.
- Omit education dates only when the education is more than 10 years old and the user agrees.
- Include the user's supplied location in the location field; never infer one. Use a conventional single-column layout with ordinary section headings, entry title aligned left and dates aligned right. Keep employer, location, and technologies readable without a forced `Company | Location | Stack` string or per-entry stack dump. For links, use compact descriptive clickable text with decorative globe or GitHub icons where available; icons must not replace the link label and must not carry meaning alone. Choose section order with `resume.sectionOrder` only when it improves this resume.
### Banned language and patterns

Avoid all listed terms and phrases case-insensitively, including obvious tense, plural, and spelling variants. Preserve proper names and source evidence; revise generated resume text, not the facts. The list is a strict editing convention, not evidence that a word automatically triggers rejection by recruiters or ATS.

Banned terms (lint terms): `spearhead`, `spearheads`, `spearheaded`, `spearheading`, `orchestrate`, `orchestrates`, `orchestrated`, `orchestrating`, `leverage`, `leverages`, `leveraged`, `leveraging`, `utilize`, `utilizes`, `utilized`, `utilizing`, `catalyze`, `catalyzes`, `catalyzed`, `catalyzing`, `synergize`, `synergizes`, `synergized`, `synergizing`, `revolutionize`, `revolutionizes`, `revolutionized`, `revolutionizing`, `pioneer`, `pioneers`, `pioneered`, `pioneering`, `champion`, `champions`, `championed`, `championing`, `foster`, `fosters`, `fostered`, `fostering`, `delve`, `delves`, `delved`, `delving`, `harness`, `harnesses`, `harnessed`, `harnessing`, `empower`, `empowers`, `empowered`, `empowering`, `elevate`, `elevates`, `elevated`, `elevating`, `unveil`, `unveils`, `unveiled`, `unveiling`, `seamless`, `seamlessly`, `robust`, `robustly`, `robustness`, `cutting-edge`, `cutting edge`, `state-of-the-art`, `state of the art`, `dynamic`, `dynamically`, `results-driven`, `result-driven`, `results driven`, `result driven`, `passionate`, `passionately`, `detail-oriented`, `detail oriented`, `team player`, `team players`, `thought leader`, `thought leaders`, `fast-paced`, `fast paced`, `paradigm-shifting`, `paradigm shifting`, `responsible for`, `duties included`, `worked on`, `helped with`, `assisted in`, `enhancing operational efficiency`, `driving business growth`, `ensuring seamless user experience`, `proven track record`, `proven track records`, `small`, `smaller`, `smallest`, `dependable`, `dependably`, `dependability`, `product-minded`, `product minded`, `significantly improved performance`, `significantly improves performance`, `significantly improving performance`.

Limit trailing “without …” clauses to one per resume and rule-of-three lists to two per resume. Avoid weak openers “Partnered with,” “Collaborated with,” “Worked with,” “Coordinated,” and “Contributed to” unless they name the true scope. Also avoid repetitive sentence openings, inflated unmeasured impact, unsubstantiated disclaimers, dangling fluff tails, and generic claims with no candidate-specific detail. Lint's clean result does not imply Jev clarity or relevance 2/2.
### Gaps to ask the user about

Review inputs against this checklist once before rewriting, and ask missing items in a single message:
- **Missing contact:** basics has neither email nor phone.
- **Freelance work not listed:** marketplace header link present without corresponding experience entry.
- **One-bullet roles:** roles lacking sufficient accomplishment depth.
- **Unclear or unsupported project details:** ask only when a missing fact materially changes the claim; a stack or link is useful when available, but neither is a content quota.
- **Selective skills:** include supported technologies that clarify the candidate's work; do not ask for a tool to be listed merely because it appears repeatedly in bullets.
- **Thin coverage of a long role:** ask about other real work, phases, maintenance, or validation cycles only when needed to show relevant confirmed scope; never pad with invented projects.
- **Unclear accomplishment:** ask what changed, who used it, what the candidate personally did, and whether the outcome was observed or estimated.
- **Unclear status or chronology:** reconcile conflicting source dates, project participation, ongoing credentials, and overlapping roles without inventing dates or gap explanations.
- **Missing requirement evidence (mode A):** ask about relevant work that could support an important uncovered requirement; if none exists, leave the qualification unclaimed.

### Final review

- Can each claim be traced to confirmed facts without claiming more than they establish?
- Does every bullet state X and Z, and include Y only when evidence supports its measure or scope?
- Are team ownership, dates, tools, and outcomes accurate?
- Are relevance, length, page count, and selective skill choices appropriate, without padding to meet quotas?
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
