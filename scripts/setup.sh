#!/usr/bin/env bash
set -euo pipefail

fail() {
  printf 'setup: %s\n' "$*" >&2
  exit 1
}

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
TOOLKIT_ROOT="$(cd -- "$SCRIPT_DIR/.." && pwd -P)"
export TOOLKIT_ROOT
HOME_DIR="${HOME:?HOME must be set}"
LOCAL_BIN="$HOME_DIR/.local/bin"

if [[ $# -gt 1 ]]; then
  fail 'usage: ./scripts/setup.sh [workspace-path]'
fi

WORKSPACE_PATH=''
if [[ $# -eq 1 ]]; then
  command -v realpath >/dev/null 2>&1 || fail 'realpath is required to safely resolve workspace paths.'
  WORKSPACE_PATH="$(realpath -m -- "$1")" || fail 'could not resolve workspace path.'
  case "$WORKSPACE_PATH" in
    "$TOOLKIT_ROOT"|"$TOOLKIT_ROOT"/*)
      fail 'workspace path must be outside the toolkit repository.'
      ;;
  esac
fi

command -v bun >/dev/null 2>&1 || fail 'bun is required.'

# Prefer the pinned local compiler, but accept any matching version on PATH.
typst_candidates=("$LOCAL_BIN/typst")
IFS=: read -r -a path_dirs <<< "${PATH:-}"
for path_dir in "${path_dirs[@]}"; do
  [[ -n "$path_dir" ]] || path_dir='.'
  typst_candidates+=("$path_dir/typst")
done
TYPST_BIN=''
for candidate in "${typst_candidates[@]}"; do
  [[ -x "$candidate" ]] || continue
  version="$("$candidate" --version 2>/dev/null || true)"
  if [[ "$version" =~ ^typst[[:space:]]0\.15\.1([[:space:]]|$) ]]; then
    TYPST_BIN="$candidate"
    break
  fi
done
[[ -n "$TYPST_BIN" ]] || fail 'Typst 0.15.1 is required at ~/.local/bin/typst or on PATH.'
TYPST_DIR="$(cd -- "$(dirname -- "$TYPST_BIN")" && pwd -P)"
export PATH="$TYPST_DIR:$LOCAL_BIN${PATH:+:$PATH}"

ensure_symlink() {
  local target="$1"
  local link="$2"
  local current
  mkdir -p -- "$(dirname -- "$link")"
  if [[ -L "$link" ]]; then
    current="$(readlink -f -- "$link" 2>/dev/null || true)"
    [[ "$current" == "$target" ]] || ln -sfn -- "$target" "$link"
  elif [[ "$link" == "$LOCAL_BIN/resume-toolkit" && -f "$link" ]]; then
    printf -v old_wrapper '#!/usr/bin/env sh\nexec bun run "%s/src/cli.ts" "$@"' "$TOOLKIT_ROOT"
    if [[ "$(cat -- "$link")" == "$old_wrapper" ]]; then
      rm -- "$link"
      ln -s -- "$target" "$link"
    else
      fail "$link exists and is not a symlink; refusing to replace it."
    fi
  elif [[ -e "$link" ]]; then
    fail "$link exists and is not a symlink; refusing to replace it."
  else
    ln -s -- "$target" "$link"
  fi
}

install_skill_copy() {
  local source="$1"
  local destination="$2"
  local current
  local source_file
  local destination_file
  [[ -f "$source/SKILL.md" ]] || fail "skill source is missing SKILL.md: $source"
  mkdir -p -- "$(dirname -- "$destination")"
  if [[ -L "$destination" ]]; then
    current="$(readlink -f -- "$destination" 2>/dev/null || true)"
    [[ -n "$current" && "$(basename -- "$current")" == resume-toolkit && -f "$current/SKILL.md" ]] \
      || fail "$destination is a symlink to an unrelated target; refusing to replace it."
    rm -- "$destination"
  fi
  if [[ -e "$destination" ]]; then
    [[ -d "$destination" ]] || fail "$destination exists but is not a directory."
  else
    mkdir -- "$destination"
  fi
  for source_file in "$source"/*; do
    [[ -f "$source_file" && ! -L "$source_file" ]] || fail "unsupported skill source entry: $source_file"
    destination_file="$destination/${source_file##*/}"
    [[ ! -L "$destination_file" ]] || fail "$destination_file is a symlink; refusing to overwrite it."
    [[ ! -e "$destination_file" || -f "$destination_file" ]] || fail "$destination_file is not a regular file."
    cp -p -- "$source_file" "$destination_file"
  done
}

ensure_claude_skill_link() {
  local source="$1"
  local destination="$2"
  local current
  local entry
  mkdir -p -- "$(dirname -- "$destination")"
  if [[ -L "$destination" ]]; then
    current="$(readlink -f -- "$destination" 2>/dev/null || true)"
    if [[ "$current" == "$source" ]]; then
      return
    fi
    [[ -n "$current" && "$(basename -- "$current")" == resume-toolkit && -f "$current/SKILL.md" ]] \
      || fail "$destination is a symlink to an unrelated target; refusing to replace it."
    rm -- "$destination"
  elif [[ -d "$destination" ]]; then
    for entry in "$destination"/* "$destination"/.[!.]* "$destination"/..?*; do
      [[ -e "$entry" || -L "$entry" ]] || continue
      [[ -f "$entry" && ! -L "$entry" && -f "$source/${entry##*/}" ]] \
        || fail "$destination contains extra files; move them before converting it to a symlink."
      rm -- "$entry"
    done
    rmdir -- "$destination"
  elif [[ -e "$destination" ]]; then
    fail "$destination exists and is not a skill directory."
  fi
  ln -s -- "../../.agents/skills/resume-toolkit" "$destination"
}

mkdir -p -- "$LOCAL_BIN"
(
  cd -- "$TOOLKIT_ROOT"
  bun install --frozen-lockfile
  bun link
)
ensure_symlink "$TOOLKIT_ROOT/src/cli.ts" "$LOCAL_BIN/resume-toolkit"
install_skill_copy "$TOOLKIT_ROOT/skills/resume-toolkit" "$HOME_DIR/.agents/skills/resume-toolkit"
install_skill_copy "$TOOLKIT_ROOT/skills/resume-toolkit" "$HOME_DIR/.omp/skills/resume-toolkit"
ensure_claude_skill_link "$HOME_DIR/.agents/skills/resume-toolkit" "$HOME_DIR/.claude/skills/resume-toolkit"

printf 'Checking installed CLI outside the repository...\n'
(
  cd /tmp
  resume-toolkit schema --kind application --json >/dev/null
  resume-toolkit validate --input "$TOOLKIT_ROOT/examples/application.json" --json >/dev/null
)

create_file_if_missing() {
  local file="$1"
  if [[ -e "$file" || -L "$file" ]]; then
    [[ -f "$file" ]] || fail "$file exists but is not a regular file."
    return
  fi
  (set -o noclobber; cat > "$file") || fail "could not create $file without overwriting an existing file."
}

if [[ -n "$WORKSPACE_PATH" ]]; then
  mkdir -p -- \
    "$WORKSPACE_PATH/career-vault" \
    "$WORKSPACE_PATH/jobs" \
    "$WORKSPACE_PATH/.agents/skills" \
    "$WORKSPACE_PATH/.omp/skills" \
    "$WORKSPACE_PATH/.claude/skills"
  install_skill_copy "$TOOLKIT_ROOT/skills/resume-toolkit" "$WORKSPACE_PATH/.agents/skills/resume-toolkit"
  install_skill_copy "$TOOLKIT_ROOT/skills/resume-toolkit" "$WORKSPACE_PATH/.omp/skills/resume-toolkit"
  ensure_claude_skill_link "$WORKSPACE_PATH/.agents/skills/resume-toolkit" "$WORKSPACE_PATH/.claude/skills/resume-toolkit"

  create_file_if_missing "$WORKSPACE_PATH/.gitignore" <<'EOF'
# Keep personal career data and generated exports out of source control.
career-vault/
jobs/
.env
.env.*
!.env.example
*.pdf
*.docx
EOF
  create_file_if_missing "$WORKSPACE_PATH/.env.example" <<'EOF'
# Set only when explicitly authorizing remote evaluation.
TYPESAFE_API_KEY=
EOF
  create_file_if_missing "$WORKSPACE_PATH/career-vault/01-basics-and-education.md" <<'EOF'
# Basics and Education

## Basics
- Name:
- Contact details:
- Location:
- Public links:

## Education
EOF
  create_file_if_missing "$WORKSPACE_PATH/career-vault/02-experience.md" <<'EOF'
# Experience

## Roles
For each role, record dates, title, organization, responsibilities, measurable outcomes, and the source for each factual claim.
EOF
  create_file_if_missing "$WORKSPACE_PATH/career-vault/03-projects.md" <<'EOF'
# Projects

## Projects
For each project, record your role, dates, technologies, outcomes, and sources for factual claims.
EOF
  create_file_if_missing "$WORKSPACE_PATH/career-vault/04-skills.md" <<'EOF'
# Skills

## Skills and evidence
For each skill, record where you used it and the supporting experience or project.
EOF
  printf 'Workspace ready: %s\n' "$WORKSPACE_PATH"
fi

printf 'Setup complete. Ensure %s is on PATH to run resume-toolkit in other shells.\n' "$LOCAL_BIN"
