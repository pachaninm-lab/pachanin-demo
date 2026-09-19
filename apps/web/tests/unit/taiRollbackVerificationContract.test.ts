import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { afterAll, describe, expect, it } from 'vitest';

/**
 * The rollback path only runs during an incident, which is why its defect
 * survived so long.
 *
 * `rollback_images` escaped the double quotes inside a single-quoted Go
 * template. A backslash inside single quotes escapes nothing in the shell, so
 * Docker received literal backslashes and rejected both reads with
 * `unexpected "\" in operand`. Both revision variables came back empty, the
 * comparisons could never hold, and the path reported AUTOMATIC_ROLLBACK_FAILED
 * whatever had actually happened to the containers — a verifier that could not
 * pass, reported as a restore that did not work.
 *
 * `bash -n` cannot see this: the shell syntax is valid and only Docker's parser
 * objects. So the guard is a source scan, and these tests run the real checker
 * against a deliberately broken copy to prove it fires rather than trusting
 * that it would.
 */

const root = path.resolve(process.cwd(), '../..');
const executorPath = path.join(root, 'scripts/production-full-stack-exact-sha.sh');
const executor = fs.readFileSync(executorPath, 'utf8');

/** Files the release checker reads, relative to the repository root. */
const CHECKER = 'scripts/check-production-full-stack-release.mjs';
const CHECKED_FILES = [
  CHECKER,
  '.github/workflows/docker-publish.yml',
  '.github/workflows/production-full-stack-exact-sha.yml',
  '.github/workflows/platform-v7-safe-merge.yml',
  'apps/web/middleware.ts',
  'scripts/production-full-stack-exact-sha.sh',
  'scripts/production-full-stack-live-acceptance.sh',
  'apps/web/i18n/platform-v7-hero-message.ts',
  'docs/platform-v7/autopilot/scopes/production-full-stack-release-v1.json',
] as const;

const workspaces: string[] = [];

/** A minimal copy of the repository the release checker can run against. */
function stagedRepository(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pc-rollback-'));
  workspaces.push(dir);
  for (const relative of CHECKED_FILES) {
    const destination = path.join(dir, relative);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.copyFileSync(path.join(root, relative), destination);
  }
  return dir;
}

function runChecker(cwd: string) {
  const result = spawnSync(process.execPath, [CHECKER], { cwd, encoding: 'utf8' });
  return { status: result.status, output: `${result.stdout ?? ''}${result.stderr ?? ''}` };
}

afterAll(() => {
  for (const dir of workspaces) fs.rmSync(dir, { recursive: true, force: true });
});

describe('the release contract rejects a Go template Docker would refuse', () => {
  it('passes on the repository as it stands', () => {
    const { status, output } = runChecker(stagedRepository());

    expect(output).toContain('PASS:');
    expect(status).toBe(0);
  });

  it('fails when the escaped-quote template is reintroduced', () => {
    const dir = stagedRepository();
    const target = path.join(dir, 'scripts/production-full-stack-exact-sha.sh');
    fs.writeFileSync(
      target,
      fs.readFileSync(target, 'utf8').replace(
        `docker inspect --format '{{ index .Config.Labels "org.opencontainers.image.revision" }}' "$1"`,
        `docker inspect --format '{{ index .Config.Labels \\"org.opencontainers.image.revision\\" }}' "$1"`,
      ),
      'utf8',
    );

    const { status, output } = runChecker(dir);

    expect(status).not.toBe(0);
    expect(output).toContain('Go template escapes double quotes inside single quotes');
  });

  it('fails when the distinct rollback outcomes are collapsed back into one', () => {
    const dir = stagedRepository();
    const target = path.join(dir, 'scripts/production-full-stack-exact-sha.sh');
    fs.writeFileSync(
      target,
      fs.readFileSync(target, 'utf8')
        .replace('fail ROLLBACK_REVISION_UNREADABLE 57', 'fail AUTOMATIC_ROLLBACK_FAILED 50')
        .replace('fail ROLLBACK_REVISION_MISMATCH 58', 'fail AUTOMATIC_ROLLBACK_FAILED 50'),
      'utf8',
    );

    const { status, output } = runChecker(dir);

    expect(status).not.toBe(0);
    expect(output).toContain('ROLLBACK_REVISION_UNREADABLE');
  });
});

describe('rollback cannot report success it did not verify', () => {
  const rollback = executor.slice(
    executor.indexOf('rollback_images() {'),
    executor.indexOf('verify_durable_intake_local_postgres()'),
  );

  it('reads both revisions through the corrected template', () => {
    expect(executor).toContain('container_revision() {');
    expect(executor).toContain(
      `  docker inspect --format '{{ index .Config.Labels "org.opencontainers.image.revision" }}' "$1"`,
    );
    expect(rollback).toContain('restored_api_revision="$(container_revision "$restored_api_id")" || return 2');
    expect(rollback).toContain('restored_web_revision="$(container_revision "$restored_web_id")" || return 2');
  });

  it('treats an unreadable revision as a different failure from a wrong one', () => {
    // Unreadable → 2, mismatched → 3. Collapsing them is what turned a broken
    // verifier into a report about the containers.
    expect(rollback).toContain('is_revision "$restored_api_revision" || return 2');
    expect(rollback).toContain('is_revision "$restored_web_revision" || return 2');
    expect(rollback).toContain('[[ "$restored_api_revision" == "$BASELINE_API_REVISION" ]] || return 3');
    expect(rollback).toContain('[[ "$restored_web_revision" == "$BASELINE_WEB_REVISION" ]] || return 3');
  });

  it('maps each outcome to its own error code, and all of them still fail', () => {
    expect(executor).toContain('fail ROLLBACK_REVISION_UNREADABLE 57');
    expect(executor).toContain('fail ROLLBACK_REVISION_MISMATCH 58');
    expect(executor).toContain('fail AUTOMATIC_ROLLBACK_FAILED 50');

    // None of the three may fall through to the success markers.
    const rollbackAction = executor.slice(executor.indexOf('if [[ "$ACTION" == rollback ]]; then'));
    const successAt = rollbackAction.indexOf("printf 'ROLLBACK_COMPLETE=1\\n'");
    for (const code of ['ROLLBACK_REVISION_UNREADABLE', 'ROLLBACK_REVISION_MISMATCH', 'AUTOMATIC_ROLLBACK_FAILED']) {
      expect(rollbackAction.indexOf(code)).toBeGreaterThan(-1);
      expect(rollbackAction.indexOf(code)).toBeLessThan(successAt);
    }
  });

  it('only claims success after both revisions matched their baseline', () => {
    const rollbackAction = executor.slice(executor.indexOf('if [[ "$ACTION" == rollback ]]; then'));

    expect(rollbackAction).toContain("printf 'ROLLBACK_COMPLETE=1\\n'");
    expect(rollbackAction).toContain("printf 'ROLLBACK_CONTAINER_REVISIONS_VERIFIED=1\\n'");
    expect(rollbackAction).toContain("printf 'RESTORED_API_REVISION=%s\\n' \"$restored_api_revision\"");
    expect(rollbackAction).toContain("printf 'RESTORED_WEB_REVISION=%s\\n' \"$restored_web_revision\"");
  });

  it('keeps the executor a valid shell program', () => {
    const result = spawnSync('bash', ['-n', executorPath], { encoding: 'utf8' });

    expect(result.stderr.trim()).toBe('');
    expect(result.status).toBe(0);
  });
});
