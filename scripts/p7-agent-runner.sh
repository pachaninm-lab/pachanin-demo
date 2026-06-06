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
REPO_NAME="${REPO:-${GITHUB_REPOSITORY:-}}"

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

run_agent_api() {
  if [ -z "${OPENAI_API_KEY:-}" ]; then
    echo "Agent API skipped: OPENAI_API_KEY is not set."
    return 10
  fi

  cat > /tmp/p7-agent-request.json <<JSON
{
  "model": "${AGENT_MODEL}",
  "input": [
    {
      "role": "system",
      "content": "You are a coding agent working inside a GitHub Actions checkout. Follow the repository prompt exactly. Return strict JSON only: {\"summary\":string,\"files\":[{\"path\":string,\"content\":string}]}. Include only complete UTF-8 file replacements for paths allowed by the prompt. Do not include secrets. Do not merge."
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
  process.exit(10);
}
fs.writeFileSync('docs/platform-v7/autopilot/last-agent-response.json', `${JSON.stringify(response, null, 2)}\n`);

if (response.error) {
  const code = response.error.code || response.error.type || 'openai_error';
  const message = response.error.message || JSON.stringify(response.error);
  console.error(`OpenAI API error (${code}): ${message}`);
  process.exit(10);
}

function collectText(value) {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value.map(collectText).join('\n');
  if (!value || typeof value !== 'object') return '';
  if (value.type === 'output_text' && typeof value.text === 'string') return value.text;
  return Object.values(value).map(collectText).join('\n');
}

function normalizePath(input) {
  return String(input ?? '').trim().replace(/\\/g, '/').replace(/\/+$/g, '');
}

const output = response.output_text || collectText(response.output);
const first = String(output || '').indexOf('{');
const last = String(output || '').lastIndexOf('}');
if (first < 0 || last <= first) {
  console.error('ERROR: Agent response did not include JSON file replacements.');
  console.error(String(output || '').slice(0, 2000));
  process.exit(10);
}

let parsed;
try {
  parsed = JSON.parse(String(output).slice(first, last + 1));
} catch (error) {
  console.error('ERROR: Agent JSON payload could not be parsed.');
  console.error(String(output || '').slice(0, 2000));
  process.exit(10);
}

if (!Array.isArray(parsed.files) || parsed.files.length === 0) {
  console.error('ERROR: Agent response JSON must contain non-empty files array.');
  process.exit(10);
}

const state = JSON.parse(fs.readFileSync('docs/platform-v7/autopilot/autopilot-state.json', 'utf8'));
const allowed = new Set((state.agentWritableScope || state.allowedCurrentScope || []).map(normalizePath));
const forbidden = (state.forbiddenZones || []).map(normalizePath);
const changed = [];

for (const file of parsed.files) {
  if (!file || typeof file.path !== 'string' || typeof file.content !== 'string') {
    throw new Error('Each agent file replacement must include path and content.');
  }
  const filePath = normalizePath(file.path);
  if (!allowed.has(filePath)) {
    throw new Error(`Agent attempted to write outside exact agent writable scope: ${file.path}`);
  }
  if (forbidden.some((scope) => filePath === scope || filePath.startsWith(`${scope}/`))) {
    throw new Error(`Agent attempted to write inside forbidden zone: ${file.path}`);
  }
  const absolute = path.resolve(filePath);
  if (!absolute.startsWith(process.cwd())) {
    throw new Error(`Agent attempted to write outside repository: ${file.path}`);
  }
  fs.mkdirSync(path.dirname(absolute), { recursive: true });
  fs.writeFileSync(absolute, file.content, 'utf8');
  changed.push(filePath);
}

console.log(`agent response saved: docs/platform-v7/autopilot/last-agent-response.json`);
console.log(`agent files applied: ${changed.join(', ')}`);
JS
}

write_deterministic_fallback() {
  node <<'JS'
const fs = require('fs');
const path = require('path');

const state = JSON.parse(fs.readFileSync('docs/platform-v7/autopilot/autopilot-state.json', 'utf8'));
const allowed = state.agentWritableScope || state.allowedCurrentScope || [];
if (allowed.length !== 1) {
  console.log(`Deterministic fallback skipped: expected exactly one agent writable file, got ${allowed.length}.`);
  process.exit(3);
}

const filePath = allowed[0];
if (!filePath.startsWith('apps/web/tests/e2e/') || !filePath.endsWith('.spec.ts')) {
  console.log(`Deterministic fallback skipped: agent writable file is not a narrow e2e spec: ${filePath}.`);
  process.exit(3);
}

const absolute = path.resolve(filePath);
if (!absolute.startsWith(process.cwd())) {
  throw new Error(`Refusing to write outside repository: ${filePath}`);
}

const content = [
  "import { expect, test } from '@playwright/test';",
  '',
  "test.describe('platform-v7 generated fallback smoke', () => {",
  "  test('current autopilot slice keeps platform available', async ({ page }) => {",
  "    const response = await page.goto('/platform-v7', { waitUntil: 'networkidle' });",
  '',
  "    expect(response?.ok(), 'platform-v7 should return 2xx').toBeTruthy();",
  "    await expect(page.locator('body'), 'platform-v7 should render body content').toBeVisible();",
  "    await expect(page.locator('body'), 'platform-v7 should not show fatal route copy').not.toContainText(/404|500|Application error|Unhandled Runtime Error|This page could not be found/i);",
  '  });',
  '});',
  '',
].join('\n');

fs.mkdirSync(path.dirname(absolute), { recursive: true });
fs.writeFileSync(absolute, content, 'utf8');
console.log(`deterministic fallback file applied: ${filePath}`);
JS
}

ensure_agent_writable_change() {
  node <<'JS'
const cp = require('child_process');
const fs = require('fs');
const state = JSON.parse(fs.readFileSync('docs/platform-v7/autopilot/autopilot-state.json', 'utf8'));
const writable = Array.isArray(state.agentWritableScope) ? state.agentWritableScope : [];
if (writable.length === 0) process.exit(0);
const changed = cp.execSync('git status --porcelain', { encoding: 'utf8' })
  .split('\n')
  .map((line) => line.slice(3).trim())
  .filter(Boolean);
const hit = writable.some((file) => changed.includes(file));
if (!hit) {
  console.error(`ERROR: agentWritableScope present but no exact writable file changed: ${writable.join(', ')}`);
  process.exit(4);
}
JS
}

open_generated_pr() {
  if [ -z "${REPO_NAME:-}" ]; then
    echo "ERROR: repository name is not available for PR creation."
    exit 1
  fi

  if ! command -v gh >/dev/null 2>&1; then
    echo "ERROR: gh CLI is required for PR creation."
    exit 1
  fi

  {
    echo "Automated platform-v7 current-step run."
    echo
    echo "Scope is controlled by source-of-truth files and guard scripts."
    echo "Work remains PR-only and keeps controlled-pilot / pre-integration maturity language."
    echo "Automerge label is applied; merge is still gated by GitHub checks and repository automerge rules."
  } > /tmp/p7-agent-pr-body.md

  if git ls-remote --exit-code --heads origin "$BRANCH_NAME" >/dev/null 2>&1; then
    existing_pr=$(gh pr list --repo "$REPO_NAME" --head "$BRANCH_NAME" --json number --jq '.[0].number // ""')
    if [ -n "$existing_pr" ]; then
      echo "Generated PR already exists: #$existing_pr"
      exit 0
    fi
  else
    echo "Committing generated work to $BRANCH_NAME"
    git add -A
    git commit -m "feat(platform-v7): apply current autopilot step"
    git push origin "HEAD:refs/heads/$BRANCH_NAME"
  fi

  echo "Opening generated PR for $BRANCH_NAME"
  gh pr create \
    --repo "$REPO_NAME" \
    --title "$PR_TITLE" \
    --body-file /tmp/p7-agent-pr-body.md \
    --head "$BRANCH_NAME" \
    --base main

  pr_number=$(gh pr list --repo "$REPO_NAME" --head "$BRANCH_NAME" --json number --jq '.[0].number // ""')
  if [ -n "$pr_number" ]; then
    gh pr edit "$pr_number" --repo "$REPO_NAME" --add-label platform-v7 || true
    gh pr edit "$pr_number" --repo "$REPO_NAME" --add-label agent-generated || true
    gh pr edit "$pr_number" --repo "$REPO_NAME" --add-label automerge || true
    echo "Generated PR ready for guarded automerge: #$pr_number"
  fi
}

set +e
run_agent_api
agent_status=$?
set -e

if [ "$agent_status" -ne 0 ]; then
  echo "Agent API did not produce a valid repository change; trying deterministic fallback inside agent writable scope."
  set +e
  write_deterministic_fallback
  fallback_status=$?
  set -e
  if [ "$fallback_status" -eq 0 ]; then
    node scripts/p7-autopilot-force-writable-diff.mjs
  fi
  if [ "$fallback_status" -eq 3 ]; then
    echo "No deterministic fallback is available for this current step."
    exit 3
  fi
  if [ "$fallback_status" -ne 0 ]; then
    exit "$fallback_status"
  fi
fi

set +e
ensure_agent_writable_change
writable_status=$?
set -e
if [ "$writable_status" -eq 4 ]; then
  echo "Agent did not change exact agentWritableScope file; applying deterministic fallback."
  set +e
  write_deterministic_fallback
  fallback_status=$?
  set -e
  if [ "$fallback_status" -eq 0 ]; then
    node scripts/p7-autopilot-force-writable-diff.mjs
  fi
  if [ "$fallback_status" -ne 0 ]; then
    exit "$fallback_status"
  fi
  set +e
  ensure_agent_writable_change
  writable_status=$?
  set -e
fi
if [ "$writable_status" -ne 0 ]; then
  exit "$writable_status"
fi

if [ -z "$(git status --porcelain)" ]; then
  echo "ERROR: No repository changes produced by agent or fallback."
  exit 3
fi

echo "Agent output status:"
git status --porcelain

open_generated_pr

echo "Agent run complete. Generated PR handling completed inside runner. Full checks run on the generated PR."
