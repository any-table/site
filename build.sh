#!/usr/bin/env bash
# Build anytable.org. Used as the Cloudflare Pages build command.
#
#   ANYTABLE_REF  what to publish from any-table/anytable (default: latest-tag,
#                 the newest release tag of the form vMAJOR.MINOR.PATCH).
#                 Any branch or tag name also works, e.g. main for a preview.
#   ANYTABLE_DIR  build from a local checkout instead of cloning, e.g. ../anytable
set -euo pipefail
cd "$(dirname "$0")"

REPO_URL="https://github.com/any-table/anytable.git"
REF="${ANYTABLE_REF:-latest-tag}"

if [ -z "${ANYTABLE_DIR:-}" ]; then
  if [ "$REF" = "latest-tag" ]; then
    # Release tags only: v1.2.3, not pre-release tags such as v1.2.3-rc1.
    TAGS="$(git ls-remote --tags --refs "$REPO_URL" 'v*')"
    REF="$(printf '%s\n' "$TAGS" \
      | sed 's#.*refs/tags/##' \
      | grep -E '^v[0-9]+\.[0-9]+\.[0-9]+$' \
      | sort -V | tail -n1 || true)"
    if [ -z "$REF" ]; then
      echo "No vMAJOR.MINOR.PATCH tags found in $REPO_URL" >&2
      exit 1
    fi
  fi
  echo "Fetching $REPO_URL at $REF"
  rm -rf content
  git -c advice.detachedHead=false clone --quiet --depth 1 --branch "$REF" "$REPO_URL" content
fi

[ -d node_modules ] || npm ci --no-audit --no-fund
node build.mjs
