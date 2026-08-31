import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const ACCEPTANCE='scripts/production-p0-first-customer-acceptance.sh';
const WORKFLOW='.github/workflows/production-p0-first-customer-acceptance.yml';
const CORE_BLOB='b02ce590dc308ce46c41df33416dd7b11700ae98';
const CHECKER_BLOB='5b315be49d4f7025069441a5ff551729dbc46d36';
const HISTORICAL_COMMIT='c8038e36adb95d62ea9c862deccdda26547f7799';
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
  'group: pc-crop-production-release-candidate',
  'pc-crop-registration-lifecycle',
  'queue: max',
  'Resolve immutable candidate from successful release and mail cutover',
  'P0_LATEST_RELEASE_INTENT_NOT_TERMINAL_PASS',
  'gh api --paginate --slurp',
  'actor=$GITHUB_REPOSITORY_OWNER',
  'created=%3E%3D$expected_created',
  '/attempts/$candidate_attempt/jobs?per_page=100',
  'runs/$run_id/attempts/$run_attempt/jobs?per_page=100',
  "const control = jobs.filter((job) => job.name === 'production-release-control-3072')",
  'control.length !== 1',
  'production-reviewer-readiness-3072 / Validate production reviewer inspect contract',
  'production-reviewer-readiness-3072 / Read-only REG.RU reviewer login readiness',
  'git merge-base --is-ancestor "$target" "$current"',
  'git checkout --detach "$target"',
  'Validate acceptance contract from immutable candidate',
  'assert_no_newer_release_intent()',
  'node - "$runs" > "$candidates_parser_file"',
  'mapfile -t candidates < "$candidates_parser_file"',
  'PC_P0_RELEASE_RUN_ID: ${{ steps.target.outputs.release_run_id }}',
  'PC_P0_RELEASE_RUN_ATTEMPT: ${{ steps.target.outputs.release_run_attempt }}',
  'P0_RELEASE_ATTEMPT_CHANGED_BEFORE_FIRST_CUSTOMER',
  'monitor_release_attempt()',
  'P0_RELEASE_ATTEMPT_CHANGED_DURING_FIRST_CUSTOMER',
  'P0_RELEASE_ATTEMPT_CHANGED_BEFORE_FIRST_CUSTOMER_ARTIFACT',
  'setsid --wait bash -c',
  'kill -TERM -- "-$runner_pid"',
  'result.releaseControllerRunAttempt !== releaseRunAttempt',
  'result.production?.authMailWorkerRevisionExact !== true',
  'result.production?.authMailWorkerReady !== true',
  'production-p0-first-customer-${{ steps.target.outputs.sha }}-${{ github.run_id }}-${{ github.run_attempt }}',
]) if(!workflow.includes(marker)) fail(`continuation workflow marker missing: ${marker}`);
const lifecycleGroup=workflow.match(/^concurrency:\n\s+group: ([^\n]+)$/mu)?.[1]||'';
if(!lifecycleGroup.includes('pc-crop-registration-lifecycle')
  || lifecycleGroup.includes('github.triggering_actor')) {
  fail('reruns of the original owner command must remain in the serialized lifecycle group');
}
for(const forbidden of [
  '[[ "$candidate_status" == completed ]] && continue',
  'if [[ "$count" == 0 && "$run_status" == completed ]]; then continue; fi',
  'control.length === 0 ||',
]) if(workflow.includes(forbidden)) fail(`zero-job latest-intent bypass remains: ${forbidden}`);
if(!workflow.includes('for _ in $(seq 1 15); do')) {
  fail('release-attempt monitor must use the bounded 15-second polling interval');
}
const acceptanceExecution=workflow.indexOf('- name: Execute immutable-candidate P0 first-customer acceptance');
const acceptanceAttemptRecheck=workflow.indexOf('P0_RELEASE_ATTEMPT_CHANGED_BEFORE_FIRST_CUSTOMER',acceptanceExecution);
const acceptanceAttemptMonitor=workflow.indexOf('monitor_release_attempt()',acceptanceExecution);
const acceptanceRunnerLaunch=workflow.indexOf('setsid --wait bash -c',acceptanceExecution);
const acceptanceMonitorLaunch=workflow.indexOf('monitor_release_attempt &',acceptanceExecution);
const acceptanceRunnerWait=workflow.indexOf('wait "$runner_pid"',acceptanceExecution);
const acceptanceMutation=workflow.indexOf('bash scripts/production-p0-first-customer-acceptance.sh',acceptanceExecution);
if(!(acceptanceExecution>=0 && acceptanceAttemptRecheck>acceptanceExecution
  && acceptanceAttemptMonitor>acceptanceAttemptRecheck && acceptanceMutation>acceptanceAttemptMonitor)) {
  fail('release run attempt must be rechecked and continuously supervised inside the acceptance step');
}
if(!(acceptanceRunnerLaunch>acceptanceAttemptMonitor && acceptanceMonitorLaunch>acceptanceRunnerLaunch
  && acceptanceRunnerWait>acceptanceMonitorLaunch)) {
  fail('release-attempt monitor must actually launch and supervise the acceptance process group');
}
const artifactGuard=workflow.indexOf('- name: Guard immutable release candidate before artifact publication');
const artifactLatestIntent=workflow.indexOf('assert_no_newer_release_intent\n',artifactGuard);
const artifactFinalFetch=workflow.indexOf('git fetch --no-tags origin main >/dev/null',artifactLatestIntent);
const artifactFinalAncestry=workflow.indexOf('git merge-base --is-ancestor "$TARGET_SHA" "$current"',artifactFinalFetch);
const artifactFinalAttemptEndpoint=workflow.indexOf('actions/runs/$RELEASE_RUN_ID',artifactFinalAncestry);
const artifactFinalAttempt=workflow.indexOf('P0_RELEASE_ATTEMPT_CHANGED_BEFORE_FIRST_CUSTOMER_ARTIFACT',artifactGuard);
const artifactUpload=workflow.indexOf('- name: Upload bounded P0 acceptance evidence',artifactGuard);
if(!(artifactGuard>=0 && artifactLatestIntent>artifactGuard
  && artifactFinalFetch>artifactLatestIntent && artifactFinalAncestry>artifactFinalFetch
  && artifactFinalAttemptEndpoint>artifactFinalAncestry
  && artifactFinalAttempt>artifactFinalAttemptEndpoint && artifactUpload>artifactFinalAttempt)) {
  fail('artifact publication must follow the final release-attempt and candidate-ancestry recheck');
}
if(/mapfile -t \w+ < <\(node/u.test(workflow)) {
  fail('latest-intent parser exit status must not be hidden by process substitution');
}
if(workflow.includes('jobs?filter=latest')) {
  fail('latest jobs endpoint is forbidden; every provenance read must name an exact run attempt');
}
if(/assert_no_newer_release_intent\s*(?:\\\n\s*)?\|\|/u.test(workflow)) {
  fail('latest-intent guard must be called directly so Bash errexit remains active inside the function');
}
const parserFailureProbe=spawnSync('bash',['-c',
  'set -euo pipefail; out="$(mktemp)"; trap \'rm -f "$out"\' EXIT; node -e \'process.stdout.write("partial\\n");process.exit(7)\' > "$out"; mapfile -t rows < "$out"; echo FAIL_OPEN'],
  {encoding:'utf8'},
);
if(parserFailureProbe.status===0 || parserFailureProbe.stdout.includes('FAIL_OPEN')) {
  fail('status-checked latest-intent parser failure probe did not fail closed');
}
if((workflow.match(/^\s+queue: max$/gmu)||[]).length!==3) {
  fail('workflow, bounded reviewer repair, and First Customer acceptance must retain every serialized pending invocation');
}
if(workflow.includes('platform-v7-safe-merge.yml/runs?event=issue_comment&status=success')) {
  fail('release selector must inspect the latest qualifying intent, not fallback across non-success runs');
}
const releaseJobs=[
  'production-release-control-3072',
  'production-full-stack-execution-3072 / Validate full-stack release contract',
  'production-full-stack-execution-3072 / Migrate, deploy API and web, verify live intake',
  'production-auth-mail-cutover-3072 / Validate auth-mail cutover contract',
  'production-auth-mail-cutover-3072 / Cut over exact production to durable auth-mail worker',
  'production-reviewer-readiness-3072 / Validate production reviewer inspect contract',
  'production-reviewer-readiness-3072 / Read-only REG.RU reviewer login readiness',
];
const releaseVerdict=(runs)=>{
  for(const run of runs){
    const control=run.jobs.filter((job)=>job.name===releaseJobs[0]);
    if(control.length===1 && control[0].conclusion==='skipped') {
      if(Number(run.runAttempt||1)>1) return 'BLOCK';
      continue;
    }
    if(run.status!=='completed' || run.conclusion!=='success') return 'BLOCK';
    return releaseJobs.every((name)=>{
      const matches=run.jobs.filter((job)=>job.name===name);
      return matches.length===1 && matches[0].conclusion==='success';
    })?'PASS':'BLOCK';
  }
  return 'BLOCK';
};
const successJobs=releaseJobs.map((name)=>({name,conclusion:'success'}));
const oldPass={runAttempt:1,status:'completed',conclusion:'success',jobs:successJobs};
if(releaseVerdict([
  {runAttempt:2,status:'completed',conclusion:'failure',jobs:[{name:releaseJobs[0],conclusion:'skipped'}]},
  oldPass,
])!=='BLOCK') fail('newer rerun with skipped release control must block fallback');
if(releaseVerdict([{runAttempt:1,status:'completed',conclusion:'cancelled',jobs:[]},oldPass])!=='BLOCK') {
  fail('newer completed release intent without materialized jobs must block fallback');
}
if(releaseVerdict([{status:'in_progress',conclusion:null,jobs:[{name:releaseJobs[0],conclusion:null}]},oldPass])!=='BLOCK') {
  fail('newer in-progress release intent must block fallback to an older PASS');
}
if(releaseVerdict([{status:'completed',conclusion:'failure',jobs:[{name:releaseJobs[0],conclusion:'success'}]},oldPass])!=='BLOCK') {
  fail('newer failed release intent must block fallback to an older PASS');
}
if(releaseVerdict([{...oldPass,jobs:[...successJobs,{...successJobs[1]}]}])!=='BLOCK') {
  fail('duplicate controller job evidence must fail closed');
}
if(releaseVerdict([oldPass])!=='PASS') fail('single exact successful controller chain must pass the selector model');
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
  'RELEASE_CANDIDATE_ANCESTRY_GUARD',
  'P0_FIRST_CUSTOMER_RELEASE_CANDIDATE_GUARD=PASS',
  'AUTH_MAIL_WORKER_EXACT_READY',
  'P0_AUTH_MAIL_WORKER_RUNTIME_AUTHORITY_AMBIGUOUS',
  'P0_AUTH_MAIL_WORKER_REVISION_MISMATCH',
  'P0_AUTH_MAIL_WORKER_NOT_HEALTHY',
  'P0_AUTH_MAIL_WORKER_NOT_READY',
  'authMailWorkerRevisionExact',
  'authMailWorkerReady',
  'releaseControllerRunId',
  'releaseControllerRunAttempt',
  'TERMINAL_PRODUCTION_PREFLIGHT',
  'P0_FIRST_CUSTOMER_AUTH_MAIL_WORKER_GUARD=PASS',
  'P0_FIRST_CUSTOMER_RELEASE_PROVENANCE=PASS',
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
  || !validation.stdout.includes('P0_FIRST_CUSTOMER_READ_RESOURCE_SET_U_PATCH=PASS')
  || !validation.stdout.includes('P0_FIRST_CUSTOMER_RELEASE_CANDIDATE_GUARD=PASS')
  || !validation.stdout.includes('P0_FIRST_CUSTOMER_AUTH_MAIL_WORKER_GUARD=PASS')
  || !validation.stdout.includes('P0_FIRST_CUSTOMER_RELEASE_PROVENANCE=PASS')) {
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
const oldWorkflow=path.join(dir,'workflow.yml');
try {
  fs.writeFileSync(oldChecker,run('git',['cat-file','blob',CHECKER_BLOB]));
  fs.writeFileSync(oldAcceptance,run('git',['cat-file','blob',CORE_BLOB]));
  fs.writeFileSync(oldWorkflow,run('git',['show',`${HISTORICAL_COMMIT}:${WORKFLOW}`]));
  if(run('git',['hash-object',oldAcceptance]).trim()!==CORE_BLOB) fail('historical acceptance blob mismatch');
  if(run('git',['hash-object',oldChecker]).trim()!==CHECKER_BLOB) fail('historical checker blob mismatch');

  const current=fs.readFileSync(ACCEPTANCE);
  const currentMode=fs.statSync(ACCEPTANCE).mode & 0o777;
  const currentWorkflow=fs.readFileSync(WORKFLOW);
  try {
    fs.copyFileSync(oldAcceptance,ACCEPTANCE);
    fs.copyFileSync(oldWorkflow,WORKFLOW);
    const historical=spawnSync(process.execPath,[oldChecker],{encoding:'utf8'});
    if(historical.status!==0) fail(`historical contract failed: ${(historical.stderr||historical.stdout||'').trim().slice(0,1200)}`);
  } finally {
    fs.writeFileSync(ACCEPTANCE,current);
    fs.chmodSync(ACCEPTANCE,currentMode);
    fs.writeFileSync(WORKFLOW,currentWorkflow);
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
