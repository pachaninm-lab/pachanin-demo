import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const paths = {
  executor: 'scripts/production-full-stack-exact-sha.sh',
  provisioner: 'scripts/provision-production-auth-opaque-token-key.sh',
  checker: 'scripts/check-production-auth-opaque-token-provision.mjs',
  workflow: '.github/workflows/production-auth-opaque-token-key.yml',
  scope: 'docs/platform-v7/autopilot/scopes/production-auth-key-provision-3723.json',
};
const derivationLabel = 'pc-auth-generic-hash-pepper:v1';
const failures = [];
const content = {};
for (const [name, filePath] of Object.entries(paths)) {
  if (!fs.existsSync(filePath)) failures.push(`${filePath}: missing`);
  else content[name] = fs.readFileSync(filePath, 'utf8');
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
  'AUTH_OPAQUE_TOKEN_ENV_FILE_PERMISSIONS_INVALID',
  'AUTH_OPAQUE_TOKEN_ENV_FILE_CONTENT_INVALID',
  "stat -c '%a:%u:%g'",
  'if len(lines) != 2:',
  'AUTH_OPAQUE_TOKEN_DIGEST_KEY=([A-Fa-f0-9]{64,})',
  'AUTH_TOKEN_PEPPER=([a-f0-9]{64})',
  derivationLabel,
  'hmac.compare_digest',
  'env_file:',
  '- ${auth_opaque_token_env_file}',
  'verify_api_auth_hash_keys',
  "process.env.AUTH_TOKEN_PEPPER",
  "process.stdout.write('API_AUTH_HASH_KEYS=VALID\\n')",
  'verify_api_auth_hash_keys "$new_api_id" || fail API_AUTH_HASH_KEYS_INVALID 77',
]);
requireAll('provisioner', [
  derivationLabel,
  'EXISTING_OPAQUE_KEY_FILE_MISSING',
  'active_authority_relationship',
  "['docker', 'inspect', container_id]",
  'read_only_impact_preflight',
  'default_transaction_read_only=on',
  "current_setting('transaction_read_only') = 'on'",
  "has_table_privilege(current_user, 'auth.login_throttles', 'SELECT')",
  "has_table_privilege(current_user, 'auth.registration_applications', 'SELECT')",
  "has_table_privilege(current_user, 'auth.registration_public_attempts', 'SELECT')",
  "has_table_privilege(current_user, 'auth.organization_invitations', 'SELECT')",
  "has_table_privilege(current_user, 'auth.organization_membership_command_events', 'SELECT')",
  "has_table_privilege(current_user, 'auth.mfa_recovery_challenges', 'SELECT')",
  'AUTH_HASH_IMPACT_PREFLIGHT=SAFE_EMPTY_PERSISTED_GENERIC_HASH_STATE',
  'AUTH_HASH_IMPACT_PREFLIGHT=NO_MUTATION_CURRENT_AUTHORITY',
  'ACTIVE_PRODUCTION_REVISION=%s',
  "expected_shape == 'legacy'",
  "expected_shape == 'current'",
  'write_current_file "$key_file" "$temporary_file"',
  'os.O_NOFOLLOW',
  'os.write(descriptor, payload) != len(payload)',
  'hmac.compare_digest',
  'chmod 0600',
  'chown 0:0',
  "provision_state='MIGRATED'",
  "provision_state='EXISTING'",
  'AUTH_OPAQUE_TOKEN_KEY_PROVISION=EXISTING',
  'AUTH_GENERIC_HASH_PEPPER_PROVISION=%s',
  'AUTH_OPAQUE_TOKEN_KEY_VALID=1',
  'AUTH_GENERIC_HASH_PEPPER_VALID=1',
  'AUTH_KEY_MATERIAL_DISCLOSURE=NONE',
  'EXISTING_KEY_FILE_INVALID',
  "docker ps -q --filter 'label=com.docker.compose.service=web'",
  "--filter 'label=com.docker.compose.service=api'",
  'COMPOSE_WEB_AUTHORITY_AMBIGUOUS',
  'COMPOSE_API_AUTHORITY_AMBIGUOUS',
  'ACTIVE_REVISION_PARITY_INVALID',
  'com.docker.compose.project.working_dir',
  '[[ -z "${1:-}" ]] && return 0',
]);
requireAll('workflow', [
  'github.event.issue.number == 3072',
  "github.event.comment.body == '/production provision-auth-opaque-token-key current-main'",
  'github.event.comment.user.login == github.repository_owner',
  'StrictHostKeyChecking=yes',
  'scp_common=',
  'ssh_common=',
  '-p "$PORT"',
  'provision-production-auth-opaque-token-key.sh',
  'git fetch --no-tags origin main',
  '[[ "$(git rev-parse HEAD)" == "$TARGET_SHA" ]]',
  '[[ "$(git rev-parse origin/main)" == "$TARGET_SHA" ]]',
  'assert_bounded_worktree(){',
  'git diff --no-ext-diff --quiet --',
  'git diff --cached --no-ext-diff --quiet --',
  "while IFS= read -r -d '' untracked; do",
  '[[ "$untracked" == "$EVIDENCE_DIR/"* ]]',
  'git ls-files --others --exclude-standard -z',
  'git merge-base --is-ancestor "$active_revision" "$TARGET_SHA"',
  'AUTH_HASH_IMPACT_PREFLIGHT=(SAFE_EMPTY_PERSISTED_GENERIC_HASH_STATE|NO_MUTATION_CURRENT_AUTHORITY)',
  'AUTH_GENERIC_HASH_PEPPER_PROVISION=(EXISTING|MIGRATED)',
  'AUTH_OPAQUE_TOKEN_KEY_VALID=1',
  'AUTH_GENERIC_HASH_PEPPER_VALID=1',
  'AUTH_KEY_MATERIAL_DISCLOSURE=NONE',
  'wc -l < "$EVIDENCE_DIR/provision.log"',
  '== 7',
]);
forbid('provisioner', [
  /set\s+-[^\n]*x/,
  /^[ \t]*(?:cat|printenv)\b/m,
  /^[ \t]*source\s+["'$]/m,
  /echo\s+.*(?:key_material|opaque|pepper)/i,
  /printf[^\n]*AUTH_TOKEN_PEPPER/,
  /(?:sys\.stdout|sys\.stderr|print\s*\()/,
  /AUTH_OPAQUE_TOKEN_DIGEST_KEY=.*(?:stdout|stderr)/,
  /openssl\s+rand/,
  /key_material=/,
  /AUTH_OPAQUE_TOKEN_KEY_PROVISION=CREATED/,
]);
forbid('executor', [
  /printf[^\n]*(?:AUTH_OPAQUE_TOKEN_DIGEST_KEY|AUTH_TOKEN_PEPPER)/,
  /echo[^\n]*(?:AUTH_OPAQUE_TOKEN_DIGEST_KEY|AUTH_TOKEN_PEPPER)/,
  /(?:sys\.stdout|sys\.stderr|print\s*\()[^\n]*(?:opaque|pepper)/i,
]);
forbid('workflow', [
  /StrictHostKeyChecking=no/,
  /sshpass/i,
  /AUTH_OPAQUE_TOKEN_DIGEST_KEY\s*:/,
  /AUTH_TOKEN_PEPPER\s*:/,
  /\$\{\{\s*secrets\.[^}]*AUTH_(?:OPAQUE|TOKEN_PEPPER)/,
]);

const workflowScpIndex = content.workflow?.indexOf('scp "${scp_common[@]}" scripts/provision-production-auth-opaque-token-key.sh') ?? -1;
const workflowMutationIndex = content.workflow?.indexOf('"chmod 0700 \'$remote_script\' && \'$remote_script\' provision"') ?? -1;
const workflowPreMutationFetchIndex = content.workflow?.lastIndexOf('git fetch --no-tags origin main', workflowMutationIndex) ?? -1;
const workflowPostMutationFetchIndex = content.workflow?.indexOf('git fetch --no-tags origin main', workflowMutationIndex) ?? -1;
const boundedWorktreeCalls = content.workflow?.match(/^          assert_bounded_worktree$/gm) ?? [];
if (
  workflowScpIndex < 0 ||
  workflowPreMutationFetchIndex <= workflowScpIndex ||
  workflowMutationIndex <= workflowPreMutationFetchIndex ||
  workflowPostMutationFetchIndex <= workflowMutationIndex
) {
  failures.push(`${paths.workflow}: exact main must be fetched immediately before and after the bounded remote operation`);
}
if (boundedWorktreeCalls.length !== 3) {
  failures.push(`${paths.workflow}: bounded worktree guard must run before copy, immediately before mutation and after mutation`);
}

for (const filePath of [paths.executor, paths.provisioner]) {
  const result = spawnSync('bash', ['-n', filePath], { encoding: 'utf8' });
  if (result.status !== 0) failures.push(`${filePath}: bash -n failed: ${result.stderr.trim()}`);
}
const apiStartIndex = content.executor?.indexOf('"${dc_target[@]}" up -d --no-deps --pull never api') ?? -1;
const runtimeKeyIndex = content.executor?.indexOf('verify_api_auth_hash_keys "$new_api_id" || fail API_AUTH_HASH_KEYS_INVALID 77') ?? -1;
const webStartIndex = content.executor?.indexOf('"${dc_target[@]}" up -d --no-deps --pull never web') ?? -1;
if (apiStartIndex < 0 || runtimeKeyIndex <= apiStartIndex || webStartIndex <= runtimeKeyIndex) {
  failures.push(`${paths.executor}: effective API auth hash keys must be verified after API readiness and before Web rollout`);
}

function expectedPepper(opaque) {
  return crypto.createHmac('sha256', opaque).update(derivationLabel).digest('hex');
}

function parseCurrentFile(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  const match = raw.match(/^AUTH_OPAQUE_TOKEN_DIGEST_KEY=([A-Fa-f0-9]{64,})\nAUTH_TOKEN_PEPPER=([a-f0-9]{64})\n$/);
  if (!match) return null;
  return { raw, opaque: match[1], pepper: match[2] };
}

const fixtureRevision = '5b57f4b13de5f1d2f9175032bca1fd1dc8ec84c4';

function safeProvisionOutput(result, expectedState, expectedImpact = 'SAFE_EMPTY_PERSISTED_GENERIC_HASH_STATE') {
  const lines = result.stdout.trimEnd().split('\n');
  const expected = [
    `ACTIVE_PRODUCTION_REVISION=${fixtureRevision}`,
    `AUTH_HASH_IMPACT_PREFLIGHT=${expectedImpact}`,
    'AUTH_OPAQUE_TOKEN_KEY_PROVISION=EXISTING',
    `AUTH_GENERIC_HASH_PEPPER_PROVISION=${expectedState}`,
    'AUTH_OPAQUE_TOKEN_KEY_VALID=1',
    'AUTH_GENERIC_HASH_PEPPER_VALID=1',
    'AUTH_KEY_MATERIAL_DISCLOSURE=NONE',
  ];
  if (lines.length !== expected.length || lines.some((line, index) => line !== expected[index])) {
    failures.push(`${paths.provisioner}: unexpected successful output for ${expectedState}`);
  }
  if (/[A-Fa-f0-9]{64,}/.test(result.stdout)) {
    failures.push(`${paths.provisioner}: successful output contains key-like material`);
  }
}

const embeddedNodeBlocks = [...(content.provisioner ?? '').matchAll(/<<'NODE'\n([\s\S]*?)\nNODE/g)].map((match) => match[1]);
if (embeddedNodeBlocks.length !== 1) {
  failures.push(`${paths.provisioner}: expected exactly one embedded read-only Node preflight`);
}
for (const block of embeddedNodeBlocks) {
  const syntax = spawnSync('node', ['--check', '-'], { input: block, encoding: 'utf8' });
  if (syntax.status !== 0) failures.push(`${paths.provisioner}: embedded Node syntax failed: ${syntax.stderr.trim()}`);
  if (/\b(?:INSERT|UPDATE|DELETE|ALTER|CREATE|DROP|TRUNCATE|GRANT|REVOKE)\b|\$executeRaw/i.test(block)) {
    failures.push(`${paths.provisioner}: embedded database preflight contains a write-capable token`);
  }
}

const embeddedPythonBlocks = [...(content.provisioner ?? '').matchAll(/<<'PY'\n([\s\S]*?)\nPY/g)].map((match) => match[1]);
if (embeddedPythonBlocks.length !== 3) {
  failures.push(`${paths.provisioner}: expected exactly three embedded Python validators/writers`);
}
for (const block of embeddedPythonBlocks) {
  const syntax = spawnSync('python3', ['-c', "import sys; compile(sys.stdin.read(), '<embedded>', 'exec')"], {
    input: block,
    encoding: 'utf8',
  });
  if (syntax.status !== 0) failures.push(`${paths.provisioner}: embedded Python syntax failed: ${syntax.stderr.trim()}`);
}

const mockRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'pc-auth-key-provision-'));
try {
  const mockBin = path.join(mockRoot, 'bin');
  const discoveryDir = path.join(mockRoot, 'discovery-production');
  fs.mkdirSync(mockBin);
  fs.mkdirSync(discoveryDir);
  fs.writeFileSync(path.join(mockBin, 'docker'), `#!/usr/bin/env bash
set -Eeuo pipefail
if [[ "$1" == ps && "$*" == *'service=web'* ]]; then printf 'web-active\\n'; exit 0; fi
if [[ "$1" == ps && "$*" == *'service=api'* ]]; then printf 'api-active\\n'; exit 0; fi
if [[ "$1" == inspect && "$2" == --format ]]; then
  case "$3" in
    *project.working_dir*) printf '%s\\n' "\${PC_FIXTURE_PROD_DIR:?}" ;;
    *com.docker.compose.project*) printf 'pc-fixture\\n' ;;
    *org.opencontainers.image.revision*) printf '%s\\n' "\${PC_FIXTURE_REVISION:?}" ;;
    *) exit 91 ;;
  esac
  exit 0
fi
if [[ "$1" == inspect && "$2" == api-active ]]; then
  python3 - <<'PY'
import json
import os

assignments = [f"AUTH_OPAQUE_TOKEN_DIGEST_KEY={os.environ['PC_FIXTURE_ACTIVE_OPAQUE']}"]
if 'PC_FIXTURE_ACTIVE_GENERIC' in os.environ:
    assignments.append(f"AUTH_TOKEN_PEPPER={os.environ['PC_FIXTURE_ACTIVE_GENERIC']}")
print(json.dumps([{'Config': {'Env': assignments}}]))
PY
  exit 0
fi
if [[ "$1" == exec && "$2" == -i && "$3" == api-active ]]; then
  cat >/dev/null
  [[ "\${PC_FIXTURE_PREFLIGHT_FAIL:-0}" == 0 ]] || exit 92
  printf 'AUTH_HASH_IMPACT_PREFLIGHT=SAFE_EMPTY_PERSISTED_GENERIC_HASH_STATE\\n'
  exit 0
fi
exit 90
`);
  fs.writeFileSync(path.join(mockBin, 'chown'), '#!/usr/bin/env bash\nexit 0\n');
  fs.writeFileSync(path.join(mockBin, 'stat'), `#!/usr/bin/env bash
set -Eeuo pipefail
target="\${!#}"
mode="$(/usr/bin/stat -c '%a' "$target")"
printf '%s:0:0\\n' "$mode"
  `);
  for (const command of ['docker', 'chown', 'stat']) fs.chmodSync(path.join(mockBin, command), 0o700);
  const baseEnv = { ...process.env, PATH: `${mockBin}:${process.env.PATH}` };
  const run = (productionDir, activeOpaque, { activeGeneric, omitOptionalDirectory = false, preflightFail = false } = {}) => spawnSync('bash', [paths.provisioner, 'provision'], {
    encoding: 'utf8',
    env: {
      ...baseEnv,
      PC_PROD_DIR_B64: omitOptionalDirectory ? '' : Buffer.from(productionDir).toString('base64'),
      PC_FIXTURE_PROD_DIR: productionDir,
      PC_FIXTURE_REVISION: fixtureRevision,
      PC_FIXTURE_ACTIVE_OPAQUE: activeOpaque,
      ...(activeGeneric === undefined ? {} : { PC_FIXTURE_ACTIVE_GENERIC: activeGeneric }),
      PC_FIXTURE_PREFLIGHT_FAIL: preflightFail ? '1' : '0',
    },
  });

  const missingOpaque = 'D'.repeat(96);
  const missing = run(discoveryDir, missingOpaque, { omitOptionalDirectory: true });
  const missingFile = path.join(discoveryDir, '.pc-auth-opaque-token.env');
  if (missing.status === 0 || !missing.stderr.includes('ERROR_CODE=EXISTING_OPAQUE_KEY_FILE_MISSING')) {
    failures.push(`${paths.provisioner}: missing protected root file did not fail closed after Compose discovery`);
  }
  if (fs.existsSync(missingFile)) {
    failures.push(`${paths.provisioner}: missing protected root file was replaced with newly created key material`);
  }

  const migrationDir = path.join(mockRoot, 'legacy-production');
  fs.mkdirSync(migrationDir);
  const migrationFile = path.join(migrationDir, '.pc-auth-opaque-token.env');
  const legacyOpaque = 'A'.repeat(96);
  fs.writeFileSync(migrationFile, `AUTH_OPAQUE_TOKEN_DIGEST_KEY=${legacyOpaque}\n`, { mode: 0o600 });
  const migrated = run(migrationDir, legacyOpaque);
  if (migrated.status !== 0) {
    failures.push(`${paths.provisioner}: valid legacy file did not migrate: ${migrated.stderr.trim()}`);
  } else {
    safeProvisionOutput(migrated, 'MIGRATED');
    const parsed = parseCurrentFile(migrationFile);
    if (!parsed || parsed.opaque !== legacyOpaque || parsed.pepper !== expectedPepper(legacyOpaque)) {
      failures.push(`${paths.provisioner}: migration did not preserve the opaque root and derive the exact pepper`);
    } else {
      const before = parsed.raw;
      const existing = run(migrationDir, legacyOpaque);
      if (existing.status !== 0) failures.push(`${paths.provisioner}: migrated file is not idempotent: ${existing.stderr.trim()}`);
      else safeProvisionOutput(existing, 'EXISTING');
      if (fs.readFileSync(migrationFile, 'utf8') !== before) {
        failures.push(`${paths.provisioner}: migrated file was rewritten or rotated on its second run`);
      }
    }
  }

  const currentDir = path.join(mockRoot, 'current-production');
  fs.mkdirSync(currentDir);
  const currentFile = path.join(currentDir, '.pc-auth-opaque-token.env');
  const currentOpaque = 'E'.repeat(96);
  const currentPepper = expectedPepper(currentOpaque);
  const currentBytes = `AUTH_OPAQUE_TOKEN_DIGEST_KEY=${currentOpaque}\nAUTH_TOKEN_PEPPER=${currentPepper}\n`;
  fs.writeFileSync(currentFile, currentBytes, { mode: 0o600 });
  const current = run(currentDir, currentOpaque, { activeGeneric: currentPepper });
  if (current.status !== 0) {
    failures.push(`${paths.provisioner}: matching current active authority was not accepted: ${current.stderr.trim()}`);
  } else {
    safeProvisionOutput(current, 'EXISTING', 'NO_MUTATION_CURRENT_AUTHORITY');
  }
  if (fs.readFileSync(currentFile, 'utf8') !== currentBytes) {
    failures.push(`${paths.provisioner}: matching current authority was rewritten or rotated`);
  }

  const authorityMismatchDir = path.join(mockRoot, 'authority-mismatch-production');
  fs.mkdirSync(authorityMismatchDir);
  const authorityMismatchFile = path.join(authorityMismatchDir, '.pc-auth-opaque-token.env');
  const authorityFileOpaque = 'F'.repeat(96);
  const authorityMismatchBytes = `AUTH_OPAQUE_TOKEN_DIGEST_KEY=${authorityFileOpaque}\n`;
  fs.writeFileSync(authorityMismatchFile, authorityMismatchBytes, { mode: 0o600 });
  const authorityMismatch = run(authorityMismatchDir, '1'.repeat(96));
  if (authorityMismatch.status === 0 || !authorityMismatch.stderr.includes('ERROR_CODE=ACTIVE_AUTHORITY_RELATIONSHIP_INVALID')) {
    failures.push(`${paths.provisioner}: protected file root mismatch with active API did not fail closed`);
  }
  if (fs.readFileSync(authorityMismatchFile, 'utf8') !== authorityMismatchBytes) {
    failures.push(`${paths.provisioner}: active-authority mismatch mutated the protected file`);
  }

  const preflightDir = path.join(mockRoot, 'preflight-failure-production');
  fs.mkdirSync(preflightDir);
  const preflightFile = path.join(preflightDir, '.pc-auth-opaque-token.env');
  const preflightOpaque = '2'.repeat(96);
  const preflightBytes = `AUTH_OPAQUE_TOKEN_DIGEST_KEY=${preflightOpaque}\n`;
  fs.writeFileSync(preflightFile, preflightBytes, { mode: 0o600 });
  const preflightFailure = run(preflightDir, preflightOpaque, { preflightFail: true });
  if (preflightFailure.status === 0 || !preflightFailure.stderr.includes('ERROR_CODE=AUTH_HASH_IMPACT_PREFLIGHT_FAILED')) {
    failures.push(`${paths.provisioner}: failed read-only impact preflight did not stop migration`);
  }
  if (fs.readFileSync(preflightFile, 'utf8') !== preflightBytes) {
    failures.push(`${paths.provisioner}: failed impact preflight mutated the protected file`);
  }

  const mismatchDir = path.join(mockRoot, 'mismatch-production');
  fs.mkdirSync(mismatchDir);
  const mismatchFile = path.join(mismatchDir, '.pc-auth-opaque-token.env');
  const mismatched = `AUTH_OPAQUE_TOKEN_DIGEST_KEY=${'B'.repeat(96)}\nAUTH_TOKEN_PEPPER=${'0'.repeat(64)}\n`;
  fs.writeFileSync(mismatchFile, mismatched, { mode: 0o600 });
  const mismatchResult = run(mismatchDir, 'B'.repeat(96));
  if (mismatchResult.status === 0 || !mismatchResult.stderr.includes('ERROR_CODE=EXISTING_KEY_FILE_INVALID')) {
    failures.push(`${paths.provisioner}: mismatched derived pepper did not fail closed`);
  }
  if (fs.readFileSync(mismatchFile, 'utf8') !== mismatched) {
    failures.push(`${paths.provisioner}: mismatched existing file was mutated`);
  }

  const permissionsDir = path.join(mockRoot, 'permissions-production');
  fs.mkdirSync(permissionsDir);
  const permissionsFile = path.join(permissionsDir, '.pc-auth-opaque-token.env');
  const unsafePermissions = `AUTH_OPAQUE_TOKEN_DIGEST_KEY=${'C'.repeat(96)}\n`;
  fs.writeFileSync(permissionsFile, unsafePermissions, { mode: 0o644 });
  const permissionsResult = run(permissionsDir, 'C'.repeat(96));
  if (permissionsResult.status === 0 || !permissionsResult.stderr.includes('ERROR_CODE=EXISTING_KEY_FILE_INVALID')) {
    failures.push(`${paths.provisioner}: unsafe existing permissions did not fail closed`);
  }
  if (fs.readFileSync(permissionsFile, 'utf8') !== unsafePermissions) {
    failures.push(`${paths.provisioner}: unsafe-permission file was mutated`);
  }
} finally {
  fs.rmSync(mockRoot, { recursive: true, force: true });
}

const guardStart = content.workflow?.indexOf('          assert_bounded_worktree(){\n') ?? -1;
const guardEnd = guardStart < 0 ? -1 : content.workflow.indexOf('\n          }\n', guardStart);
if (guardStart < 0 || guardEnd < 0) {
  failures.push(`${paths.workflow}: bounded worktree guard function could not be extracted`);
} else {
  const guardScript = content.workflow
    .slice(guardStart, guardEnd + '\n          }'.length)
    .split('\n')
    .map((line) => line.slice(10))
    .join('\n');
  const guardRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'pc-auth-key-worktree-'));
  const guardEnv = { ...process.env, EVIDENCE_DIR: 'artifacts/production-auth-opaque-token-key' };
  const git = (...args) => spawnSync('git', args, { cwd: guardRoot, encoding: 'utf8' });
  const runGuard = () => spawnSync('bash', ['-Eeuo', 'pipefail', '-c', `${guardScript}\nassert_bounded_worktree`], {
    cwd: guardRoot,
    env: guardEnv,
    encoding: 'utf8',
  });
  try {
    if (git('init', '-q').status !== 0 || git('config', 'user.email', 'fixture@example.invalid').status !== 0 || git('config', 'user.name', 'Fixture').status !== 0) {
      failures.push(`${paths.workflow}: bounded worktree fixture git initialization failed`);
    } else {
      const tracked = path.join(guardRoot, 'tracked.txt');
      fs.writeFileSync(tracked, 'baseline\n');
      git('add', 'tracked.txt');
      git('commit', '-qm', 'fixture');
      if (runGuard().status !== 0) failures.push(`${paths.workflow}: clean worktree did not pass bounded guard`);

      const evidenceDir = path.join(guardRoot, guardEnv.EVIDENCE_DIR);
      fs.mkdirSync(evidenceDir, { recursive: true });
      fs.writeFileSync(path.join(evidenceDir, 'evidence.txt'), 'safe evidence\n');
      if (runGuard().status !== 0) failures.push(`${paths.workflow}: exact evidence subtree was rejected by bounded guard`);

      const unexpected = path.join(guardRoot, 'unexpected.txt');
      fs.writeFileSync(unexpected, 'unexpected\n');
      if (runGuard().status === 0) failures.push(`${paths.workflow}: unexpected untracked path passed bounded guard`);
      fs.rmSync(unexpected);

      fs.writeFileSync(tracked, 'mutated\n');
      if (runGuard().status === 0) failures.push(`${paths.workflow}: tracked worktree mutation passed bounded guard`);
      git('add', 'tracked.txt');
      if (runGuard().status === 0) failures.push(`${paths.workflow}: staged worktree mutation passed bounded guard`);
    }
  } finally {
    fs.rmSync(guardRoot, { recursive: true, force: true });
  }
}

try {
  const scope = JSON.parse(content.scope ?? '{}');
  const expectedPaths = Object.values(paths).sort();
  if (scope.branch !== 'agent/production-auth-key-discovery-3727') failures.push(`${paths.scope}: branch mismatch`);
  if (scope.authorityBaseExactMain !== '1ce8c51c1545024e4df3b5faa603b900891f523a') failures.push(`${paths.scope}: exact-main authority mismatch`);
  if (scope.impactClassifierRun !== 31728508551) failures.push(`${paths.scope}: impact classifier run mismatch`);
  if (scope.impactEvidenceComment !== 5284486928) failures.push(`${paths.scope}: impact evidence comment mismatch`);
  if (scope.impactProductionRevision !== '65303fa3c2268a7f9db59e76b76412933174ebd2') failures.push(`${paths.scope}: impact production revision mismatch`);
  if (scope.impactCompatibilityClass !== 'SAFE_EMPTY_PERSISTED_GENERIC_HASH_STATE') failures.push(`${paths.scope}: impact compatibility class mismatch`);
  if (JSON.stringify(scope.preMutationFailureRuns) !== JSON.stringify([31730301382, 31730387466])) failures.push(`${paths.scope}: pre-mutation failure runs mismatch`);
  if (scope.preMutationFailureClass !== 'LOCAL_EVIDENCE_WORKTREE_GUARD') failures.push(`${paths.scope}: pre-mutation failure class mismatch`);
  if (scope.preMutationFailureProof !== 'REMOTE_SCRIPT_NOT_EXECUTED_AND_PRODUCTION_MUTATION_NONE') failures.push(`${paths.scope}: pre-mutation failure proof mismatch`);
  if (scope.productionHosting !== 'REG_RU_VPS_ONLY') failures.push(`${paths.scope}: production hosting mismatch`);
  if (scope.newRecurringCostRub !== 0) failures.push(`${paths.scope}: recurring cost must be zero`);
  if (JSON.stringify([...(scope.allowedPaths ?? [])].sort()) !== JSON.stringify(expectedPaths)) {
    failures.push(`${paths.scope}: allowed paths must be exactly the five bounded auth provision files`);
  }
  if (!scope.forbiddenCapabilities?.some((entry) => entry.includes('password reset, SMTP, IMAP'))) {
    failures.push(`${paths.scope}: reset and mail mutations are not explicitly forbidden`);
  }
  if (!scope.acceptance?.some((entry) => entry.includes(derivationLabel))) {
    failures.push(`${paths.scope}: fixed derivation label acceptance is missing`);
  }
} catch (error) {
  failures.push(`${paths.scope}: invalid JSON: ${error.message}`);
}

if (failures.length) {
  console.error('Production auth hash-key provision contract failed:');
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}
console.log('PASS: owner-only provisioning preserves the opaque root, deterministically derives the separate generic auth hash pepper, validates the exact release relationship and publishes no key material.');
