import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const paths = {
  executor: 'scripts/production-full-stack-exact-sha.sh',
  provisioner: 'scripts/provision-production-gekta-runtime.sh',
  workflow: '.github/workflows/production-p0-password-reset-runtime-provision.yml',
  checker: 'scripts/check-production-gekta-runtime-provision.mjs',
  scope: 'docs/platform-v7/autopilot/scopes/production-gekta-runtime-20260813.json',
};
const additionalGovernedPaths = [
  '.github/workflows/production-gekta-first-user-acceptance.yml',
  'docs/ops/production-gekta-first-user-acceptance.md',
  'scripts/check-production-gekta-first-user-acceptance.mjs',
  'scripts/production-gekta-first-user-acceptance.mjs',
  'scripts/production-web-live-acceptance.sh',
];
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
  '.pc-gekta-api-runtime.env',
  '.pc-gekta-web-runtime.env',
  'GEKTA_API_RUNTIME_ENV_FILE_PERMISSIONS_INVALID',
  'GEKTA_WEB_RUNTIME_ENV_FILE_PERMISSIONS_INVALID',
  "{'GEKTA_PHONE_ENCRYPTION_KEY', 'GEKTA_PHONE_LOOKUP_PEPPER'}",
  "{'MFA_LOGIN_TICKET_SECRET', 'GEKTA_ANONYMOUS_SESSION_SECRET'}",
  "values['MFA_LOGIN_TICKET_SECRET'] == values['GEKTA_ANONYMOUS_SESSION_SECRET']",
  'GEKTA_RUNTIME_PURPOSE_SEPARATION_INVALID',
  'resolve_gekta_runtime_env_files',
  'gekta_api_runtime_env_file',
  'gekta_web_runtime_env_file',
  'if [[ "$ACTION" == deploy ]]; then',
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
  if (!apiBlock.includes('${gekta_api_runtime_env_file}')) failures.push(`${paths.executor}: API does not consume its Gekta runtime file`);
  if (apiBlock.includes('${gekta_web_runtime_env_file}')) failures.push(`${paths.executor}: API receives Web-only Gekta secrets`);
  if (!webBlock.includes('${gekta_web_runtime_env_file}')) failures.push(`${paths.executor}: Web does not consume its Gekta runtime file`);
  if (webBlock.includes('${gekta_api_runtime_env_file}')) failures.push(`${paths.executor}: Web receives API-only phone secrets`);
}
const rollbackStart = content.executor.indexOf('rollback_images()');
const rollbackEnd = rollbackStart === -1 ? -1 : content.executor.indexOf('\n}', rollbackStart);
const rollbackBlock = rollbackStart === -1 || rollbackEnd === -1 ? '' : content.executor.slice(rollbackStart, rollbackEnd);
if (rollbackBlock.includes('"$full_override" 1')) failures.push(`${paths.executor}: rollback must not require or inject Gekta runtime files`);

requireAll('provisioner', [
  'openssl rand -hex 32',
  'openssl rand -hex 48',
  'GEKTA_PHONE_ENCRYPTION_KEY=%s',
  'GEKTA_PHONE_LOOKUP_PEPPER=%s',
  'MFA_LOGIN_TICKET_SECRET=%s',
  'GEKTA_ANONYMOUS_SESSION_SECRET=%s',
  '.pc-gekta-api-runtime.env',
  '.pc-gekta-web-runtime.env',
  "stat -c '%a:%u:%g'",
  'chmod 0600',
  'chown 0:0',
  'RUNTIME_AUTHORITY_CONFLICT',
  'valid_purpose_separation',
  'PC_RECONCILE_ACTIVE_RUNTIME',
  "docker ps -q --filter 'label=com.docker.compose.service=web'",
  'GEKTA_API_RUNTIME_PROVISION=%s',
  'GEKTA_WEB_RUNTIME_PROVISION=%s',
  'GEKTA_RUNTIME_VALID=1',
  'GEKTA_RUNTIME_AUTHORITY_RECONCILED=%s',
]);
if ((content.provisioner.match(/openssl rand -hex 32/g) || []).length !== 1) {
  failures.push(`${paths.provisioner}: must generate exactly one 32-byte phone encryption key`);
}
if ((content.provisioner.match(/openssl rand -hex 48/g) || []).length !== 3) {
  failures.push(`${paths.provisioner}: must generate exactly three independent 48-byte purpose secrets`);
}
requireAll('workflow', [
  'github.event.issue.number == 3072',
  "github.event.comment.body == '/production provision-gekta-runtime current-main'",
  'github.event.comment.user.login == github.repository_owner',
  'TARGET_SHA: ${{ github.sha }}',
  '[[ "$TARGET_SHA" == "$target_sha" ]]',
  '[[ "$(git rev-parse HEAD)" == "$TARGET_SHA" ]]',
  '[[ "$(git rev-parse origin/main)" == "$TARGET_SHA" ]]',
  'node scripts/check-production-gekta-runtime-provision.mjs',
  'scripts/provision-production-gekta-runtime.sh',
  'PC_PROD_DIR_B64=',
  'PC_RECONCILE_ACTIVE_RUNTIME=1',
  'StrictHostKeyChecking=yes',
  'GEKTA_API_RUNTIME_PROVISION=(CREATED|EXISTING)',
  'GEKTA_WEB_RUNTIME_PROVISION=(CREATED|EXISTING)',
  'GEKTA_RUNTIME_VALID=1',
  'GEKTA_RUNTIME_AUTHORITY_RECONCILED=[01]',
  'needs: [authority, provision, publish_images]',
  'uses: ./.github/workflows/production-full-stack-exact-sha.yml',
  'owner_release_authorized: true',
  'POST_RELEASE_GEKTA_RUNTIME_READY|1|1|1|1|1|1|1',
  "api.get('GEKTA_PHONE_ENCRYPTION_KEY', '').strip()",
  "web.get('MFA_LOGIN_TICKET_SECRET', '').strip()",
  'api_isolated',
  'web_isolated',
  'purpose_keys_distinct',
  'actions/upload-artifact@v4',
  'retention-days: 90',
]);
if ((content.workflow.match(/TARGET_SHA: \$\{\{ github\.sha \}\}/g) || []).length !== 4) {
  failures.push(`${paths.workflow}: every exact-SHA job must consume the immutable issue-comment event SHA directly`);
}
if (/needs\.authority\.outputs\.target_sha|steps\.target\.outputs\.sha|echo\s+["']sha=.*GITHUB_OUTPUT/.test(content.workflow)) {
  failures.push(`${paths.workflow}: exact SHA must not cross a job-output secret-masking boundary`);
}
forbid('provisioner', [
  /cat\s+.*pc-gekta/i,
  /source\s+.*pc-gekta/i,
  /set\s+-[A-Za-z]*x[A-Za-z]*/,
]);
forbid('workflow', [
  /195\.19\.12\.120/,
  /StrictHostKeyChecking=no/,
  /sshpass/i,
  /set\s+-[A-Za-z]*x[A-Za-z]*/,
  /docker\s+inspect[^\n]*\|\s*(?:cat|tee)/i,
]);

for (const file of [paths.executor, paths.provisioner]) {
  const result = spawnSync('bash', ['-n', file], { encoding: 'utf8' });
  if (result.status !== 0) failures.push(`${file}: bash -n failed: ${result.stderr.trim()}`);
}

const classifierStartMarker = "          read -r -d '' gekta_classifier <<'PY' || true\n";
const classifierEndMarker = '\n          PY\n';
const classifierStart = content.workflow.indexOf(classifierStartMarker);
const classifierEnd = classifierStart === -1 ? -1 : content.workflow.indexOf(
  classifierEndMarker,
  classifierStart + classifierStartMarker.length,
);
if (classifierStart === -1 || classifierEnd === -1) {
  failures.push(`${paths.workflow}: post-release Gekta classifier missing`);
} else {
  const classifierSource = content.workflow
    .slice(classifierStart + classifierStartMarker.length, classifierEnd)
    .split('\n')
    .map((line) => line.startsWith('          ') ? line.slice(10) : line)
    .join('\n');
  const mfa = 'a'.repeat(96);
  const anonymous = 'b'.repeat(96);
  const phoneKey = 'c'.repeat(64);
  const pepper = 'd'.repeat(96);
  const readyDocuments = [
    { Config: { Env: [`MFA_LOGIN_TICKET_SECRET=${mfa}`, `GEKTA_ANONYMOUS_SESSION_SECRET=${anonymous}`] } },
    { Config: { Env: [`GEKTA_PHONE_ENCRYPTION_KEY=${phoneKey}`, `GEKTA_PHONE_LOOKUP_PEPPER=${pepper}`] } },
  ];
  const runClassifier = (documents) => spawnSync('python3', ['-c', classifierSource], {
    encoding: 'utf8',
    input: JSON.stringify(documents),
  });
  const ready = runClassifier(readyDocuments);
  if (ready.status !== 0 || ready.stdout.trim() !== 'POST_RELEASE_GEKTA_RUNTIME_READY|1|1|1|1|1|1|1') {
    failures.push(`${paths.workflow}: post-release ready classifier regression: ${ready.stderr.trim()}`);
  }
  for (const sentinel of [mfa, anonymous, phoneKey, pepper]) {
    if (ready.stdout.includes(sentinel) || ready.stderr.includes(sentinel)) failures.push(`${paths.workflow}: Gekta classifier disclosed a protected value`);
  }
  const missingPepper = JSON.parse(JSON.stringify(readyDocuments));
  missingPepper[1].Config.Env = missingPepper[1].Config.Env.filter((line) => !line.startsWith('GEKTA_PHONE_LOOKUP_PEPPER='));
  if (runClassifier(missingPepper).stdout.trim() !== 'POST_RELEASE_GEKTA_RUNTIME_READY|1|1|0|1|0|1|1') {
    failures.push(`${paths.workflow}: missing phone pepper classifier regression`);
  }
  const leakedWebSecret = JSON.parse(JSON.stringify(readyDocuments));
  leakedWebSecret[1].Config.Env.push(`MFA_LOGIN_TICKET_SECRET=${mfa}`);
  if (runClassifier(leakedWebSecret).stdout.trim() !== 'POST_RELEASE_GEKTA_RUNTIME_READY|1|1|1|1|1|0|1') {
    failures.push(`${paths.workflow}: least-privilege classifier regression`);
  }
}

const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'pc-gekta-runtime-'));
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
fs.writeFileSync(path.join(fixtureBin, 'docker'), `#!/usr/bin/env bash
set -Eeuo pipefail
if [[ "$1" == ps ]]; then
  printf 'fixture-web-id\\n'
  exit 0
fi
if [[ "$1" == inspect ]]; then
  [[ -n "\${PC_FIXTURE_ACTIVE_DIR:-}" ]]
  printf '%s\\n' "$PC_FIXTURE_ACTIVE_DIR"
  exit 0
fi
exit 1
`, { mode: 0o700 });

const runtime = (seed) => {
  const alphabet = '0123456789abcdef';
  const index = alphabet.indexOf(seed);
  if (index < 0) throw new Error(`invalid fixture seed: ${seed}`);
  const pepper = alphabet[(index + 1) % alphabet.length];
  const mfa = alphabet[(index + 2) % alphabet.length];
  const anonymous = alphabet[(index + 3) % alphabet.length];
  return {
    api: `GEKTA_PHONE_ENCRYPTION_KEY=${seed.repeat(64)}\nGEKTA_PHONE_LOOKUP_PEPPER=${pepper.repeat(96)}\n`,
    web: `MFA_LOGIN_TICKET_SECRET=${mfa.repeat(96)}\nGEKTA_ANONYMOUS_SESSION_SECRET=${anonymous.repeat(96)}\n`,
  };
};
const writeRuntime = (directory, values, apiMode = 0o600, webMode = 0o600) => {
  const api = path.join(directory, '.pc-gekta-api-runtime.env');
  const web = path.join(directory, '.pc-gekta-web-runtime.env');
  fs.writeFileSync(api, values.api, { mode: apiMode });
  fs.writeFileSync(web, values.web, { mode: webMode });
  fs.chmodSync(api, apiMode);
  fs.chmodSync(web, webMode);
  return { api, web };
};
const runProvisioner = (productionDir, extraEnv = {}) => spawnSync('bash', [paths.provisioner, 'provision'], {
  encoding: 'utf8',
  env: {
    ...process.env,
    PATH: `${fixtureBin}:${process.env.PATH}`,
    PC_PROD_DIR_B64: Buffer.from(productionDir).toString('base64'),
    ...extraEnv,
  },
});

try {
  const createdDir = path.join(fixtureRoot, 'created');
  fs.mkdirSync(createdDir);
  const created = runProvisioner(createdDir);
  if (created.status !== 0 || !created.stdout.includes('GEKTA_RUNTIME_VALID=1')
    || !created.stdout.includes('GEKTA_API_RUNTIME_PROVISION=CREATED')
    || !created.stdout.includes('GEKTA_WEB_RUNTIME_PROVISION=CREATED')) {
    failures.push(`${paths.provisioner}: creation fixture failed: ${created.stderr.trim()}`);
  } else {
    const apiFile = path.join(createdDir, '.pc-gekta-api-runtime.env');
    const webFile = path.join(createdDir, '.pc-gekta-web-runtime.env');
    const api = fs.readFileSync(apiFile, 'utf8');
    const web = fs.readFileSync(webFile, 'utf8');
    const apiMatch = /^GEKTA_PHONE_ENCRYPTION_KEY=([A-Fa-f0-9]{64})\nGEKTA_PHONE_LOOKUP_PEPPER=([A-Fa-f0-9]{96})\n$/.exec(api);
    const webMatch = /^MFA_LOGIN_TICKET_SECRET=([A-Fa-f0-9]{96})\nGEKTA_ANONYMOUS_SESSION_SECRET=([A-Fa-f0-9]{96})\n$/.exec(web);
    if (!apiMatch || !webMatch || new Set([apiMatch?.[2], webMatch?.[1], webMatch?.[2]]).size !== 3) {
      failures.push(`${paths.provisioner}: generated purpose/format separation regression`);
    }
    for (const file of [apiFile, webFile]) {
      if ((fs.statSync(file).mode & 0o777) !== 0o600) failures.push(`${paths.provisioner}: generated file mode regression`);
    }
    for (const value of [...(apiMatch?.slice(1) ?? []), ...(webMatch?.slice(1) ?? [])]) {
      if (created.stdout.includes(value) || created.stderr.includes(value)) failures.push(`${paths.provisioner}: generated secret disclosed`);
    }
    const second = runProvisioner(createdDir);
    if (second.status !== 0 || !second.stdout.includes('GEKTA_API_RUNTIME_PROVISION=EXISTING')
      || fs.readFileSync(apiFile, 'utf8') !== api || fs.readFileSync(webFile, 'utf8') !== web) {
      failures.push(`${paths.provisioner}: idempotence fixture failed: ${second.stderr.trim()}`);
    }
  }

  const invalidDir = path.join(fixtureRoot, 'invalid');
  fs.mkdirSync(invalidDir);
  const invalidValues = runtime('e');
  const invalidFiles = writeRuntime(invalidDir, invalidValues, 0o644, 0o600);
  const invalid = runProvisioner(invalidDir);
  if (invalid.status === 0 || fs.readFileSync(invalidFiles.api, 'utf8') !== invalidValues.api
    || fs.readFileSync(invalidFiles.web, 'utf8') !== invalidValues.web) {
    failures.push(`${paths.provisioner}: unsafe existing runtime was accepted or mutated`);
  }

  const incompleteDir = path.join(fixtureRoot, 'incomplete');
  fs.mkdirSync(incompleteDir);
  const incompleteApi = path.join(incompleteDir, '.pc-gekta-api-runtime.env');
  fs.writeFileSync(incompleteApi, runtime('f').api, { mode: 0o600 });
  const incomplete = runProvisioner(incompleteDir);
  if (incomplete.status === 0 || fs.existsSync(path.join(incompleteDir, '.pc-gekta-web-runtime.env'))) {
    failures.push(`${paths.provisioner}: incomplete canonical pair did not fail closed`);
  }

  const activeDir = path.join(fixtureRoot, 'active');
  const canonicalDir = path.join(fixtureRoot, 'canonical');
  fs.mkdirSync(activeDir);
  fs.mkdirSync(canonicalDir);
  const activeValues = runtime('1');
  writeRuntime(activeDir, activeValues);
  const reconciled = runProvisioner(canonicalDir, {
    PC_RECONCILE_ACTIVE_RUNTIME: '1',
    PC_FIXTURE_ACTIVE_DIR: activeDir,
  });
  if (reconciled.status !== 0 || !reconciled.stdout.includes('GEKTA_RUNTIME_AUTHORITY_RECONCILED=1')) {
    failures.push(`${paths.provisioner}: authority reconciliation failed: ${reconciled.stderr.trim()}`);
  } else {
    const canonicalApi = path.join(canonicalDir, '.pc-gekta-api-runtime.env');
    const canonicalWeb = path.join(canonicalDir, '.pc-gekta-web-runtime.env');
    if (fs.readFileSync(canonicalApi, 'utf8') !== activeValues.api || fs.readFileSync(canonicalWeb, 'utf8') !== activeValues.web
      || fs.existsSync(path.join(activeDir, '.pc-gekta-api-runtime.env')) || fs.existsSync(path.join(activeDir, '.pc-gekta-web-runtime.env'))) {
      failures.push(`${paths.provisioner}: authority reconciliation regenerated or duplicated protected values`);
    }
  }

  const conflictActive = path.join(fixtureRoot, 'conflict-active');
  const conflictCanonical = path.join(fixtureRoot, 'conflict-canonical');
  fs.mkdirSync(conflictActive);
  fs.mkdirSync(conflictCanonical);
  const activeConflictValues = runtime('3');
  const canonicalConflictValues = runtime('5');
  const activeConflictFiles = writeRuntime(conflictActive, activeConflictValues);
  const canonicalConflictFiles = writeRuntime(conflictCanonical, canonicalConflictValues);
  const conflict = runProvisioner(conflictCanonical, {
    PC_RECONCILE_ACTIVE_RUNTIME: '1',
    PC_FIXTURE_ACTIVE_DIR: conflictActive,
  });
  if (conflict.status === 0 || !conflict.stderr.includes('ERROR_CODE=RUNTIME_AUTHORITY_CONFLICT')
    || fs.readFileSync(activeConflictFiles.api, 'utf8') !== activeConflictValues.api
    || fs.readFileSync(canonicalConflictFiles.api, 'utf8') !== canonicalConflictValues.api
    || !fs.existsSync(activeConflictFiles.web) || !fs.existsSync(canonicalConflictFiles.web)) {
    failures.push(`${paths.provisioner}: conflicting authorities were not preserved fail-closed`);
  }
} finally {
  fs.rmSync(fixtureRoot, { recursive: true, force: true });
}

try {
  const scope = JSON.parse(content.scope || '{}');
  if (scope.branch !== 'ops/production-gekta-runtime-20260813') failures.push(`${paths.scope}: branch mismatch`);
  if (scope.productionHosting !== 'REG_RU_EXISTING_INFRASTRUCTURE_ONLY') failures.push(`${paths.scope}: production hosting mismatch`);
  if (scope.boundaries?.newRecurringCostRub !== 0) failures.push(`${paths.scope}: recurring cost must be zero`);
  if (scope.boundaries?.databaseMutation !== 'EXACT_RELEASE_MIGRATIONS_AND_SYNTHETIC_GEKTA_ACCEPTANCE_ONLY'
    || scope.boundaries?.sessionMutation !== true || scope.boundaries?.mfaMutation !== true
    || scope.boundaries?.syntheticAccountMutation !== true || scope.boundaries?.ownerEntitlementMutation !== true) {
    failures.push(`${paths.scope}: exact release and synthetic acceptance mutation boundary missing`);
  }
  if (scope.boundaries?.ownerOnly !== true || scope.boundaries?.exactMainGuard !== true
    || scope.boundaries?.credentialOutput !== false || scope.boundaries?.piiOutput !== false) {
    failures.push(`${paths.scope}: owner/exact-main/no-disclosure boundary missing`);
  }
  const acceptance = Array.isArray(scope.acceptance) ? scope.acceptance.join('\n') : '';
  if (!acceptance.includes('MFA_LOGIN_TICKET_SECRET') || !acceptance.includes('GEKTA_PHONE_ENCRYPTION_KEY')
    || !acceptance.includes('least privilege') || !acceptance.includes('current DNS IPv4 answers')) {
    failures.push(`${paths.scope}: Gekta keys, isolation or protected-host acceptance is missing`);
  }
  if (JSON.stringify(scope.allowedPaths) !== JSON.stringify([...Object.values(paths), ...additionalGovernedPaths].sort())) {
    failures.push(`${paths.scope}: allowed paths must exactly match the governed implementation paths`);
  }
} catch (error) {
  failures.push(`${paths.scope}: invalid JSON: ${error.message}`);
}

if (failures.length) {
  console.error('Production Gekta runtime provision contract failed:');
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}
console.log('PASS: owner-only exact-main provisioning creates or validates isolated root-owned Gekta API/Web runtime files, preserves existing key authority, releases exact images and proves post-release readiness without secret disclosure.');
