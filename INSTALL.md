# Agent Installation Guide

Use this guide when a user asks you to install Resume Toolkit or scaffold a workspace. Do not install it or create a workspace without that request: the installer downloads software and modifies files under the user's home directory.

## One-command install

On Linux, with `curl` available, run this with the user's requested workspace path:

```sh
curl -fsSL https://raw.githubusercontent.com/sfsajid91/resume-toolkit/main/scripts/install.sh | bash -s -- "$HOME/work/my-applications"
```

Omit the workspace argument to install the CLI and global skills without creating a workspace:

```sh
curl -fsSL https://raw.githubusercontent.com/sfsajid91/resume-toolkit/main/scripts/install.sh | bash
```

The command executes a script downloaded from GitHub. Review the public [`scripts/install.sh`](https://github.com/sfsajid91/resume-toolkit/blob/main/scripts/install.sh) before running it if desired.

## What the installer changes

- Downloads and verifies the `release.ts` installer asset and checksum from the latest GitHub Release; that verified helper downloads the stable release archive/checksum over HTTPS (each release also publishes version-tagged archive/checksum assets), validates package contents/version, then installs to `~/.local/share/resume-toolkit`. No Git executable or GitHub API token is required.
- Installs Bun with Bun's official installer if Bun is missing.
- Installs Typst 0.15.1 to `~/.local/bin/typst` when no matching version is available. The Linux x86_64 and aarch64 archives are checksum-verified. It refuses to overwrite a different executable already at that path.
- Runs the toolkit setup: installs locked dependencies, links `resume-toolkit` into `~/.local/bin`, installs a physical original skill copy at `~/.agents/skills/resume-toolkit`, retains a physical copy at `~/.omp/skills/resume-toolkit`, makes `~/.claude/skills/resume-toolkit` a relative symlink to the `.agents` copy, and runs CLI smoke checks.
- With a workspace argument, creates `career-vault/`, `jobs/`, a physical skill copy under `.agents/skills/resume-toolkit`, an OMP copy under `.omp/skills/resume-toolkit`, and a Claude symlink under `.claude/skills/resume-toolkit`, plus `.gitignore`, `.env.example`, and starter notes. Career notes and config files are preserved; toolkit-owned skill files refresh on rerun. Workspace paths inside the toolkit checkout are refused.

`~/.agents/skills/resume-toolkit` is the canonical physical copy; `~/.omp/skills/resume-toolkit` remains a physical OMP copy. `~/.claude/skills/resume-toolkit` is a relative symlink to the canonical copy. Setup converts old Claude copies only when they contain toolkit-owned files; extra files make it stop safely.

- Requires Linux, Bash, `curl`, `tar`, `install`, `mktemp`, `sha256sum`, and GNU coreutils (`realpath`, `readlink`, `mkdir`, `cp`, `basename`). `unzip` is needed if Bun must be installed. Unsupported Linux architectures must install Typst 0.15.1 separately.

Ensure `~/.local/bin` is on `PATH` in the user's shell. The workspace is separate from the toolkit checkout; never put personal career facts, job descriptions, API keys, or generated resumes in the toolkit repository.

## Updating

Existing installations created by the Git-based installer must rerun the public installer command above once; their old `resume-toolkit update` only reapplies setup and cannot fetch the release-based updater. After that migration, rerunning the installer or using `resume-toolkit update` downloads the latest GitHub Release. The updater verifies the published SHA-256 checksum and package version, installs in a staging directory, then refreshes setup and any explicitly supplied workspace. Failed downloads or validation leave the current installation unchanged; setup failure restores it. Successful release installs carry a `.resume-toolkit-release` marker; same-version setup shortcuts apply only to marker-verified installs. Unmarked legacy checkouts migrate even when their package version matches. After a successful upgrade, the prior installation remains at `~/.local/share/resume-toolkit.backup-<old-version>` (or `~/.local/share/resume-toolkit.backup-unmanaged` when it is unmarked or its package version cannot be identified). Backups are not deleted or overwritten automatically; if a backup path already exists, the updater refuses to replace it. Career notes and existing workspace files remain untouched; toolkit-owned skill files refresh.

## Smoke check

```sh
resume-toolkit schema --kind application --json
resume-toolkit validate --input /path/to/application.json --json
```

The scaffold contains note templates, not an application JSON snapshot. Ask the user or their agent to prepare and confirm the application snapshot before validation or rendering. Remote evaluation is optional and always requires explicit user consent.
