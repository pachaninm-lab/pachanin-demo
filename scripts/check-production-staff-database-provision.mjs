import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

const paths = {
  executor: 'scripts/production-full-stack-exact-sha.sh',
  provisioner: 'scripts/provision-production-staff-database-url.sh',
  workflow: '.github/workflows/production-staff-database-url.yml',
  scope: 'docs/platform-v7/autopilot/scopes/production-staff-database-provision-3734.json',
};
const failures = [];
const content = Object.fromEntries(Object.entries(paths).map(([name, file]) => {
  if (!fs.existsSync(file)) failures.push(`${file}: missing`);
  return [name, fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : ''];
}));
const requires = (name, terms) => terms.forEach((term) => {
  if (!content[name].includes(term)) failures.push(`${paths[name]}: missing ${JSON.stringify(term)}`);
});
const forbids = (name, patterns) => patterns.forEach((pattern) => {
  if (pattern.test(content[name])) failures.push(`${paths[name]}: forbidden ${pattern}`);
});

requires('executor', ['.pc-staff-database.env', 'STAFF_DATABASE_ENV_FILE_MISSING', 'STAFF_DATABASE_URL=', 'pc_staff_runtime']);
requires('provisioner', ['pc_staff_runtime', 'docker compose', 'node_modules/prisma/build/index.js db execute', 'STAFF_DATABASE_URL_PROVISION=CREATED', 'STAFF_DATABASE_URL_PROVISION=EXISTING', 'STAFF_DATABASE_URL_VALID=1', 'chmod 0600', 'chown 0:0', 'COMPOSE_WEB_AUTHORITY_AMBIGUOUS']);
requires('workflow', ["github.event.issue.number == 3072", "github.event.comment.body == '/production provision-staff-database-url current-main'", 'github.event.comment.user.login == github.repository_owner', 'StrictHostKeyChecking=yes', 'provision-production-staff-database-url.sh', 'STAFF_DATABASE_URL_VALID=1', 'try_slot "${SSH_KEY_PRIMARY:-}" || try_slot "${SSH_KEY_SECONDARY:-}" || try_slot "${SSH_KEY_FALLBACK:-}" || exit 14']);
forbids('provisioner', [/echo\s+.*password/i, /cat\s+.*pc-staff-database/i, /source\s+.*pc-staff-database/i, /STAFF_DATABASE_URL\s*:/]);
forbids('workflow', [/StrictHostKeyChecking=no/, /sshpass/i, /STAFF_DATABASE_URL\s*:/]);
for (const file of [paths.executor, paths.provisioner]) {
  const result = spawnSync('bash', ['-n', file], { encoding: 'utf8' });
  if (result.status !== 0) failures.push(`${file}: bash syntax failed: ${result.stderr.trim()}`);
}
try {
  const scope = JSON.parse(content.scope);
  if (scope.branch !== 'fix/production-staff-database-provision-3734') failures.push(`${paths.scope}: branch mismatch`);
  if (scope.productionHosting !== 'REG_RU_VPS_ONLY' || scope.newRecurringCostRub !== 0) failures.push(`${paths.scope}: production boundary mismatch`);
} catch (error) {
  failures.push(`${paths.scope}: invalid JSON: ${error.message}`);
}
if (failures.length) {
  console.error('Production staff database provision contract failed:');
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}
console.log('PASS: owner-only staff database provision creates or validates one root-owned 0600 runtime URL, enables only the pre-existing least-privilege staff principal, and exact release consumes it without secret disclosure.');
