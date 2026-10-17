# CLI reference

Use the installed `resume-toolkit` command. `bun run src/cli.ts` is only for development inside this repository. No repository install is part of the user workflow.

## Commands

```sh
resume-toolkit --help
resume-toolkit --version
resume-toolkit schema --kind application --json
resume-toolkit schema --kind report --json
resume-toolkit validate --input snapshot.json --json
resume-toolkit lint --input snapshot.json --json
resume-toolkit evaluate --input snapshot.json --dry-run --json
resume-toolkit evaluate --input snapshot.json --allow-remote --out report.json --json
resume-toolkit render --input snapshot.json --format pdf --paper a4 --out resume.pdf --json
resume-toolkit render --input snapshot.json --format docx --paper a4 --out resume.docx --json
```

## Flags and behavior

Available flags: `--help`, `--version`, `--json`, `--force`, `--dry-run`, `--allow-remote`, `--kind`, `--input`, `--out`, `--format`, and `--paper`. `schema` accepts `--kind application|report`. `render` requires `--format pdf|docx` and `--out` with the matching extension. `--paper a4|letter` defaults to A4. Evaluation `--out` must end in `.json`.

`--force` allows replacing an existing explicit output; without it, writes do not clobber. Inputs are not mutated. Unknown, duplicate, or conflicting options are rejected. Evaluation requires exactly one of `--dry-run` or `--allow-remote`. Dry-run cannot be combined with `--allow-remote`, `--out`, or `--force`; `--force` requires evaluation `--out`.

`--allow-remote` sends the prepared evaluation request to the hosted Jev service. Preview first, disclose the exact transfer, and obtain explicit consent for that snapshot before using this flag. A configured API key does not constitute consent. Evaluation requires `TYPESAFE_API_KEY`; local validation, lint, schema generation, dry-run preview, and rendering do not require a key or network access. PDF rendering requires Typst 0.15.1 installed locally.

JSON mode emits one JSON result on stdout; errors are sanitized. Do not expose secrets or source documents in error messages.

## Exit codes

- `0`: successful command, including evaluation with semantic findings.
- `1`: invalid input or failed evaluation prerequisites.
- `2`: usage error, missing remote consent, or configuration error.
- `3`: attempted evaluation failure.
- `4`: I/O, output, or compiler failure.

Evaluation prerequisites are checked before key lookup or network access. A successful evaluation can still contain concerning findings; exit status is not a quality score.
