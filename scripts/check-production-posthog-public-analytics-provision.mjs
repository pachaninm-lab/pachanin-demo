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
  'RUNTIME_AUTHORITY_PARTIAL',
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

// Execute the real release entrypoint. A Docker sentinel stops admitted fixtures
// before any deployment command; invalid authority must stop before that sentinel.
// lstat snapshots also prove rejection does not replace dangling links or files.
const executorFixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'pc-posthog-executor-'));
const executorFixtureBin = path.join(executorFixtureRoot, 'bin');
fs.mkdirSync(executorFixtureBin);
fs.writeFileSync(path.join(executorFixtureBin, 'docker'), [
  '#!/usr/bin/env bash',
  'printf "called\\n" >> "$PC_EXECUTOR_DOCKER_MARKER"',
  'printf "PC_EXECUTOR_DOCKER_BOUNDARY\\n" >&2',
  'exit 86',
  '',
].join('\n'), { mode: 0o700 });
fs.writeFileSync(path.join(executorFixtureBin, 'stat'), [
  '#!/usr/bin/env python3',
  'import os, stat, sys',
  "if len(sys.argv) != 4 or sys.argv[1:3] != ['-c', '%a:%u:%g']:",
  '    raise SystemExit(96)',
  "print(format(stat.S_IMODE(os.stat(sys.argv[3]).st_mode), 'o') + ':0:0')",
  '',
].join('\n'), { mode: 0o700 });
const snapshotRuntimePath = (file) => {
  try {
    const info = fs.lstatSync(file);
    return JSON.stringify({
      mode: info.mode,
      kind: info.isSymbolicLink() ? 'link' : info.isDirectory() ? 'directory' : 'file',
      value: info.isSymbolicLink() ? fs.readlinkSync(file)
        : info.isFile() ? fs.readFileSync(file, 'utf8') : null,
    });
  } catch (error) {
    if (error.code === 'ENOENT') return 'absent';
    throw error;
  }
};
const executorCases = [
  ['absent', 'absent', null],
  ['file', 'file', null],
  ['file', 'absent', 'POSTHOG_RUNTIME_AUTHORITY_PARTIAL'],
  ['absent', 'file', 'POSTHOG_RUNTIME_AUTHORITY_PARTIAL'],
  ['dangling', 'absent', 'POSTHOG_RUNTIME_AUTHORITY_PARTIAL'],
  ['absent', 'dangling', 'POSTHOG_RUNTIME_AUTHORITY_PARTIAL'],
  ['dangling', 'dangling', 'POSTHOG_RUNTIME_FILE_INVALID'],
  ['dangling', 'file', 'POSTHOG_RUNTIME_FILE_INVALID'],
  ['file', 'dangling', 'POSTHOG_RUNTIME_OVERRIDE_INVALID'],
  ['symlink', 'file', 'POSTHOG_RUNTIME_FILE_INVALID'],
  ['file', 'symlink', 'POSTHOG_RUNTIME_OVERRIDE_INVALID'],
  ['directory', 'file', 'POSTHOG_RUNTIME_FILE_INVALID'],
  ['file', 'directory', 'POSTHOG_RUNTIME_OVERRIDE_INVALID'],
  ['open-mode', 'file', 'POSTHOG_RUNTIME_FILE_INVALID'],
  ['file', 'open-mode', 'POSTHOG_RUNTIME_OVERRIDE_INVALID'],
  ['malformed', 'file', 'POSTHOG_RUNTIME_FILE_INVALID'],
  ['file', 'malformed', 'POSTHOG_RUNTIME_OVERRIDE_INVALID'],
];
try {
  for (const action of ['audit', 'deploy', 'rollback']) {
    for (const [envKind, overrideKind, expectedError] of executorCases) {
      const label = `${action}:${envKind}/${overrideKind}`;
      const dir = fs.mkdtempSync(path.join(executorFixtureRoot, `${action}-`));
      const envFile = path.join(dir, '.pc-posthog-public-analytics.env');
      const override = path.join(dir, 'compose.pc-posthog-public-analytics.override.yml');
      const compose = path.join(dir, 'compose.yml');
      const hardening = path.join(dir, 'compose.production-hardening.override.yml');
      const imageOverride = path.join(dir, 'compose.production-web-image.override.yml');
      const acceptance = path.join(dir, 'acceptance.sh');
      const dockerMarker = path.join(dir, 'docker-called');
      const acceptanceMarker = path.join(dir, 'acceptance-called');
      const reference = `phc_${'B'.repeat(32)}`;
      const envBody = `POSTHOG_PROJECT_REFERENCE=${reference}\nPOSTHOG_INGEST_REGION=us\n`;
      const overrideBody = `services:\n  web:\n    env_file:\n      - ${JSON.stringify(envFile)}\n`;
      fs.writeFileSync(compose, 'services:\n  web:\n    image: fixture/web:exact\n');
      fs.writeFileSync(hardening, 'services: {}\n');
      fs.writeFileSync(imageOverride, 'services: {}\n');
      fs.writeFileSync(acceptance, '#!/usr/bin/env bash\nprintf "called\\n" >> "$PC_EXECUTOR_ACCEPTANCE_MARKER"\nexit 85\n', { mode: 0o700 });
      const install = (file, kind, body) => {
        if (kind === 'absent') return;
        if (kind === 'dangling') { fs.symlinkSync(`${file}.missing`, file); return; }
        if (kind === 'directory') { fs.mkdirSync(file); return; }
        if (kind === 'symlink') {
          fs.writeFileSync(`${file}.target`, body, { mode: 0o600 });
          fs.symlinkSync(`${file}.target`, file);
          return;
        }
        fs.writeFileSync(file, kind === 'malformed' ? 'invalid\n' : body);
        fs.chmodSync(file, kind === 'open-mode' ? 0o644 : 0o600);
      };
      install(envFile, envKind, envBody);
      install(override, overrideKind, overrideBody);
      const watchedPaths = [envFile, override, imageOverride, `${envFile}.target`, `${override}.target`];
      const before = watchedPaths.map(snapshotRuntimePath);
      const result = spawnSync('bash', [path.resolve(paths.executor), action, 'a'.repeat(40)], {
        encoding: 'utf8',
        timeout: 10000,
        env: {
          ...process.env,
          PATH: `${executorFixtureBin}:${process.env.PATH}`,
          PC_PROD_DIR: dir,
          PC_PROD_COMPOSE: compose,
          PC_PROD_PROJECT: 'fixtureproj',
          PC_HARDENING_OVERRIDE: hardening,
          PC_IMAGE_OVERRIDE: imageOverride,
          PC_POSTHOG_RUNTIME_ENV_FILE: envFile,
          PC_POSTHOG_RUNTIME_OVERRIDE: override,
          PC_LIVE_ACCEPTANCE_SCRIPT: acceptance,
          PC_EXECUTOR_DOCKER_MARKER: dockerMarker,
          PC_EXECUTOR_ACCEPTANCE_MARKER: acceptanceMarker,
        },
      });
      const output = `${result.stdout || ''}\n${result.stderr || ''}`;
      if (result.error || result.signal) failures.push(`executor ${label}: process did not terminate normally`);
      if (expectedError) {
        if (result.status === 0 || !output.includes(`ERROR: ${expectedError}`)) {
          failures.push(`executor ${label}: required rejection ${expectedError} missing`);
        }
        if (fs.existsSync(dockerMarker)) failures.push(`executor ${label}: invalid authority reached Docker`);
      } else if (result.status !== 86 || !fs.existsSync(dockerMarker) || !output.includes('PC_EXECUTOR_DOCKER_BOUNDARY')) {
        failures.push(`executor ${label}: valid authority did not reach the Docker boundary`);
      }
      if (fs.existsSync(acceptanceMarker)) failures.push(`executor ${label}: live acceptance unexpectedly executed`);
      if (output.includes(reference)) failures.push(`executor ${label}: project reference leaked`);
      if (JSON.stringify(before) !== JSON.stringify(watchedPaths.map(snapshotRuntimePath))) {
        failures.push(`executor ${label}: runtime paths or image override changed during admission`);
      }
    }
  }
} finally {
  fs.rmSync(executorFixtureRoot, { recursive: true, force: true });
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
  # Model the real Docker CLI: default quiet IDs are short; --no-trunc IDs are full.
  [[ "$state" == 1 ]] && web_id="${'b'.repeat(64)}" || web_id="${'c'.repeat(64)}"
  api_id="${'d'.repeat(64)}"
  if [[ "$*" != *"--no-trunc"* ]]; then
    web_id="\${web_id:0:12}"
    api_id="\${api_id:0:12}"
  fi
  printf '%s\\n' "$web_id"
  if [[ "$*" != *"label=com.docker.compose.service=web"* ]]; then
    printf '%s\\n' "$api_id"
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
  if [[ "$format" == *"com.docker.compose.service"* ]]; then [[ "$id" == ${'d'.repeat(12)}* ]] && printf 'api\\n' || printf 'web\\n'; exit 0; fi
  if [[ "$format" == *".Config.Image"* ]]; then [[ "$id" == ${'d'.repeat(12)}* ]] && printf 'fixture/api:exact\\n' || printf 'fixture/web:exact\\n'; exit 0; fi
  if [[ "$format" == *"{{.Image}}"* ]]; then printf '%s\\n' "$image_id"; exit 0; fi
  if [[ "$format" == *"if .State.Health"* && "$format" == *"1"* ]]; then printf '1\\n'; exit 0; fi
  if [[ "$format" == *"State.Health.Status"* ]]; then printf 'healthy\\n'; exit 0; fi
  if [[ "$format" == *"range .Config.Env"* ]]; then
    if [[ "$id" != ${'d'.repeat(12)}* && "$state" == 1 ]]; then
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
  const expectedOverride = `services:\n  web:\n    env_file:\n      - ${JSON.stringify(runtimeFile)}\n`;
  if (!fs.existsSync(overrideFile)) {
    failures.push(`${paths.provisioner}: override file missing`);
  } else if (fs.readFileSync(overrideFile, 'utf8') !== expectedOverride) {
    failures.push(`${paths.provisioner}: override file mismatch`);
  }

  const second = runProvisioner();
  if (second.status !== 0 || !second.stdout.includes('PRODUCTION_MUTATION=NONE_ALREADY_READY')) {
    failures.push(`${paths.provisioner}: idempotent fixture failed: ${second.stderr.trim()}`);
  }
  if (second.stdout.includes(fixtureReference) || second.stderr.includes(fixtureReference)) {
    failures.push(`${paths.provisioner}: project reference leaked on idempotent run`);
  }

  fs.rmSync(overrideFile, { force: true });
  const envOnly = runProvisioner();
  if (envOnly.status === 0 || !envOnly.stderr.includes('POSTHOG_RUNTIME_ERROR=RUNTIME_AUTHORITY_PARTIAL')) {
    failures.push(`${paths.provisioner}: env-only partial authority was not rejected`);
  }
  if (envOnly.stdout.includes(fixtureReference) || envOnly.stderr.includes(fixtureReference)) {
    failures.push(`${paths.provisioner}: project reference leaked during env-only rejection`);
  }

  fs.writeFileSync(overrideFile, expectedOverride, { mode: 0o600 });
  fs.chmodSync(overrideFile, 0o600);
  fs.rmSync(runtimeFile, { force: true });
  const overrideOnly = runProvisioner();
  if (overrideOnly.status === 0 || !overrideOnly.stderr.includes('POSTHOG_RUNTIME_ERROR=RUNTIME_AUTHORITY_PARTIAL')) {
    failures.push(`${paths.provisioner}: override-only partial authority was not rejected`);
  }
  if (overrideOnly.stdout.includes(fixtureReference) || overrideOnly.stderr.includes(fixtureReference)) {
    failures.push(`${paths.provisioner}: project reference leaked during override-only rejection`);
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
