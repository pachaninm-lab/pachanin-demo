import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

const paths = {
  executor: 'scripts/production-full-stack-exact-sha.sh',
  provisioner: 'scripts/provision-production-staff-database-url.sh',
  workflow: '.github/workflows/production-staff-database-url.yml',
  scope: 'docs/platform-v7/autopilot/scopes/production-staff-database-nul-3739.json',
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
const extractPythonBlock = (startMarker, endMarker, label) => {
  const start = content.provisioner.indexOf(startMarker);
  const end = start === -1 ? -1 : content.provisioner.indexOf(endMarker, start + startMarker.length);
  if (start === -1 || end === -1) {
    failures.push('staff database ' + label + ' Python block is missing');
    return '';
  }
  return content.provisioner.slice(start + startMarker.length, end);
};
const nulSplit = 'split(b"\\0", 1)';
const escapedNulSplit = 'split(b"\\\\0", 1)';
if ((content.provisioner.split(nulSplit).length - 1) !== 2) failures.push('staff database provisioner must split both NUL-delimited inputs');
if (content.provisioner.includes(escapedNulSplit)) failures.push('staff database provisioner retains an escaped NUL delimiter');
const password = 'a'.repeat(64);
const urlBuilderSource = extractPythonBlock(
  'staff_url="$(printf \'%s\\0%s\' "$migration_url" "$password" | python3 -c \'\n',
  '\n\')" || fail STAFF_DATABASE_URL_BUILD_FAILED 12',
  'URL builder',
);
const urlBuilder = spawnSync('python3', ['-c', urlBuilderSource], {
  encoding: 'utf8',
  input: Buffer.concat([Buffer.from('postgresql://migration:secret@db.example:5432/platform?sslmode=require'), Buffer.from([0]), Buffer.from(password)]),
});
const expectedUrl = 'postgresql://pc_staff_runtime:' + password + '@db.example:5432/platform?sslmode=require';
if (urlBuilder.status !== 0 || urlBuilder.stdout.trim() !== expectedUrl) failures.push('staff database URL builder regression failed: ' + urlBuilder.stderr.trim());
const sqlBuilderSource = extractPythonBlock(
  'sql="$(printf \'%s\\0\' "$password" | python3 -c \'\n',
  '\n\')" || fail STAFF_RUNTIME_SQL_BUILD_FAILED 13',
  'SQL builder',
);
const sqlBuilder = spawnSync('python3', ['-c', sqlBuilderSource], {
  encoding: 'utf8',
  input: Buffer.concat([Buffer.from(password), Buffer.from([0])]),
});
if (sqlBuilder.status !== 0 || !sqlBuilder.stdout.includes('ALTER ROLE pc_staff_runtime') || sqlBuilder.stdout.includes('\0')) failures.push('staff database SQL builder regression failed: ' + sqlBuilder.stderr.trim());
try {
  const scope = JSON.parse(content.scope);
  if (scope.branch !== 'fix/production-staff-database-nul-3739') failures.push(`${paths.scope}: branch mismatch`);
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
