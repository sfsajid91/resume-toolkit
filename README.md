# Resume Toolkit

A local Bun CLI for validating agent-supplied application snapshots, optionally evaluating them with Jev, and exporting PDF and editable DOCX resumes. The toolkit does not store or manage career history; the connected agent owns tailoring and revisions.

## Install

On Linux, install the CLI and scaffold a workspace with:

```sh
curl -fsSL https://raw.githubusercontent.com/sfsajid91/resume-toolkit/main/scripts/install.sh | bash -s -- "$HOME/work/my-applications"
```

The installer bootstraps Bun and Typst 0.15.1 when needed, installs the CLI, copies the canonical skill to `~/.agents/skills/resume-toolkit`, keeps an OMP copy under `~/.omp/skills/resume-toolkit`, and symlinks `~/.claude/skills/resume-toolkit` to the `.agents` copy. With a workspace argument, it creates matching local destinations. Ensure `~/.local/bin` is on `PATH`.

**Agents:** read [INSTALL.md](INSTALL.md) before installing; install only when the user requests it. To inspect the remote script before execution, download it from the URL above and review it first.

## Updating

If installed with the earlier Git-based installer, rerun the public installer command above once; that old CLI's `update` command only reapplies setup and cannot fetch the new updater. After migration, `resume-toolkit update` downloads the latest GitHub Release archive and checksum, validates the package and required files, installs in a staging directory, and reapplies setup. It uses HTTPS and does not require Git. Replaced contents remain recoverable at `~/.local/share/resume-toolkit.backup-<old-version>` (or `.backup-unmanaged` for unmarked legacy installs); backups are never overwritten automatically. Typst stays pinned to 0.15.1.

## Use

Pass an application snapshot explicitly; rendering writes the requested format to the current directory when `--out` is relative:

```sh
resume-toolkit schema --kind application --json
resume-toolkit validate --input /path/to/application.json --json
resume-toolkit render --input /path/to/application.json --format pdf --out resume.pdf --json
resume-toolkit render --input /path/to/application.json --format docx --out resume.docx --json
```

Validation and rendering work offline. Remote evaluation requires `TYPESAFE_API_KEY` and explicit `--allow-remote` consent. The workspace `.env.example` documents the optional key; copy it to `.env` only if remote evaluation is explicitly authorized.
