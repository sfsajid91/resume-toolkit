# Resume Toolkit — Agent Tool Direction

Status: revised product direction, not implemented. This document refines [prd-idea.md](prd-idea.md) and [research-synthesis.md](research-synthesis.md). Where recommendations differ, this direction supersedes the earlier standalone-profile and browser-rendering recommendations. [prototype-plan.md](prototype-plan.md) defines concrete contracts, implementation phases, and acceptance checks, including editable DOCX export.

## 1. Product boundary

Build a resume rendering and evaluation tool for existing AI agents, not a separate career-management product.

Agents such as Hermes, grokbot, dots, and muse already hold user context. They supply content and invoke the toolkit; compatibility with each environment must be exercised before being advertised.

| Existing AI agent owns | Toolkit owns |
|---|---|
| Career memory and gathering missing information | Validation of supplied structured content |
| Finding jobs and interpreting requirements | Jev evaluation against supplied requirements |
| Selecting experience and writing tailored wording | Criterion-level results and flagged claims |
| Preferences and revision orchestration | A fixed, versioned resume design |
| Applying, tracking, and following up | Local PDF/DOCX generation and output paths |

Do not duplicate agent memory, application tracking, or orchestration. A skill explains input contracts, commands, privacy, and interpretation of results. The agent decides when to invoke them.

The toolkit cannot access an agent's knowledge implicitly. Relevant facts and job requirements must be supplied explicitly. This does not require a toolkit-managed profile database.

Existing-resume ingestion also belongs to the agent: it uses available PDF/text/vision tools and asks the user to confirm uncertain extraction. The toolkit does not implement a PDF parser or OCR in the prototype.

## 2. Browserless PDF and editable DOCX generation

Recommended stack: **Bun/TypeScript CLI + fixed Typst PDF template + native `docx` serializer + Jev**.

Typst provides a local compiler with prebuilt binaries, JSON data loading, and PDF generation without Chromium. On 2026-10-13, Typst 0.15.1 produced a synthetic A4 PDF with inspected text, link annotation, embedded Carlito subsets, and layout; see [prototype-plan.md](prototype-plan.md) for remaining feasibility gates.

Implementation responsibilities:

- Accept and validate agent-supplied JSON.
- Pass structured data to a toolkit-owned Typst template.
- Keep fonts, spacing, headings, and page rules in the template.
- Compile PDF locally and return its path; generate editable DOCX from the same resolved content.
- Pin the compiler, template, DOCX package, and local fonts for predictable output.
- Treat supplied strings as text, never executable Typst source.

The agent writes resume content, not template code. Use a trusted template and controlled local assets; do not permit supplied content to trigger arbitrary file reads or execution.

Tradeoff: a native compiler dependency replaces the browser dependency. This is browserless, not dependency-free.

Initial outputs are PDF and editable DOCX. Review the PDF directly; defer HTML preview and Markdown unless an actual agent workflow needs them.

DOCX uses native paragraphs, named styles, lists, and links rather than images or floating text boxes. Both outputs share wording, order, and a fixed design specification, but pagination may differ across Typst and word processors. Manual DOCX edits are not synchronized with source JSON or covered by an earlier evaluation report. The agent must reconcile changes into a new reviewed snapshot before reevaluation or regeneration.

References:

- [Typst compiler installation](https://github.com/typst/typst#installation)
- [Typst CLI usage](https://github.com/typst/typst#usage)
- [Typst JSON data loading](https://typst.app/docs/reference/data-loading/json/)

## 3. Small input contract

Accept an application-specific snapshot rather than requiring a toolkit-managed master profile:

- **Resume:** contact details, experience, projects, education, skills, and tailored claims/bullets.
- **Job:** relevant requirements with original supporting quotes.
- **Evidence:** source facts backing tailored claims, linked by IDs.

Rendering requires the resume. Job-specific evaluation additionally requires the job. Evidence-support evaluation requires supporting facts.

An agent knowing the user does not remove the need to supply evidence to Jev. For example, a recorded fact saying “Implemented caching” does not support the tailored claim “Led a team-wide performance initiative.” Without the original facts, Jev can assess clarity or relevance but cannot meaningfully assess whether tailoring preserved those facts.

Supply only relevant evidence, not the user's whole career history. Describe it as agent-supplied or user-recorded evidence, not independently verified truth.

Reuse strict validation and provenance principles from the synthesis, while revising its concrete schemas to fit this snapshot contract. Schema details remain to be implemented; the earlier examples are not installed validators.

## 4. Jev evaluations and scores

Jev is an advisory reviewer, not another resume writer.

| Dimension | Result |
|---|---|
| Evidence support | Supported, contradicted, or insufficient evidence per claim |
| Requirement coverage | Whether each supplied requirement is demonstrated, with uncertainty |
| Relevance | A clearly defined rubric score against the supplied job |
| Clarity | A clearly defined rubric score with locatable review targets |

Keep dimensions separate. Do not present an aggregate ATS score or hiring probability. High relevance must not conceal an unsupported claim.

Return structured findings with target IDs or paths, raw judgments, uncertainty, and toolkit-owned review guidance. Do not fabricate model explanations or missing results.

Keep validation and rendering available without Jev. API failures produce unavailable evaluation, not a bad score or a blocked local export.

Hosted evaluation requires explicit permission and a previewable minimized payload. Permission to apply for jobs does not automatically authorize transferring career evidence to another provider. The connected agent may also have its own separate data egress.

## 5. Consistent, ATS-friendly formatting

Use the claim **“ATS-friendly formatting,” not “guaranteed ATS compatibility.”**

The initial template should provide:

- Single-column content.
- Conventional section headings.
- Selectable text rather than text rendered as images.
- Straightforward reading order.
- Contact information in the main document body.
- No skill bars, decorative charts, or icons carrying essential information.
- Readable local fonts and predictable page breaks.
- No silent content removal or automatic font shrinking to force one page.

Verify actual generated PDFs for text extraction, reading order, usable links, glyph coverage, clipping, and one-/two-page layouts. Successful text extraction is useful evidence, not proof of compatibility with every hiring system.

Keyword relevance belongs to agent tailoring and evaluation, not the PDF renderer.

## 6. Tool surface

Keep three main operations plus schema discovery:

| Operation | Responsibility |
|---|---|
| `validate` | Check supplied structures, references, and invariants |
| `evaluate` | Return structured Jev findings for supplied resume, job, and evidence |
| `render` | Generate a local PDF or editable DOCX using the fixed design |
| `schema` | Publish exact contracts for agent discovery |

Evaluation and rendering validate internally; agents must not need to remember a separate mandatory validation call.

Start with CLI + skill for agents capable of executing local commands. Add MCP only when a concrete target environment requires it, using the same underlying functions.

Preserve the synthesis's relevant safety boundaries: explicit paths, no input mutation, overwrite protection, staged output publication, safe links, structured failures, clean JSON output, and no automatic submission by the toolkit.

## 7. Revised scope

### In scope

- Agent-consumable structured input contracts.
- Deterministic validation and evidence linkage.
- One fixed, versioned resume design.
- Browserless local PDF and native editable DOCX generation.
- Separate advisory Jev evaluations and rubric scores.
- A skill documenting invocation, revision guidance, and privacy.
- An exercised workflow in one named agent environment.

### Out of scope initially

- Toolkit-managed career memory or profile database.
- Internal agent runtime or revision orchestration.
- Job scraping, application submission, or tracking.
- Dashboard, accounts, and hosted toolkit infrastructure.
- Multiple templates, renderers, or provider abstractions.
- MCP without an actual integration requirement.
- HTML preview or Markdown without a demonstrated need.
- Universal ATS guarantees, truth certification, or hiring predictions.

## 8. Implementation order and acceptance

1. **Prove both exports.** Generate an actual PDF with Bun/Typst and an editable DOCX with the `docx` package from the same synthetic data. Inspect text, links, fonts, and layout; save/reopen a manual DOCX edit. Observe installation requirements on the initial supported platform.
2. **Complete the local tool path.** Implement strict contracts, validation, shared content/design, both export serializers, safe output handling, and schema discovery. Prove malformed inputs fail usefully and existing artifacts survive failures.
3. **Add Jev evaluation.** Implement minimized request preview, explicit consent, separate criteria, validated responses, uncertainty, and honest failure handling. Exercise authorized real calls; do not substitute fabricated results.
4. **Exercise one agent workflow.** The agent supplies resume/job/evidence snapshots, receives findings, revises content, and returns user-reviewed PDF/DOCX files. No toolkit-owned ingestion, application, or tracking loop.
5. **Package observed evidence.** Document installation, tested agent/platform, template/font notices, privacy boundaries, and known limitations. Retain small behavioral checks for actual contract and safety risks.

The first end-to-end acceptance gate is: **one agent supplies structured content, receives useful Jev findings, revises it, and generates a consistent, readable PDF plus a manually editable DOCX.** Offline rendering is independently usable when evaluation is unavailable.

## 9. Portfolio positioning

Demonstrate reliable document generation and inspectable evaluation, not another agent platform.

A public example should show source facts, a tailored claim, structural validation, an overstated but structurally linked claim requiring semantic/human review, corrected wording, and the final PDF. Use synthetic public fixtures and make only claims supported by observed runs.

Build and prove both local exports first, then Jev, then the complete workflow with one agent. Follow [prototype-plan.md](prototype-plan.md) for the concrete build order. Let exercised integrations determine further scope.
