#!/usr/bin/env bash
set -euo pipefail

REPOSITORY='https://github.com/sfsajid91/resume-toolkit.git'
HOME_DIR="${HOME:?HOME must be set}"
LOCAL_BIN="$HOME_DIR/.local/bin"
TOOLKIT_DIR="$HOME_DIR/.local/share/resume-toolkit"
BUN_INSTALL="${BUN_INSTALL:-$HOME_DIR/.bun}"

fail() {
  printf 'resume-toolkit installer: %s\n' "$*" >&2
  exit 1
}

if [[ $# -gt 1 ]]; then
  fail 'usage: install.sh [workspace-path]'
fi
WORKSPACE_PATH="${1:-}"

for dependency in curl git tar install mktemp uname sha256sum; do
  command -v "$dependency" >/dev/null 2>&1 || fail "$dependency is required."
done
[[ "$(uname -s)" == Linux ]] || fail 'automatic installation currently supports Linux only.'

mkdir -p -- "$LOCAL_BIN"
export BUN_INSTALL
export PATH="$BUN_INSTALL/bin:$LOCAL_BIN${PATH:+:$PATH}"
if ! command -v bun >/dev/null 2>&1; then
  command -v unzip >/dev/null 2>&1 || fail 'unzip is required to install Bun on Linux.'
  curl -fsSL https://bun.com/install | bash
  export PATH="$BUN_INSTALL/bin:$LOCAL_BIN${PATH:+:$PATH}"
fi
command -v bun >/dev/null 2>&1 || fail 'Bun installation failed.'

is_typst_0151() {
  local version
  [[ -x "$1" ]] || return 1
  version="$("$1" --version 2>/dev/null || true)"
  [[ "$version" =~ ^typst[[:space:]]0\.15\.1([[:space:]]|$) ]]
}

install_typst() {
  local target checksum archive archive_path archive_dir
  case "$(uname -m)" in
    x86_64|amd64)
      target='x86_64-unknown-linux-musl'
      checksum='a6d077d0a95eed5a2eba715b2dae06be954f624ccbf85758a03f389ded33118c'
      ;;
    aarch64|arm64)
      target='aarch64-unknown-linux-musl'
      checksum='5aa8d74a3d906e60ea12a66ac2f37f8eef1b14cbad7182a745e393a10c23dcee'
      ;;
    *)
      fail "unsupported Linux architecture: $(uname -m). Install Typst 0.15.1 manually."
      ;;
  esac

  archive="typst-$target.tar.xz"
  archive_path="$TEMP_DIR/$archive"
  archive_dir="${archive%.tar.xz}"
  curl -fsSL --retry 3 "https://github.com/typst/typst/releases/download/v0.15.1/$archive" -o "$archive_path"
  printf '%s  %s\n' "$checksum" "$archive_path" | sha256sum --check --status - || fail 'Typst archive checksum did not match.'
  tar -xJf "$archive_path" -C "$TEMP_DIR"
  [[ -x "$TEMP_DIR/$archive_dir/typst" ]] || fail 'Typst archive did not contain the expected executable.'
  [[ ! -e "$LOCAL_BIN/typst" && ! -L "$LOCAL_BIN/typst" ]] || fail "refusing to replace existing $LOCAL_BIN/typst. Move it aside and retry."
  install -m 0755 "$TEMP_DIR/$archive_dir/typst" "$LOCAL_BIN/typst"
}

if [[ -e "$LOCAL_BIN/typst" || -L "$LOCAL_BIN/typst" ]]; then
  is_typst_0151 "$LOCAL_BIN/typst" || fail "existing $LOCAL_BIN/typst is not Typst 0.15.1; move it aside and retry."
elif ! command -v typst >/dev/null 2>&1 || ! is_typst_0151 "$(command -v typst)"; then
  TEMP_DIR="$(mktemp -d "${TMPDIR:-/tmp}/resume-toolkit-install.XXXXXX")"
  trap 'rm -rf -- "$TEMP_DIR"' EXIT
  install_typst
fi

mkdir -p -- "$(dirname -- "$TOOLKIT_DIR")"
if [[ -e "$TOOLKIT_DIR" || -L "$TOOLKIT_DIR" ]]; then
  git -C "$TOOLKIT_DIR" rev-parse --is-inside-work-tree >/dev/null 2>&1 || fail "$TOOLKIT_DIR exists but is not a Git checkout."
  origin="$(git -C "$TOOLKIT_DIR" remote get-url origin 2>/dev/null || true)"
  case "$origin" in
    "$REPOSITORY"|https://github.com/sfsajid91/resume-toolkit|git@github.com:sfsajid91/resume-toolkit.git|ssh://git@github.com/sfsajid91/resume-toolkit.git)
      ;;
    *)
      fail "$TOOLKIT_DIR has an unexpected origin; refusing to update it."
      ;;
  esac
  branch="$(git -C "$TOOLKIT_DIR" branch --show-current)"
  [[ "$branch" == main ]] || fail "switch $TOOLKIT_DIR to main before updating."
  [[ -z "$(git -C "$TOOLKIT_DIR" status --porcelain)" ]] || fail "$TOOLKIT_DIR has local changes; commit or stash them before updating."
  git -C "$TOOLKIT_DIR" pull --ff-only origin main
else
  git clone --branch main --depth 1 "$REPOSITORY" "$TOOLKIT_DIR"
fi

export PATH="$BUN_INSTALL/bin:$LOCAL_BIN${PATH:+:$PATH}"
if [[ -n "$WORKSPACE_PATH" ]]; then
  "$TOOLKIT_DIR/scripts/setup.sh" "$WORKSPACE_PATH"
else
  "$TOOLKIT_DIR/scripts/setup.sh"
fi

printf 'Installed toolkit checkout: %s\n' "$TOOLKIT_DIR"
