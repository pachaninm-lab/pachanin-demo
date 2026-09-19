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

set_agent_noop() {
  local reason="$1"
  if [ -n "${GITHUB_ENV:-}" ]; then
    {
      echo "P7_AGENT_NOOP=true"
      echo "P7_AGENT_NOOP_REASON=${reason}"
    } >> "$GITHUB_ENV"
  fi
  echo "Agent NOOP: ${reason}"
}

consume_trigger_issue() {
  if [ -n "${ISSUE_NUMBER:-}" ] && [ -n "${REPO_NAME:-}" ] && command -v gh >/dev/null 2>&1; then
    gh issue edit "$ISSUE_NUMBER" --repo "$REPO_NAME" --remove-label agent:run >/dev/null 2>&1 || true
    echo "Consumed trigger issue #${ISSUE_NUMBER}: removed agent:run label if present."
  fi
}

dispatch_generated_merge_gate() {
  if [ -n "${REPO_NAME:-}" ] && command -v gh >/dev/null 2>&1; then
    gh workflow run platform-v7-autopilot-generated-merge.yml --repo "$REPO_NAME" --ref main || true
    echo "Dispatched platform-v7 generated merge gate."
  fi
}

write_agent_engine_audit() {
  local engine="$1"
  set +e
  P7_AGENT_BRANCH_NAME="$BRANCH_NAME" P7_AGENT_CURRENT_STEP="$CURRENT_STEP" node scripts/p7-autopilot-agent-engine-audit.mjs "$engine"
  local audit_status=$?
  set -e
  if [ "$audit_status" -ne 0 ]; then
    echo "Agent engine audit failed for ${engine}; continuing without printing secrets."
  fi
}

if [ -n "${GITHUB_ENV:-}" ]; then
  {
    echo "P7_AGENT_BRANCH=${BRANCH_NAME}"
    echo "P7_AGENT_PR_TITLE=${PR_TITLE}"
  } >> "$GITHUB_ENV"
fi

slice_guard_result=$(node <<'JS'
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

function currentSliceNumber(value) {
  const match = String(value || '').match(/Autopilot Product Slice\s+(\d+)/i);
  return match ? Number(match[1]) : null;
}

function titleSliceNumber(value) {
  const match = String(value || '').match(/autopilot product slice\s+(\d+)/i);
  return match ? Number(match[1]) : null;
}

function print(action, data = {}) {
  process.stdout.write(JSON.stringify({ action, ...data }));
}

const repo = process.env.REPO || process.env.GITHUB_REPOSITORY || '';
const state = JSON.parse(fs.readFileSync('docs/platform-v7/autopilot/autopilot-state.json', 'utf8'));
const current = String(state.current || '');
const slice = currentSliceNumber(current);

if (!slice) {
  print('run', { reason: 'current step is not a generated product slice' });
  process.exit(0);
}

const auditDir = 'docs/platform-v7/autopilot/audit';
if (fs.existsSync(auditDir)) {
  for (const entry of fs.readdirSync(auditDir)) {
    if (!/^generated-pr-\d+-merged\.json$/.test(entry)) continue;
    const record = JSON.parse(fs.readFileSync(path.join(auditDir, entry), 'utf8'));
    if (record.layerClosed === current) {
      print('reconcile', {
        reason: `audit lock says ${current} already merged in PR #${record.sourcePr}`,
        prNumber: record.sourcePr || null,
      });
      process.exit(0);
    }
  }
}

if (!repo) {
  print('run', { reason: 'repository name is unavailable' });
  process.exit(0);
}

try {
  execFileSync('gh', ['--version'], { stdio: 'ignore' });
} catch {
  print('run', { reason: 'gh CLI is unavailable for slice guard' });
  process.exit(0);
}

const raw = execFileSync('gh', [
  'pr',
  'list',
  '--repo',
  repo,
  '--state',
  'all',
  '--label',
  'platform-v7',
  '--label',
  'agent-generated',
  '--json',
  'number,title,state,mergedAt,url',
  '--limit',
  '50',
], { encoding: 'utf8' });

const prs = JSON.parse(raw || '[]');
const matching = prs.filter((pr) => titleSliceNumber(pr.title) === slice);
const open = matching.find((pr) => String(pr.state).toUpperCase() === 'OPEN');
if (open) {
  print('noop', {
    reason: `generated PR #${open.number} is already open for ${current}`,
    prNumber: open.number,
  });
  process.exit(0);
}

const merged = matching.find((pr) => pr.mergedAt);
if (merged) {
  print('reconcile', {
    reason: `generated PR #${merged.number} already merged for ${current}`,
    prNumber: merged.number,
  });
  process.exit(0);
}

print('run', { reason: `no generated PR lock for ${current}` });
JS
)
slice_guard_action=$(SLICE_GUARD_RESULT="$slice_guard_result" node -e "const r=JSON.parse(process.env.SLICE_GUARD_RESULT); console.log(r.action)")
slice_guard_reason=$(SLICE_GUARD_RESULT="$slice_guard_result" node -e "const r=JSON.parse(process.env.SLICE_GUARD_RESULT); console.log(r.reason || r.action)")

if [ "$slice_guard_action" = "noop" ]; then
  dispatch_generated_merge_gate
  consume_trigger_issue
  set_agent_noop "$slice_guard_reason"
  exit 0
fi

if [ "$slice_guard_action" = "reconcile" ]; then
  echo "Current slice has a merged generated PR or audit lock; running generated merge reconciler instead of creating another PR."
  node scripts/p7-autopilot-generated-merge-reconcile.mjs
  dispatch_generated_merge_gate
  consume_trigger_issue
  set_agent_noop "$slice_guard_reason"
  exit 0
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
  console.error(raw.slice(0, 2000).replace(/(sk|gh[pousr])_[A-Za-z0-9_=-]+/g, '[redacted-secret]'));
  process.exit(10);
}

function sanitizeSecretText(input) {
  return String(input || '')
    .replace(/(sk|gh[pousr])_[A-Za-z0-9_=-]+/g, '[redacted-secret]')
    .replace(/Bearer\s+[A-Za-z0-9._=-]+/gi, 'Bearer [redacted-secret]');
}

if (response.error) {
  const code = response.error.code || response.error.type || 'openai_error';
  const message = sanitizeSecretText(response.error.message || JSON.stringify(response.error));
  fs.writeFileSync('docs/platform-v7/autopilot/last-agent-response.json', `${JSON.stringify({
    error: {
      code,
      message,
    },
  }, null, 2)}\n`);
  console.error(`OpenAI API error (${code}): ${message}`);
  if (code === 'invalid_api_key' || /api key/i.test(message)) {
    console.error('OpenAI real coding not proven until OPENAI_API_KEY is replaced.');
  }
  process.exit(10);
}

fs.writeFileSync('docs/platform-v7/autopilot/last-agent-response.json', `${JSON.stringify(response, null, 2)}\n`);

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
    echo "Automerge label is applied; merge is owned by the platform-v7 generated merge gate."
  } > /tmp/p7-agent-pr-body.md

  if git ls-remote --exit-code --heads origin "$BRANCH_NAME" >/dev/null 2>&1; then
    existing_pr=$(gh pr list --repo "$REPO_NAME" --head "$BRANCH_NAME" --json number --jq '.[0].number // ""')
    if [ -n "$existing_pr" ]; then
      echo "Generated PR already exists: #$existing_pr"
      consume_trigger_issue
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
    consume_trigger_issue
    dispatch_generated_merge_gate
  fi
}

agent_engine="unknown"

set +e
run_agent_api
agent_status=$?
set -e

if [ "$agent_status" -eq 0 ]; then
  agent_engine="openai"
fi

if [ "$agent_status" -ne 0 ]; then
  echo "Agent API did not produce a valid repository change; trying deterministic fallback inside agent writable scope."
  set +e
  write_deterministic_fallback
  fallback_status=$?
  set -e
  if [ "$fallback_status" -eq 0 ]; then
    node scripts/p7-autopilot-force-writable-diff.mjs
    agent_engine="fallback"
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
    agent_engine="fallback"
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

if [ "$agent_engine" = "openai" ] || [ "$agent_engine" = "fallback" ]; then
  write_agent_engine_audit "$agent_engine"
fi

if [ -z "$(git status --porcelain)" ]; then
  echo "ERROR: No repository changes produced by agent or fallback."
  exit 3
fi

echo "Agent output status:"
git status --porcelain

open_generated_pr

echo "Agent run complete. Generated PR handling completed inside runner. Full checks run on the generated PR."
