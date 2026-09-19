import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), 'utf8');
}

const openGate = source('app/api/platform-v7/cabinet-lock-login/route.ts');
const canonicalLogin = source('app/api/auth/login/route.ts');
const identity = source('app/auth/me/route.ts');
const staffFixture = source('app/staff/[...path]/route.ts');
const sessionResponse = source('lib/server/auth-session-response.ts');

const roles = [
  'operator',
  'buyer',
  'seller',
  'logistics',
  'driver',
  'surveyor',
  'elevator',
  'lab',
  'bank',
  'arbitrator',
  'compliance',
  'executive',
];

describe('Platform V7 controlled test access', () => {
  it('keeps the legacy open gate role accounts bound to one server-side role', () => {
    for (const role of roles) {
      expect(openGate).toContain(`'${role}.test': '${role}'`);
    }
    expect(openGate).toContain("reason: 'role_mismatch'");
    expect(openGate).toContain('effectiveRole = fixedRole as string');
  });

  it('supports the canonical login page with valid email-form test identities', () => {
    for (const role of roles) {
      expect(canonicalLogin).toContain(`'${role}.test@procent-agro.test'`);
    }
    expect(canonicalLogin).toContain('const controlled = controlledPayload(email, password)');
    expect(canonicalLogin).toContain("payload.staffOwner ? '/platform-v7/staff' : platformHome(role)");
  });

  it('requires explicit expiry and server-side secrets', () => {
    expect(canonicalLogin).toContain('PC_CABINET_TEST_ACCESS');
    expect(canonicalLogin).toContain('PC_CABINET_TEST_ACCESS_EXPIRES_AT');
    expect(canonicalLogin).toContain('PC_CABINET_ROLE_PASSWORD');
    expect(canonicalLogin).toContain('PC_CABINET_SESSION_SECRET');
    expect(canonicalLogin).toContain('timingSafeEqual');
    expect(sessionResponse).toContain('process.env.JWT_SECRET || process.env.PC_CABINET_SESSION_SECRET');
  });

  it('keeps Staff Control Center restricted to the signed owner account', () => {
    expect(canonicalLogin).toContain('staffOwner: account.owner');
    expect(identity).toContain('staffOwner: owner');
    expect(staffFixture).toContain('claims.owner !== true');
    expect(staffFixture).toContain("return json({ code: 'OWNER_ACCESS_REQUIRED' }, 403)");
  });

  it('uses stable token expiry when Staff BFF verifies activated sessions', () => {
    expect(staffFixture).toContain('new Date(claims.exp * 1000).toISOString()');
    expect(staffFixture).toContain("session('CONTROL_PLANE', claims)");
    expect(staffFixture).toContain("session('VIEW_AS', claims)");
  });
});
