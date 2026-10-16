# Resume Toolkit — Concrete Prototype Plan

Status: Phases 1–4 local implementation and offline/simulated workflow verification complete. The authorized live Jev answer/model/usage and cancellation gate remains open.

This is the build specification for the prototype. It refines [agent-tool-direction.md](agent-tool-direction.md) and supersedes conflicting contracts in [research-synthesis.md](research-synthesis.md). Planning documents live in `docs/`; the project layout and current verification state are recorded below.

## 1. Product and completion condition

An existing AI agent turns its knowledge of the user and a job description into structured resume content. The toolkit validates that content, evaluates it with Jev on explicit permission, and exports a consistent PDF or an editable DOCX. The agent owns tailoring, existing-resume ingestion, revisions, job applications, and tracking.

The prototype is complete when one documented agent environment completes this real workflow:

1. Prepare an application snapshot from user-confirmed facts and a job description.
2. Validate it locally and inspect the exact remote-evaluation payload.
3. Obtain permission, call Jev, and inspect separate findings/scores.
4. Revise an overstated or unclear claim without changing its source facts.
5. Export and review both PDF and editable DOCX.
6. Add a bullet manually in a desktop DOCX editor and save it successfully.
7. Demonstrate that local exports still work without a Jev key or network access.

Manual edits produce a separate artifact. A report about the original JSON does not evaluate the edited DOCX.

## 2. Scope decisions

### Ship

- Bun/TypeScript local CLI and one agent skill.
- Versioned, strict structured input and report schemas.
- Deterministic validation with locatable issues.
- Browserless PDF using one fixed Typst template.
- Editable DOCX using the TypeScript `docx` package.
- One shared content model and design specification for both formats.
- Jev evidence support, requirement coverage, relevance, and clarity judgments.
- JSON results, explicit paths, safe writes, synthetic examples, and installation instructions.
- One actually exercised agent and Linux environment.

### Do not ship

Career/profile database; job scraping; application submission; tracking; web UI; internal agent runtime; automatic revision loop; MCP; PDF/DOCX import; OCR; DOCX-to-PDF conversion; HTML/Markdown exports; template gallery; plugin/provider framework; opaque ATS/hiring score.

The connected agent reads an existing resume using its own PDF/vision/extraction tools and asks the user to confirm uncertain facts. The toolkit does not assume every agent has native PDF support.

## 3. Technical decisions

| Responsibility | Choice | Constraint |
|---|---|---|
| Runtime/CLI/files/hashes | Bun + `node:util` argument parsing + native filesystem/crypto APIs | No CLI framework or database |
| Validation/contracts | Zod 4; generated JSON Schema | One authoritative schema definition, strict keys |
| PDF | Local Typst CLI + trusted template + local fonts | No Chromium, remote packages, or agent-generated Typst code |
| DOCX | `docx` package with native paragraphs, styles, lists, and links | No screenshots, text boxes, or hand-written OOXML engine |
| Evaluation | Official `@typesafe-ai/sdk` | Load only for live evaluation; one batch with an overall AbortSignal deadline; live call and cancellation remain unverified |
| Checks | `bun:test`, TypeScript checker, actual CLI/export runs | No external API calls in routine tests; evaluation failure cases use a loopback mock |

Environment versions observed: Bun 1.4.2 and Typst 0.15.1. `package.json`/`bun.lock` exact-pin `docx` 9.10.0, `@typesafe-ai/sdk` 0.6.0, Zod 4.6.7, TypeScript 7.0.2, and `@types/bun` 1.4.3. Typst is installed outside the repository; the renderer must verify its version. Local export smoke tests and the LibreOffice Writer edit/save/reopen check passed; Phase 0 remains open only for an explicitly authorized live Jev call and cancellation check. If the SDK fails during an authorized Bun request, use one documented HTTP client path; do not ship two clients. A renderer change requires updating this plan, not silently substituting a browser.

A DOCX renderer is a required second output serializer, not a second PDF backend.

## 4. Input contract

Use one application-specific JSON file. This avoids three mandatory input paths and does not create permanent career storage.

```ts
type Application = {
  schemaVersion: 1;
  id: string;
  revision: number;
  resume: Resume;
  evidence?: Evidence[];
  job?: Job;
};

type Claim = {
  id: string;
  text: string;
  evidenceIds: string[];
};

type Resume = {
  basics: {
    name: string;
    headline?: string;
    email?: string;
    phone?: string;
    location?: string;
    links: { label: string; url: string }[];
  };
  summary: Claim[];
  sections: Section[];
  skills: { id: string; label: string; category?: string; evidenceIds: string[] }[];
};
type Section = {
  kind: "experience" | "projects" | "education" | "certifications";
  items: Entry[];
};

type Entry = {
  id: string;
  name: string;
  title?: string;
  issuer?: string;
  start?: string; // calendar-valid YYYY-MM
  end?: string | null; // null = ongoing; omitted = not recorded
  url?: string;
  bullets: Claim[];
};

type Evidence = {
  id: string;
  entryId: string; // an entry in this application snapshot
  text: string;
  source: {
    kind: "user_statement" | "document";
    locator: string; // opaque provenance note, never opened by toolkit
  };
  confirmedByUser: boolean;
};

type Job = {
  id: string;
  company: string;
  title: string;
  sourceUrl?: string;
  rawText: string;
  requirements: {
    id: string;
    text: string;
    quote: string;
    importance: "required" | "preferred" | "unspecified";
  }[];
};
```

These outlines are design contracts, not a second manually maintained schema. Implementation uses strict Zod definitions and kind-specific entry refinements.

### Required behavior

- All objects reject unknown fields and unsupported schema versions. Revisions are positive integers. Reject whitespace-only required strings without rewriting inputs.
- All claim IDs are unique across summary and bullets. Entry, skill, evidence, and requirement IDs are unique in their respective namespaces; duplicate selections/references are errors.
- Section kinds are unique; preserve input section and item order. Headings come from a fixed map: Professional Experience, Selected Projects, Education, Certifications, plus Professional Summary and Technical Skills.
- Experience requires title/start; education requires title; certification requires issuer. At least one entry or skill must exist. Empty summary and credential bullets are allowed.
- Validate calendar months and chronological order. Do not invent dates or silently normalize them.
- Web URLs allow `https:`/`http:` only; validate email separately. Reject unsafe schemes/control characters. Links are never fetched.
- When evidence is supplied, every referenced evidence ID must resolve; entry bullets may reference only evidence belonging to that entry. Summary and skills may span entries.
- When evidence is absent or a claim/skill has no evidence references, `validate`/`render` issue warnings but allow structurally valid exports. Explicitly report evidence linkage as unavailable/incomplete, never verified.
- `evaluate` requires evidence, nonempty evidence refs for every claim/skill, a job, and at least one quoted requirement. Missing evaluation prerequisites fail before key lookup or network access.
- Requirement quotes must be nonempty exact substrings of raw job text. This checks quote presence, not correctness/completeness of requirement extraction.
- Unconfirmed referenced evidence warns. Confirmation is user-recorded, not independent verification.
- Canonical header/name/date/credential fields are supplied snapshot facts, not rewritten claims. Show them for user review and requirement coverage; the support rubric evaluates claims/skills, not every header field. Reports disclose this boundary.
- Initial input limits: 2 MiB per file, 100 total entries, 100 total summary/bullet claims, 100 skills, 1,000 evidence records, 40 requirements, 4,000 characters per claim/evidence item, 100,000 characters of job text. These are safety limits, not model token limits.
- Load input bytes once and hash them as `sha256:<hex>`. Validation, evaluation, and output use the same snapshot. Never mutate the input.

### Example fixture

```json
{
  "schemaVersion": 1,
  "id": "example-backend",
  "revision": 1,
  "resume": {
    "basics": { "name": "Alex Example", "email": "alex@example.com", "links": [] },
    "summary": [],
    "sections": [{
      "kind": "experience",
      "items": [{
        "id": "exp-api",
        "name": "Example Co",
        "title": "Software Engineer",
        "start": "2025-01",
        "end": "2026-01",
        "bullets": [{
          "id": "claim-cache",
          "text": "Implemented TypeScript API caching, contributing to a measured 20% reduction in p95 latency.",
          "evidenceIds": ["fact-cache"]
        }]
      }]
    }],
    "skills": [{ "id": "skill-ts", "label": "TypeScript", "evidenceIds": ["fact-cache"] }]
  },
  "evidence": [{
    "id": "fact-cache",
    "entryId": "exp-api",
    "text": "Implemented TypeScript API caching in production. Team measurements showed p95 latency fell from 250 ms to 200 ms. I implemented the cache, not the full team's performance work.",
    "source": { "kind": "user_statement", "locator": "Reviewed career note 3" },
    "confirmedByUser": true
  }],
  "job": {
    "id": "job-backend",
    "company": "Example Hiring Co",
    "title": "Backend Engineer",
    "rawText": "Required: production TypeScript API experience. Preferred: Kubernetes experience.",
    "requirements": [
      { "id": "req-ts", "text": "Production TypeScript API experience", "quote": "production TypeScript API experience", "importance": "required" },
      { "id": "req-k8s", "text": "Kubernetes experience", "quote": "Kubernetes experience", "importance": "preferred" }
    ]
  }
}
```

All example people/companies are synthetic. No illustrative judgment is represented as a live Jev result.

## 5. CLI contracts

`resume-toolkit` is the working command name. During development the same arguments run through `bun run src/cli.ts`; no published executable is assumed.

```sh
resume-toolkit schema --kind application --json
resume-toolkit schema --kind report --json

resume-toolkit validate --input application.v1.json --json

resume-toolkit evaluate --input application.v1.json --dry-run --json
resume-toolkit evaluate --input application.v1.json \
  --allow-remote --out report.v1.json --json

resume-toolkit render --input application.v2.json \
  --format pdf --paper a4 --out resume.v2.pdf --json
resume-toolkit render --input application.v2.json \
  --format docx --paper a4 --out resume.v2.docx --json
```

| Command | Observable contract |
|---|---|
| `schema` | Generated application/report JSON Schema; no files or network |
| `validate` | Status, exact input hash, evidence-linkage status, locatable errors/warnings; no writes/network |
| `evaluate --dry-run` | Local validation plus exact minimized request and egress disclosure; no API key/network/output file |
| `evaluate --allow-remote` | Validate prerequisites, request Jev judgments, return report; optional explicit report write |
| `render --format pdf\|docx` | Validate locally, resolve resume once, export one file, return path/format/hash/design/tool versions and warnings; no evaluation prerequisite |

Common flags: `--help`, `--version`, `--json`. `--paper a4|letter` applies to both exports, default A4. `--force` is only for explicit output writes. Reject unknown/conflicting flags. Dry-run is mutually exclusive with live consent/output flags. Rendering requires a matching output extension.

JSON mode emits exactly one result on stdout; diagnostics use sanitized stderr. Do not return binary/base64 files, open viewers automatically, or print secrets/source documents in errors.

Exit codes: 0 success (including semantic review findings); 1 invalid input/evaluation prerequisites; 2 usage/missing consent/configuration; 3 attempted evaluation failure; 4 IO/output/compiler failure.

Refuse input/output aliasing, including symlink aliases. Stage writes on the destination filesystem and publish with no-clobber semantics unless forced. Preserve old outputs on failure and remove only owned temporary files. Each command writes one file; no multi-file transaction promise.

## 6. Rendering and editable DOCX

### One content model, two serializers

A plain resolved resume model removes job/evidence metadata and retains selected content in original order. Both serializers consume it. A small `design.ts` owns shared font names, point sizes, margins, spacing, paper dimensions, and design version. This is a fixed specification, not user-configurable theming.

Current design (version 2.2.0): single-column, Cambria in DOCX and bundled Caladea for PDF. Caladea is Apache-2.0 licensed and metric-compatible with Cambria, so PDF output stays deterministic without redistributing Microsoft's font; recipient DOCX viewers still need Cambria or may substitute. Primary `#000000`, secondary `#222222`, 18 mm margins on all sides. The name is 19 pt, optional headline 12 pt, section headings 12 pt, all other regular text 11 pt, and bullets 10.5 pt. DOCX uses automatic `w:line=276` (1.15 × single); Typst uses 0.76em leading calibrated to Caladea's rendered line pitch and a 0.7em proportional trailing gap for paragraph/list spacing. No automatic font shrinking; support honest multipage output.

The centered header uses a 19 pt bold uppercase name (2 pt after), optional 12 pt regular headline (3 pt after), 11 pt location/phone/email joined by ` | `, then 11 pt links joined by ` | `. Typst applies the same 0.7em font-size-proportional gap between stacked header rows. Link display text omits `https://` while href targets stay unchanged. The header block ends with 8 pt spacing.

Section headings are `PROFESSIONAL SUMMARY`, `PROFESSIONAL EXPERIENCE`, `TECHNICAL SKILLS`, `SELECTED PROJECTS`, `EDUCATION`, and `CERTIFICATIONS`: 12 pt bold uppercase, full-width 0.6 pt black bottom rule, 8 pt before/3 pt after, and kept with following content.

Experience and education put the 11 pt bold role/title and 11 pt regular date range on one line, with the date flush right; Typst uses a two-column grid and DOCX one native right-aligned tab stop and one tab. The 11 pt italic company/institution follows on its own line with 3 pt after. Projects put an 11 pt bold name and optional URL/date on the first line, then optional 11 pt italic subtitle/tech stack with 3 pt after. Valid `YYYY-MM` inputs display as abbreviated month/year, joined with an en dash; source snapshots remain unchanged.

Summary and skills use 11 pt text with 3 pt and 2 pt after respectively. Bullets are 10.5 pt with a 4.5 mm hanging indent and 2 pt between bullets; entries have 6 pt separation. Skills render as bold `Skills:` plus a comma-separated list when categories are absent, or as bold category labels in first-appearance order. Use local Droid Sans Fallback Full (Apache 2.0) for CJK and Noto Emoji (OFL 1.1 and Apache 2.0) for glyph fallbacks. Typst bundles Caladea and embeds used subsets. Visual inspection covered accented Latin, Greek, CJK, and U+1F9EA; this does not guarantee universal glyph coverage. DOCX declares Cambria; exact display remains dependent on recipient font availability. No photo, icons, skill bars, content tables, or floating shapes.

PDF and DOCX must preserve the same wording, section order, links, and visual hierarchy. Exact line wrapping and page-count parity are not acceptance requirements: Word processors and Typst have different layout engines.

### PDF

- Render data through the trusted Typst template; do not interpolate user strings into executable source or call `eval` on them.
- Run the compiler with an argument array, not a shell-built command.
- Use an isolated temporary root containing only the template, resolved JSON, and approved local assets. No remote template imports.
- Pin/verify the compiler and control font discovery using the supported compiler options established in Phase 0.
- Enforce a compilation deadline and preserve previous outputs on timeout/error.
- Generate searchable/selectable PDF text and usable links. Review actual PDF page images, not just extracted text.

### DOCX

- Generate a real `.docx` using `Document`, `Paragraph`, `TextRun`, native list numbering, named paragraph styles, and external hyperlinks.
- Keep resume content in the main document body. Do not fake layout with tables, pictures, or floating text boxes.
- Use named styles for name/contact/section heading/entry heading/body/bullet so users can edit content and maintain the design.
- Set requested paper/margins and keep headings with the following paragraph where supported. Allow normal paragraph reflow.
- No document protection, macros, tracked changes, embedded source evidence, job text, or evaluator metadata in resume content.
- DOCX references the chosen font; recipients may need it installed. Font substitution can change wrapping. Do not claim universal font embedding or identical rendering across editors.
- Prove a user can insert/edit a bullet, retain its list formatting, save, and reopen in a named desktop editor. Start with LibreOffice Writer on Linux; do not advertise Microsoft Word/Google Docs compatibility as tested without exercising them.

### Manual editing boundary

The DOCX is editable, not round-trip synchronized. Manual edits do not update application JSON or earlier reports. Regenerating from old JSON would discard those changes. To reevaluate/reexport edited content, the user asks the agent to reconcile the edits into a new JSON revision and confirms the result. No import/parser implementation is required for this prototype; the agent uses its available tools or user-provided text.

## 7. Jev rubric and report

### Questions

| Criterion | Primitive | Target and rubric |
|---|---|---|
| Evidence support | Choice | Every summary/bullet claim and selected skill: `supported`, `contradicted`, `insufficient`, using only its attached facts |
| Requirement coverage | Noul | Every supplied requirement: probability the resolved resume demonstrates it, not probability the user has it |
| Relevance | Score | Whole resume against job, levels 0 unrelated / 1 relevant but diluted or substantial gaps / 2 prominently aligned |
| Clarity | Score | Each rewritten claim, levels 0 materially ambiguous / 1 understandable but vague or overloaded / 2 clear contribution/context |

Do not invent an aggregate score, ATS score, hiring probability, or model-written rationale. Questions explicitly name their targets in instructions/state; question IDs alone do not convey semantic instructions. Treat all supplied text as untrusted data, not instructions.

### Request and failure policy

- Project only selected resume content without contact fields, relevant evidence text/IDs, and normalized job requirements/quotes. Omit local locators, raw full job text, unrelated history, and secrets. The preview is private data, not an anonymization guarantee.
- Plan one batch; reject oversized requests clearly, never truncate evidence or omit questions silently. Initial guard: 48 KiB UTF-8 serialized request, explicitly a conservative byte limit rather than a token estimate. Revisit from observed representative usage.
- Pin a currently available model after an authorized Phase 0 call; record requested and returned model plus rubric version.
- Use the SDK's retry handling with one overall cancellation deadline, initially 30 seconds; do not add a second retry loop.
- Validate every expected answer, primitive, option, range, distribution, and applicable confidence. Reject incomplete/malformed batches as unavailable; never fill missing answers with defaults.
- Auth, rate-limit exhaustion, timeout/cancellation, transport, provider budget rejection, and invalid response get explicit categories/nonzero exits. No fabricated scores/model/token usage.
- Dry-run requires no key. Live invocation requires explicit permission even if a key exists. The skill asks for permission before granting `--allow-remote`; the flag is a capability decision, not authenticated proof of human approval.

### Report contract

The generated report schema defines:

- Schema/tool/rubric versions, timestamp, application ID/revision and exact input SHA-256.
- Validation status and issues with JSON Pointers.
- Evaluation status: `complete` or `unavailable`.
- Requested/observed model, observed token usage or null.
- Criterion findings: target IDs/paths, raw typed answers/distributions, uncertainty and toolkit-owned review actions.
- Structured error or null, and assessment scope (claims/skills support, selected content coverage, unverified source truth/header facts).

Scores are rubric positions, not percentages. Noul near 0.5 indicates yes/no uncertainty, not partial qualification. Show uncertainty without a binary pass/fail label or uncalibrated truth guarantee.

A successful API exchange may flag unsupported content and still exit 0. Rendering never adds an evaluated/passed badge. Reports apply to their exact input hash, not to later JSON revisions or manually edited DOCX files.

## 8. Implementation layout

Create files only as their phase needs them; this is not permission to generate empty scaffolding. The Bun package is private ESM; source entrypoints and test scripts are added with real behavior, not as placeholders.

```text
.
├── .gitignore
├── package.json
├── bun.lock
├── tsconfig.json
├── docs/
│   ├── agent-tool-direction.md
│   ├── prd-idea.md
│   ├── prototype-plan.md
│   └── research-synthesis.md
├── src/                         # Add modules with Phase 1; no empty scaffold
│   ├── cli.ts
│   ├── schema.ts
│   ├── validate.ts
│   ├── io.ts
│   ├── resume.ts
│   ├── design.ts
│   ├── pdf.ts
│   ├── docx.ts
│   └── evaluate.ts
├── assets/                      # Add with export implementation
│   ├── resume.typ
│   └── fonts/                   # Licensed files and notices
├── skills/resume-toolkit/       # Add with Phase 4
│   └── SKILL.md
└── examples/                    # Synthetic fixtures only
    ├── application.json
    ├── dense-application.json
    └── edge-application.json
```

Use plain functions, direct imports, and explicit format dispatch. No generic renderer/evaluator interfaces. Add a few behavior-oriented Bun tests alongside the owning modules when failure modes justify them.

## 9. Ordered build phases

| Phase | Work | Gate before proceeding |
|---|---|---|
| **0 — feasibility** | Disposable Bun experiments: Typst PDF; `docx` generation; SDK import and authorized synthetic call/cancellation. Select compiler/package/font versions. | Actual PDF compilation and text/link/layout inspection; DOCX opens and permits a saved/reopened edit in Writer; real Jev answer/model/usage observed. Missing credentials block only the live gate, not reachable local work. |
| **1 — contracts and validation** | Implement strict schemas, JSON Schema output, input snapshot/hash, issues, CLI help and `validate`. Commit synthetic example. | CLI handles valid snapshot, bad version/date/quote/link, wrong-entry refs, duplicate IDs, missing evidence warnings; input unchanged and no network. |
| **2 — exports** | Resolve model, shared design, Typst template, native DOCX styles/lists/links, both paper sizes, safe writes and errors. | Actual compact/multipage/edge CLI exports; matching selected text/order across formats; usable links, no clipping/lost content, successful manual DOCX edit; exports work offline without API key. |
| **3 — evaluation** | Versioned rubric, exact dry-run, consent, SDK integration, total deadline, response validation, report output. | Authorized live synthetic call plus controlled invalid-answer/auth/timeout scenarios; target-linked findings/scores observed; unavailable evaluation is distinct from low scores. |
| **4 — agent workflow** | Skill setup, contracts, ingestion responsibility, bounded revisions and human-review guidance. Exercise one installed shell-capable agent. | Agent produces snapshot, fixes validation, obtains remote consent, revises a claim after findings, exports both formats, and explains manual-edit/report boundaries. Name the tested environment; no universal-agent claim. |
| **5 — prototype delivery** | Fresh-install instructions, privacy/service terms disclosure, licenses, actual export examples and observed verification notes. | Another documented fresh workspace reaches both exports; observed limitations recorded; no claimed compatibility/usefulness benchmark without evidence. |

### Implementation progress

Phase 0 remains open only for an authorized live Jev request/cancellation check. Phase 2 local exports and the LibreOffice Writer edit/save/reopen check are complete.

1. **Completed — Phase 1: contracts and validation.** Implemented strict Zod application/report schemas, generated JSON Schema, one-time input snapshots/hashes, locatable issues, `schema`/`validate` CLI behavior, the synthetic fixture, and focused Bun tests. **Gate:** `bunx tsc --noEmit` and `bun test` pass; subprocess checks exercise exit codes 0, 1, 2, and 4, evidence warnings, and unchanged fixture bytes.

2. **Completed — Phase 2: local exports.** Implemented the ordered resolved model and fixed design, trusted JSON Typst template, native editable DOCX, local licensed fonts, staged safe writes, CLI `render`, A4/Letter, and compact/dense/edge examples. **Gate:** final CLI tests rendered all three fixtures in both formats; `pdftotext`/`pdfinfo` confirmed selectable content, paper sizes, two-page dense layout, and link annotations; PDF pages were visually inspected; Writer save/reopen retained native bullet style and numbering; rendering stayed offline.

3. **Implemented — Phase 3 local evaluation.** Added the minimized projection, exact offline `--dry-run`, explicit remote consent, one SDK batch using Choice/Noul/Score, a 30-second overall AbortSignal deadline, strict answer validation, and versioned reports. **Local gate:** `bun x tsc --noEmit`, all 29 tests, loopback mock failures, and the actual no-key dry-run CLI path passed. **Remaining live gate:** an explicitly authorized synthetic Jev call with observed model/usage/findings and cancellation; it was not completed.

4. **Implemented — Phase 4 agent workflow and skill.** Added [`skills/resume-toolkit/SKILL.md`](../skills/resume-toolkit/SKILL.md) with schema discovery, ownership/provenance boundaries, exact command/exit-code reference, minimized-payload preview and explicit human consent, at most two automated revision passes, and manual DOCX reconciliation/report boundaries. `src/workflow.test.ts` exercises real CLI schema discovery, a structurally valid overstated v1, dry-run inspection, an explicitly simulated contradicted finding, an immutable-evidence v2 with a distinct byte hash, and both offline exports. It checks full corrected wording with `pdftotext`, DOCX archive integrity/native OOXML paragraphs/lists/styles, and unchanged snapshot bytes. **Local gate:** `bunx tsc --noEmit` and `bun test` pass (30 tests across eight files, zero failures). **Remaining live boundary:** this synthetic report does not satisfy the authorized Jev or real remote-consent exercise in the full prototype gate.

Do not wait for broad evaluator calibration to use local exports. The complete prototype still requires a real authorized Jev run; fake responses are only controlled failure fixtures, not feature proof.

## 10. Verification matrix

Keep routine tests focused on plausible consumer-visible defects, not implementation wording or option forwarding.

| Scenario | Required observation |
|---|---|
| Unknown/misowned evidence, duplicate IDs, invalid months and quotes | Stable error category and correct pointer; evaluation never sends invalid data |
| No evidence / unconfirmed evidence | Explicit unavailable-linkage/review warnings; no false truth claim |
| Render-only snapshot without job/key | Both exports succeed; no remote evaluator access |
| Dry-run and missing consent | Exact preview works offline; no network when consent absent |
| Missing answers, wrong types/probabilities, auth and timeout | Unavailable evaluation and nonzero exit, no invented findings |
| Compact, dense multipage, long strings and Unicode | Selected content survives both exports; correct paper; readable layout and documented glyph coverage |
| Hostile-looking text/unsafe URLs | Text remains inert; bad links rejected; no source-controlled reads or network |
| Existing output, alias, missing compiler, timeout/write failure | Inputs/prior output intact; owned temporary files removed |
| Manual DOCX edit | Native list/style preserved; saved/reopened edit visible; old report not presented as covering edit |
| New JSON revision after feedback | New hashes/report; no silent reuse of prior evaluation |

For PDF use `pdftotext`/`pdfinfo`, link-annotation inspection, and actual page images as development verification tools. For DOCX inspect paragraph/text/link structure and open in Writer. A headless conversion alone does not prove manual editability or visual quality. Do not add LibreOffice to the toolkit's runtime dependency set.

Use a few realistic support examples plus mutations of magnitude/ownership and missing requirements to inspect Jev usefulness. Record misleading findings; this small prototype exercise is not a calibrated accuracy study or ATS benchmark.

## 11. Prerequisites and current verification

The initial project setup consists of a private Bun package, exact dependency pins, `bun.lock`, `tsconfig.json`, `.gitignore`, and planning documents under `docs/`. Phase 1 added `src/schema.ts`, `src/io.ts`, `src/validate.ts`, `src/cli.ts`, focused `bun:test` suites, and the synthetic application fixture. Phase 2 added the shared resolved resume/design, staged writes, both local serializers, Typst template and licensed font assets, export fixtures, `render`, and focused tests. Phase 3 added `src/evaluate.ts`, the `evaluate` CLI mode, and loopback-backed evaluation tests. Phase 4 added the agent skill and `src/workflow.test.ts` lifecycle regression.

### Observed local smoke checks

- Bun 1.4.2 and Typst 0.15.1 ran on the development Linux x86_64 environment. Typst was installed to `~/.local/bin/typst` from the official `typst-x86_64-unknown-linux-musl` v0.15.1 release; the archive SHA-256 was verified.
- Carlito, Droid Sans Fallback Full, and Noto Emoji are bundled with their OFL/Apache notices. Design 2.0 rendered both application fixtures as A4 and Letter PDFs with system font discovery disabled. `pdfinfo` confirmed page sizes/counts: compact is one page at both sizes; dense is one A4 page and two Letter pages, with only the skills section on Letter page two. `pdftotext` confirmed selectable content; `pdfinfo -url` confirmed full HTTPS targets; `pdffonts` confirmed embedded Carlito subsets. Page-image review checked centered headers, uppercase ruled sections, right-aligned dates, and the dense page boundary.
- `docx` 9.10.0 rendered both fixtures at A4 and Letter. OOXML inspection verified 15/16 mm margins, centered header styles, 276-twip line spacing, section rules, right-tab positions at the printable widths (10092 A4 / 10426 Letter), and exactly one native tab run per date row with no tab characters in text runs. LibreOffice Writer edited, saved, and reopened a v2.0 dense A4 DOCX; the `Resume Bullet` style and numbering level 0 remained intact. LibreOffice is verification-only, not a runtime dependency.
- `@typesafe-ai/sdk` 0.6.0 is available under Bun. The final evaluation tests used only a local mock service; no successful live Jev result or cancellation has been observed.
- The repository dependency smoke test imported `docx`, Zod, and `@typesafe-ai/sdk`, instantiated the SDK client without making a request, and parsed a small strict Zod value.
- Current local gate: `bunx tsc --noEmit` passed; `bun test` passed (35 tests across eight files); the actual `evaluate --dry-run --json` CLI returned `status: "dry_run"` with no API key or network access.
- Phase 4 local gate was exercised by the omp shell-capable coding agent on Linux x86_64 with Bun 1.4.2, Typst 0.15.1, Poppler `pdftotext` 26.01.0, and UnZip 6.00. The workflow test requires both export tools rather than silently skipping PDF verification. Its renders run with an empty `TYPESAFE_API_KEY` and preloaded network-denial guards. A separate actual CLI smoke run also produced distinct v1/v2 hashes, preserved v1 bytes, and extracted the corrected claim from both exports with no remote evaluation. Skill YAML frontmatter parsed successfully. These checks do not establish compatibility with other agent environments.

These are local product CLI checks, not the remaining Phase 0/3 live-evaluation gate. An authorized synthetic Jev request, live response/model/usage, and cancellation remain open. No findings or usage are fabricated.

## 12. Documentation sources checked for planning

- [Typst installation and CLI](https://github.com/typst/typst#installation): native compiler and local compilation.
- [Typst JSON loading](https://typst.app/docs/reference/data-loading/json/): structured data input, separate from executable template source.
- [`docx` usage](https://github.com/dolanmiu/docx/tree/master/docs/usage): paragraphs, styles, lists, hyperlinks, and document packing. Bun generation and LibreOffice open/edit/save/reopen were exercised; LibreOffice is verification-only, not a runtime dependency.
- [TypeSafe JavaScript SDK](https://docs.typesafe.ai/sdk/javascript.md): client, typed primitives, custom fetch transport, retry policy, and AbortSignal support. The pinned SDK was exercised through a local mock service; a live Jev call and cancellation remain unverified.
- [Bun TypeScript configuration](https://bun.com/docs/runtime/typescript): Bun TypeScript, compiler options, and `@types/bun`.
- [TypeSafe primitives](https://docs.typesafe.ai/primitives.md): Choice/Score/Noul answer shapes and uncertainty semantics.

Documentation checks are not runtime tests. PDF extraction is not universal ATS compatibility. DOCX editability does not imply identical pagination or automatic round-trip synchronization.
