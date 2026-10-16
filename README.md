# Resume Toolkit

A local Bun CLI for validating agent-supplied application snapshots, optionally evaluating them with Jev, and exporting PDF and editable DOCX resumes. The toolkit does not store or manage career history; the connected agent owns tailoring and revisions.

## Setup

Install Bun and Typst 0.15.1, then run from the toolkit repository:

```sh
./scripts/setup.sh
```

The setup script installs locked dependencies, links `resume-toolkit` into `~/.local/bin`, links the agent skill into `~/.omp/skills` and `~/.claude/skills`, and checks the CLI from `/tmp`. Make sure `~/.local/bin` is on `PATH` in shells where you use the command.

To also create a private working directory:

```sh
./scripts/setup.sh ~/work/my-applications
```

This creates `career-vault/`, `jobs/`, local skill links under `.omp/skills/` and `.claude/skills/`, a no-clobber `.gitignore` and `.env.example`, and starter Markdown files in `career-vault/`. Existing files are preserved. Workspace paths inside the toolkit repository are refused. The generated `.gitignore` excludes career notes, job data, credentials, and rendered exports.

## Updating

Run from the workspace root:

```sh
resume-toolkit update
```

This reinstalls missing locked Bun dependencies, repairs the global and workspace skill links, verifies Typst 0.15.1, and reruns the CLI smoke checks. Skills, PDF template, fonts, and design settings are read from the linked toolkit checkout rather than copied into the workspace, so changes in that checkout are used by the next invocation or render.

`update` does not fetch new toolkit source or install/upgrade Typst. Update the toolkit checkout separately; Typst remains pinned to 0.15.1.

## Use

Pass an application snapshot explicitly; rendering writes the requested format to the current directory when `--out` is relative:

```sh
resume-toolkit schema --kind application --json
resume-toolkit validate --input /path/to/application.json --json
resume-toolkit render --input /path/to/application.json --format pdf --out resume.pdf --json
resume-toolkit render --input /path/to/application.json --format docx --out resume.docx --json
```

Validation and rendering work offline. Remote evaluation requires `TYPESAFE_API_KEY` and explicit `--allow-remote` consent. The workspace `.env.example` documents the optional key; copy it to `.env` only if remote evaluation is explicitly authorized.
