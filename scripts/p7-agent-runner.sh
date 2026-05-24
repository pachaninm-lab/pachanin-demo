#!/usr/bin/env bash
set -euo pipefail

STATE_FILE="docs/platform-v7/autopilot/autopilot-state.json"
PROMPT_FILE="docs/platform-v7/autopilot/prompts/current-codex-task.md"
REVIEW_FILE="docs/platform-v7/autopilot/prompts/current-review-task.md"
PROGRESS_FILE="docs/platform-v7/autopilot/progress.json"
BRANCH_PREFIX="p7-agent"
AGENT_MODEL="${OPENAI_MODEL:-gpt-4o}"

echo "platform-v7 agent runner"
echo "agent model: ${AGENT_MODEL}"

if [ -z "${OPENAI_API_KEY:-}" ]; then
  echo "ERROR: OPENAI_API_KEY is not set. Add it to GitHub Actions secrets before running the agent."
  exit 2
fi

if ! command -v node >/dev/null 2>&1; then
  echo "ERROR: node is required."
  exit 1
fi

if ! command -v git >/dev/null 2>&1; then
  echo "ERROR: git is required."
  exit 1
fi

node scripts/p7-autopilot-dispatcher.mjs

if [ ! -f "$STATE_FILE" ]; then
  echo "ERROR: Missing autopilot state: $STATE_FILE"
  exit 1
fi

if [ ! -f "$PROMPT_FILE" ]; then
  echo "ERROR: Missing generated implementation prompt: $PROMPT_FILE"
  exit 1
fi

CURRENT_STEP=$(node -e "const fs=require('fs'); const p=JSON.parse(fs.readFileSync('$PROGRESS_FILE','utf8')); console.log(p.currentStep || 'current-step');")
STEP_SLUG=$(node - <<'JS'
const fs = require('fs');
const progress = JSON.parse(fs.readFileSync('docs/platform-v7/autopilot/progress.json', 'utf8'));
const slug = String(progress.currentStep || 'current-step')
  .toLowerCase()
  .replace(/—/g, '-')
  .replace(/[^a-z0-9а-яё]+/gi, '-')
  .replace(/-+/g, '-')
  .replace(/^-|-$/g, '');
console.log(slug || 'current-step');
JS
)
PR_TITLE=$(node - <<'JS'
const fs = require('fs');
const progress = JSON.parse(fs.readFileSync('docs/platform-v7/autopilot/progress.json', 'utf8'));
const current = String(progress.currentStep || 'current autopilot step');
const normalized = current
  .replace(/^PR\s+5\.2\s+[—-]\s*/i, 'add ')
  .replace(/^PR\s+5\.6\s+[—-]\s*/i, 'add ')
  .replace(/^PR\s+5\.7\s+[—-]\s*/i, 'finalize ')
  .replace(/^PR\s+/i, '')
  .trim()
  .toLowerCase();
console.log(`feat(platform-v7): ${normalized || 'apply current autopilot step'}`);
JS
)
RUN_ID="${GITHUB_RUN_ID:-local}"
BRANCH_NAME="${BRANCH_PREFIX}/${RUN_ID}-${STEP_SLUG}"

echo "current step: ${CURRENT_STEP}"
echo "prompt: ${PROMPT_FILE}"
echo "review: ${REVIEW_FILE}"
echo "branch: ${BRANCH_NAME}"
echo "pr title: ${PR_TITLE}"

if [ -n "${GITHUB_ENV:-}" ]; then
  {
    echo "P7_AGENT_BRANCH=${BRANCH_NAME}"
    echo "P7_AGENT_PR_TITLE=${PR_TITLE}"
  } >> "$GITHUB_ENV"
fi

git config user.name "platform-v7-agent"
git config user.email "platform-v7-agent@users.noreply.github.com"
git checkout -B "$BRANCH_NAME"

cat > /tmp/p7-agent-request.json <<JSON
{
  "model": "${AGENT_MODEL}",
  "input": [
    {
      "role": "system",
      "content": "You are a coding agent working inside a GitHub Actions checkout. Follow the repository prompt exactly. Return strict JSON only: {\\\"summary\\\":string,\\\"files\\\":[{\\\"path\\\":string,\\\"content\\\":string}]}. Include only complete UTF-8 file replacements for paths allowed by the prompt. Do not include secrets. Do not merge."
    },
    {
      "role": "user",
      "content": $(node -e "console.log(JSON.stringify(require('fs').readFileSync('$PROMPT_FILE','utf8')))")
    }
  ]
}
JSON

curl -sS https://api.openai.com/v1/responses \
  -H "Authorization: Bearer ${OPENAI_API_KEY}" \
  -H "Content-Type: application/json" \
  -d @/tmp/p7-agent-request.json \
  > /tmp/p7-agent-response.json

node <<'JS'
const fs = require('fs');
const path = require('path');

const raw = fs.readFileSync('/tmp/p7-agent-response.json', 'utf8');
let response;
try {
  response = JSON.parse(raw);
} catch (error) {
  console.error('ERROR: OpenAI response was not valid JSON.');
  console.error(raw.slice(0, 2000));
  process.exit(1);
}
fs.writeFileSync('docs/platform-v7/autopilot/last-agent-response.json', `${JSON.stringify(response, null, 2)}\n`);

if (response.error) {
  const code = response.error.code || response.error.type || 'openai_error';
  const message = response.error.message || JSON.stringify(response.error);
  throw new Error(`OpenAI API error (${code}): ${message}`);
}

function collectText(value) {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value.map(collectText).join('\n');
  if (!value || typeof value !== 'object') return '';
  if (value.type === 'output_text' && typeof value.text === 'string') return value.text;
  return Object.values(value).map(collectText).join('\n');
}

function extractJsonObject(text) {
  const trimmed = String(text || '').trim();
  if (!trimmed) return '';
  const fenceStripped = trimmed.replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim();
  if (fenceStripped.startsWith('{')) return fenceStripped;
  const first = fenceStripped.indexOf('{');
  const last = fenceStripped.lastIndexOf('}');
  if (first >= 0 && last > first) return fenceStripped.slice(first, last + 1);
  return '';
}

const output = response.output_text || collectText(response.output);
const jsonText = extractJsonObject(output);
if (!jsonText) {
  console.error('ERROR: Agent response did not include JSON file replacements.');
  console.error('Response preview:');
  console.error(String(output || '').slice(0, 2000));
  throw new Error('Agent response did not include JSON file replacements.');
}

const parsed = JSON.parse(jsonText);
if (!Array.isArray(parsed.files)) {
  throw new Error('Agent response JSON must contain files array.');
}

const state = JSON.parse(fs.readFileSync('docs/platform-v7/autopilot/autopilot-state.json', 'utf8'));
const allowed = new Set(state.allowedCurrentScope || []);
const changed = [];
for (const file of parsed.files) {
  if (!file || typeof file.path !== 'string' || typeof file.content !== 'string') {
    throw new Error('Each agent file replacement must include path and content.');
  }
  if (!allowed.has(file.path)) {
    throw new Error(`Agent attempted to write outside allowed current scope: ${file.path}`);
  }
  const absolute = path.resolve(file.path);
  if (!absolute.startsWith(process.cwd())) {
    throw new Error(`Agent attempted to write outside repository: ${file.path}`);
  }
  fs.mkdirSync(path.dirname(absolute), { recursive: true });
  fs.writeFileSync(absolute, file.content, 'utf8');
  changed.push(file.path);
}

console.log(`agent response saved: docs/platform-v7/autopilot/last-agent-response.json`);
console.log(`agent files applied: ${changed.join(', ') || 'none'}`);
if (changed.length === 0) {
  throw new Error('Agent returned no file replacements.');
}
JS

bash scripts/p7-autopilot-guard.sh
pnpm typecheck
pnpm test

if git diff --quiet; then
  echo "ERROR: No repository changes produced by agent."
  exit 3
fi

echo "Agent run complete. GitHub Actions create-pull-request will commit and open the PR."
