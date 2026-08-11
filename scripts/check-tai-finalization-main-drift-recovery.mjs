#!/usr/bin/env node
import { readFileSync } from 'node:fs';

const paths = {
  workflow: '.github/workflows/tai-owner-finalization-recovery-command.yml',
  checker: 'scripts/check-tai-finalization-main-drift-recovery.mjs',
  scope: 'docs/platform-v7/autopilot/scopes/tai-finalization-main-drift-recovery-20260811.json',
};

const workflow = readFileSync(paths.workflow, 'utf8');
const scope = JSON.parse(readFileSync(paths.scope, 'utf8'));
const violations = [];
const requireFragment = (source, fragment, label) => {
  if (!source.includes(fragment)) violations.push(`${label}: missing ${JSON.stringify(fragment)}`);
};
const forbid = (source, pattern, label) => {
  if (pattern.test(source)) violations.push(label);
};

for (const fragment of [
  'name: TAI Owner Exact Finalization Recovery',
  "github.event.issue.number == 3365",
  "github.event.comment.body == '/tai recover-finalization 31478303771'",
  'RECOVERY_COMMAND: /tai recover-finalization 31478303771',
  'ACTIVATION_RUN_ID: "31478303771"',
  'CONTROLLER_RUN_ID: "314783037711"',
  'ACTIVATION_TARGET_SHA: b57b1e4e6c50e01acefc1a1da0deea05a0099a92',
  'FAILED_FINALIZATION_JOB_ID: "93746092416"',
  '[[ "$COMMENTER" == "$OWNER" ]]',
  '[[ "$ACTOR" == "$OWNER" ]]',
  '[[ "$TRIGGERING_ACTOR" == "$OWNER" ]]',
  "git merge-base --is-ancestor \"$ACTIVATION_TARGET_SHA\" \"$current_sha\"",
  "['Activate through protected REG.RU controller', 'success']",
  "['Hosted live public AI acceptance', 'success']",
  "['Finalize or roll back activation', 'failure']",
  "['Confirm restricted Qwen activation chain result', 'failure']",
  'ERROR_CODE=TARGET_IS_NOT_CURRENT_MAIN',
  'runs-on: ubuntu-24.04',
  'DEFAULT_HOST: 195.19.12.120',
  'SSH_HOST_FINGERPRINT_SECRET: ${{ secrets.PC_PROD_SSH_HOST_FINGERPRINT }}',
  'StrictHostKeyChecking=yes',
  "exec 9>/run/lock/pc-tai-release-controller.lock",
  'flock -n 9',
  'git -C "$repository" merge-base --is-ancestor "$target" "$current"',
  '[[ -s "$job_state/target-sha" && "$(cat "$job_state/target-sha")" == "$target" ]]',
  '[[ -s "$job_state/PENDING_UI_ACCEPTANCE" && "$(cat "$job_state/PENDING_UI_ACCEPTANCE")" == "$target" ]]',
  "assert report.get('passed') is True",
  "assert report.get('productionInboundSshUsed') is False",
  "assert report.get('publicModelPortPublished') is False",
  "docker ps -q --filter 'label=com.docker.compose.service=api'",
  "docker ps -q --filter 'label=com.docker.compose.service=web'",
  'org.opencontainers.image.revision',
  '[[ "$api_revision" == "$target" && "$web_revision" == "$target" ]]',
  "grep -Fxq 'TAI_RESTRICTED_QWEN_PUBLIC_ENABLED=true'",
  "grep -Fxq 'AI_ASSISTANT_MODEL=tai-qwen3-8b-q4km'",
  "grep -Fxq 'TAI_RESTRICTED_QWEN_MODEL_IDENTITY=tai-qwen3-8b-q4km'",
  'install -m 0600 -o root -g root /dev/null "$qwen_state/FINAL_ACCEPTED"',
  "'schemaVersion':'tai.restricted-qwen.finalization.v1'",
  "'recoveredAfterMainDrift':True",
  "'applicationDeploymentPerformed':False",
  "'databaseMutationPerformed':False",
  "'modelMutationPerformed':False",
  "'rollbackPerformed':False",
  "'schemaVersion':'tai.finalization-main-drift-recovery.v1'",
  "'runnerAuthorityChanged':False",
  'TAI_FINALIZATION_MAIN_DRIFT_RECOVERY=PASS',
  "context='TAI Restricted Qwen REG.RU Activation'",
  'name: Confirm exact finalization recovery result',
]) requireFragment(workflow, fragment, paths.workflow);

forbid(workflow, /pull_request_target:/u, `${paths.workflow}: pull_request_target is forbidden`);
forbid(workflow, /continue-on-error:\s*true/mu, `${paths.workflow}: continue-on-error is forbidden`);
forbid(workflow, /StrictHostKeyChecking=(?:no|accept-new)/u, `${paths.workflow}: unpinned SSH host acceptance is forbidden`);
forbid(workflow, /runs-on:\s*\[self-hosted/iu, `${paths.workflow}: recovery must not run through the restricted self-hosted runner`);
forbid(workflow, /\/tai\s+recover-finalization\s+(?!31478303771)/u,
  `${paths.workflow}: alternate activation recovery target is forbidden`);
forbid(workflow, /\bdocker\s+(?:run|rm|rmi|compose|pull|push|login|exec|stop|start|restart|create|network|volume|system|image\s+rm)\b/iu,
  `${paths.workflow}: Docker mutation is forbidden`);
forbid(workflow, /\b(?:psql|createdb|dropdb|createuser|dropuser|prisma\s+migrate)\b/iu,
  `${paths.workflow}: database mutation is forbidden`);
forbid(workflow, /production-full-stack-exact-sha[.]sh\s+(?:deploy|rollback)|tai-reg-ru-deploy[.]sh|rollback_activation|rollback-qwen-env/iu,
  `${paths.workflow}: deployment or rollback execution is forbidden`);
forbid(workflow, /usermod|gpasswd|\/var\/run\/docker[.]sock|sudoers/iu,
  `${paths.workflow}: runner or sudo authority mutation is forbidden`);
forbid(workflow, /set\s+-[^\n]*x/iu, `${paths.workflow}: shell tracing is forbidden`);
forbid(workflow, /\b(?:netlify|vercel|railway|openai[.]com|anthropic[.]com)\b/iu,
  `${paths.workflow}: external hosting or paid LLM dependency is forbidden`);

if (scope.schemaVersion !== 'platform-v7.concurrent-scope.v1') violations.push(`${paths.scope}: invalid schemaVersion`);
if (scope.branch !== 'fix/tai-finalization-main-drift-recovery-20260811') violations.push(`${paths.scope}: branch mismatch`);
if (scope.baselineExactMain !== '10b6cc03ea7a142e4d6baf5bf87ddc02a6b44a2d') violations.push(`${paths.scope}: baseline mismatch`);
if (scope.productionHosting !== 'REG_RU_VPS_ONLY' || scope.newRecurringCostRub !== 0) {
  violations.push(`${paths.scope}: hosting or cost boundary changed`);
}
for (const path of [paths.workflow, paths.checker, paths.scope]) {
  if (!scope.allowedPaths.includes(path)) violations.push(`${paths.scope}: ${path} outside allowedPaths`);
}
const evidence = scope.productionEvidence || {};
if (evidence.activationRun !== 31478303771
  || evidence.targetSha !== 'b57b1e4e6c50e01acefc1a1da0deea05a0099a92'
  || evidence.activationJob !== 93737449372
  || evidence.hostedAcceptanceJob !== 93738361753
  || evidence.failedFinalizationJob !== 93746092416
  || evidence.failureCode !== 'TARGET_IS_NOT_CURRENT_MAIN') {
  violations.push(`${paths.scope}: production evidence does not match the exact failed finalization`);
}

const authorityIndex = workflow.indexOf('Verify owner, exact activation run and descendant current main');
const activationEvidenceIndex = workflow.indexOf("assert report.get('passed') is True");
const liveRevisionIndex = workflow.indexOf('[[ "$api_revision" == "$target" && "$web_revision" == "$target" ]]');
const finalMarkerIndex = workflow.indexOf('install -m 0600 -o root -g root /dev/null "$qwen_state/FINAL_ACCEPTED"');
const originalEvidenceIndex = workflow.indexOf('"$original_output/finalization.json"');
const recoveryEvidenceIndex = workflow.indexOf("'schemaVersion':'tai.finalization-main-drift-recovery.v1'");
const publishIndex = workflow.indexOf('Publish exact accepted result');
if ([authorityIndex, activationEvidenceIndex, liveRevisionIndex, finalMarkerIndex, originalEvidenceIndex, recoveryEvidenceIndex, publishIndex]
  .some((index) => index < 0)
  || !(authorityIndex < activationEvidenceIndex
    && activationEvidenceIndex < liveRevisionIndex
    && liveRevisionIndex < finalMarkerIndex
    && finalMarkerIndex < originalEvidenceIndex
    && originalEvidenceIndex < recoveryEvidenceIndex
    && recoveryEvidenceIndex < publishIndex)) {
  violations.push(`${paths.workflow}: authority, evidence, live-revision, final-marker and publication order is invalid`);
}

if (violations.length) {
  console.error('TAI exact finalization recovery contract failed:');
  for (const violation of violations) console.error(`- ${violation}`);
  process.exit(1);
}

console.log('TAI exact finalization recovery contract PASS: one owner-only accepted activation, descendant-main proof, exact live revisions, controller lock, no deployment/rollback mutation, bounded final marker and evidence publication.');
