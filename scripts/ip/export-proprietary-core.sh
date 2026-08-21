#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 1 ]]; then
  echo "Usage: $0 <private-target-git-url>" >&2
  exit 64
fi

TARGET="$1"
if ! command -v git-filter-repo >/dev/null 2>&1 && ! git filter-repo -h >/dev/null 2>&1; then
  echo "git-filter-repo is required; aborting without modifying the source repository." >&2
  exit 69
fi

ROOT="$(git rev-parse --show-toplevel)"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

node -e '
const fs=require("fs");
const b=JSON.parse(fs.readFileSync("docs/ip/proprietary-core-boundary.json","utf8"));
for (const x of b.protectedRoots) console.log(x.path);
' > "$TMP/paths.txt"

git clone --no-local "$ROOT" "$TMP/repo"
cd "$TMP/repo"
args=()
while IFS= read -r path; do
  [[ -n "$path" ]] && args+=(--path "$path")
done < "$TMP/paths.txt"

git filter-repo "${args[@]}" --force
git remote remove origin || true
git remote add origin "$TARGET"

echo "Prepared filtered proprietary-core repository at: $TMP/repo"
echo "Target configured as: $TARGET"
echo "Review the filtered tree and target visibility/access before pushing."
echo "No push was performed automatically."
