#!/usr/bin/env node
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

const workflowPath = '.github/workflows/production-p0-reviewer-reset-stack-classifier-31974946435.yml';
const scriptPath = 'scripts/production-p0-reviewer-reset-stack-classifier-31974946435.sh';
const checkerPath = 'scripts/check-production-p0-reviewer-reset-stack-classifier-31974946435.mjs';
const scopePath = 'docs/platform-v7/autopilot/scopes/production-p0-reviewer-reset-stack-classifier-31974946435-3785.json';
const sourceScript = 'scripts/production-p0-reviewer-reset-stack-classifier-31901032491.sh';
const sourceBlobSha = '499bf064866f83a658ccbdfecaa885541d44c780';
const command = '/production p0-reviewer-reset-stack-classify 31974946435 current-main';
const branch = 'fix/p0-reviewer-reset-stack-stage-v3-31974946435-3785';
const allowed = [workflowPath, scriptPath, checkerPath, scopePath];
const workflow = fs.readFileSync(workflowPath, 'utf8');
const script = fs.readFileSync(scriptPath, 'utf8');
const scope = JSON.parse(fs.readFileSync(scopePath, 'utf8'));
const failures = [];
const need = (where, text, token) => { if (!text.includes(token)) failures.push(`${where}: missing ${token}`); };
const deny = (where, text, regex) => { if (regex.test(text)) failures.push(`${where}: forbidden ${regex}`); };

for (const token of [
  'pull_request:', 'issue_comment:', 'github.event.issue.number == 3072',
  'github.event.comment.user.login == github.repository_owner',
  "github.event.comment.author_association == 'OWNER'",
  'github.event.comment.performed_via_github_app.id == 1144995',
  `github.event.comment.body == '${command}'`,
  "needs.contract.result == 'success'",
  `node ${checkerPath}`,
  `bash -n ${scriptPath}`,
  `bash ${scriptPath}`,
]) need('workflow', workflow, token);
for (const path of allowed) need('workflow', workflow, `      - '${path}'`);
for (const regex of [/workflow_dispatch:/, /schedule:/, /\bpush:/, /StrictHostKeyChecking=no/, /UserKnownHostsFile=\/dev\/null/]) deny('workflow', workflow, regex);

for (const token of [
  `COMMAND='${command}'`,
  "RESET_RUN_ID='31974946435'",
  "RESET_REVISION='440e40753e2cac13c93f8e007d9fe17c2b66caba'",
  "ATTEMPT_SINCE='2026-08-16T21:57:20Z'",
  "ATTEMPT_UNTIL='2026-08-16T21:59:06Z'",
  `SOURCE_SCRIPT='${sourceScript}'`,
  `SOURCE_BLOB_SHA='${sourceBlobSha}'`,
  "SOURCE_RUN_ID='31901032491'",
  "SOURCE_REVISION='056ed4461dafb5e7dab2efc9ea5a0d5877523169'",
  "mapfile -t api_ids < <(docker ps -aq --filter 'label=com.docker.compose.service=api')",
  '[[ "$marker_count" =~ ^[0-9]+$ && "$marker_count" -ge 1 && "$marker_count" -le 4 ]]',
  'docker logs --since "$since" --until "$until"',
  "remote_stage='REMOTE_BEGIN'",
  "remote_stage='DOCKER_LIST'",
  "remote_stage='REVISION_MATCH'",
  "remote_stage='LOG_FETCH'",
  "remote_stage='MARKER_COUNT'",
  "remote_stage='CONTEXT_EXTRACT'",
  "remote_stage='CLASSIFY'",
  "remote_stage='SANITIZE'",
  "remote_stage='PUBLISH'",
  "remote_stage='SSH_TRANSPORT'",
  'REMOTE_BEGIN|DOCKER_LIST|REVISION_MATCH|LOG_FETCH|MARKER_COUNT|CONTEXT_EXTRACT|SANITIZE|CLASSIFY|PUBLISH',
  'trap remote_fail ERR',
  "printf 'REMOTE_STAGE=%s\\n'",
  "printf 'REMOTE_RC=%s\\n'",
  'FAIL_CLOSED_STAGE_CLASSIFIED',
  'remote_rc=$?',
  'set +e',
  'set -e',
  '2>/dev/null',
  "'ssh-capture-start'",
  "'ssh-capture-end'",
  'PRODUCTION_MUTATION=NONE',
  'raw logs / PII / credentials',
  'PATCHED_SOURCE_REINTRODUCED_UNSAFE_OR_OVERCONSTRAINED',
]) need('script', script, token);

for (const regex of [
  /password-reset\/request/, /forgot-password/, /password-reset\/confirm/, /\bcurl\s/,
  /docker\s+exec/, /docker\s+(restart|stop|rm|kill)/, /docker\s+compose\s+(up|down|restart)/,
  /\bpsql\b/, /\bINSERT\b/i, /\bUPDATE\b/i, /\bDELETE\b/i, /\bALTER\b/i, /\bGRANT\b/i, /\bREVOKE\b/i,
  /echo \"\$output\"/, /printf ['"]%s\\n['"] \"\$output\"/,
]) deny('script', script, regex);

if (!script.includes('case "$remote_stage" in')) failures.push('script: remote stage whitelist case missing');
if (!script.includes("*) remote_stage='REMOTE_BEGIN' ;;")) failures.push('script: remote fail-closed stage fallback missing');
if (!script.includes("*) remote_stage='SSH_TRANSPORT' ;;")) failures.push('script: local SSH transport fallback missing');
if (!script.includes("gh issue comment \"$RELEASE_ISSUE_NUMBER\"")) failures.push('script: sanitized issue publication missing');
if (!script.includes('result_published=1')) failures.push('script: failure publication dedupe missing');
if (!script.includes("[[ \"$remote_marker_rc\" =~ ^[0-9]+$ ]]")) failures.push('script: numeric remote RC validation missing');
if (!script.includes("[[ \"$remote_mutation\" == 'PRODUCTION_MUTATION=NONE' ]]")) failures.push('script: production mutation marker validation missing');

const sourceHash = spawnSync('git', ['hash-object', sourceScript], { encoding: 'utf8' });
if (sourceHash.status !== 0 || String(sourceHash.stdout).trim() !== sourceBlobSha) failures.push('source classifier blob mismatch');

if (scope.schemaVersion !== 'platform-v7.concurrent-scope.v1') failures.push('scope schema mismatch');
if (scope.branch !== branch || scope.status !== 'active') failures.push('scope identity mismatch');
if (scope.issue !== 3785 || scope.releaseIssue !== 3072 || scope.sourceRun !== 31974946435) failures.push('scope authority mismatch');
if (scope.sourceRevision !== '440e40753e2cac13c93f8e007d9fe17c2b66caba') failures.push('scope revision mismatch');
if (scope.attemptSinceUtc !== '2026-08-16T21:57:20Z' || scope.attemptUntilUtc !== '2026-08-16T21:59:06Z') failures.push('scope window mismatch');
if (JSON.stringify([...scope.allowedPaths].sort()) !== JSON.stringify([...allowed].sort())) failures.push('scope paths mismatch');
const b = scope.boundaries || {};
for (const key of ['databaseMutation','identityMutation','passwordMutation','mfaMutation','sessionMutation','resetReplay','mailSend','deploymentMutation','containerLifecycleMutation','databaseRead','piiOutput','credentialOutput','rawLogOutput']) {
  if (b[key] !== false) failures.push(`scope boundary ${key}`);
}
if (b.productionMutation !== 'NONE' || b.logReadOnly !== true || b.ownerOnly !== true || b.exactMainGuard !== true || b.exactHistoricalRevision !== true || b.boundedUtcWindow !== true || b.newRecurringCostRub !== 0) failures.push('scope core boundary mismatch');
const acceptanceText = JSON.stringify(scope.acceptance || []);
for (const clause of [
  'between one and four password-reset transaction failure markers',
  'publish a whitelisted REMOTE_STAGE and numeric RC',
  'never publish captured SSH output or raw Docker logs',
]) {
  if (!acceptanceText.includes(clause)) failures.push(`scope acceptance missing ${clause}`);
}

const syntax = spawnSync('bash', ['-n', scriptPath], { encoding: 'utf8' });
if (syntax.status !== 0) failures.push(`bash syntax failed: ${String(syntax.stderr).slice(0, 200)}`);
if (process.env.GITHUB_EVENT_NAME === 'pull_request') {
  const diff = spawnSync('git', ['diff', '--name-only', 'origin/main...HEAD'], { encoding: 'utf8' });
  const changed = String(diff.stdout).trim().split('\n').filter(Boolean).sort();
  const outOfScope = changed.filter((file) => !allowed.includes(file));
  if (diff.status !== 0 || changed.length === 0 || outOfScope.length) failures.push(`PR scope mismatch ${JSON.stringify(changed)}`);
}

if (failures.length) {
  for (const failure of failures) console.error(`FAIL: ${failure}`);
  process.exit(1);
}
console.log('PASS: reset 31974946435 classifier v3 keeps strict safety invariants while checking semantic SSH/stage guards instead of brittle heredoc escaping.');
