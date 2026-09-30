#!/usr/bin/env bash
# Build anytable.org. Used as the Cloudflare Pages build command.
#
#   ANYTABLE_REF  branch or tag of any-table/anytable to publish (default: main).
#                 Set to "latest-tag" to publish the newest v* tag instead.
#   ANYTABLE_DIR  build from a local checkout instead of cloning, e.g. ../anytable
set -euo pipefail
cd "$(dirname "$0")"

REPO_URL="https://github.com/any-table/anytable.git"
REF="${ANYTABLE_REF:-main}"

if [ -z "${ANYTABLE_DIR:-}" ]; then
  if [ "$REF" = "latest-tag" ]; then
    REF="$(git ls-remote --tags --refs --sort=-version:refname "$REPO_URL" 'v*' | head -n1 | sed 's#.*refs/tags/##')"
    if [ -z "$REF" ]; then
      echo "No v* tags found in $REPO_URL" >&2
      exit 1
    fi
  fi
  echo "Fetching $REPO_URL at $REF"
  rm -rf content
  git -c advice.detachedHead=false clone --quiet --depth 1 --branch "$REF" "$REPO_URL" content
fi

[ -d node_modules ] || npm ci --no-audit --no-fund
node build.mjs
