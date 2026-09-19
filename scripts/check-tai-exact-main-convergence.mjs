#!/usr/bin/env node
/**
 * Executable contract for the exact-main container convergence wait.
 *
 * The standalone TAI deployment is triggered when the activation workflow
 * finishes, which can be while the production web and API containers are still
 * rolling to the new revision. Reading the topology at that moment produced an
 * immediate exact-main mismatch and failed a release that would have been
 * correct seconds later.
 *
 * The wait removes that race without loosening anything: a revision that never
 * converges still fails, ambiguity still fails, and both failures name the
 * container that never arrived. This file proves that against a stubbed docker,
 * using the function extracted from the deployment script itself rather than a
 * copy that could drift away from it.
 */
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync, chmodSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const DEPLOY_SCRIPT = 'scripts/tai-reg-ru-deploy.sh';
const TARGET_SHA = 'a'.repeat(40);
const OTHER_SHA = 'b'.repeat(40);
const CONTAINER_ID = '0123456789ab';

const violations = [];
const source = readFileSync(DEPLOY_SCRIPT, 'utf8');

const start = source.indexOf('wait_for_exact_main_container() {');
const end = source.indexOf('\n}\n', start);
if (start < 0 || end < 0) {
  console.error('exact-main convergence contract failed:\n- wait_for_exact_main_container is missing from ' + DEPLOY_SCRIPT);
  process.exit(1);
}
const waitFunction = source.slice(start, end + 3);

for (const required of [
  'EXACT_MAIN_CONVERGENCE_TIMEOUT_SECONDS=',
  'EXACT_MAIN_CONVERGENCE_POLL_SECONDS=',
  'web_id="$(wait_for_exact_main_container web)"',
  'api_wait_id="$(wait_for_exact_main_container api)"',
]) {
  if (!source.includes(required)) violations.push(`${DEPLOY_SCRIPT}: missing ${required}`);
}

// A later re-resolution that keeps `head -1` would silently pick a winner among
// two web containers, which is the ambiguity the authority checks refuse.
if (/ps -q web \| head -1/.test(source)) {
  violations.push(`${DEPLOY_SCRIPT}: web authority still resolved with head -1`);
}

/**
 * Runs the extracted wait against a docker stub.
 *
 * `script` is a bash snippet that prints container ids for `docker ps` and a
 * revision for `docker inspect`, so a scenario can change its answer between
 * polls exactly the way a rolling restart does.
 */
function runWait(service, dockerStub, { timeout = 3, poll = 1 } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'tai-convergence-'));
  try {
    const bin = join(root, 'bin');
    mkdirSync(bin);
    const docker = join(bin, 'docker');
    writeFileSync(docker, `#!/usr/bin/env bash\nSTATE_DIR=${JSON.stringify(root)}\n${dockerStub}\n`, 'utf8');
    chmodSync(docker, 0o755);

    const harness = [
      'set -Eeuo pipefail',
      `TARGET_SHA=${JSON.stringify(TARGET_SHA)}`,
      `EXACT_MAIN_CONVERGENCE_TIMEOUT_SECONDS=${timeout}`,
      `EXACT_MAIN_CONVERGENCE_POLL_SECONDS=${poll}`,
      waitFunction,
      `wait_for_exact_main_container ${service}`,
    ].join('\n');

    const result = spawnSync('bash', ['-s'], {
      input: harness,
      encoding: 'utf8',
      timeout: 30_000,
      env: { ...process.env, PATH: `${bin}:${process.env.PATH}` },
    });
    return { status: result.status, stdout: (result.stdout || '').trim(), stderr: (result.stderr || '').trim() };
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

/** A stub that always reports one container at `revision`. */
function steady(revision) {
  return [
    'if [[ "$1" == "ps" ]]; then',
    `  printf '%s\\n' ${JSON.stringify(CONTAINER_ID)}`,
    '  exit 0',
    'fi',
    'if [[ "$1" == "inspect" ]]; then',
    `  printf '%s\\n' ${JSON.stringify(revision)}`,
    '  exit 0',
    'fi',
    'exit 1',
  ].join('\n');
}

/** A stub that reports the old revision for the first `n` polls, then TARGET_SHA. */
function convergesAfter(n) {
  return [
    'counter="$STATE_DIR/polls"',
    'if [[ "$1" == "ps" ]]; then',
    `  printf '%s\\n' ${JSON.stringify(CONTAINER_ID)}`,
    '  exit 0',
    'fi',
    'if [[ "$1" == "inspect" ]]; then',
    '  count=0',
    '  [[ -f "$counter" ]] && count="$(cat "$counter")"',
    '  printf "%s" "$(( count + 1 ))" > "$counter"',
    `  if (( count < ${n} )); then printf '%s\\n' ${JSON.stringify(OTHER_SHA)}; else printf '%s\\n' ${JSON.stringify(TARGET_SHA)}; fi`,
    '  exit 0',
    'fi',
    'exit 1',
  ].join('\n');
}

/** A stub that reports two running containers for the service. */
const ambiguous = [
  'if [[ "$1" == "ps" ]]; then',
  `  printf '%s\\n%s\\n' ${JSON.stringify(CONTAINER_ID)} ${JSON.stringify('cafebabe0011')}`,
  '  exit 0',
  'fi',
  `if [[ "$1" == "inspect" ]]; then printf '%s\\n' ${JSON.stringify(TARGET_SHA)}; exit 0; fi`,
  'exit 1',
].join('\n');

function expectConverges(name, service, stub) {
  const result = runWait(service, stub);
  if (result.status !== 0 || result.stdout !== CONTAINER_ID) {
    violations.push(`${name}: expected the container id on convergence, got status=${result.status} stdout=${result.stdout} stderr=${result.stderr}`);
  }
}

function expectTimeout(name, service, stub, code) {
  const result = runWait(service, stub);
  if (result.status === 0 || !result.stderr.includes(code)) {
    violations.push(`${name}: expected ${code}, got status=${result.status} stderr=${result.stderr}`);
  }
}

expectConverges('an already-converged web container returns immediately', 'web', steady(TARGET_SHA));
expectConverges('an already-converged api container returns immediately', 'api', steady(TARGET_SHA));
expectConverges('a web container that rolls during the wait is accepted', 'web', convergesAfter(2));
expectConverges('an api container that rolls during the wait is accepted', 'api', convergesAfter(2));

expectTimeout(
  'a web revision that never converges fails closed',
  'web', steady(OTHER_SHA), 'EXACT_MAIN_WEB_CONVERGENCE_TIMEOUT',
);
expectTimeout(
  'an api revision that never converges fails closed',
  'api', steady(OTHER_SHA), 'EXACT_MAIN_API_CONVERGENCE_TIMEOUT',
);
expectTimeout(
  'two running web containers never satisfy the wait',
  'web', ambiguous, 'EXACT_MAIN_WEB_CONVERGENCE_TIMEOUT',
);
expectTimeout(
  'a missing container never satisfies the wait',
  'web',
  ['if [[ "$1" == "ps" ]]; then exit 0; fi', 'exit 1'].join('\n'),
  'EXACT_MAIN_WEB_CONVERGENCE_TIMEOUT',
);

if (violations.length > 0) {
  console.error('exact-main convergence contract failed:\n- ' + violations.join('\n- '));
  process.exit(1);
}

console.log('TAI exact-main convergence contract PASS: bounded wait for exactly one web and API container at the target revision, fail-closed with a named timeout code.');
