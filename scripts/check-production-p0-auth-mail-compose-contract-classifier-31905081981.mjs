#!/usr/bin/env node
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

const workflowPath='.github/workflows/production-p0-auth-mail-compose-contract-classifier-31905081981.yml';
const scriptPath='scripts/production-p0-auth-mail-compose-contract-classifier-31905081981.sh';
const checkerPath='scripts/check-production-p0-auth-mail-compose-contract-classifier-31905081981.mjs';
const scopePath='docs/platform-v7/autopilot/scopes/production-p0-auth-mail-compose-contract-31905081981-3785.json';
const command='/production p0-auth-mail-compose-classify 31905081981 current-main';
const subject='01e38e835f2fec57603eb31e063e62567396a1c2';
const allowed=[workflowPath,scopePath,checkerPath,scriptPath].sort();
const protectedPaths=[
  'scripts/production-auth-mail-outbox-cutover-core.sh',
  'scripts/production-auth-mail-outbox-cutover.sh',
  '.github/workflows/production-auth-mail-outbox-cutover.yml',
  'scripts/provision-production-auth-mail-runtime.sh',
  'apps/api/src/auth-mail-worker.ts',
  'apps/api/prisma/migrations/20260812010000_p0_industrial_auth_mail_outbox/migration.sql',
];
const workflow=fs.readFileSync(workflowPath,'utf8');
const script=fs.readFileSync(scriptPath,'utf8');
const scope=JSON.parse(fs.readFileSync(scopePath,'utf8'));
const failures=[];
const need=(where,text,token)=>{if(!text.includes(token)) failures.push(`${where}: missing ${token}`)};
const deny=(where,text,re)=>{if(re.test(text)) failures.push(`${where}: forbidden ${re}`)};
for(const token of ['pull_request:','issue_comment:','github.event.issue.number == 3072','github.event.comment.user.login == github.repository_owner','github.actor == github.repository_owner','github.triggering_actor == github.repository_owner',`github.event.comment.body == '${command}'`,`node ${checkerPath}`,`bash -n ${scriptPath}`,`bash ${scriptPath}`]) need('workflow',workflow,token);
for(const p of allowed) need('workflow',workflow,`      - '${p}'`);
for(const re of [/workflow_dispatch:/,/schedule:/,/\bpush:/,/StrictHostKeyChecking=no/,/UserKnownHostsFile=\/dev\/null/]) deny('workflow',workflow,re);
for(const token of [
  `COMMAND='${command}'`,
  `SUBJECT_SHA='${subject}'`,
  'git diff --quiet "$SUBJECT_SHA..$CURRENT_MAIN" --',
  ...protectedPaths,
  'docker compose --project-directory',
  'config --format json',
  'CONTRACT_CLASS=',
  'COMPOSE_FILE_COUNT=',
  'PRODUCTION_REVISION=',
  'PRODUCTION_REVISION_COHERENT=',
  'RAW_CONFIG_PUBLISHED=0',
  'PRODUCTION_MUTATION=NONE',
  'stop_class()',
  'WEB_LEGACY_SMTP_',
  'WEB_WORKER_AUTHORITY_FORBIDDEN',
  'API_FORBIDDEN_',
  'WORKER_ENV_',
]) need('script',script,token);
for(const re of [/password-reset\/request/,/password-reset\/confirm/,/docker\s+(restart|stop|rm|kill|compose\s+up|compose\s+down)/,/\bpsql\b/,/\bprisma\s+(migrate|db|generate)/,/smtplib\./,/imaplib\./,/send_message\(/,/mailbox\.login\(/]) deny('script',script,re);
if(scope.schemaVersion!=='platform-v7.concurrent-scope.v1'||scope.branch!=='diag/p0-auth-mail-compose-contract-31905081981-3785'||scope.status!=='active') failures.push('scope identity mismatch');
if(scope.issue!==3785||scope.releaseIssue!==3072||scope.sourceRun!==31905081981||scope.sourceRevision!==subject) failures.push('scope authority mismatch');
if(JSON.stringify([...scope.allowedPaths].sort())!==JSON.stringify(allowed)) failures.push('scope paths mismatch');
const b=scope.boundaries||{};
for(const k of ['databaseMutation','identityMutation','passwordMutation','mfaMutation','sessionMutation','resetReplay','mailSend','deploymentMutation','containerLifecycleMutation','composeMutation','piiOutput','credentialOutput','rawConfigOutput']) if(b[k]!==false) failures.push(`scope boundary ${k}`);
if(b.productionMutation!=='NONE'||b.ownerOnly!==true||b.fixedProductionSubject!==true||b.newRecurringCostRub!==0) failures.push('scope core boundary mismatch');
const syntax=spawnSync('bash',['-n',scriptPath],{encoding:'utf8'}); if(syntax.status!==0) failures.push(`bash syntax failed ${syntax.stderr.slice(0,200)}`);
if(process.env.GITHUB_EVENT_NAME==='pull_request'){
  const diff=spawnSync('git',['diff','--name-only','origin/main...HEAD'],{encoding:'utf8'});
  const changed=diff.stdout.trim().split('\n').filter(Boolean).sort();
  const outside=changed.filter((path)=>!allowed.includes(path));
  if(diff.status!==0||outside.length||!changed.includes(scriptPath)||!changed.includes(checkerPath)) failures.push(`PR scope mismatch ${JSON.stringify(changed)}`);
}
if(failures.length){for(const f of failures) console.error(`FAIL: ${f}`); process.exit(1);}
console.log('PASS: auth-mail Compose classifier mirrors the active wrapper contract and remains owner-only/read-only/secret-safe.');
