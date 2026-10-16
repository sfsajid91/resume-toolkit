# Agent Installation Guide

Use this guide when a user asks you to install Resume Toolkit or scaffold a workspace. Do not install it or create a workspace without that request: the installer downloads software and modifies files under the user's home directory.

## One-command install

On Linux, with `curl` and `git` available, run this with the user's requested workspace path:

```sh
curl -fsSL https://raw.githubusercontent.com/sfsajid91/resume-toolkit/main/scripts/install.sh | bash -s -- "$HOME/work/my-applications"
```

Omit the workspace argument to install the CLI and global skills without creating a workspace:

```sh
curl -fsSL https://raw.githubusercontent.com/sfsajid91/resume-toolkit/main/scripts/install.sh | bash
```

The command executes a script downloaded from GitHub. Review the public [`scripts/install.sh`](https://github.com/sfsajid91/resume-toolkit/blob/main/scripts/install.sh) before running it if desired.

## What the installer changes

- Clones the public toolkit to `~/.local/share/resume-toolkit`. On repeat installs, it fast-forwards a clean `main` checkout; it refuses a dirty, divergent, wrong-origin, or non-`main` checkout.
- Installs Bun with Bun's official installer if Bun is missing.
- Installs Typst 0.15.1 to `~/.local/bin/typst` when no matching version is available. The Linux x86_64 and aarch64 archives are checksum-verified. It refuses to overwrite a different executable already at that path.
- Runs the toolkit setup: installs locked dependencies, links `resume-toolkit` into `~/.local/bin`, copies the skill files into `~/.omp/skills/resume-toolkit` and `~/.claude/skills/resume-toolkit`, and runs CLI smoke checks.
- With a workspace argument, creates `career-vault/`, `jobs/`, skill copies under `.omp/skills/resume-toolkit` and `.claude/skills/resume-toolkit`, `.gitignore`, `.env.example`, and starter notes. Existing career notes and config files are preserved; setup refreshes toolkit-owned skill files on rerun and keeps extra files in those directories. Workspace paths inside the toolkit checkout are refused.

Agent loaders need the skill as real files, not symlinks. `setup.sh` copies `skills/resume-toolkit/*` into each destination and refreshes those source-owned files on rerun while leaving extra files alone.

No `sudo` or GitHub CLI is used. The installer requires Linux, Bash, `curl`, `git`, `tar`, `install`, `mktemp`, `sha256sum`, and GNU coreutils (`realpath`, `readlink`, `mkdir`, `cp`, `basename`). `unzip` is needed if Bun must be installed. Unsupported Linux architectures must install Typst 0.15.1 separately.

Ensure `~/.local/bin` is on `PATH` in the user's shell. The workspace is separate from the toolkit checkout; never put personal career facts, job descriptions, API keys, or generated resumes in the toolkit repository.

## Updating

Run the same `curl` installer again from a workspace to fast-forward the clean toolkit checkout and reapply setup. It refuses to update a checkout with local changes; preserve or commit those changes first.

`resume-toolkit update` only reapplies setup from the currently installed checkout. It does not fetch source from GitHub. Typst remains pinned to 0.15.1; the installer verifies or installs that version.

## Smoke check

```sh
resume-toolkit schema --kind application --json
resume-toolkit validate --input /path/to/application.json --json
```

The scaffold contains note templates, not an application JSON snapshot. Ask the user or their agent to prepare and confirm the application snapshot before validation or rendering. Remote evaluation is optional and always requires explicit user consent.
