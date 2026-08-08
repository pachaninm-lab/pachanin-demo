import fs from 'node:fs';

const workflowPath = '.github/workflows/production-web-owner-exact-command.yml';
const workflow = fs.readFileSync(workflowPath, 'utf8');
const failures = [];

const requireText = (needle) => {
  if (!workflow.includes(needle)) failures.push(`missing ${JSON.stringify(needle)}`);
};
const forbid = (pattern) => {
  if (pattern.test(workflow)) failures.push(`forbidden ${pattern}`);
};

for (const needle of [
  'issue_comment:',
  'types: [created]',
  'actions: write',
  'issues: write',
  'github.event.issue.number == 3048',
  'github.event.comment.user.login == github.repository_owner',
  "startsWith(github.event.comment.body, '/production web exact ')",
  '^/production\\ web\\ exact\\ ([0-9a-f]{40})$',
  'git merge-base --is-ancestor "$target_sha" origin/main',
  'gh workflow run production-web-exact-sha.yml',
  '-f action=deploy',
  '-f target_sha="$TARGET_SHA"',
  '-f confirmation=DEPLOY-EXACT-SHA',
  'COMMAND_AUTHORITY=OWNER_ONLY',
  'RELEASE_AUTHORITY=production-web-exact-sha.yml',
  'DISPATCH_OUTCOME=',
  'gh issue comment 3048',
  'production mutation in this command workflow: `none`',
]) requireText(needle);

forbid(/ssh\s+-/);
forbid(/scp\s+/);
forbid(/docker\s+(?:compose|run|exec|restart|stop|rm|update)/);
forbid(/PC_PROD_SSH_(?:KEY|PASSWORD|HOST_FINGERPRINT)/);
forbid(/apps\/tai|grainflow-tai|TAI_/);
forbid(/apps\/api|grainflow-api/);
forbid(/prisma|migration/i);
forbid(/StrictHostKeyChecking=no/);

if (failures.length) {
  console.error('Production web owner exact command contract failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('PASS: owner-only issue command validates an exact main ancestor, dispatches only the canonical bounded web release, and publishes non-secret dispatch evidence.');
