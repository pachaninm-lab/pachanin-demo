#!/usr/bin/env bash
set -euo pipefail

STATE_FILE="docs/platform-v7/autopilot/autopilot-state.json"
PROMPT_FILE="docs/platform-v7/autopilot/prompts/codex-pr-5.1.md"
REVIEW_FILE="docs/platform-v7/autopilot/prompts/review-pr-5.1.md"
BRANCH_PREFIX="p7-agent"

if [ ! -f "$STATE_FILE" ]; then
  echo "Missing autopilot state: $STATE_FILE"
  exit 1
fi

if [ ! -f "$PROMPT_FILE" ]; then
  echo "Missing current implementation prompt: $PROMPT_FILE"
  exit 1
fi

echo "platform-v7 agent runner"
echo "state: $STATE_FILE"
echo "prompt: $PROMPT_FILE"
echo "review: $REVIEW_FILE"

CURRENT_STEP=$(python - <<'PY'
import json
with open('docs/platform-v7/autopilot/autopilot-state.json', 'r', encoding='utf-8') as f:
    data = json.load(f)
print(data.get('current', 'unknown'))
PY
)

RUN_ID="${GITHUB_RUN_ID:-local}"
BRANCH_NAME="${BRANCH_PREFIX}/${RUN_ID}-pr-5-1-application-service"

echo "current step: ${CURRENT_STEP}"
echo "branch: ${BRANCH_NAME}"

if [ -z "${OPENAI_API_KEY:-}" ]; then
  echo "OPENAI_API_KEY is not set. Add it in GitHub repository secrets before running autonomous implementation."
  echo "This runner stops before code generation. Existing guard and prompts remain usable."
  exit 2
fi

if ! command -v git >/dev/null 2>&1; then
  echo "git is required"
  exit 1
fi

git config user.name "platform-v7-agent"
git config user.email "platform-v7-agent@users.noreply.github.com"

git checkout -B "$BRANCH_NAME"

AGENT_PROMPT=$(cat "$PROMPT_FILE")

cat > /tmp/p7-agent-request.json <<JSON
{
  "model": "gpt-5.1-codex-max",
  "input": [
    {
      "role": "system",
      "content": "You are a coding agent working inside a GitHub Actions checkout. Follow the repository prompt exactly. Do not expand scope. Return only patch-ready implementation guidance if direct file editing is unavailable."
    },
    {
      "role": "user",
      "content": $(python - <<'PY'
import json
from pathlib import Path
print(json.dumps(Path('docs/platform-v7/autopilot/prompts/codex-pr-5.1.md').read_text(encoding='utf-8')))
PY
)
    }
  ]
}
JSON

curl -sS https://api.openai.com/v1/responses \
  -H "Authorization: Bearer ${OPENAI_API_KEY}" \
  -H "Content-Type: application/json" \
  -d @/tmp/p7-agent-request.json \
  > /tmp/p7-agent-response.json

python - <<'PY'
import json
from pathlib import Path
response = json.loads(Path('/tmp/p7-agent-response.json').read_text(encoding='utf-8'))
Path('docs/platform-v7/autopilot/last-agent-response.json').write_text(json.dumps(response, ensure_ascii=False, indent=2), encoding='utf-8')
print('agent response saved: docs/platform-v7/autopilot/last-agent-response.json')
PY

bash scripts/p7-autopilot-guard.sh

if command -v pnpm >/dev/null 2>&1; then
  pnpm run typecheck
  pnpm test
else
  npm run typecheck
  npm test
fi

if git diff --quiet; then
  echo "No repository changes produced by agent."
  exit 0
fi

git add \
  apps/web/lib/platform-v7/runtime/application-service.ts \
  apps/web/lib/platform-v7/runtime/application-service-types.ts \
  apps/web/tests/unit/platformV7RuntimeApplicationServices.test.ts \
  docs/platform-v7/autopilot/last-agent-response.json

git commit -m "feat(platform-v7): apply agent step for application service layer"
git push origin "$BRANCH_NAME"

echo "Agent branch pushed: $BRANCH_NAME"
