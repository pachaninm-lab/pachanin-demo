#!/usr/bin/env bash
set -euo pipefail

HEAD_REF="${COMMIT_REF:-HEAD}"

if [ -n "${REVIEW_ID:-}" ]; then
  git fetch origin main >/dev/null 2>&1 || true
  if git rev-parse --verify origin/main >/dev/null 2>&1; then
    if git diff --quiet origin/main..."$HEAD_REF" -- apps/web package.json pnpm-lock.yaml pnpm-workspace.yaml; then
      echo "Netlify ignore: no web/runtime changes detected in PR."
      exit 0
    fi
    echo "Netlify ignore: web/runtime changes detected in PR."
    exit 1
  fi
fi

BASE_REF="${CACHED_COMMIT_REF:-}"
if [ -z "$BASE_REF" ] || ! git rev-parse --verify "$BASE_REF" >/dev/null 2>&1; then
  BASE_REF="$(git rev-parse HEAD^ 2>/dev/null || printf '%s' "$HEAD_REF")"
fi

if git diff --quiet "$BASE_REF" "$HEAD_REF" -- apps/web package.json pnpm-lock.yaml pnpm-workspace.yaml; then
  echo "Netlify ignore: no web/runtime changes detected."
  exit 0
fi

echo "Netlify ignore: web/runtime changes detected."
exit 1
