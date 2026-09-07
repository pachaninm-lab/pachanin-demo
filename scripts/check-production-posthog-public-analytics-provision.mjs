#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const paths = {
  executor: 'scripts/production-web-exact-sha.sh',
  provisioner: 'scripts/provision-production-posthog-public-analytics.sh',
  runner: 'scripts/run-repo-build-test-contour.mjs',
  scope: 'docs/platform-v7/autopilot/scopes/posthog-public-analytics-activation-5138.json',
};
const checkerPath = 'scripts/check-production-posthog-public-analytics-provision.mjs';
const failures = [];
const content = {};
for (const [name, file] of Object.entries(paths)) {
  if (!fs.existsSync(file)) failures.push(`${file}: missing`);
  content[name] = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
}
if (!fs.existsSync(checkerPath)) failures.push(`${checkerPath}: missing`);

const requireAll = (name, values) => values.forEach((value) => {
  if (!content[name].includes(value)) failures.push(`${paths[name]}: missing ${JSON.stringify(value)}`);
});
const forbid = (name, patterns) => patterns.forEach((pattern) => {
  if (pattern.test(content[name])) failures.push(`${paths[name]}: forbidden ${pattern}`);
});

requireAll('executor', [
  '.pc-posthog-public-analytics.env',
  'compose.pc-posthog-public-analytics.override.yml',
  'POSTHOG_RUNTIME_OVERRIDE_PRESENT',
  "stat -c '%a:%u:%g'",
  'POSTHOG_INGEST_REGION',
  'POSTHOG_PROJECT_REFERENCE',
  'BASE_DC+=(-f "$POSTHOG_RUNTIME_OVERRIDE")',
  'POSTHOG_RUNTIME_AUTHORITY_PARTIAL',
  'POSTHOG_RUNTIME_FILE_INVALID',
  'POSTHOG_RUNTIME_OVERRIDE_INVALID',
]);
requireAll('provisioner', [
  'PC_POSTHOG_PROJECT_REFERENCE_B64',
  '^phc_[A-Za-z0-9_-]{20,96}$',
  '.pc-posthog-public-analytics.env',
  'compose.pc-posthog-public-analytics.override.yml',
  'POSTHOG_INGEST_REGION=us',
  "stat -c '%a:%u:%g'",
  'chmod 0600',
  'chown 0:0',
  'ACTIVE_POSTHOG_AUTHORITY_UNTRACKED',
  'POSTHOG_RUNTIME_LEAKED_TO_NON_WEB_SERVICE',
  'POSTHOG_WEB_IMAGE_UNCHANGED=1',
  'POSTHOG_NON_WEB_UNCHANGED=1',
  'PRODUCTION_MUTATION=WEB_RECREATE_SAME_IMAGE',
  'PRODUCTION_MUTATION=NONE_ALREADY_READY',
]);
requireAll('runner', [
  "['posthog_public_analytics_runtime', 'node ./scripts/check-production-posthog-public-analytics-provision.mjs']",
]);

forbid('provisioner', [
  /set\s+-[A-Za-z]*x[A-Za-z]*/,
  /cat\s+.*posthog/i,
  /source\s+.*posthog/i,
  /echo\s+.*project_reference/i,
]);
forbid('executor', [
  /set\s+-[A-Za-z]*x[A-Za-z]*/,
  /cat\s+.*posthog/i,
  /source\s+.*posthog/i,
  /printf\s+['"][^'"]*POSTHOG_PROJECT_REFERENCE/i,
]);

for (const file of [paths.executor, paths.provisioner]) {
  const result = spawnSync('bash', ['-n', file], { encoding: 'utf8' });
  if (result.status !== 0) failures.push(`${file}: bash -n failed: ${result.stderr.trim()}`);
}

try {
  const scope = JSON.parse(content.scope);
  const expected = [
    'scripts/production-web-exact-sha.sh',
    'scripts/provision-production-posthog-public-analytics.sh',
    'scripts/check-production-posthog-public-analytics-provision.mjs',
    'scripts/run-repo-build-test-contour.mjs',
  ];
  if (scope.branch !== 'ops/posthog-public-analytics-activation-5138') {
    failures.push(`${paths.scope}: branch mismatch`);
  }
  if (JSON.stringify(scope.allowedPaths) !== JSON.stringify(expected)) {
    failures.push(`${paths.scope}: allowedPaths mismatch`);
  }
  if (scope.allowedPaths.some((item) => item.includes('cryptographic-inventory'))) {
    failures.push(`${paths.scope}: cryptographic inventory must remain outside activation scope`);
  }
} catch (error) {
  failures.push(`${paths.scope}: invalid JSON: ${error.message}`);
}

const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'pc-posthog-runtime-'));
const fixtureBin = path.join(fixtureRoot, 'bin');
const prodDir = path.join(fixtureRoot, 'prod');
const baseCompose = path.join(prodDir, 'compose.yml');
const overrideFile = path.join(prodDir, 'compose.pc-posthog-public-analytics.override.yml');
const stateFile = path.join(fixtureRoot, 'state');
const fixtureReference = `phc_${'A'.repeat(32)}`;
fs.mkdirSync(fixtureBin);
fs.mkdirSync(prodDir);
fs.writeFileSync(baseCompose, 'services:\n  web:\n    image: fixture/web:exact\n');
fs.writeFileSync(stateFile, '0\n');

fs.writeFileSync(path.join(fixtureBin, 'id'), `#!/usr/bin/env bash
if [[ "\${1:-}" == -u ]]; then echo 0; exit 0; fi
exec /usr/bin/id "$@"
`, { mode: 0o700 });
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
state="$(tr -d '\\n' < "$PC_FIXTURE_STATE")"
image_id="sha256:${'a'.repeat(64)}"
if [[ "$1" == ps ]]; then
  if [[ "$*" == *"label=com.docker.compose.service=web"* ]]; then
    [[ "$state" == 1 ]] && printf 'web-new\\n' || printf 'web-old\\n'
  else
    [[ "$state" == 1 ]] && printf 'web-new\\napi-1\\n' || printf 'web-old\\napi-1\\n'
  fi
  exit 0
fi
if [[ "$1" == inspect ]]; then
  format="$3"
  id="$4"
  if [[ "$format" == *"working_dir"* ]]; then printf '%s\\n' "$PC_FIXTURE_PROD_DIR"; exit 0; fi
  if [[ "$format" == *"config_files"* ]]; then
    if [[ "$state" == 1 ]]; then printf '%s,%s\\n' "$PC_FIXTURE_BASE_COMPOSE" "$PC_FIXTURE_OVERRIDE"; else printf '%s\\n' "$PC_FIXTURE_BASE_COMPOSE"; fi
    exit 0
  fi
  if [[ "$format" == *"com.docker.compose.project"* ]]; then printf 'fixtureproj\\n'; exit 0; fi
  if [[ "$format" == *"com.docker.compose.service"* ]]; then [[ "$id" == api-1 ]] && printf 'api\\n' || printf 'web\\n'; exit 0; fi
  if [[ "$format" == *".Config.Image"* ]]; then [[ "$id" == api-1 ]] && printf 'fixture/api:exact\\n' || printf 'fixture/web:exact\\n'; exit 0; fi
  if [[ "$format" == *"{{.Image}}"* ]]; then printf '%s\\n' "$image_id"; exit 0; fi
  if [[ "$format" == *"if .State.Health"* && "$format" == *"1"* ]]; then printf '1\\n'; exit 0; fi
  if [[ "$format" == *"State.Health.Status"* ]]; then printf 'healthy\\n'; exit 0; fi
  if [[ "$format" == *"range .Config.Env"* ]]; then
    if [[ "$id" != api-1 && "$state" == 1 ]]; then
      printf 'POSTHOG_PROJECT_REFERENCE=%s\\n' "$PC_FIXTURE_REFERENCE"
      printf 'POSTHOG_INGEST_REGION=us\\n'
    fi
    exit 0
  fi
  exit 1
fi
if [[ "$1" == image && "$2" == inspect ]]; then
  printf '%s\\n' "$image_id"
  exit 0
fi
if [[ "$1" == compose ]]; then
  command_name=''
  for arg in "$@"; do
    case "$arg" in config|up) command_name="$arg"; break;; esac
  done
  if [[ "$command_name" == config ]]; then
    [[ "$*" == *"--services"* ]] && printf 'web\\n'
    exit 0
  fi
  if [[ "$command_name" == up ]]; then
    printf '1\\n' > "$PC_FIXTURE_STATE"
    exit 0
  fi
fi
exit 1
`, { mode: 0o700 });

const runProvisioner = () => spawnSync('bash', [paths.provisioner, 'provision'], {
  encoding: 'utf8',
  env: {
    ...process.env,
    PATH: `${fixtureBin}:${process.env.PATH}`,
    PC_POSTHOG_PROJECT_REFERENCE_B64: Buffer.from(fixtureReference).toString('base64'),
    PC_FIXTURE_PROD_DIR: prodDir,
    PC_FIXTURE_BASE_COMPOSE: baseCompose,
    PC_FIXTURE_OVERRIDE: overrideFile,
    PC_FIXTURE_STATE: stateFile,
    PC_FIXTURE_REFERENCE: fixtureReference,
  },
});

try {
  const first = runProvisioner();
  if (first.status !== 0) {
    failures.push(`${paths.provisioner}: fixture provision failed: ${first.stderr.trim()}`);
  } else {
    for (const marker of [
      'POSTHOG_RUNTIME_ENV=CREATED',
      'POSTHOG_OVERRIDE=CREATED',
      'POSTHOG_REGION=us',
      'POSTHOG_WEB_READY=1',
      'POSTHOG_WEB_IMAGE_UNCHANGED=1',
      'POSTHOG_NON_WEB_UNCHANGED=1',
      'PRODUCTION_MUTATION=WEB_RECREATE_SAME_IMAGE',
    ]) {
      if (!first.stdout.includes(marker)) failures.push(`${paths.provisioner}: fixture missing ${marker}`);
    }
    if (first.stdout.includes(fixtureReference) || first.stderr.includes(fixtureReference)) {
      failures.push(`${paths.provisioner}: project reference leaked to process output`);
    }
  }

  const runtimeFile = path.join(prodDir, '.pc-posthog-public-analytics.env');
  const expectedRuntime = `POSTHOG_PROJECT_REFERENCE=${fixtureReference}\nPOSTHOG_INGEST_REGION=us\n`;
  if (!fs.existsSync(runtimeFile) || fs.readFileSync(runtimeFile, 'utf8') !== expectedRuntime) {
    failures.push(`${paths.provisioner}: runtime file mismatch`);
  }
  if (!fs.existsSync(overrideFile)) {
    failures.push(`${paths.provisioner}: override file missing`);
  } else {
    const expectedOverride = `services:\n  web:\n    env_file:\n      - ${JSON.stringify(runtimeFile)}\n`;
    if (fs.readFileSync(overrideFile, 'utf8') !== expectedOverride) failures.push(`${paths.provisioner}: override file mismatch`);
  }

  const second = runProvisioner();
  if (second.status !== 0 || !second.stdout.includes('PRODUCTION_MUTATION=NONE_ALREADY_READY')) {
    failures.push(`${paths.provisioner}: idempotent fixture failed: ${second.stderr.trim()}`);
  }
  if (second.stdout.includes(fixtureReference) || second.stderr.includes(fixtureReference)) {
    failures.push(`${paths.provisioner}: project reference leaked on idempotent run`);
  }
} finally {
  fs.rmSync(fixtureRoot, { recursive: true, force: true });
}

if (failures.length > 0) {
  console.error('PostHog public analytics runtime provision contract: FAIL');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log('PostHog public analytics runtime provision contract: PASS');
