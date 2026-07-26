import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Owner decision of 26.07.2026: TAI is INFORMATIONAL_ONLY / READ_ONLY for every role in
 * this industrial release. The user performs every platform action by hand, so the UI must
 * offer no control that confirms or executes a TAI-produced write.
 *
 * The API and the Python runtime enforce this on their own side. This test covers the part
 * neither of them can see: a button that exists in the UI is a promise to the user, and a
 * confirm/execute control for an AI action would be a promise the platform must not make —
 * even while every server path refuses it.
 *
 * It scans source rather than rendering, deliberately. Rendering proves a control is absent
 * from the screens the test happens to mount; scanning proves the identifiers are absent
 * from the app at all, including screens nobody remembered to mount.
 */

const SOURCE_ROOTS = ['app', 'components', 'lib', 'hooks'];
const SOURCE_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx'];
const SKIP_DIRECTORIES = new Set(['node_modules', '.next', 'dist', 'build', 'coverage']);

/** Identifiers that only exist if a TAI write path is wired into the UI. */
const FORBIDDEN_IDENTIFIERS = [
  'prepareCommandDraft',
  'acknowledgeRisk',
  'platform.deal-command-draft',
  'prepared_actions',
  'preparedActions',
  '/v1/platform/actions/confirm',
  'actions/confirm',
  'requiresExplicitUserConfirmation',
  'explicit_user_confirmation',
  'explicitUserConfirmation',
];

function* walk(directory: string): Generator<string> {
  let entries: string[];
  try {
    entries = readdirSync(directory);
  } catch {
    return;
  }
  for (const entry of entries) {
    if (SKIP_DIRECTORIES.has(entry)) continue;
    const path = join(directory, entry);
    if (statSync(path).isDirectory()) {
      yield* walk(path);
      continue;
    }
    if (SOURCE_EXTENSIONS.some((extension) => entry.endsWith(extension))) yield path;
  }
}

function sourceFiles(): string[] {
  return SOURCE_ROOTS.flatMap((root) => [...walk(join(process.cwd(), root))]);
}

describe('TAI informational-only UI boundary', () => {
  const files = sourceFiles();

  it('scans a non-empty source tree', () => {
    // Without this, an unreadable or renamed directory would make every assertion below
    // pass while checking nothing.
    expect(files.length).toBeGreaterThan(100);
  });

  it.each(FORBIDDEN_IDENTIFIERS)('shows no UI surface for %s', (identifier) => {
    const offenders = files
      .filter((path) => readFileSync(path, 'utf8').includes(identifier))
      .map((path) => path.slice(process.cwd().length + 1));

    expect(offenders).toEqual([]);
  });

  it('never sends the user to a TAI action-confirmation route', () => {
    const offenders: string[] = [];
    for (const path of files) {
      const source = readFileSync(path, 'utf8');
      // A confirm route reached via string building would slip past a literal match.
      if (/platform\/actions/.test(source) || /taiConfirm|confirmTaiAction/i.test(source)) {
        offenders.push(path.slice(process.cwd().length + 1));
      }
    }

    expect(offenders).toEqual([]);
  });
});
