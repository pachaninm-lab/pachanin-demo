import fs from 'node:fs';

const ownerWorkflowPath = '.github/workflows/production-web-owner-exact-command.yml';
const releaseWorkflowPath = '.github/workflows/production-web-exact-sha.yml';
const ownerWorkflow = fs.readFileSync(ownerWorkflowPath, 'utf8');
const releaseWorkflow = fs.readFileSync(releaseWorkflowPath, 'utf8');
const failures = [];

const requireText = (source, needle, label) => {
  if (!source.includes(needle)) failures.push(`${label}: missing ${JSON.stringify(needle)}`);
};
const forbid = (source, pattern, label) => {
  if (pattern.test(source)) failures.push(`${label}: forbidden ${pattern}`);
};

for (const needle of [
  'issue_comment:',
  'types: [created]',
  'packages: read',
  'issues: write',
  'github.event.issue.number == 3048',
  'github.event.comment.user.login == github.repository_owner',
  "startsWith(github.event.comment.body, '/production web exact ')",
  '^/production\\ web\\ exact\\ ([0-9a-f]{40})$',
  'git merge-base --is-ancestor "$target_sha" origin/main',
  'uses: ./.github/workflows/production-web-exact-sha.yml',
  'action: deploy',
  'target_sha: ${{ needs.validate.outputs.target_sha }}',
  'confirmation: DEPLOY-EXACT-SHA',
  'secrets: inherit',
  'COMMAND_AUTHORITY=OWNER_ONLY',
  'RELEASE_AUTHORITY=production-web-exact-sha.yml',
  'CALL_MODE=workflow_call',
  'gh issue comment 3048',
  'production mutation in this command wrapper: `none`',
]) requireText(ownerWorkflow, needle, 'owner workflow');

for (const needle of [
  'workflow_call:',
  "description: 'audit, deploy or rollback'",
  "description: 'Full main commit SHA for deploy or rollback'",
  "description: 'DEPLOY-EXACT-SHA or ROLLBACK-EXACT-SHA'",
  "if: github.event_name == 'push' || github.actor == github.repository_owner",
  "echo 'Release action is invalid.' >&2",
]) requireText(releaseWorkflow, needle, 'release workflow');

forbid(ownerWorkflow, /actions:\s*write/);
forbid(ownerWorkflow, /gh\s+workflow\s+run/);
forbid(ownerWorkflow, /ssh\s+-/);
forbid(ownerWorkflow, /scp\s+/);
forbid(ownerWorkflow, /docker\s+(?:compose|run|exec|restart|stop|rm|update)/);
forbid(ownerWorkflow, /PC_PROD_SSH_(?:KEY|PASSWORD|HOST_FINGERPRINT)/);
forbid(ownerWorkflow, /apps\/tai|grainflow-tai|TAI_/);
forbid(ownerWorkflow, /apps\/api|grainflow-api/);
forbid(ownerWorkflow, /prisma|migration/i);
forbid(ownerWorkflow, /StrictHostKeyChecking=no/);
forbid(releaseWorkflow, /github\.actor\s*==\s*['"]github-actions\[bot\]['"]/);

if (failures.length) {
  console.error('Production web owner exact command contract failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('PASS: owner-only issue command preserves owner identity through workflow_call and the canonical bounded web release remains the sole production mutation authority.');
