import { execFileSync } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

/**
 * A stub that answers "MFA enabled. Save backup codes securely." while storing
 * nothing is worse than no endpoint at all, and this one was mounted:
 * app.module.ts listed MfaModule in its imports, so POST /api/mfa/setup/init,
 * /setup/verify and /verify were live authenticated routes in the running API.
 *
 * The rule for a dead stub is that removing it has to be provable, not
 * asserted. Removal is proved here on the two things that make a route exist in
 * a Nest application: a controller that declares the path, and a module in the
 * graph that lists that controller. Both are declared in source by decorator,
 * so their absence from the tracked source is what absence means - and a
 * revival would have to add one of them back and would fail here.
 *
 * The scan runs over `git ls-files` rather than the working tree so an
 * untracked scratch copy cannot fail the suite and, more importantly, so a
 * revival that is actually committed cannot hide from it.
 */

const REPO_ROOT = join(__dirname, '..', '..', '..', '..', '..');

/**
 * This file names every pattern it forbids, so it matches itself. A scanner
 * that counts its own text is not evidence about the code, so it is excluded
 * by path - and by path only, rather than by some "ignore test files" rule
 * that would also blind the scan to a stub revived inside a spec.
 */
const SELF = 'apps/api/src/modules/auth/decorative-mfa-removal.spec.ts';

function trackedApiSources(): string[] {
  const out = execFileSync('git', ['ls-files', 'apps/api/src', 'apps/api/test'], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
  });
  const files = out.split('\n').filter((line) => line.endsWith('.ts') && line !== SELF);
  // A scan that silently found nothing would pass every assertion below.
  expect(files.length).toBeGreaterThan(100);
  return files;
}

/**
 * Comments are documentation, not registration. A note explaining what was
 * removed names the removed class by necessity, and a scanner that counts that
 * as a live reference reports the opposite of the truth - the better the
 * comment, the louder the false positive. Both this file and the module husk
 * describe what they forbid, so every scan below reads code only.
 */
function codeOf(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//gu, ' ').replace(/(^|[^:])\/\/[^\n]*/gu, '$1 ');
}

function grepTracked(pattern: RegExp): string[] {
  return trackedApiSources().filter((file) => pattern.test(codeOf(readFileSync(join(REPO_ROOT, file), 'utf8'))));
}

describe('the decorative /api/mfa module stays removed (#4687)', () => {
  it('has no controller or service file left', () => {
    for (const gone of ['mfa.controller.ts', 'mfa.service.ts']) {
      expect(existsSync(join(REPO_ROOT, 'apps/api/src/modules/mfa', gone))).toBe(false);
    }
  });

  it('leaves the surviving module husk registering nothing', () => {
    // app.module.ts still imports MfaModule and cannot stop doing so: that file
    // is outside the default autopilot scope, so touching it needs a scope
    // file, and pc-crop-01b3 fails any PR that touches it together with one.
    // See #4765. So the husk stays - and must stay inert.
    const husk = codeOf(readFileSync(join(REPO_ROOT, 'apps/api/src/modules/mfa/mfa.module.ts'), 'utf8'));
    expect(husk).toMatch(/@Module\(\{\}\)/u);
    expect(husk).not.toContain('controllers');
    expect(husk).not.toContain('providers');
    expect(husk).not.toContain('MfaController');
    expect(husk).not.toContain('MfaService');
  });

  it('declares no controller on the api/mfa path', () => {
    expect(grepTracked(/@Controller\(\s*['"`]api\/mfa/u)).toEqual([]);
  });

  it('leaves nothing importing or providing the removed service', () => {
    expect(grepTracked(/\bMfaService\b/u)).toEqual([]);
    expect(grepTracked(/\bMfaController\b/u)).toEqual([]);
    // MfaModule survives only as its own empty declaration and the root
    // registration that cannot currently be removed - nothing else.
    expect(grepTracked(/\bMfaModule\b/u).sort()).toEqual([
      'apps/api/src/app.module.ts',
      'apps/api/src/modules/mfa/mfa.module.ts',
    ]);
  });

  it('leaves no caller of the removed routes anywhere in the API sources', () => {
    expect(grepTracked(/['"`\/]api\/mfa\//u)).toEqual([]);
  });

  it('leaves exactly one TOTP verifier, the real one', () => {
    // The declaration shape, not the call shape: `verifyTotp(secret, code)` at a
    // call site must not count, or every caller would look like a second
    // implementation. Both the exported function and the class method that used
    // to shadow it annotate the parameter, so this catches either.
    expect(grepTracked(/verifyTotp\(secret: string/u)).toEqual([
      'apps/api/src/modules/auth/auth-crypto.ts',
    ]);
    expect(grepTracked(/export function verifyTotp\b/u)).toEqual([
      'apps/api/src/modules/auth/auth-crypto.ts',
    ]);
  });

  it('leaves no second backup-code implementation storing an unsalted digest', () => {
    expect(grepTracked(/createHash\(\s*['"`]sha256['"`]\s*\)\s*\.update\(\s*code\b/u)).toEqual([]);
  });
});
