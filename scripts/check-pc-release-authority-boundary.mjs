#!/usr/bin/env node
/**
 * The release-authority filesystem boundary, checked where it is declared.
 *
 * `/var/lib/pc-release-authority` has two authors: the controller, which
 * restores the boundary on every run, and the bootstrap scripts, which create it
 * when a runner is installed or resumed. They disagreed. Bootstrap provisioned
 * the authority root `0700 root:root`, so `pcactions` had no search permission on
 * the ancestor and could not create its attempt-scoped input directory — no
 * matter that `runner-input` itself was group-writable, because a denied
 * ancestor stops path resolution before the child's mode is ever consulted.
 *
 * That made the failure look like a TAI or Qwen defect and made it survive code
 * changes: the controller repairs the boundary, but it is only reachable through
 * the step the broken boundary blocks. A runner restart re-broke production
 * release authority, and nothing in CI noticed, because no test compared the two
 * authors of the same path.
 *
 * This checker is that test. It is source-level on purpose: the production host
 * is not reachable from CI, and the thing that actually regressed is the
 * agreement between these files.
 */
import { readFileSync } from 'node:fs';

const paths = {
  install: 'scripts/install-pc-prod-actions-runner.sh',
  resume: 'scripts/resume-pc-prod-actions-runner.sh',
  controller: 'scripts/pc-tai-release-controller.sh',
  activation: '.github/workflows/tai-restricted-qwen-reg-ru-activation.yml',
};

const source = Object.fromEntries(
  Object.entries(paths).map(([key, file]) => [key, readFileSync(file, 'utf8')]),
);

const violations = [];
const require = (key, fragment, why) => {
  if (!source[key].includes(fragment)) violations.push(`${paths[key]}: ${why} — missing ${JSON.stringify(fragment)}`);
};
const forbid = (key, pattern, why) => {
  if (pattern.test(source[key])) violations.push(`${paths[key]}: ${why}`);
};

/* 4. The authority root is traversable by the runner group, in every author. */
const AUTHORITY_ROOT_MODE = /install -d -m 0710 -o root -g ["']?(?:\$RUNNER_USER|pcactions)["']? [\\\s]*\/var\/lib\/pc-release-authority(?![/\w])/u;
for (const key of ['install', 'resume', 'controller']) {
  const declared = key === 'controller'
    ? source[key].includes('install -d -m 0710 -o root -g pcactions "$STATE_ROOT"')
    : AUTHORITY_ROOT_MODE.test(source[key]);
  if (!declared) {
    violations.push(
      `${paths[key]}: the authority root must be provisioned 0710 root:pcactions so the runner can traverse to runner-input`,
    );
  }
}

/* The authority root must never be provisioned root:root-only again. */
const ROOT_ONLY_AUTHORITY = /install -d -m 0700 -o root -g root(?:[^\n]|\n\s+)*\/var\/lib\/pc-release-authority(?![/\w])/u;
for (const key of ['install', 'resume']) {
  forbid(
    key,
    ROOT_ONLY_AUTHORITY,
    'the authority root must not be provisioned 0700 root:root — it denies the runner the search permission it needs on the ancestor',
  );
}

/* 7. Everything else under the authority root stays closed to the runner. */
for (const key of ['install', 'resume']) {
  require(key, '/var/lib/pc-release-authority/repository', 'the protected repository must still be provisioned');
  require(key, '/var/lib/pc-release-authority/controller-jobs', 'protected controller jobs must still be provisioned');
  require(key, 'install -d -m 0730 -o root -g "$RUNNER_USER" /var/lib/pc-release-authority/runner-input', 'runner-input stays write+traverse for the runner group, never readable');
  require(key, 'install -d -m 0750 -o root -g "$RUNNER_USER" /var/lib/pc-release-authority/runner-output', 'runner-output stays read-only for the runner group');
}
for (const key of ['install', 'resume']) {
  if (!/install -d -m 0700 -o root -g root(?:[^\n]|\n\s+)*\/var\/lib\/pc-release-authority\/repository/u.test(source[key])
    || !/install -d -m 0700 -o root -g root(?:[^\n]|\n\s+)*\/var\/lib\/pc-release-authority\/controller-jobs/u.test(source[key])) {
    violations.push(`${paths[key]}: repository and controller-jobs must remain 0700 root:root`);
  }
}

/* 3. The runner's only privileged authority is the one controller command. */
for (const key of ['install', 'resume']) {
  require(key, 'pcactions ALL=(root) NOPASSWD: /usr/local/sbin/pc-tai-release-controller', 'the sudo grant must stay scoped to the controller');
  forbid(key, /NOPASSWD:\s*ALL/u, 'unrestricted sudo must never be granted to the runner');
  // Only *adding* is forbidden. Both scripts deliberately call `gpasswd -d` to
  // remove a docker membership a previous provisioning may have left behind, and
  // a pattern that cannot tell removal from addition would forbid the fix.
  forbid(key, /usermod[^\n]*-a?G[^\n]*docker|gpasswd\s+-a[^\n]*docker|adduser\s+\S+\s+docker/u, 'the runner must never be added to the docker group');
  require(key, `! id -nG "$RUNNER_USER" | tr ' ' '\\n' | grep -Fxq docker`, 'the runner must be proven out of the docker group');
}

/* 1, 2, 5, 6, 8. The properties the failing step itself asserts stay asserted. */
for (const [fragment, why] of [
  ['[[ "$(id -u)" -ne 0 ]]', 'the runner must prove it is not root'],
  ["! id -nG | tr ' ' '\\n' | grep -Fxq docker", 'the runner must prove it is not in the docker group'],
  ['if docker version >/dev/null 2>&1; then exit 21; fi', 'the runner must prove Docker is unusable'],
  ["sudo -n -l | grep -Fq '/usr/local/sbin/pc-tai-release-controller'", 'the runner must prove its sudo scope'],
  ['[[ ! -e "$input" ]] ||', 'a reused attempt id must be refused'],
  ['install -d -m 0700 "$input"', 'the attempt directory is created by the runner itself'],
  ["[[ \"$(stat -c '%U:%G:%a' \"$input\")\" == pcactions:pcactions:700 ]]", 'the attempt directory must end pcactions:pcactions:0700'],
  ['chmod 0600 "$input/model-user" "$input/model-port" "$input/backup-evidence-path"', 'attempt secrets must be 0600'],
]) {
  require('activation', fragment, why);
}

/* 9, 10. Exact-SHA authority and protected output are untouched by this fix. */
for (const [fragment, why] of [
  ['TARGET_IS_NOT_CURRENT_MAIN', 'the controller must still refuse a target that is not current main'],
  ['INSTALLED_CONTROLLER_NOT_EXACT_TARGET', 'the controller must still verify it is the exact target revision'],
  ['install -d -m 0750 -o root -g pcactions "$OUTPUT_ROOT"', 'controller output must stay read-only for the runner'],
  ['find -P "$job_output" -mindepth 1 -maxdepth 1 -type f -exec chmod 0640 {} +', 'evidence files must stay 0640'],
  ['restore_runner_boundary', 'the controller must still restore the boundary on exit'],
]) {
  require('controller', fragment, why);
}

if (violations.length > 0) {
  console.error('PC release-authority boundary contract FAIL:');
  for (const violation of violations) console.error(`  - ${violation}`);
  process.exit(1);
}

console.log(
  'PC release-authority boundary contract PASS: authority root traversable by the runner group in bootstrap and controller alike, '
  + 'protected repository and controller jobs closed, runner-input write-only, runner-output read-only, sudo scoped to the controller, '
  + 'no docker or root authority, attempt input 0700 with 0600 secrets, reused attempt ids refused, exact-SHA authority intact.',
);
