import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

const paths = {
  executor: 'scripts/production-full-stack-exact-sha.sh',
  provisioner: 'scripts/provision-production-auth-opaque-token-key.sh',
  workflow: '.github/workflows/production-auth-opaque-token-key.yml',
  scope: 'docs/platform-v7/autopilot/scopes/production-auth-key-provision-3723.json',
};
const failures = [];
const content = {};
for (const [name, path] of Object.entries(paths)) {
  if (!fs.existsSync(path)) failures.push(`${path}: missing`);
  else content[name] = fs.readFileSync(path, 'utf8');
}
const requireAll = (name, values) => values.forEach((value) => {
  if (!content[name]?.includes(value)) failures.push(`${paths[name]}: missing ${JSON.stringify(value)}`);
});
const forbid = (name, patterns) => patterns.forEach((pattern) => {
  if (pattern.test(content[name] ?? '')) failures.push(`${paths[name]}: forbidden ${pattern}`);
});

requireAll('executor', [
  '.pc-auth-opaque-token.env',
  'AUTH_OPAQUE_TOKEN_ENV_FILE_MISSING',
  "stat -c '%a:%u:%g'",
  'AUTH_OPAQUE_TOKEN_DIGEST_KEY=[A-Fa-f0-9]{64,}',
  'env_file:',
]);
requireAll('provisioner', [
  'openssl rand -hex 48',
  'AUTH_OPAQUE_TOKEN_DIGEST_KEY=%s',
  'chmod 0600',
  'chown 0:0',
  'AUTH_OPAQUE_TOKEN_KEY_PROVISION=CREATED',
  'AUTH_OPAQUE_TOKEN_KEY_PROVISION=EXISTING',
  'AUTH_OPAQUE_TOKEN_KEY_VALID=1',
  'EXISTING_KEY_FILE_INVALID',
]);
requireAll('workflow', [
  "github.event.issue.number == 3072",
  "github.event.comment.body == '/production provision-auth-opaque-token-key current-main'",
  'github.event.comment.user.login == github.repository_owner',
  'PC_PROD_DIR',
  'PC_PROD_DIR_B64',
  'StrictHostKeyChecking=yes',
  'provision-production-auth-opaque-token-key.sh',
  'AUTH_OPAQUE_TOKEN_KEY_VALID=1',
]);
forbid('provisioner', [
  /echo\s+.*key_material/i,
  /cat\s+.*pc-auth-opaque-token/i,
  /source\s+.*pc-auth-opaque-token/i,
  /AUTH_TOKEN_PEPPER=/,
]);
forbid('workflow', [
  /StrictHostKeyChecking=no/,
  /sshpass/i,
  /AUTH_OPAQUE_TOKEN_DIGEST_KEY\s*:/,
  /AUTH_TOKEN_PEPPER\s*:/,
]);
for (const path of [paths.executor, paths.provisioner]) {
  const result = spawnSync('bash', ['-n', path], { encoding: 'utf8' });
  if (result.status !== 0) failures.push(`${path}: bash -n failed: ${result.stderr.trim()}`);
}
try {
  const scope = JSON.parse(content.scope ?? '{}');
  if (scope.branch !== 'agent/production-auth-key-provision-3723') failures.push(`${paths.scope}: branch mismatch`);
  if (scope.productionHosting !== 'REG_RU_VPS_ONLY') failures.push(`${paths.scope}: production hosting mismatch`);
  if (scope.newRecurringCostRub !== 0) failures.push(`${paths.scope}: recurring cost must be zero`);
} catch (error) {
  failures.push(`${paths.scope}: invalid JSON: ${error.message}`);
}
if (failures.length) {
  console.error('Production opaque-token key provision contract failed:');
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}
console.log('PASS: the owner-only production key provisioner creates or validates root-owned 0600 opaque-token key material without logging it, and exact releases consume only that protected file.');
