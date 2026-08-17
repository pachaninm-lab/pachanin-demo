#!/usr/bin/env node
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

const workflowPath = '.github/workflows/production-p0-reviewer-auth-mail-runtime-wiring-31901032491.yml';
const runnerPath = 'scripts/production-p0-reviewer-auth-mail-runtime-wiring-31901032491.sh';
const checkerPath = 'scripts/check-production-p0-reviewer-auth-mail-runtime-wiring-31901032491.mjs';
const scopePath = 'docs/platform-v7/autopilot/scopes/production-p0-reviewer-auth-mail-runtime-wiring-31901032491-3785.json';
const command = '/production p0-reviewer-auth-mail-runtime-wiring 31901032491 current-main';
const revision = '056ed4461dafb5e7dab2efc9ea5a0d5877523169';
const allowed = [workflowPath, runnerPath, checkerPath, scopePath];
const read = (p) => fs.readFileSync(p, 'utf8');
const workflow = read(workflowPath); const runner = read(runnerPath); const scope = JSON.parse(read(scopePath));
const failures = [];
const need = (w,t,k) => { if (!t.includes(k)) failures.push(`${w}: missing ${k}`); };
const deny = (w,t,r) => { if (r.test(t)) failures.push(`${w}: forbidden ${r}`); };

for (const token of ['pull_request:','issue_comment:','github.event.issue.number == 3072','github.event.comment.user.login == github.repository_owner','github.actor == github.repository_owner','github.triggering_actor == github.repository_owner',`github.event.comment.body == '${command}'`,`node ${checkerPath}`,`bash -n ${runnerPath}`,`bash ${runnerPath}`]) need('workflow',workflow,token);
for (const p of allowed) need('workflow',workflow,`      - '${p}'`);
for (const re of [/workflow_dispatch:/,/schedule:/,/\bpush:/,/StrictHostKeyChecking=no/,/UserKnownHostsFile=\/dev\/null/]) deny('workflow',workflow,re);
for (const token of [`COMMAND='${command}'`,`RESET_RUN_ID='31901032491'`,`RESET_REVISION='${revision}'`,`ATTEMPT_SINCE='2026-08-15T18:24:20Z'`,`AUTHORITY_DIR='/var/lib/pc-secret-authority/runtime'`,'git merge-base --is-ancestor "$RESET_REVISION" "$CURRENT_MAIN"',"docker ps -q --filter 'label=com.docker.compose.service=api'",'AUTH_MAIL_OUTBOX_KEYRING_DIR','AUTH_MAIL_OUTBOX_CURRENT_KEY_VERSION_FILE','/run/pc-auth-mail/keyring','/run/pc-auth-mail/current-key-version','AUTH_MAIL_API_ENV_WIRING_MISSING','AUTH_MAIL_API_SECRET_MOUNTS_MISSING','AUTH_MAIL_WORKER_NOT_EXACT_RUNNING','PRODUCTION_MUTATION=NONE']) need('runner',runner,token);
for (const re of [/docker\s+(?:rm|rmi|kill|stop|restart|start)\b/,/docker\s+compose[^\n]*(?:up|down|restart|rm|pull|build)\b/,/\b(?:psql|prisma\s+migrate|kubectl|systemctl)\b/,/forgot-password[^\n]*(?:--data|--request\s+POST)/,/password-reset\/request/]) deny('runner',runner,re);
if (/docker\s+exec\b/.test(runner)) failures.push('runner: docker exec is intentionally absent from read-only wiring probe');

if (scope.schemaVersion !== 'platform-v7.concurrent-scope.v1' || scope.status !== 'active') failures.push('scope schema/status mismatch');
if (scope.branch !== 'diag/p0-reviewer-auth-mail-runtime-wiring-31901032491-3785') failures.push('scope branch mismatch');
if (scope.issue !== 3785 || scope.releaseIssue !== 3072 || scope.sourceRun !== 31901032491 || scope.sourceRevision !== revision) failures.push('scope authority/source mismatch');
if (JSON.stringify([...scope.allowedPaths].sort()) !== JSON.stringify([...allowed].sort())) failures.push('scope allowedPaths mismatch');
const b = scope.boundaries || {};
if (b.productionMutation !== 'NONE' || b.dockerInspectReadOnly !== true || b.hostMetadataReadOnly !== true || b.ownerOnly !== true || b.newRecurringCostRub !== 0) failures.push('scope read-only boundary mismatch');
for (const k of ['databaseMutation','identityMutation','passwordMutation','mfaMutation','sessionMutation','resetReplay','mailSend','deploymentMutation','containerLifecycleMutation','secretValueOutput','rawInspectOutput']) if (b[k] !== false) failures.push(`scope boundary ${k} must be false`);
const syntax = spawnSync('bash',['-n',runnerPath],{encoding:'utf8'}); if (syntax.status !== 0) failures.push(`bash -n failed: ${syntax.stderr.trim().slice(0,240)}`);
if (process.env.GITHUB_EVENT_NAME === 'pull_request') {
  const diff = spawnSync('git',['diff','--name-only','origin/main...HEAD'],{encoding:'utf8'}); const changed = diff.stdout.trim().split('\n').filter(Boolean).sort();
  if (diff.status !== 0 || JSON.stringify(changed) !== JSON.stringify([...allowed].sort())) failures.push(`PR scope mismatch: ${JSON.stringify(changed)}`);
}
if (failures.length) { failures.forEach(x=>console.error(`FAIL: ${x}`)); process.exit(1); }
console.log('PASS: auth-mail runtime wiring diagnostic is owner-only, docker-inspect/host-metadata read-only, and exposes booleans only.');
