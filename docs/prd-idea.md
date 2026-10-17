# Research Brief: Local Resume Toolkit for AI Agents

> **Superseded:** This initial research brief is retained for history. Follow [prototype-plan.md](prototype-plan.md) for current product boundaries, workflows, schema, lint, CLI, rendering, and verification.


## Goal

Research and propose a practical v0.1 for a local resume toolkit built with Bun and TypeScript.

The project serves two purposes:
1. Help me create tailored resumes for real job applications.
2. Demonstrate my engineering skills as a portfolio project.

## Core Idea

Users connect their existing AI coding agent through a skill file and CLI, with optional MCP support.

The agent handles gathering information, analyzing jobs, selecting relevant experience, writing content, and revising drafts.

The toolkit accepts agent-prepared structured data, validates it, uses Jev from TypeSafe AI to evaluate specific criteria, returns actionable results, and generates resume files locally.

Working slogan: “Connect your favorite AI agent. Craft a resume for every job.”

## Intended Workflow

1. User provides career history, skills, projects, achievements, an existing resume, and a job description.
2. Agent prepares a reusable master profile and structured job requirements.
3. Agent creates a tailored draft linked to supporting profile evidence.
4. Toolkit validates the draft and evaluates it.
5. Agent interprets the feedback and revises the draft.
6. User reviews the result.
7. Toolkit exports the resume locally.

## Responsibilities

- **AI agent:** Research, reasoning, requirement extraction, content selection, writing, and explanations.
- **Skill file:** Instructions, input schemas, command usage, and revision workflow.
- **CLI:** Input validation, evidence checks, evaluator calls, reports, and rendering.
- **Jev:** Narrow judgments such as relevance, requirement satisfaction, clarity, and evidence support.

Do not build an internal general-purpose agent runtime. The connected agent should remain responsible for orchestration.

## Proposed v0.1

- Bun and TypeScript.
- Local structured files for profiles, jobs, drafts, and reports.
- Source references connecting claims to recorded experience.
- Commands resembling `validate`, `evaluate`, and `render`.
- Separate evaluation criteria with uncertainty and flagged issues.
- One polished resume template.
- PDF and Markdown exports, with HTML preview if practical.
- A skill file explaining the complete workflow.

Files and rendering should stay local. Selected evaluation data may be sent to Jev’s hosted API.

## Research Questions

1. What is the smallest useful architecture and dependency set?
2. Should v0.1 use CLI plus a skill, MCP, or both?
3. What schemas best separate fixed facts from rewritten content?
4. Which factual checks can code enforce, and which require model judgment?
5. How should Jev criteria, scores, uncertainty, and failure handling work?
6. How can we test whether evaluation results are actually useful?
7. Which rendering approach is easiest and reliable with Bun: HTML/CSS plus Playwright, Typst, or another option?
8. How should drafts, revisions, and exports be organized locally?

## Existing Projects to Inspect

- https://github.com/end1989/tailored
- https://github.com/aarangop/resume-mcp
- https://github.com/joseym/aarg
- https://www.dreamworkhq.com/agents

Inspect implementation and tool contracts, not only marketing descriptions. Identify useful patterns, limitations, unnecessary complexity, and licensing requirements if reusing code.

## Scope Boundaries

Defer broad job scraping, automatic applications, dashboards, accounts, and hosted infrastructure. Job import and application tracking are possible v0.2 features.

Do not present evaluation scores as hiring probabilities or universal ATS scores. Evidence checks can flag unsupported claims; they cannot guarantee truthfulness.

## Requested Deliverables

Produce:
- A concise findings report with sources.
- Recommended architecture and alternatives.
- A proposed v0.1 PRD with acceptance criteria.
- Example input/output schemas and CLI contracts.
- A prioritized implementation plan.
- A small evaluation and rendering test strategy.

Separate confirmed facts, recommendations, and unresolved decisions. Research first; do not start implementation yet.
