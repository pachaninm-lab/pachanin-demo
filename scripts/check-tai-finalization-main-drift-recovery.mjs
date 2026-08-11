#!/usr/bin/env node
import { readFileSync } from 'node:fs';

const paths = {
  workflow: '.github/workflows/tai-owner-finalization-recovery-command.yml',
  checker: 'scripts/check-tai-finalization-main-drift-recovery.mjs',
  scope: 'docs/platform-v7/autopilot/scopes/tai-finalization-main-drift-recovery-2-20260811.json',
  state: 'docs/platform-v7/autopilot/autopilot-state.json',
};

const workflow = readFileSync(paths.workflow, 'utf8');
const scope = JSON.parse(readFileSync(paths.scope, 'utf8'));
const state = JSON.parse(readFileSync(paths.state, 'utf8'));
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
  "github.event.comment.body == '/tai recover-finalization 31481267058'",
  'RECOVERY_COMMAND: /tai recover-finalization 31481267058',
  'ACTIVATION_RUN_ID: "31481267058"',
  'CONTROLLER_RUN_ID: "314812670581"',
  'ACTIVATION_TARGET_SHA: 10b6cc03ea7a142e4d6baf5bf87ddc02a6b44a2d',
  'ACTIVATION_JOB_ID: "93746825204"',
  'HOSTED_ACCEPTANCE_JOB_ID: "93747517497"',
  'FAILED_FINALIZATION_JOB_ID: "93754807742"',
  'HOSTED_ARTIFACT_ID: "9098297919"',
  'HOSTED_ARTIFACT_NAME: tai-live-public-ai-ui-31481267058',
  'HOSTED_ARTIFACT_SIZE: "4805479"',
  'HOSTED_ARTIFACT_DIGEST: sha256:1777d4300744555ae3ffc2abd614a34b0830d974b851c0e169917b4b723044ee',
  'actions/runs/${ACTIVATION_RUN_ID}/artifacts?per_page=100',
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
  'runner_authority=/etc/pc-release-authority/actions-runner.json',
  'target_controller_sha="$(git -C "$repository" show "$target:scripts/pc-tai-release-controller.sh" | sha256sum',
  "assert report.get('schemaVersion') == 'pc.actions-runner-authority.v3'",
  "assert report.get('sudoControllerSha256') == sys.argv[2]",
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
  "docker ps -q --filter 'label=com.docker.compose.service=tai'",
  'org.opencontainers.image.revision',
  '[[ "$api_revision" == "$target" && "$web_revision" == "$target" && "$tai_revision" == "$target" ]]',
  "grep -Fxq 'TAI_RESTRICTED_QWEN_PUBLIC_ENABLED=true'",
  "grep -Fxq 'AI_ASSISTANT_MODEL=tai-qwen3-8b-q4km'",
  "grep -Fxq 'TAI_RESTRICTED_QWEN_MODEL_IDENTITY=tai-qwen3-8b-q4km'",
  'mv -Tf "$finalization_tmp" "$job_state/finalization.json"',
  'mv -Tf "$recovery_tmp" "$output"',
  'mv -Tf "$marker_tmp" "$qwen_state/FINAL_ACCEPTED"',
  "'taiRevision':tai_revision",
  "'controllerAuthorityAttested':True",
  "'hostedArtifactDigest':artifact_digest",
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
  'ref: ${{ github.event.repository.default_branch }}',
  'printf \'CURRENT_SHA=%s\\n\' "$current_sha" >> "$GITHUB_ENV"',
  'actions/download-artifact@v4',
  'name: tai-finalization-main-drift-recovery-${{ github.run_id }}',
  "run.name !== 'TAI Restricted Qwen REG.RU Activation'",
  "run.event !== 'workflow_dispatch'",
  "run.head_repository?.full_name !== repository",
  "run.run_attempt !== 1",
  "assert report.get('schemaVersion') == 'tai.restricted-qwen.activation.v1'",
  "assert report.get('runId') == sys.argv[3]",
  "recovery.recoveryRunId !== Number(runId)",
  'process.stdout.write(recovery.currentMain);',
]) requireFragment(workflow, fragment, paths.workflow);

const jobsIndex = workflow.indexOf('\njobs:\n');
if (jobsIndex < 0) violations.push(`${paths.workflow}: jobs boundary missing`);
else forbid(workflow.slice(0, jobsIndex), /\$\{\{\s*secrets[.]/u,
  `${paths.workflow}: workflow-global secret expressions are forbidden`);
const sshStepStart = workflow.indexOf('      - name: Resolve protected root key and pinned REG.RU identity\n');
const sshStepEnd = workflow.indexOf('\n      - name:', sshStepStart + 1);
if (sshStepStart < 0 || sshStepEnd < 0) violations.push(`${paths.workflow}: exact SSH step boundary missing`);
else {
  const sshStep = workflow.slice(sshStepStart, sshStepEnd);
  for (const fragment of [
    'SSH_HOST_SECRET: ${{ secrets.PC_PROD_HOST }}',
    'SSH_USER_SECRET: ${{ secrets.PC_PROD_SSH_USER }}',
    'SSH_PORT_SECRET: ${{ secrets.PC_PROD_SSH_PORT }}',
    'SSH_KEY_PRIMARY: ${{ secrets.PC_PROD_SSH_KEY }}',
    'SSH_KEY_SECONDARY: ${{ secrets.PC_PROD_SSH_PRIVATE_KEY }}',
    'SSH_KEY_FALLBACK: ${{ secrets.VPS_SSH_KEY }}',
    'SSH_HOST_FINGERPRINT_SECRET: ${{ secrets.PC_PROD_SSH_HOST_FINGERPRINT }}',
  ]) requireFragment(sshStep, fragment, `${paths.workflow}: exact SSH step`);
}
const secretReferences = workflow.match(/\$\{\{\s*secrets[.][^}]+\}\}/gu) || [];
if (secretReferences.length !== 7) violations.push(`${paths.workflow}: SSH secrets must occur exactly once and only in the exact SSH step`);

forbid(workflow, /needs[.]authority[.]outputs[.]current_sha/u,
  `${paths.workflow}: current main SHA must not cross a job-output boundary`);
forbid(workflow, /^\s*outputs:\s*\n\s*current_sha:/mu,
  `${paths.workflow}: current main SHA job output is forbidden`);
forbid(workflow, /current_sha=.*GITHUB_OUTPUT/u,
  `${paths.workflow}: current main SHA step output is forbidden`);
forbid(workflow, /pull_request_target:/u, `${paths.workflow}: pull_request_target is forbidden`);
forbid(workflow, /continue-on-error:\s*true/mu, `${paths.workflow}: continue-on-error is forbidden`);
forbid(workflow, /StrictHostKeyChecking=(?:no|accept-new)/u, `${paths.workflow}: unpinned SSH host acceptance is forbidden`);
forbid(workflow, /runs-on:\s*\[self-hosted/iu, `${paths.workflow}: recovery must not run through the restricted self-hosted runner`);
forbid(workflow, /\/tai\s+recover-finalization\s+(?!31481267058)/u,
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
if (scope.branch !== 'fix/tai-finalization-main-drift-recovery-2-20260811') violations.push(`${paths.scope}: branch mismatch`);
if (scope.baselineExactMain !== '696f8d00f6fb05426e55d2636a5a22a7543d939e') violations.push(`${paths.scope}: baseline mismatch`);
if (scope.productionHosting !== 'REG_RU_VPS_ONLY' || scope.newRecurringCostRub !== 0) {
  violations.push(`${paths.scope}: hosting or cost boundary changed`);
}
for (const path of [paths.workflow, paths.checker, paths.scope]) {
  if (!scope.allowedPaths.includes(path)) violations.push(`${paths.scope}: ${path} outside allowedPaths`);
}
const registered = state.approvedConcurrentScopes?.[scope.branch];
if (!Array.isArray(registered)
  || registered.length !== scope.allowedPaths.length
  || registered.some((path, index) => path !== scope.allowedPaths[index])) {
  violations.push(`${paths.state}: exact implementation branch is not registered with the scope allow-list`);
}
const evidence = scope.productionEvidence || {};
if (evidence.activationRun !== 31481267058
  || evidence.targetSha !== '10b6cc03ea7a142e4d6baf5bf87ddc02a6b44a2d'
  || evidence.activationJob !== 93746825204
  || evidence.hostedAcceptanceJob !== 93747517497
  || evidence.failedFinalizationJob !== 93754807742
  || evidence.controllerRun !== 314812670581
  || evidence.currentMainAtFailure !== '696f8d00f6fb05426e55d2636a5a22a7543d939e'
  || evidence.failureCode !== 'TARGET_IS_NOT_CURRENT_MAIN') {
  violations.push(`${paths.scope}: production evidence does not match the exact failed finalization`);
}

const authorityIndex = workflow.indexOf('Verify owner, exact activation run and descendant current main');
const artifactEvidenceIndex = workflow.indexOf('artifact?.digest !== artifactDigest');
const controllerAuthorityIndex = workflow.indexOf('runner_authority=/etc/pc-release-authority/actions-runner.json');
const activationEvidenceIndex = workflow.indexOf("assert report.get('passed') is True");
const liveRevisionIndex = workflow.indexOf('[[ "$api_revision" == "$target" && "$web_revision" == "$target" && "$tai_revision" == "$target" ]]');
const finalizationEvidenceIndex = workflow.indexOf('mv -Tf "$finalization_tmp" "$job_state/finalization.json"');
const recoveryEvidenceIndex = workflow.indexOf('mv -Tf "$recovery_tmp" "$output"');
const finalMarkerIndex = workflow.indexOf('mv -Tf "$marker_tmp" "$qwen_state/FINAL_ACCEPTED"');
const publishIndex = workflow.indexOf('Publish exact accepted result');
if ([authorityIndex, artifactEvidenceIndex, controllerAuthorityIndex, activationEvidenceIndex, liveRevisionIndex,
  finalizationEvidenceIndex, recoveryEvidenceIndex, finalMarkerIndex, publishIndex].some((index) => index < 0)
  || !(authorityIndex < artifactEvidenceIndex
    && artifactEvidenceIndex < controllerAuthorityIndex
    && controllerAuthorityIndex < activationEvidenceIndex
    && activationEvidenceIndex < liveRevisionIndex
    && liveRevisionIndex < finalizationEvidenceIndex
    && finalizationEvidenceIndex < recoveryEvidenceIndex
    && recoveryEvidenceIndex < finalMarkerIndex
    && finalMarkerIndex < publishIndex)) {
  violations.push(`${paths.workflow}: authority, exact artifact, controller, live-revision, durable evidence, final-marker and publication order is invalid`);
}

if (violations.length) {
  console.error('TAI exact finalization recovery contract failed:');
  for (const violation of violations) console.error(`- ${violation}`);
  process.exit(1);
}

console.log('TAI exact finalization recovery contract PASS: registered owner-only activation, exact jobs/artifact, step-scoped SSH, controller digest, API/Web/TAI live revisions, durable evidence before atomic final marker, and no deployment/rollback mutation.');
