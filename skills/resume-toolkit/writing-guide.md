# Engineering Resume Writing Guide

Read this guide before drafting or revising `resume.summary` or any entry's `bullets`. It sets a strict editorial standard for concise, evidence-backed engineering resumes; it does not change the JSON schema or guarantee a Jev score.

The target is Jev clarity **2** (a clear contribution and context) and relevance **2** (content prominently aligned with the job requirements). For each evaluated claim, `supported` means the attached evidence directly supports the claim without adding unsupported scope. Jev judges those criteria separately; no wording formula can guarantee its judgments. See `src/evaluate.ts` and the current contract in `docs/prototype-plan.md` §7.

## 1. Select and prioritize evidence

1. Read `job.requirements`; order them `required`, then `preferred`, then `unspecified`. For each, identify the exact `evidence` records that support a relevant entry, bullet, or skill. Prioritize the strongest direct evidence for required requirements first. Use preferred requirements when supported. Include unspecified requirements only when they clearly improve fit. Never imply that an unsupported requirement is met.
2. Select only entries and achievements that demonstrate those requirements. Order included experience/projects by relevance and strength, not by how much career history is available. Remove unrelated or repetitive material; relevance level 2 means prominently aligned content, not a complete chronology.
3. Aim for **4–5 bullets** in a flagship or recent role and **2–3** in an older or secondary entry. These are editing targets, not quotas: use fewer when evidence does not support distinct, relevant achievements. Do not pad a role or invent achievements to hit a count.
4. Default `resume.summary` to `[]` for IC, junior, and mid-level engineers. For a senior-level transition where a short orientation is useful, use at most **1–2 factual claims**, each tied to evidence and free of self-praise or adjectives. An empty summary is valid in the schema.
5. Mirror exact technical terms from supported job requirements in context—such as **PostgreSQL**, **Docker**, or **Playwright**. Keep spelling/capitalization faithful where practical. A keyword belongs in a bullet or `resume.skills` only when attached evidence supports its use; do not keyword-stuff, infer proficiency, or add a tool solely to match the posting.

## 2. Write varied, evidence-backed XYZ bullets

Each bullet is one coherent achievement, normally **15–28 words**. Include all three parts, in any order:

- **X — Impact/outcome:** what changed, shipped, became possible, or was delivered.
- **Y — Measure/scale/scope:** a defensible result, baseline, count, frequency, workload, boundary, or system scope.
- **Z — Mechanism:** the engineering action, design, or supported tools that produced the outcome.

Use the XYZ idea—“accomplished X, measured by Y, by doing Z”—as a completeness check, not a fill-in-the-blanks sentence template. One supported count or architecture boundary can make Y concrete when no percentage or business metric exists. If the evidence has no numeric outcome, quantify only a sourced scale or describe a specific before/after mechanism. Never invent a number, imply causation the evidence does not establish, or substitute vague filler such as “significantly improved performance.” If the evidence cannot support an impact, scope, or mechanism, ask for clarification or omit the claim.

Describe architecture through concrete boundaries and changes: services/components connected, data or request flow, integrations replaced, deployment or migration scope, failure handling, or interfaces affected. State a measurable result if evidence provides one; otherwise show the verified technical scope and the actual resulting change. Do not call a design “scalable,” “reliable,” or “high-performance” without evidence that establishes what that means.

**Vary sentence openings. Never use the same structure in consecutive bullets. Rotate these shapes while retaining X, Y, and Z:**

Illustrative evidence for these three structures: dashboard refreshes ran through 14 REST polling hooks; an implementation replaced those hooks with one WebSocket connection used for dashboard updates.

- **Action-first:** `Replaced 14 REST polling hooks with one WebSocket connection, consolidating dashboard updates into a single transport.`
- **Result-first:** `Dashboard updates moved from 14 REST polling hooks to one WebSocket connection, consolidating the client update path.`
- **Mechanism/scale-first:** `Across 14 REST polling hooks, replaced dashboard polling with one WebSocket connection, consolidating updates through a single transport.`

These structures share the same illustrative evidence, not a candidate fact. Use only the details an actual evidence record establishes. The variation is deliberate: strong bullets need not all begin with identical “Built/Implemented…” syntax. Keep the action identifiable and the wording natural.

Use past tense for completed achievements, including completed work in a current role. Use present tense only for a genuinely ongoing state; do not mix tenses inside one bullet. Prefer one sentence and no first-person pronouns. Remove setup that does not help a reader understand the accomplishment. The 15–28-word bound is this guide's editing constraint, not a schema limit or a Jev rubric rule.

## 3. Banned vocabulary and AI-slop audit

Treat this list as a strict project editing rule for generated summary/bullet prose, not as proof that every recruiter or ATS automatically rejects any individual word. Search case-insensitively, including obvious tense/plural variants, before saving a snapshot or running `validate` or `evaluate`. Rewrite a hit in plain, specific language. Preserve original evidence and factual proper names; do not edit source material to make an audit pass.

**Banned AI verbs:** *Spearheaded, Orchestrated, Leveraged, Utilized, Catalyzed, Synergized, Revolutionized, Pioneered, Championed, Fostered, Delved, Harnessed, Empowered, Elevate, Unveil.*

**Banned empty adjectives/clichés:** *Seamless, Robust, Cutting-edge, State-of-the-art, Dynamic, Results-driven, Passionate, Detail-oriented, Team player, Thought leader, Fast-paced, Paradigm-shifting.*

**Banned passive openings:** *Responsible for, Duties included, Worked on, Helped with, Assisted in.*

**Banned dangling fluff tails:** *“enhancing operational efficiency,” “driving business growth,” “ensuring seamless user experience,”* and similar claims that add no specific, evidenced result.

Prefer plain engineering verbs when accurate: **Built, Implemented, Designed, Architected, Shipped, Launched, Automated, Refactored, Reduced, Cut, Migrated, Debugged, Eliminated, Integrated, Mentored, Led, Co-developed.** Pick the verb that describes the candidate's actual action; a stronger-sounding verb must never inflate ownership.

Other AI-slop signals are repetitive sentence openings, inflated but unmeasured impact, generic “proven track record” language, tool lists without application, and claims that could describe any engineer. Vary cadence, name the actual system or workflow, and retain details a candidate could explain in an interview. Research does not establish a universal vocabulary that triggers automatic rejection; the goal is credible, specific writing, not detector evasion.

## 4. Attribution and provenance

- Every summary/bullet claim and selected skill needs relevant `evidenceIds` for evaluation. Attach the evidence that supports the whole claim, not merely one keyword. A reference is traceability, not truth verification; read the attached fact and preserve its boundaries.
- Keep personal contribution distinct from team outcomes. Say **Led** only when evidence establishes leadership; otherwise name the actual contribution (for example, **Co-developed**, **Implemented**, or **Contributed to**) and attribute a team-level result to the team. Do not turn “team shipped” into “I led” or claim sole credit for shared work.
- Do not infer an outcome from a tool name, job title, project label, or the fact that a task was assigned. Unsupported claim details are not repaired by adding more evidence IDs. If a metric is missing, ask the user rather than estimate.
- Treat unconfirmed evidence as unconfirmed. Do not strengthen its wording, borrow facts from another entry for an entry bullet, or let the job description serve as evidence.

### Before and after

The following examples use **synthetic evidence** and illustrate rewriting, not verified candidate accomplishments.

| Weak draft | Attached evidence | Evidence-linked rewrite |
|---|---|---|
| “Responsible for backend services.” | `fact-ws`: “Replaced 14 REST polling hooks in the dashboard with one WebSocket connection; dashboard updates use that connection.” | “Replaced 14 REST polling hooks with one WebSocket connection, consolidating dashboard updates into a single transport.” |
| “Spearheaded a robust, cutting-edge modernization that significantly improved performance.” | `fact-tests`: “On a three-engineer team, I wrote Playwright integration tests for 12 checkout flows; release notes recorded coverage for all 12. I did not lead the project.” | “Implemented Playwright integration tests for 12 checkout flows as part of a three-engineer team; release notes recorded coverage across all 12 flows.” |

The first rewrite reports the evidenced replacement and scope; the second preserves the documented team attribution and drops unsupported superlatives. If evidence did not establish the outcome or ownership in a rewrite, remove it or ask—never complete the story by guessing.

## 5. Final claim-by-claim check

Before saving a new or revised snapshot:

- Does every selected item help demonstrate a required or preferred job requirement?
- Does each bullet contain a clear outcome, supported measure/scope, and technical mechanism in 15–28 words?
- Do adjacent bullets use different opening structures?
- Are every number, tool, impact, and ownership verb supported by attached evidence?
- Are exact job keywords present only where evidence supports them?
- Is the summary empty by default, or limited to 1–2 evidence-backed facts for a senior-level transition?
- Did the banned-vocabulary/fluff audit pass without altering evidence or proper names?

Then run local validation. Jev's 2/2 clarity and relevance are evaluation targets, not promises. Review actual criterion findings separately; revise only within the evidence and the existing bounded workflow in `SKILL.md`.

## Research basis

These sources inform the guidance; resume conventions are editorial advice, not guarantees of screening outcomes. Direct fetching of the Reddit wiki returned 403 during research, so its indexed guidance is cross-checked below against university career offices and engineering-specific sources.

- [r/EngineeringResumes wiki](https://www.reddit.com/r/EngineeringResumes/wiki/index/), [software guide](https://www.reddit.com/r/EngineeringResumes/wiki/software/), and [checklist](https://www.reddit.com/r/EngineeringResumes/wiki/checklist/) — accomplishment-focused bullets, XYZ/STAR/CAR, relevance ordering, concise writing, and concrete technical context.
- [UT Austin Career Services: Strong Bullets for Technical Resumes](https://careerservices.cns.utexas.edu/resources/resumes/strong-bullets-technical-resumes) — explain what was built, why it mattered, and how; quantify users, teams, usage, and work scope where available.
- [Yale Office of Career Strategy: Writing Impactful Resume Bullets](https://ocs.yale.edu/resources/writing-impactful-resume-bullets/) — action/project/result and XYZ structures; specific personal contribution, measurable impact, and context.
- [SHRM: How to Spot AI-Generated Lies on a Resume](https://www.shrm.org/topics-tools/news/technology/how-to-spot-ai-generated-lies-on-a-resume) (2024) — recruiters interviewed describe probing claims and preferring genuine, explainable experience over embellished wording.
- [Forbes Coaches Council: How Recruiters Can Tell You Used AI On Your Resume—and Why It Matters](https://www.forbes.com/councils/forbescoachescouncil/2025/08/07/how-recruiters-can-tell-you-used-ai-on-your-resume-and-why-it-matters/) (2025) — recruiter observations on generic buzzwords, copy-pasted content, poor job customization, and missing candidate-specific detail. This is expert commentary, not a controlled study.
- [Jobscan: Can ATS Detect AI Resumes?](https://www.jobscan.co/blog/can-ats-detect-ai-resume/) (2026) — distinguishes job matching from authorship detection and identifies generic, unedited content as a human-review risk; a vendor article, not independent validation.
- Project authority: `docs/prototype-plan.md` §7 supersedes conflicting early proposals in `docs/research-synthesis.md`; the latter informs only the boundary that the connected agent writes and tailors from evidence while the toolkit validates and evaluates.
