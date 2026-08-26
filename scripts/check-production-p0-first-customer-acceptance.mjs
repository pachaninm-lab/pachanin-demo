import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const ACCEPTANCE='scripts/production-p0-first-customer-acceptance.sh';
const WORKFLOW='.github/workflows/production-p0-first-customer-acceptance.yml';
const CORE_BLOB='b02ce590dc308ce46c41df33416dd7b11700ae98';
const CHECKER_BLOB='5b315be49d4f7025069441a5ff551729dbc46d36';
const fail=(m)=>{ throw new Error(`P0_FIRST_CUSTOMER_ALIAS_CONTRACT: ${m}`); };
const run=(cmd,args,opts={})=>{
  const r=spawnSync(cmd,args,{encoding:'utf8',...opts});
  if(r.status!==0) fail(`${cmd} failed: ${(r.stderr||r.stdout||'').trim().slice(0,600)}`);
  return r.stdout;
};

const wrapper=fs.readFileSync(ACCEPTANCE,'utf8');
const workflow=fs.readFileSync(WORKFLOW,'utf8');
for(const marker of [
  'github.event.issue.number == 4637',
  "github.event.comment.body == '/production p0-first-customer current-main'",
  'RELEASE_ISSUE_NUMBER: ${{ github.event.issue.number }}',
]) if(!workflow.includes(marker)) fail(`continuation workflow marker missing: ${marker}`);
const repairStart=workflow.indexOf('\n  repair-production-reviewer:');
const acceptanceStart=workflow.indexOf('\n  accept-production-first-customers:');
if(repairStart<0 || acceptanceStart<=repairStart) fail('continuation workflow job boundaries missing');
const repairJob=workflow.slice(repairStart,acceptanceStart);
if(repairJob.includes('github.event.issue.number == 4637')) {
  fail('historical reviewer membership repair must not be authorized on continuation issue');
}
const acceptanceJob=workflow.slice(acceptanceStart);
if(!acceptanceJob.includes('(github.event.issue.number == 3072 || github.event.issue.number == 4637)')) {
  fail('first-customer acceptance must bind legacy or exact continuation authority');
}
for(const marker of [
  `CORE_BLOB='${CORE_BLOB}'`,
  "'pc_auth_runtime', 'one_deal_auth', 'app_auth', 'app_service'",
  'AUTH_ROLE_ALLOWLIST',
  'AUTH_ROLE_OUTPUT_GUARD',
  'IMAP_IDNA_TARGET',
  'IMAP_IDNA_RECIPIENTS',
  'REMOTE_BLOCKER_PERSIST',
  'REMOTE_BLOCKER_RECOVER',
  '$TMP_ROOT/remote-blocker',
  'REMOTE_BLOCKER_BOUNDARY_CARDINALITY_INVALID',
  'def canonical_mailbox(value):',
  "domain.encode('idna').decode('ascii').lower()",
  'PC_P0_FIRST_CUSTOMER_ALIAS_VALIDATE_ONLY',
  'P0_FIRST_CUSTOMER_IMAP_IDNA_PATCH=PASS',
  'P0_FIRST_CUSTOMER_REMOTE_BLOCKER_PROPAGATION=PASS',
  'REGISTRATION_FAILURE_STATE',
  'REGISTRATION_FAILURE_ENV',
  'REGISTRATION_FAILURE_RECORD',
  'REGISTRATION_FAILURE_CLASSIFIER',
  'P0_REGISTRATION_HTTP_STATUS',
  'P0_REGISTRATION_PUBLIC_CODE',
  "payload['registrationHttpStatus']",
  "payload['registrationPublicCode']",
  "re.fullmatch(r'[A-Z0-9_]{4,100}', code)",
  'REGISTRATION_FAILURE_RAW_RESPONSE_FORBIDDEN',
  'P0_FIRST_CUSTOMER_REGISTRATION_FAILURE_EVIDENCE_PATCH=PASS',
  'READ_CUSTOMER_RESOURCE_SET_U',
  'READ_CUSTOMER_RESOURCE_SET_U_PATCH_CARDINALITY_INVALID',
  'READ_CUSTOMER_RESOURCE_UNBOUND_LOCAL_REMAINS',
  'P0_FIRST_CUSTOMER_READ_RESOURCE_SET_U_PATCH=PASS',
]) if(!wrapper.includes(marker)) fail(`wrapper marker missing: ${marker}`);
const rawResponseGuard=`if 'cat "$response"' in s or 'P0_REGISTRATION_RESPONSE_BODY' in s:`;
if(wrapper.split(rawResponseGuard).length-1!==1) {
  fail('raw registration response guard cardinality invalid');
}

const validation=spawnSync('bash',[ACCEPTANCE],{
  encoding:'utf8',
  env:{...process.env,PC_P0_FIRST_CUSTOMER_ALIAS_VALIDATE_ONLY:'1'},
});
if(validation.status!==0
  || !validation.stdout.includes('P0_FIRST_CUSTOMER_AUTH_ALIAS_PATCH=PASS')
  || !validation.stdout.includes('P0_FIRST_CUSTOMER_IMAP_IDNA_PATCH=PASS')
  || !validation.stdout.includes('P0_FIRST_CUSTOMER_REMOTE_BLOCKER_PROPAGATION=PASS')
  || !validation.stdout.includes('P0_FIRST_CUSTOMER_REGISTRATION_FAILURE_EVIDENCE_PATCH=PASS')
  || !validation.stdout.includes('P0_FIRST_CUSTOMER_READ_RESOURCE_SET_U_PATCH=PASS')) {
  fail(`wrapper validation failed: ${(validation.stderr||validation.stdout||'').trim().slice(0,600)}`);
}

const brokenSetUControl=spawnSync('bash',['-c',String.raw`
set -eu
TMP_ROOT=/tmp/pc-p0-first-customer-set-u
read_customer_resource_paths() {
  local label="$1" jar="$TMP_ROOT/$label.cookies" response="$TMP_ROOT/$label-team.json"
  [[ -n "$jar" && -n "$response" ]]
}
read_customer_resource_paths b
`],{encoding:'utf8'});
if(brokenSetUControl.status===0 || !brokenSetUControl.stderr.includes('label: unbound variable')) {
  fail(`set -u negative control did not reproduce the original failure: ${(brokenSetUControl.stderr||brokenSetUControl.stdout||'').trim().slice(0,600)}`);
}

const setURegression=spawnSync('bash',['-c',String.raw`
set -eu
TMP_ROOT=/tmp/pc-p0-first-customer-set-u
read_customer_resource_paths() {
  local label="$1"
  local jar="$TMP_ROOT/$label.cookies" response="$TMP_ROOT/$label-team.json"
  [[ "$jar" == /tmp/pc-p0-first-customer-set-u/b.cookies ]]
  [[ "$response" == /tmp/pc-p0-first-customer-set-u/b-team.json ]]
}
read_customer_resource_paths b
`],{encoding:'utf8'});
if(setURegression.status!==0) {
  fail(`set -u read_customer_resource regression failed: ${(setURegression.stderr||setURegression.stdout||'').trim().slice(0,600)}`);
}

const dir=fs.mkdtempSync(path.join(os.tmpdir(),'pc-p0-first-customer-contract-'));
const oldChecker=path.join(dir,'checker.mjs');
const oldAcceptance=path.join(dir,'acceptance.sh');
try {
  fs.writeFileSync(oldChecker,run('git',['cat-file','blob',CHECKER_BLOB]));
  fs.writeFileSync(oldAcceptance,run('git',['cat-file','blob',CORE_BLOB]));
  if(run('git',['hash-object',oldAcceptance]).trim()!==CORE_BLOB) fail('historical acceptance blob mismatch');
  if(run('git',['hash-object',oldChecker]).trim()!==CHECKER_BLOB) fail('historical checker blob mismatch');

  const current=fs.readFileSync(ACCEPTANCE);
  const currentMode=fs.statSync(ACCEPTANCE).mode & 0o777;
  try {
    fs.copyFileSync(oldAcceptance,ACCEPTANCE);
    const historical=spawnSync(process.execPath,[oldChecker],{encoding:'utf8'});
    if(historical.status!==0) fail(`historical contract failed: ${(historical.stderr||historical.stdout||'').trim().slice(0,1200)}`);
  } finally {
    fs.writeFileSync(ACCEPTANCE,current);
    fs.chmodSync(ACCEPTANCE,currentMode);
  }
} finally {
  fs.rmSync(dir,{recursive:true,force:true});
}

const restored=fs.readFileSync(ACCEPTANCE,'utf8');
if(!restored.includes("'app_service'")) fail('wrapper restore failed');
if(!restored.includes('REMOTE_BLOCKER_PERSIST') || !restored.includes('REMOTE_BLOCKER_RECOVER')) {
  fail('remote blocker propagation wrapper restore failed');
}
if(!restored.includes('REGISTRATION_FAILURE_CLASSIFIER')
  || !restored.includes("payload['registrationHttpStatus']")
  || !restored.includes("payload['registrationPublicCode']")) {
  fail('registration failure evidence wrapper restore failed');
}
console.log('P0_FIRST_CUSTOMER_ACCEPTANCE_CONTRACT=PASS');
console.log('P0_FIRST_CUSTOMER_AUTH_ALIAS_COMPATIBILITY=HARDENED_LEGACY_APP_SERVICE');
console.log('P0_FIRST_CUSTOMER_IMAP_RECIPIENT_CANONICALIZATION=IDNA_ASCII');
console.log('P0_FIRST_CUSTOMER_REMOTE_BLOCKER_PROPAGATION=SHARED_TMP_FAIL_CLOSED');
console.log('P0_FIRST_CUSTOMER_REGISTRATION_FAILURE_EVIDENCE=HTTP_STATUS_AND_ALLOWLISTED_PUBLIC_CODE_ONLY');
console.log('P0_FIRST_CUSTOMER_READ_RESOURCE_SET_U=PASS');
