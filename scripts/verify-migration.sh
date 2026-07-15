#!/usr/bin/env bash
set -euo pipefail

ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
LEGACY_REF=${LEGACY_REF:-main}
LEGACY_PYTHON=${LEGACY_PYTHON:-/home/claude/code/solana-subscriptions-field-guide/.venv/bin/python3}
REPORT=${REPORT:-$ROOT/reports/astro-migration-comparison.md}
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

git -C "$ROOT" archive "$LEGACY_REF" | tar -x -C "$TMP"
(
  cd "$TMP"
  "$LEGACY_PYTHON" build.py
)

pnpm --dir "$ROOT" build
node "$ROOT/scripts/compare-builds.mjs" \
  --old "$TMP/dist" \
  --new "$ROOT/dist" \
  --report "$REPORT" \
  --baseline "$(git -C "$ROOT" rev-parse "$LEGACY_REF")"

if ! git -C "$ROOT" diff --quiet "$LEGACY_REF" -- content/posts; then
  echo "FAIL: migration rewrites content/posts" >&2
  exit 1
fi

echo "PASS: content sources unchanged from $LEGACY_REF"
