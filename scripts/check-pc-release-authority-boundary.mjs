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
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

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

/**
 * Shell `install` invocations, one logical line each.
 *
 * Both bootstrap scripts wrap long invocations across backslash-continued lines,
 * so the mode and the paths it applies to are not on the same physical line.
 * Joining continuations first lets every assertion below be an exact token
 * comparison. The earlier version matched across newlines with an alternation
 * inside a quantifier, which is a backtracking hazard CodeQL is right to flag —
 * and a parser that can hang is a poor way to guard a security boundary.
 */
function installInvocations(text) {
  return text
    .replace(/\\\n\s*/gu, ' ')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.startsWith('install -d '));
}

/** The invocation that provisions `target` as one of its path arguments. */
function invocationFor(text, target) {
  return installInvocations(text).find((line) => line.split(/\s+/u).includes(target)) ?? null;
}

const AUTHORITY_ROOT = '/var/lib/pc-release-authority';

/* 4. The authority root is traversable by the runner group, in every author. */
for (const key of ['install', 'resume', 'controller']) {
  const declared = key === 'controller'
    ? source[key].includes('install -d -m 0710 -o root -g pcactions "$STATE_ROOT"')
    : (invocationFor(source[key], AUTHORITY_ROOT) ?? '').startsWith('install -d -m 0710 -o root -g "$RUNNER_USER"');
  if (!declared) {
    violations.push(
      `${paths[key]}: the authority root must be provisioned 0710 root:pcactions so the runner can traverse to runner-input`,
    );
  }
}

/* The authority root must never be provisioned root:root-only again. */
for (const key of ['install', 'resume']) {
  const invocation = invocationFor(source[key], AUTHORITY_ROOT);
  if (invocation !== null && invocation.includes('-o root -g root')) {
    violations.push(
      `${paths[key]}: the authority root must not be provisioned 0700 root:root — it denies the runner the search permission it needs on the ancestor`,
    );
  }
}

/* 7. Everything else under the authority root stays closed to the runner. */
for (const key of ['install', 'resume']) {
  require(key, '/var/lib/pc-release-authority/repository', 'the protected repository must still be provisioned');
  require(key, '/var/lib/pc-release-authority/controller-jobs', 'protected controller jobs must still be provisioned');
  require(key, 'install -d -m 0730 -o root -g "$RUNNER_USER" /var/lib/pc-release-authority/runner-input', 'runner-input stays write+traverse for the runner group, never readable');
  require(key, 'install -d -m 0750 -o root -g "$RUNNER_USER" /var/lib/pc-release-authority/runner-output', 'runner-output stays read-only for the runner group');
}
for (const key of ['install', 'resume']) {
  for (const child of [`${AUTHORITY_ROOT}/repository`, `${AUTHORITY_ROOT}/controller-jobs`]) {
    const invocation = invocationFor(source[key], child);
    if (invocation === null || !invocation.startsWith('install -d -m 0700 -o root -g root')) {
      violations.push(`${paths[key]}: ${child} must remain 0700 root:root and unreachable to the runner`);
    }
  }
}

/* 3. The runner's only privileged authority is the one controller command. */
for (const key of ['install', 'resume']) {
  require(key, 'pcactions ALL=(root) NOPASSWD: /usr/local/sbin/pc-tai-release-controller', 'the sudo grant must stay scoped to the controller');
  forbid(key, /NOPASSWD:\s{0,8}ALL/u, 'unrestricted sudo must never be granted to the runner');
  // Only *adding* is forbidden. Both scripts deliberately call `gpasswd -d` to
  // remove a docker membership a previous provisioning may have left behind, and
  // a pattern that cannot tell removal from addition would forbid the fix.
  // Checked per line rather than across the file so no pattern needs a wildcard
  // that could backtrack over the whole script.
  const grantsDocker = source[key]
    .split('\n')
    .map((line) => line.trim())
    .some((line) => line.includes('docker')
      && (/^usermod\b.*\B-a?G\b/u.test(line) || line.startsWith('gpasswd -a ') || /^adduser\s+\S+\s+docker$/u.test(line)));
  if (grantsDocker) violations.push(`${paths[key]}: the runner must never be added to the docker group`);
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
  ["if [[ \"$state_root_mode\" != 'root:pcactions:710' ]]", 'the shared root mode must be asserted before attempt input is created'],
  ["if [[ \"$input_root_mode\" != 'root:pcactions:730' ]]", 'the runner-input mode must be asserted before attempt input is created'],
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

/**
 * Every writer that can materialize the *shared* release-authority root.
 *
 * The boundary did not break once, it broke repeatedly, because three different
 * scripts wrote this one path and only one of them agreed on the mode. The
 * production release did `chmod 0700` (preserving the group, which is precisely
 * the root:pcactions:700 the host was found in), the controller core asserted
 * 0700 root:root mid-run, and the bootstrap created it 0700 root:root. Fixing
 * them one at a time is how this comes back, so the whole tree is scanned here
 * and any writer that asserts 0700 on the shared root fails the build.
 *
 * Per-run subdirectories under the root (`tai-qwen-<id>`, `tai-agro-os-<id>`,
 * `tai-public-acl-<id>`) are deliberately exempt: those are private scratch
 * state, 0700 is correct for them, and only the shared parent must stay
 * traversable.
 */
const SHARED_ROOT_LITERAL = '/var/lib/pc-release-authority';

function sharedRootWriters() {
  const offenders = [];
  const roots = ['scripts', '.github/workflows', 'infra', 'ops', 'automation'];
  const files = [];
  for (const root of roots) {
    let entries;
    try {
      entries = readdirSync(root, { withFileTypes: true, recursive: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (!entry.isFile()) continue;
      if (!/\.(?:sh|mjs|js|yml|yaml|service|conf)$/u.test(entry.name)) continue;
      files.push(join(entry.parentPath ?? entry.path ?? root, entry.name));
    }
  }

  for (const file of files) {
    if (file.endsWith('check-pc-release-authority-boundary.mjs')) continue;
    let text;
    try {
      text = readFileSync(file, 'utf8');
    } catch {
      continue;
    }
    if (!text.includes(SHARED_ROOT_LITERAL)) continue;

    // Does this file bind a variable to the shared root itself, rather than to a
    // per-run subdirectory beneath it?
    const bindsSharedRoot = /(?:^|\n)\s*(?:readonly\s+)?(STATE_ROOT|AUTHORITY_ROOT)=["']?\/var\/lib\/pc-release-authority["']?\s*(?:$|\n)/u.test(text);

    for (const raw of text.split('\n')) {
      const line = raw.trim();
      if (line.startsWith('#') || line.startsWith('//')) continue;
      const touchesShared = line.includes(`${SHARED_ROOT_LITERAL}"`)
        || line.includes(`${SHARED_ROOT_LITERAL} `)
        || line.endsWith(SHARED_ROOT_LITERAL)
        || (bindsSharedRoot && (line.includes('"$STATE_ROOT"') || line.includes('"$AUTHORITY_ROOT"')));
      if (!touchesShared) continue;
      // A per-run subdirectory reference is not the shared root.
      if (line.includes(`${SHARED_ROOT_LITERAL}/`)) continue;
      if (!/\b(?:install -d|chmod|chown)\b/u.test(line)) continue;
      if (line.includes('0700') || / 700\b/u.test(line)) {
        offenders.push(`${file}: ${line}`);
      }
    }
  }
  return offenders;
}

for (const offender of sharedRootWriters()) {
  violations.push(`the shared release-authority root must never be set 0700 — ${offender}`);
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
