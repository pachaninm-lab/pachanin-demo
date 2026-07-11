import fs from 'node:fs';
import path from 'node:path';

describe('staff support persistence contract', () => {
  it('uses canonical Prisma-mapped public columns', () => {
    const source = fs.readFileSync(
      path.resolve(process.cwd(), 'src/modules/staff-access/staff-support.service.ts'),
      'utf8',
    );
    expect(source).toContain('u."fullName" AS user_full_name');
    expect(source).toContain('d."dealNumber" AS deal_number');
    expect(source).not.toContain('u.full_name');
    expect(source).not.toContain('d.deal_number');
  });

  it('grants only the required support ledger operations to the runtime principal', () => {
    const migration = fs.readFileSync(
      path.resolve(process.cwd(), 'prisma/migrations/20260711110000_staff_support_cases/migration.sql'),
      'utf8',
    );
    expect(migration).toContain('GRANT USAGE ON SCHEMA support TO app_service');
    expect(migration).toContain('GRANT SELECT, INSERT ON support.case_events TO app_service');
    expect(migration).toContain('REVOKE UPDATE, DELETE ON support.case_events FROM app_service');
    expect(migration).toContain('REVOKE DELETE ON support.cases, support.access_recovery_requests FROM app_service');
    expect(migration).not.toMatch(/\bTRUNCATE\b/i);
  });
});
