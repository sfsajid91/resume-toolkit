#!/usr/bin/env bash
set -euo pipefail

OWNER='sfsajid91'
REPOSITORY='resume-toolkit'
HOME_DIR="${HOME:?HOME must be set}"
RELEASE_URL="https://github.com/$OWNER/$REPOSITORY/releases/latest/download"
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

for dependency in curl tar install mktemp uname sha256sum; do
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

TEMP_DIR="${TEMP_DIR:-$(mktemp -d "${TMPDIR:-/tmp}/resume-toolkit-install.XXXXXX")}"
trap 'rm -rf -- "$TEMP_DIR"' EXIT
export PATH="$BUN_INSTALL/bin:$LOCAL_BIN${PATH:+:$PATH}"
curl -fsSL "$RELEASE_URL/release.ts" -o "$TEMP_DIR/release.ts"
curl -fsSL "$RELEASE_URL/release.ts.sha256" -o "$TEMP_DIR/release.ts.sha256"
(cd "$TEMP_DIR" && sha256sum --check --status release.ts.sha256) || fail 'release installer checksum did not match.'
RESUME_TOOLKIT_DIR="$TOOLKIT_DIR" bun run "$TEMP_DIR/release.ts" "${WORKSPACE_PATH:+$WORKSPACE_PATH}"

printf 'Installed toolkit release: %s\n' "$TOOLKIT_DIR"
