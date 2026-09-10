#!/usr/bin/env bash
set -Eeuo pipefail

target_branch='fix/review-gate-local-qwen-regex-20260909'
git fetch origin "$target_branch"
git checkout -B "$target_branch" "origin/$target_branch"

python3 - <<'PY'
from pathlib import Path
path = Path('.github/workflows/local-qwen-independent-review.yml')
text = path.read_text(encoding='utf-8')
old = '''          root ::= "{" ws verdict-kv "," ws findings-kv "," ws summary-kv "}" ws
          verdict-kv ::= "\\\"verdict\\\"" ws ":" ws verdict
          findings-kv ::= "\\\"findings\\\"" ws ":" ws findings
          summary-kv ::= "\\\"summary\\\"" ws ":" ws string
          verdict ::= "\\\"PASS\\\"" | "\\\"BLOCK\\\""
          findings ::= "[" ws "]" ws | "[" ws finding ("," ws finding)* "]" ws
'''
new = '''          root ::= pass-object | block-object
          pass-object ::= "{" ws "\\\"verdict\\\"" ws ":" ws "\\\"PASS\\\"" "," ws "\\\"findings\\\"" ws ":" ws "[" ws "]" "," ws "\\\"summary\\\"" ws ":" ws "\\\"reviewed\\\"" "}" ws
          block-object ::= "{" ws "\\\"verdict\\\"" ws ":" ws "\\\"BLOCK\\\"" "," ws "\\\"findings\\\"" ws ":" ws "[" ws finding ("," ws finding)* "]" ws "," ws "\\\"summary\\\"" ws ":" ws "\\\"reviewed\\\"" "}" ws
'''
count = text.count(old)
if count != 1:
    raise SystemExit(f'Expected exactly one legacy grammar block, found {count}')
path.write_text(text.replace(old, new, 1), encoding='utf-8')
PY

git diff --check
test "$(git diff --name-only)" = '.github/workflows/local-qwen-independent-review.yml'
grep -F 'root ::= pass-object | block-object' .github/workflows/local-qwen-independent-review.yml
grep -F '"\"reviewed\""' .github/workflows/local-qwen-independent-review.yml
grep -F -- '--n-predict 128' .github/workflows/local-qwen-independent-review.yml

git config user.name 'github-actions[bot]'
git config user.email '41898282+github-actions[bot]@users.noreply.github.com'
git add .github/workflows/local-qwen-independent-review.yml
git commit -m 'fix(review): bound Local Qwen clean-result grammar'
git push origin HEAD:refs/heads/fix/review-gate-local-qwen-regex-20260909
