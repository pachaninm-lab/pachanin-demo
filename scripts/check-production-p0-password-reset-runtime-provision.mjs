import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const paths = {
  executor: 'scripts/production-full-stack-exact-sha.sh',
  provisioner: 'scripts/provision-production-p0-password-reset-runtime.sh',
  workflow: '.github/workflows/production-p0-password-reset-runtime-provision.yml',
  checker: 'scripts/check-production-p0-password-reset-runtime-provision.mjs',
  scope: 'docs/platform-v7/autopilot/scopes/production-p0-password-reset-runtime-provision-3785.json',
};
const failures = [];
const content = {};
for (const [name, file] of Object.entries(paths)) {
  if (!fs.existsSync(file)) failures.push(`${file}: missing`);
  content[name] = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
}
const requireAll = (name, values) => values.forEach((value) => {
  if (!content[name].includes(value)) failures.push(`${paths[name]}: missing ${JSON.stringify(value)}`);
});
const forbid = (name, patterns) => patterns.forEach((pattern) => {
  if (pattern.test(content[name])) failures.push(`${paths[name]}: forbidden ${pattern}`);
});

requireAll('executor', [
  '.pc-password-reset-delivery.env',
  '.pc-transactional-mail.env',
  'PASSWORD_RESET_DELIVERY_KEY=[A-Fa-f0-9]{96}',
  'PASSWORD_RESET_DELIVERY_ENV_FILE_PERMISSIONS_INVALID',
  'TRANSACTIONAL_MAIL_ENV_FILE_PERMISSIONS_INVALID',
  'password_reset_delivery_env_file',
  'transactional_mail_env_file',
  'if [[ "$ACTION" == deploy ]]; then',
  'PASSWORD_RESET_RUNTIME_OVERRIDE_MODE_INVALID',
  'write_override "$API_IMAGE" "$WEB_IMAGE" "$MIGRATION_IMAGE" "$full_override" 1',
]);
const overrideStart = content.executor.indexOf('write_override()');
const overrideEnd = overrideStart === -1 ? -1 : content.executor.indexOf('\nYAML', overrideStart);
const override = overrideStart === -1 || overrideEnd === -1 ? '' : content.executor.slice(overrideStart, overrideEnd);
const apiStart = override.indexOf('  api:');
const webStart = override.indexOf('  web:');
const migrationStart = override.indexOf('  ${migration_service}:');
if (apiStart === -1 || webStart === -1 || migrationStart === -1 || !(apiStart < webStart && webStart < migrationStart)) {
  failures.push(`${paths.executor}: service override blocks are missing or reordered`);
} else {
  const apiBlock = override.slice(apiStart, webStart);
  const webBlock = override.slice(webStart, migrationStart);
  if (!apiBlock.includes('${password_reset_delivery_env_file}')) failures.push(`${paths.executor}: API does not consume the shared delivery key`);
  if (apiBlock.includes('${transactional_mail_env_file}')) failures.push(`${paths.executor}: API must not receive transactional mail credentials`);
  if (!webBlock.includes('${password_reset_delivery_env_file}') || !webBlock.includes('${transactional_mail_env_file}')) {
    failures.push(`${paths.executor}: Web does not consume both protected reset runtime files`);
  }
}
const rollbackStart = content.executor.indexOf('rollback_images()');
const rollbackEnd = rollbackStart === -1 ? -1 : content.executor.indexOf('\n}', rollbackStart);
const rollbackBlock = rollbackStart === -1 || rollbackEnd === -1 ? '' : content.executor.slice(rollbackStart, rollbackEnd);
if (!rollbackBlock.includes('write_override "$BASELINE_API_IMAGE" "$BASELINE_WEB_IMAGE" "$MIGRATION_IMAGE" "$full_override"')) {
  failures.push(`${paths.executor}: rollback does not restore the baseline override`);
}
if (rollbackBlock.includes('"$full_override" 1')) {
  failures.push(`${paths.executor}: rollback must not require or inject the new password-reset runtime files`);
}

requireAll('provisioner', [
  'openssl rand -hex 48',
  'PASSWORD_RESET_DELIVERY_KEY=%s',
  '.pc-password-reset-delivery.env',
  '.pc-transactional-mail.env',
  "stat -c '%a:%u:%g'",
  'chmod 0600',
  'chown 0:0',
  'MAIL_INPUT_CONTENT_INVALID',
  'PASSWORD_RESET_DELIVERY_PROVISION=%s',
  'TRANSACTIONAL_MAIL_PROVISION=%s',
  'TRANSACTIONAL_MAIL_CHANNEL=%s',
  'PASSWORD_RESET_RUNTIME_VALID=1',
  "docker ps -q --filter 'label=com.docker.compose.service=web'",
  'COMPOSE_WEB_AUTHORITY_AMBIGUOUS',
]);
requireAll('workflow', [
  'github.event.issue.number == 3072',
  "github.event.comment.body == '/production provision-password-reset-runtime current-main'",
  'github.event.comment.user.login == github.repository_owner',
  '[[ "$(git rev-parse HEAD)" == "$TARGET_SHA" ]]',
  '[[ "$(git rev-parse origin/main)" == "$TARGET_SHA" ]]',
  'ERROR_CODE=MAIL_CREDENTIALS_MISSING',
  'secrets.RESEND_API_KEY',
  'secrets.RESEND_FROM_EMAIL',
  'secrets.PC_SMTP_HOST',
  'secrets.PC_SMTP_USER',
  'secrets.PC_SMTP_PASS',
  'StrictHostKeyChecking=yes',
  'provision-production-p0-password-reset-runtime.sh',
  'PASSWORD_RESET_RUNTIME_VALID=1',
  'actions/upload-artifact@v4',
  'retention-days: 90',
  'publish_images:',
  'actions: write',
  'gh workflow run docker-publish.yml',
  'needs: [authority, provision, publish_images]',
  'uses: ./.github/workflows/production-full-stack-exact-sha.yml',
  'owner_release_authorized: true',
  'post_release_readiness:',
  "needs.release.result == 'success'",
  'POST_RELEASE_PASSWORD_RESET_READY|1|1|1|1|1',
  'docker inspect "$web_id" "$api_id" | python3 -c "$classifier"',
]);
forbid('provisioner', [
  /echo\s+.*key_material/i,
  /printf\s+.*RESEND_API_KEY=.*RESEND_API_KEY/i,
  /printf\s+.*PC_SMTP_PASS=.*PC_SMTP_PASS/i,
  /cat\s+.*pc-(?:password-reset|transactional-mail)/i,
  /source\s+.*pc-(?:password-reset|transactional-mail)/i,
  /set\s+-[A-Za-z]*x[A-Za-z]*/,
]);
forbid('workflow', [
  /StrictHostKeyChecking=no/,
  /sshpass/i,
  /set\s+-[A-Za-z]*x[A-Za-z]*/,
  /echo\s+.*(?:RESEND_API_KEY_SECRET|SMTP_PASS_SECRET)/i,
  /GITHUB_OUTPUT[^\n]*(?:RESEND_API_KEY|SMTP_PASS)/i,
]);

for (const file of [paths.executor, paths.provisioner]) {
  const result = spawnSync('bash', ['-n', file], { encoding: 'utf8' });
  if (result.status !== 0) failures.push(`${file}: bash -n failed: ${result.stderr.trim()}`);
}

const classifierStartMarker = "          read -r -d '' classifier <<'PY' || true\n";
const classifierEndMarker = '\n          PY\n';
const classifierStart = content.workflow.indexOf(classifierStartMarker);
const classifierEnd = classifierStart === -1 ? -1 : content.workflow.indexOf(
  classifierEndMarker,
  classifierStart + classifierStartMarker.length,
);
if (classifierStart === -1 || classifierEnd === -1) {
  failures.push(`${paths.workflow}: post-release readiness classifier missing`);
} else {
  const classifierSource = content.workflow
    .slice(classifierStart + classifierStartMarker.length, classifierEnd)
    .split('\n')
    .map((line) => line.startsWith('          ') ? line.slice(10) : line)
    .join('\n');
  const sharedKey = 'a'.repeat(96);
  const mailSentinel = 'fixture-mail-value-that-must-not-leak';
  const readyDocuments = [
    { Config: { Env: [
      'API_URL=http://api:3001',
      `PASSWORD_RESET_DELIVERY_KEY=${sharedKey}`,
      `RESEND_API_KEY=${mailSentinel}`,
      'RESEND_FROM_EMAIL=noreply@example.test',
    ] } },
    { Config: { Env: [`PASSWORD_RESET_DELIVERY_KEY=${sharedKey}`] } },
  ];
  const ready = spawnSync('python3', ['-c', classifierSource], {
    encoding: 'utf8',
    input: JSON.stringify(readyDocuments),
  });
  if (ready.status !== 0 || ready.stdout.trim() !== 'POST_RELEASE_PASSWORD_RESET_READY|1|1|1|1|1') {
    failures.push(`${paths.workflow}: post-release ready classifier regression: ${ready.stderr.trim()}`);
  }
  if (ready.stdout.includes(mailSentinel) || ready.stderr.includes(mailSentinel)) {
    failures.push(`${paths.workflow}: post-release classifier disclosed a protected value`);
  }
  readyDocuments[0].Config.Env = readyDocuments[0].Config.Env.filter((line) => !line.startsWith('RESEND_'));
  const missingMail = spawnSync('python3', ['-c', classifierSource], {
    encoding: 'utf8',
    input: JSON.stringify(readyDocuments),
  });
  if (missingMail.status !== 0 || missingMail.stdout.trim() !== 'POST_RELEASE_PASSWORD_RESET_READY|1|1|1|1|0') {
    failures.push(`${paths.workflow}: post-release missing-mail classifier regression`);
  }
}

const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'pc-password-reset-runtime-'));
const fixtureBin = path.join(fixtureRoot, 'bin');
fs.mkdirSync(fixtureBin);
fs.writeFileSync(path.join(fixtureBin, 'chown'), '#!/usr/bin/env bash\nexit 0\n', { mode: 0o700 });
fs.writeFileSync(path.join(fixtureBin, 'stat'), `#!/usr/bin/env bash
set -Eeuo pipefail
if [[ "$#" == 3 && "$1" == -c && "$2" == '%a:%u:%g' ]]; then
  mode="$(/usr/bin/stat -c '%a' "$3")"
  printf '%s:0:0\\n' "$mode"
  exit 0
fi
exec /usr/bin/stat "$@"
`, { mode: 0o700 });
fs.writeFileSync(path.join(fixtureBin, 'install'), `#!/usr/bin/env bash
set -Eeuo pipefail
mode=''
source_file=''
destination=''
while (( "$#" )); do
  case "$1" in
    -m) mode="$2"; shift 2 ;;
    -o|-g) shift 2 ;;
    *) if [[ -z "$source_file" ]]; then source_file="$1"; else destination="$1"; fi; shift ;;
  esac
done
[[ -n "$mode" && -n "$source_file" && -n "$destination" ]]
exec /usr/bin/install -m "$mode" "$source_file" "$destination"
`, { mode: 0o700 });
const inputPaths = [];
const resendFixtureName = ['RESEND', 'API', 'KEY'].join('_');
const smtpFixturePasswordName = ['PC', 'SMTP', 'PASS'].join('_');
const fixtureCredential = (prefix) => `${prefix}_${'x'.repeat(32)}`;
const runFixture = ({ name, mail, expectedChannel, expectSuccess }) => {
  const productionDir = path.join(fixtureRoot, name);
  fs.mkdirSync(productionDir);
  const input = path.join(os.tmpdir(), `pc-password-reset-mail-${process.pid}-${name}.env`);
  inputPaths.push(input);
  fs.writeFileSync(input, mail, { mode: 0o600 });
  fs.chmodSync(input, 0o600);
  const secretSentinels = mail.split('\n').filter(Boolean).map((line) => line.split('=', 2)[1]).filter(Boolean);
  const result = spawnSync('bash', [paths.provisioner, 'provision', input], {
    encoding: 'utf8',
    env: {
      ...process.env,
      PATH: `${fixtureBin}:${process.env.PATH}`,
      PC_PROD_DIR_B64: Buffer.from(productionDir).toString('base64'),
    },
  });
  const output = `${result.stdout}\n${result.stderr}`;
  for (const sentinel of secretSentinels) {
    if (output.includes(sentinel)) failures.push(`${paths.provisioner}: ${name} fixture disclosed protected input`);
  }
  if (!expectSuccess) {
    if (result.status === 0) failures.push(`${paths.provisioner}: ${name} invalid fixture unexpectedly passed`);
    if (fs.existsSync(path.join(productionDir, '.pc-password-reset-delivery.env'))
      || fs.existsSync(path.join(productionDir, '.pc-transactional-mail.env'))) {
      failures.push(`${paths.provisioner}: ${name} invalid fixture mutated runtime files`);
    }
    return;
  }
  if (result.status !== 0 || !result.stdout.includes('PASSWORD_RESET_RUNTIME_VALID=1')
    || !result.stdout.includes(`TRANSACTIONAL_MAIL_CHANNEL=${expectedChannel}`)) {
    failures.push(`${paths.provisioner}: ${name} fixture failed: ${result.stderr.trim()}`);
    return;
  }
  const delivery = path.join(productionDir, '.pc-password-reset-delivery.env');
  const mailFile = path.join(productionDir, '.pc-transactional-mail.env');
  for (const file of [delivery, mailFile]) {
    if (!fs.existsSync(file) || (fs.statSync(file).mode & 0o777) !== 0o600) failures.push(`${paths.provisioner}: ${name} protected file mode regression`);
  }
  if (!/^PASSWORD_RESET_DELIVERY_KEY=[A-Fa-f0-9]{96}\n$/.test(fs.readFileSync(delivery, 'utf8'))) {
    failures.push(`${paths.provisioner}: ${name} delivery key format regression`);
  }
  const second = spawnSync('bash', [paths.provisioner, 'provision', input], {
    encoding: 'utf8',
    env: {
      ...process.env,
      PATH: `${fixtureBin}:${process.env.PATH}`,
      PC_PROD_DIR_B64: Buffer.from(productionDir).toString('base64'),
    },
  });
  if (second.status !== 0 || !second.stdout.includes('PASSWORD_RESET_DELIVERY_PROVISION=EXISTING')
    || !second.stdout.includes('TRANSACTIONAL_MAIL_PROVISION=EXISTING')) {
    failures.push(`${paths.provisioner}: ${name} idempotence regression: ${second.stderr.trim()}`);
  }
};

try {
  runFixture({
    name: 'resend',
    mail: `${resendFixtureName}=${fixtureCredential('resend')}\nRESEND_FROM_EMAIL=noreply@example.test\n`,
    expectedChannel: 'RESEND',
    expectSuccess: true,
  });
  runFixture({
    name: 'smtp',
    mail: `PC_SMTP_HOST=smtp.example.test\nPC_SMTP_USER=mailer@example.test\n${smtpFixturePasswordName}=${fixtureCredential('smtp')}\nPC_SMTP_PORT=465\n`,
    expectedChannel: 'SMTP',
    expectSuccess: true,
  });
  runFixture({
    name: 'invalid',
    mail: 'RESEND_API_KEY=invalid#secret\nRESEND_FROM_EMAIL=noreply@example.test\n',
    expectedChannel: '',
    expectSuccess: false,
  });
} finally {
  for (const file of inputPaths) fs.rmSync(file, { force: true });
  fs.rmSync(fixtureRoot, { recursive: true, force: true });
}

try {
  const scope = JSON.parse(content.scope || '{}');
  if (scope.branch !== 'fix/p0-password-reset-runtime-provision-3785') failures.push(`${paths.scope}: branch mismatch`);
  if (scope.productionHosting !== 'REG_RU_EXISTING_INFRASTRUCTURE_ONLY') failures.push(`${paths.scope}: production hosting mismatch`);
  if (scope.boundaries?.newRecurringCostRub !== 0) failures.push(`${paths.scope}: recurring cost must be zero`);
  if (scope.boundaries?.ownerOnly !== true || scope.boundaries?.exactMainGuard !== true) failures.push(`${paths.scope}: owner/exact-main boundary missing`);
  if (JSON.stringify(scope.allowedPaths) !== JSON.stringify(Object.values(paths).sort())) {
    failures.push(`${paths.scope}: allowed paths must exactly match the governed implementation paths`);
  }
} catch (error) {
  failures.push(`${paths.scope}: invalid JSON: ${error.message}`);
}

if (failures.length) {
  console.error('Production P0 password-reset runtime provision contract failed:');
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}
console.log('PASS: owner-only exact-main provisioning creates or validates a shared 0600 password-reset delivery key and Web-only 0600 transactional mail channel without secret disclosure; exact releases consume them with zero new recurring cost.');
