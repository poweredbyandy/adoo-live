#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

PLATFORM="${1:-}"
DIST_DIR="${DIST_DIR:-dist}"
OUT_DIR="${OUT_DIR:-release-artifacts}"

usage() {
  cat <<'EOF'
Uso: scripts/collect-release-artifacts.sh <mac|linux|win>

Recoge en release-artifacts/ los mismos ficheros que el workflow de GitHub.
Ejecuta tras npm run dist:mac | dist:linux | dist:win para validar el empaquetado localmente.

Variables opcionales: DIST_DIR, OUT_DIR
EOF
}

if [[ "$PLATFORM" != "mac" && "$PLATFORM" != "linux" && "$PLATFORM" != "win" ]]; then
  usage >&2
  exit 2
fi

copy_glob() {
  local pattern=$1
  local required=${2:-false}
  shopt -s nullglob
  local matches=($pattern)
  shopt -u nullglob
  if [ ${#matches[@]} -eq 0 ]; then
    if [ "$required" = true ]; then
      echo "Missing required artifact(s): $pattern" >&2
      ls -la "$DIST_DIR" 2>/dev/null || true
      exit 1
    fi
    return 0
  fi
  cp "${matches[@]}" "$OUT_DIR/"
}

rm -rf "$OUT_DIR"
mkdir -p "$OUT_DIR"

case "$PLATFORM" in
  mac)
    copy_glob "$DIST_DIR/*.dmg" true
    copy_glob "$DIST_DIR/*.zip" true
    copy_glob "$DIST_DIR/latest-mac.yml" true
    ;;
  linux)
    copy_glob "$DIST_DIR/*.AppImage" true
    copy_glob "$DIST_DIR/*.deb" true
    copy_glob "$DIST_DIR/latest-linux.yml" true
    ;;
  win)
    copy_glob "$DIST_DIR/*.exe" true
    copy_glob "$DIST_DIR/latest.yml" true
    ;;
esac

copy_glob "$DIST_DIR/*.blockmap" false

if [ -z "$(ls -A "$OUT_DIR")" ]; then
  echo "No release artifacts found in $DIST_DIR/" >&2
  ls -la "$DIST_DIR" || true
  exit 1
fi

echo "Release artifacts ($PLATFORM):"
ls -la "$OUT_DIR/"
