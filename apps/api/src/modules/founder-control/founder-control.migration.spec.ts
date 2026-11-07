import fs from 'fs';
import path from 'path';
import {
  FOUNDER_METRIC_DEFINITIONS,
} from './founder-control.types';

describe('R1.3 Founder control PostgreSQL authority migration', () => {
  const root = path.resolve(__dirname, '../../../../..');
  const migration = fs.readFileSync(
    path.join(
      root,
      'apps/api/prisma/migrations/20260921071500_founder_control_center/migration.sql',
    ),
    'utf8',
  );

  it('keeps the Founder read authority isolated, read-only and SECURITY DEFINER bounded', () => {
    expect(migration).toContain('CREATE ROLE pc_founder_control_read_authority');
    expect(migration).toContain('NOLOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS');
    expect(migration).toContain('must remain membership-isolated');
    expect(migration).toContain('SECURITY DEFINER');
    expect(migration).toContain("assignment.role = 'PLATFORM_OWNER'");
    expect(migration).toContain("session.mfa_verified_at >= now() - INTERVAL '15 minutes'");
    expect(migration).toContain('Founder control authority must remain read-only');
    expect(migration).not.toMatch(/GRANT\s+(INSERT|UPDATE|DELETE)/i);
  });

  it('maps every API metric definition to a real PostgreSQL relation and SQL branch', () => {
    for (const definition of FOUNDER_METRIC_DEFINITIONS) {
      expect(migration).toContain(definition.id);
      expect(migration).toContain(definition.sourceRelation);
    }
    expect(migration).not.toMatch(/mock|demo|synthetic success|fixed economics/i);
  });

  it('builds P0/P1 decisions only from canonical dispute facts with real SLA and source', () => {
    expect(migration).toContain("CASE dispute_case.severity WHEN 'CRITICAL' THEN 'P0' ELSE 'P1' END");
    expect(migration).toContain('dispute_case.sla_deadline');
    expect(migration).toContain('dispute_case.owner_user_id');
    expect(migration).toContain('dispute_case.owner_org_id');
    expect(migration).toContain("'dispute.cases'::text");
    expect(migration).toContain("'CURRENT'::text");
  });
});
