# Resume Toolkit

A local Bun CLI for validating agent-supplied application snapshots, optionally evaluating them with Jev, and exporting PDF and editable DOCX resumes. The toolkit does not store or manage career history; the connected agent owns tailoring and revisions.

## Install

On Linux, install the CLI and scaffold a workspace with:

```sh
curl -fsSL https://raw.githubusercontent.com/sfsajid91/resume-toolkit/main/scripts/install.sh | bash -s -- "$HOME/work/my-applications"
```

The installer bootstraps Bun and Typst 0.15.1 when needed, installs the CLI and agent skill, and creates the workspace without overwriting existing files. Omit the workspace argument to install only the CLI and global skills. Ensure `~/.local/bin` is on `PATH`.

**Agents:** read [INSTALL.md](INSTALL.md) before installing; install only when the user requests it. To inspect the remote script before execution, download it from the URL above and review it first.

## Updating

Run the same installer command again to fast-forward a clean checkout and refresh setup. It refuses to update a checkout with local changes. `resume-toolkit update` only reapplies setup from the current checkout; it does not fetch new source. Typst stays pinned to 0.15.1.

## Use

Pass an application snapshot explicitly; rendering writes the requested format to the current directory when `--out` is relative:

```sh
resume-toolkit schema --kind application --json
resume-toolkit validate --input /path/to/application.json --json
resume-toolkit render --input /path/to/application.json --format pdf --out resume.pdf --json
resume-toolkit render --input /path/to/application.json --format docx --out resume.docx --json
```

Validation and rendering work offline. Remote evaluation requires `TYPESAFE_API_KEY` and explicit `--allow-remote` consent. The workspace `.env.example` documents the optional key; copy it to `.env` only if remote evaluation is explicitly authorized.
