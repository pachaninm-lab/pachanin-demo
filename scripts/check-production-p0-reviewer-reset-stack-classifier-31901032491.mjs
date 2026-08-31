#!/usr/bin/env node
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

const workflowPath = '.github/workflows/production-p0-reviewer-reset-stack-classifier-31901032491.yml';
const scriptPath = 'scripts/production-p0-reviewer-reset-stack-classifier-31901032491.sh';
const checkerPath = 'scripts/check-production-p0-reviewer-reset-stack-classifier-31901032491.mjs';
const scopePath = 'docs/platform-v7/autopilot/scopes/production-p0-reviewer-reset-stack-classifier-31901032491-3785.json';
const command = '/production p0-reviewer-reset-stack-classify 31901032491 current-main';
const allowed = [workflowPath, scriptPath, checkerPath, scopePath];
const workflow = fs.readFileSync(workflowPath, 'utf8');
const script = fs.readFileSync(scriptPath, 'utf8');
const scope = JSON.parse(fs.readFileSync(scopePath, 'utf8'));
const failures = [];
const need = (w,t,x) => { if (!t.includes(x)) failures.push(`${w}: missing ${x}`); };
const deny = (w,t,r) => { if (r.test(t)) failures.push(`${w}: forbidden ${r}`); };
for (const token of ['pull_request:','issue_comment:','github.event.issue.number == 3072','github.event.comment.user.login == github.repository_owner','github.actor == github.repository_owner','github.triggering_actor == github.repository_owner',`github.event.comment.body == '${command}'`,"needs.contract.result == 'success'",`node ${checkerPath}`,`bash -n ${scriptPath}`,`bash ${scriptPath}`]) need('workflow', workflow, token);
for (const p of allowed) need('workflow', workflow, `      - '${p}'`);
for (const re of [/workflow_dispatch:/,/schedule:/,/\bpush:/,/StrictHostKeyChecking=no/,/UserKnownHostsFile=\/dev\/null/]) deny('workflow', workflow, re);
for (const token of [
  `COMMAND='${command}'`,
  'Password reset challenge/outbox transaction failed',
  "grep -Fn 'Password reset challenge/outbox transaction failed'",
  'end_line=$((marker_line + 27))',
  'sed -n "${marker_line},${end_line}p"',
  'PrismaClientKnownRequestError','AUTH_MAIL_ENQUEUE','ROW_LEVEL_SECURITY','SQLSTATE_42501','PRODUCTION_MUTATION=NONE','raw logs / PII / credentials / reset material',
]) need('script', script, token);
for (const re of [
  /password-reset\/request/,/password-reset\/confirm/,/\bcurl\s/,/docker\s+(restart|stop|rm|compose\s+up)/,
  /\/Password reset challenge\\\/outbox transaction failed\/ \{capture=1;/,
]) deny('script', script, re);
if (scope.schemaVersion !== 'platform-v7.concurrent-scope.v1' || scope.branch !== 'diag/p0-reviewer-reset-stack-31901032491-3785' || scope.status !== 'active') failures.push('scope identity mismatch');
if (scope.issue !== 3785 || scope.releaseIssue !== 3072 || scope.sourceRun !== 31901032491) failures.push('scope authority mismatch');
if (JSON.stringify([...scope.allowedPaths].sort()) !== JSON.stringify([...allowed].sort())) failures.push('scope paths mismatch');
const b=scope.boundaries||{};
for (const k of ['databaseMutation','identityMutation','passwordMutation','mfaMutation','sessionMutation','resetReplay','mailSend','deploymentMutation','containerLifecycleMutation','piiOutput','credentialOutput','rawLogOutput']) if (b[k] !== false) failures.push(`scope boundary ${k}`);
if (b.productionMutation !== 'NONE' || b.logReadOnly !== true || b.ownerOnly !== true || b.exactMainGuard !== true || b.newRecurringCostRub !== 0) failures.push('scope core boundary mismatch');
const syntax=spawnSync('bash',['-n',scriptPath],{encoding:'utf8'}); if(syntax.status!==0) failures.push(`bash syntax failed ${syntax.stderr.slice(0,200)}`);
if(process.env.GITHUB_EVENT_NAME==='pull_request'){
 const diff=spawnSync('git',['diff','--name-only','origin/main...HEAD'],{encoding:'utf8'});
 const changed=diff.stdout.trim().split('\n').filter(Boolean).sort();
 const outOfScope=changed.filter((file)=>!allowed.includes(file));
 if(diff.status!==0 || changed.length===0 || outOfScope.length) failures.push(`PR scope mismatch ${JSON.stringify(changed)}`);
}
if(failures.length){for(const f of failures) console.error(`FAIL: ${f}`); process.exit(1);} console.log('PASS: sanitized reset stack classifier is exact-window, owner-only, read-only, secret-safe, and uses deterministic fixed-string extraction.');
