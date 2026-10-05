#!/usr/bin/env bash
# Acceptance gate: Astro build vs the legacy build.py output.
#
#   LEGACY_REF   git ref whose build.py/content is the baseline (default: origin/main,
#                the line the live site is built from)
#   LEGACY_DIST  optional: an already-built legacy tree to compare against instead of
#                building LEGACY_REF (e.g. the deployed site, /home/claude/sites/www)
#   LEGACY_PYTHON python with PyYAML + Markdown for build.py (default: python3)
#   REPORT       report path (default: reports/astro-migration-comparison.md)
set -euo pipefail

ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
LEGACY_REF=${LEGACY_REF:-origin/main}
LEGACY_PYTHON=${LEGACY_PYTHON:-python3}
REPORT=${REPORT:-$ROOT/reports/astro-migration-comparison.md}
BASELINE="$(git -C "$ROOT" rev-parse --short "$LEGACY_REF")"

if [[ -n "${LEGACY_DIST:-}" ]]; then
  OLD_DIST=$LEGACY_DIST
  BASELINE="$BASELINE, compared against the built tree $LEGACY_DIST"
else
  TMP=$(mktemp -d)
  trap 'rm -rf "$TMP"' EXIT
  git -C "$ROOT" archive "$LEGACY_REF" | tar -x -C "$TMP"
  (
    cd "$TMP"
    "$LEGACY_PYTHON" build.py >/dev/null
  )
  OLD_DIST=$TMP/dist
fi

pnpm --dir "$ROOT" build
pnpm --dir "$ROOT" test
node "$ROOT/scripts/compare-builds.mjs" \
  --old "$OLD_DIST" \
  --new "$ROOT/dist" \
  --report "$REPORT" \
  --baseline "$BASELINE"

if ! git -C "$ROOT" diff --quiet "$LEGACY_REF" -- content/posts; then
  echo "FAIL: migration rewrites content/posts" >&2
  exit 1
fi

echo "PASS: content sources unchanged from $LEGACY_REF"
