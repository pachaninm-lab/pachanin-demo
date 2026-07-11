import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(
  resolve(process.cwd(), 'app/api/platform-v7/cabinet-lock-login/route.ts'),
  'utf8',
);

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
  it('keeps every role-specific account bound to one server-side role', () => {
    for (const role of roles) {
      expect(source).toContain(`'${role}.test': '${role}'`);
    }
    expect(source).toContain("reason: 'role_mismatch'");
    expect(source).toContain('effectiveRole = fixedRole as string');
  });

  it('requires an explicit time-bound test-access switch and server-side secrets', () => {
    expect(source).toContain("PC_CABINET_TEST_ACCESS");
    expect(source).toContain("PC_CABINET_TEST_ACCESS_EXPIRES_AT");
    expect(source).toContain("PC_CABINET_ROLE_PASSWORD");
    expect(source).toContain("PC_CABINET_SESSION_SECRET");
    expect(source).toContain("reason: 'cabinet_not_configured'");
  });

  it('preserves an owner-only account that can select any test cabinet', () => {
    expect(source).toContain("accountType: 'owner_test' | 'role_test'");
    expect(source).toContain("accountType = 'owner_test'");
    expect(source).toContain('ownerPasswords.some');
  });
});
