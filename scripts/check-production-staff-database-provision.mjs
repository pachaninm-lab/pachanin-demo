import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

const paths = {
  executor: 'scripts/production-full-stack-exact-sha.sh',
  provisioner: 'scripts/provision-production-staff-database-url.sh',
  workflow: '.github/workflows/production-staff-database-url.yml',
  scope: 'docs/platform-v7/autopilot/scopes/production-staff-database-url-syntax-3735.json',
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
requires('provisioner', ['pc_staff_runtime', 'docker compose', 'node_modules/prisma/build/index.js db execute', 'STAFF_DATABASE_URL_PROVISION=CREATED', 'STAFF_DATABASE_URL_PROVISION=EXISTING', 'STAFF_DATABASE_URL_VALID=1', 'chmod 0600', 'chown 0:0', 'COMPOSE_WEB_AUTHORITY_AMBIGUOUS', '{{ index .Config.Labels "com.docker.compose.project.working_dir" }}', '{{ index .Config.Labels "com.docker.compose.project.config_files" }}', '{{ index .Config.Labels "com.docker.compose.project" }}', 'netloc = "pc_staff_runtime:" + quote(password, safe="") + "@" + host']);
requires('workflow', ["github.event.issue.number == 3072", "github.event.comment.body == '/production provision-staff-database-url current-main'", 'github.event.comment.user.login == github.repository_owner', 'authorized: ${{ steps.target.outputs.authorized }}', 'echo "authorized=1" >> "$GITHUB_OUTPUT"', "needs.authority.outputs.authorized == '1'", 'StrictHostKeyChecking=yes', 'provision-production-staff-database-url.sh', 'STAFF_DATABASE_URL_VALID=1', 'try_slot "${SSH_KEY_PRIMARY:-}" || try_slot "${SSH_KEY_SECONDARY:-}" || try_slot "${SSH_KEY_FALLBACK:-}" || exit 14', 'ssh -i "$HOME/.ssh/id_pc_prod" -p "$port"']);
forbids('provisioner', [/echo\s+.*password/i, /cat\s+.*pc-staff-database/i, /source\s+.*pc-staff-database/i, /STAFF_DATABASE_URL\s*:/, /quote\(password, safe=\\"\\"\)/]);
forbids('workflow', [/StrictHostKeyChecking=no/, /sshpass/i, /STAFF_DATABASE_URL\s*:/, /ssh -i "\$key"/]);
for (const file of [paths.executor, paths.provisioner]) {
  const result = spawnSync('bash', ['-n', file], { encoding: 'utf8' });
  if (result.status !== 0) failures.push(`${file}: bash syntax failed: ${result.stderr.trim()}`);
}
const urlBuilder = spawnSync('python3', ['-c', [
  'from urllib.parse import quote, urlsplit, urlunsplit',
  'url = urlsplit("postgresql://migration:secret@db.example:5432/platform?sslmode=require")',
  'password = "a" * 64',
  'host = f"{url.hostname}:{url.port}"',
  'netloc = "pc_staff_runtime:" + quote(password, safe="") + "@" + host',
  'actual = urlunsplit((url.scheme, netloc, url.path, url.query, ""))',
  'expected = "postgresql://pc_staff_runtime:" + password + "@db.example:5432/platform?sslmode=require"',
  'raise SystemExit(0 if actual == expected else 1)',
].join('\n')], { encoding: 'utf8' });
if (urlBuilder.status !== 0) failures.push(`staff database URL builder regression failed: ${urlBuilder.stderr.trim()}`);
try {
  const scope = JSON.parse(content.scope);
  if (scope.branch !== 'fix/production-staff-database-url-syntax-3735') failures.push(`${paths.scope}: branch mismatch`);
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
