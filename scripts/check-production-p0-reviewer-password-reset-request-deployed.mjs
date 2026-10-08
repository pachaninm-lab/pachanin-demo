import fs from 'node:fs';

const workflowPath = '.github/workflows/production-p0-reviewer-password-reset-request-deployed.yml';
const runnerPath = 'scripts/production-p0-reviewer-password-reset-request-deployed.sh';
const scopePath = 'docs/platform-v7/autopilot/scopes/production-p0-reviewer-password-reset-request-deployed-3785.json';
const sourcePath = 'scripts/production-p0-reviewer-password-reset-request.sh';
const workflow = fs.readFileSync(workflowPath, 'utf8');
const runner = fs.readFileSync(runnerPath, 'utf8');
const source = fs.readFileSync(sourcePath, 'utf8');
const scope = JSON.parse(fs.readFileSync(scopePath, 'utf8'));

function fail(message) { throw new Error(message); }
function requireAll(label, text, needles) {
  for (const needle of needles) if (!text.includes(needle)) fail(`${label} missing ${needle}`);
}
function forbidAll(label, text, needles) {
  for (const needle of needles) if (text.includes(needle)) fail(`${label} forbidden ${needle}`);
}

const command = '/production p0-reviewer-reset-request deployed-7b66f65';
const deployed = '7b66f65f8fc7fc4bbedb56c94088ad1473462c92';
const mailProofRun = '31820889888';
const mailProofHead = 'f9ebf5dd6b7424911285378a938a78a06e9cb2fe';
const sourceBlob = 'cbfa6695df00b7b536d153a88e55626d66281063';
const branch = 'fix/p0-reviewer-reset-proof-31820889888-3785';
const allowedPaths = [workflowPath, runnerPath, scopePath, 'scripts/check-production-p0-reviewer-password-reset-request-deployed.mjs'];

requireAll('workflow', workflow, [
  'issue_comment:',
  'pull_request:',
  `github.event.comment.body == '${command}'`,
  'github.event.issue.number == 3072',
  'github.event.comment.user.login == github.repository_owner',
  'github.actor == github.repository_owner',
  'github.triggering_actor == github.repository_owner',
  'persist-credentials: false',
  'fetch-depth: 0',
  'actions: read',
  'PC_PROD_SSH_HOST_FINGERPRINT',
  `node scripts/check-production-p0-reviewer-password-reset-request-deployed.mjs`,
  `bash -n scripts/production-p0-reviewer-password-reset-request-deployed.sh`,
  `bash scripts/production-p0-reviewer-password-reset-request-deployed.sh`,
]);
forbidAll('workflow', workflow, [
  'workflow_dispatch:',
  'schedule:',
  'PC_P0_REVIEWER_EMAIL',
  'PC_P0_REVIEWER_PASSWORD',
  'PC_P0_REVIEWER_TOTP',
  'StrictHostKeyChecking=no',
  'UserKnownHostsFile=/dev/null',
]);

requireAll('runner', runner, [
  `COMMAND='${command}'`,
  `EXPECTED_DEPLOYED_SHA='${deployed}'`,
  `MAIL_PROOF_RUN_ID='${mailProofRun}'`,
  `MAIL_PROOF_HEAD_SHA='${mailProofHead}'`,
  `SOURCE_BLOB_SHA='${sourceBlob}'`,
  `git merge-base --is-ancestor "$EXPECTED_DEPLOYED_SHA" "$TARGET_SHA"`,
  `git merge-base --is-ancestor "$MAIL_PROOF_HEAD_SHA" "$TARGET_SHA"`,
  `[[ "$(git hash-object "$SOURCE_SCRIPT")" == "$SOURCE_BLOB_SHA" ]]`,
  `repos/$GITHUB_REPOSITORY/actions/runs/$MAIL_PROOF_RUN_ID`,
  'Send one isolated acceptance mail from active Web container and prove IMAP receipt',
  'proof_job_count',
  'replacements = [',
  'count = text.count(old)',
  'PATCH_CARDINALITY_FAILED',
  'text = text.replace(old, new, 1)',
  `git status --porcelain=v1`,
  `bash -n "$temp_script"`,
  `bash "$temp_script"`,
]);
forbidAll('runner', runner, [
  'StrictHostKeyChecking=no',
  'UserKnownHostsFile=/dev/null',
  'docker restart',
  'docker rm',
  'docker compose up',
  'UPDATE public."users"',
  'INSERT INTO public."users"',
  'PC_P0_REVIEWER_EMAIL',
  'PC_P0_REVIEWER_PASSWORD',
  'PC_P0_REVIEWER_TOTP',
]);

requireAll('source', source, [
  "COMMAND='/production p0-reviewer-reset-request current-main'",
  'if [[ "$api_revision" != "$target_sha" || "$web_revision" != "$target_sha" ]]; then',
  '[[ "$api_revision" == "$TARGET_SHA" && "$web_revision" == "$TARGET_SHA" ]]',
  '/api/auth/forgot-password',
  'password_reset_delivery_result',
  '"delivered"[[:space:]]*:[[:space:]]*true',
  'PRODUCTION_MUTATION=NORMAL_PASSWORD_RESET_REQUEST_ONLY',
]);

if (scope.schemaVersion !== 'platform-v7.concurrent-scope.v1') fail('scope schema mismatch');
if (scope.branch !== branch || scope.status !== 'active') fail('scope branch/status mismatch');
if (scope.issue !== 3785 || scope.releaseIssue !== 3072) fail('scope authority mismatch');
if (JSON.stringify([...scope.allowedPaths].sort()) !== JSON.stringify([...allowedPaths].sort())) fail('scope paths mismatch');
const expectedBoundaries = {
  productionMutation: 'NORMAL_PASSWORD_RESET_REQUEST_ONLY_AFTER_ALL_PREFLIGHTS',
  databaseDirectMutation: false,
  deploymentMutation: false,
  containerLifecycleMutation: false,
  reviewerIdentityOutput: false,
  credentialOutput: false,
  passwordOutput: false,
  totpOutput: false,
  fixedDeployedRevision: deployed,
  mailProofRun: Number(mailProofRun),
  mailProofHead,
  sourceBlob,
  exactMainGuard: true,
  activeRevisionMustBeAncestorOfMain: true,
  activeRevisionMustRemainFixedBeforeReset: true,
  ownerOnly: true,
  newRecurringCostRub: 0,
};
for (const [key, value] of Object.entries(expectedBoundaries)) {
  if (scope.boundaries?.[key] !== value) fail(`scope boundary mismatch ${key}`);
}
if (scope.productionHosting !== 'REG_RU_EXISTING_INFRASTRUCTURE_ONLY') fail('hosting boundary mismatch');

console.log('production P0 fixed-deployed reviewer reset request contract PASS');
