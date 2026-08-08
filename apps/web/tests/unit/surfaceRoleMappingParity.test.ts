import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { normalizeSurfaceRole } from '@/lib/server/auth-session-response';
import { mapApiRoleToCabinetRole } from '@/lib/platform-v7/verified-session';

/**
 * Two independent mappings decide the same thing from opposite ends of a
 * login: normalizeSurfaceRole picks the surface role when the session is
 * minted, and mapApiRoleToCabinetRole re-derives it in the platform layout
 * when the session is revalidated against /auth/me. The layout admits a
 * cabinet only when both agree, so any role the two disagree about is a role
 * that can log in and then be bounced straight back to the login page.
 *
 * That is exactly how ADMIN broke: removing the old catch-all
 * `return 'operator'` fixed a real privilege-by-fallback defect, but it also
 * removed the only branch that mapped the staff roles, leaving the operator
 * cabinet unreachable while the layout still expected ADMIN to be an operator.
 */

const API_ROLE_SOURCE = readFileSync(
  resolve(__dirname, '../../lib/platform-v7/verified-session.ts'),
  'utf8',
);

function declaredApiRoles(): string[] {
  const block = /const API_ROLE_TO_CABINET[^{]*\{([\s\S]*?)\n\};/.exec(API_ROLE_SOURCE);
  expect(block, 'API_ROLE_TO_CABINET must be parseable').not.toBeNull();
  return [...(block as RegExpExecArray)[1].matchAll(/^\s*([A-Z_]+):/gm)].map((match) => match[1]);
}

describe('surface role mapping parity', () => {
  const apiRoles = declaredApiRoles();

  it('covers every API role the platform layout knows about', () => {
    expect(apiRoles.length).toBeGreaterThanOrEqual(15);
  });

  it.each(declaredApiRoles())('agrees on %s', (apiRole) => {
    expect(normalizeSurfaceRole(apiRole)).toBe(mapApiRoleToCabinetRole(apiRole));
  });

  it('maps both staff roles to the operator cabinet', () => {
    expect(normalizeSurfaceRole('ADMIN')).toBe('operator');
    expect(normalizeSurfaceRole('SUPPORT_MANAGER')).toBe('operator');
  });

  it('still fails closed for an unrecognised role', () => {
    // The regression this replaced: an unknown role used to become an operator.
    for (const unknown of ['BANK_CALLBACK', 'ROOT', 'SUPERUSER', '', 'operator ']) {
      expect(normalizeSurfaceRole(unknown)).toBeNull();
    }
  });
});
