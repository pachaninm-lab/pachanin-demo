import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * P0.2-1A — proof that the *production* principals cannot get around the RLS
 * that keeps `public.audit_events` append-only.
 *
 * This asserts over the SQL that defines those principals, not over a live
 * connection. That is the point: an e2e suite connects as whatever role its
 * harness provisions, which is not a production principal, so asserting the
 * boundary there would prove nothing about production either way. The grant
 * definitions are the source of truth, they are deterministic, and they are
 * what a deployment actually applies.
 *
 * The residual owner/BYPASSRLS gap on this table is tracked in issue #3618 and
 * is not covered — or hidden — by anything here.
 */

const REPO_ROOT = resolve(__dirname, '../../../../../..');

function sql(relativePath: string): string {
  return readFileSync(resolve(REPO_ROOT, relativePath), 'utf8');
}

const APP_ROLE_GRANTS = 'apps/api/prisma/migrations/20260715021600_settlement_app_role_grants/migration.sql';
const EXCHANGE_PRINCIPALS = 'apps/api/prisma/migrations/20260727192500_fgis_grain_exchange_principals/migration.sql';
const QUARANTINE_AUDIT = 'apps/api/prisma/migrations/20260802150000_fgis_legacy_quarantine_audit/migration.sql';

/** Strips `--` comments so prose about SQL is never mistaken for SQL. */
function executable(source: string): string {
  return source
    .split('\n')
    .map((line) => line.replace(/--.*$/, ''))
    .join('\n');
}

/** Statement bodies that mention audit_events, split by statement. */
function statementsTouchingAuditEvents(source: string): string[] {
  return source
    .split(';')
    .map((statement) => statement.trim())
    .filter((statement) => /audit_events/.test(statement));
}

describe('production principals cannot rewrite public.audit_events', () => {
  const grants = sql(APP_ROLE_GRANTS);
  const principals = sql(EXCHANGE_PRINCIPALS);

  it('creates every application role NOSUPERUSER and NOBYPASSRLS', () => {
    // Either attribute would skip RLS entirely and make the policies decorative.
    for (const role of ['app_runtime', 'app_service', 'app_outbox']) {
      const creation = principals
        .split(';')
        .find((statement) => new RegExp(`CREATE ROLE ${role}\\b`).test(statement));
      expect(creation).toBeDefined();
      expect(creation).toContain('NOSUPERUSER');
      expect(creation).toContain('NOBYPASSRLS');
      expect(creation).toContain('NOINHERIT');
    }
  });

  it('grants the deal principal only SELECT and INSERT on audit_events', () => {
    const selectGrant = grants
      .split(';')
      .find((s) => /GRANT SELECT ON TABLE/.test(s) && /audit_events/.test(s));
    const insertGrant = grants
      .split(';')
      .find((s) => /GRANT INSERT ON TABLE/.test(s) && /audit_events/.test(s));
    expect(selectGrant).toBeDefined();
    expect(insertGrant).toBeDefined();
    expect(selectGrant).toContain('TO app_deal');
    expect(insertGrant).toContain('TO app_deal');
  });

  it('revokes DELETE on audit_events from the deal principal', () => {
    const revoke = grants
      .split(';')
      .find((s) => /REVOKE DELETE ON TABLE/.test(s) && /audit_events/.test(s));
    expect(revoke).toBeDefined();
    expect(revoke).toContain('FROM app_deal');
  });

  it('never grants UPDATE, DELETE or TRUNCATE on audit_events to any role', () => {
    // A grant here cannot be walked back by an RLS policy, and TRUNCATE is not
    // subject to RLS at all — the absent grant is the only thing stopping it.
    for (const file of [APP_ROLE_GRANTS, EXCHANGE_PRINCIPALS, QUARANTINE_AUDIT]) {
      for (const statement of statementsTouchingAuditEvents(sql(file))) {
        if (!/^\s*GRANT\b/i.test(statement)) continue;
        expect(statement).not.toMatch(/GRANT[\s\S]*\bUPDATE\b[\s\S]*audit_events/i);
        expect(statement).not.toMatch(/GRANT[\s\S]*\bDELETE\b[\s\S]*audit_events/i);
        expect(statement).not.toMatch(/GRANT[\s\S]*\bTRUNCATE\b[\s\S]*audit_events/i);
        expect(statement).not.toMatch(/GRANT\s+ALL[\s\S]*audit_events/i);
      }
    }
  });

  it('keeps audit_events under RLS with only an INSERT and a SELECT policy', () => {
    const baseline = sql('apps/api/prisma/migrations/0001_postgresql_initial/migration.sql');
    expect(baseline).toContain('ALTER TABLE "audit_events" ENABLE ROW LEVEL SECURITY');

    const policies = baseline
      .split(';')
      .filter((s) => /CREATE POLICY/.test(s) && /"audit_events"/.test(s));
    expect(policies).toHaveLength(2);
    expect(policies.join('\n')).toContain('FOR INSERT');
    expect(policies.join('\n')).toContain('FOR SELECT');
    expect(policies.join('\n')).not.toMatch(/FOR\s+(UPDATE|DELETE|ALL)\b/);
  });

  it('adds no policy, grant or trigger that would widen the boundary', () => {
    // Comments are stripped: this migration explains at length why it adds no
    // trigger and no bypass, and that prose must not read as the thing itself.
    const migration = executable(sql(QUARANTINE_AUDIT));
    expect(migration).not.toMatch(/CREATE POLICY/i);
    expect(migration).not.toMatch(/CREATE TRIGGER/i);
    expect(migration).not.toMatch(/DISABLE TRIGGER/i);
    expect(migration).not.toMatch(/FORCE ROW LEVEL SECURITY/i);
    // The only grant it makes is EXECUTE on the append command.
    const grantStatements = migration
      .split(';')
      .filter((s) => /GRANT/i.test(s));
    for (const statement of grantStatements) {
      expect(statement).toMatch(/GRANT EXECUTE ON FUNCTION/i);
    }
  });

  it('exposes the append command only through EXECUTE, revoked from PUBLIC', () => {
    const migration = sql(QUARANTINE_AUDIT);
    expect(migration).toContain('REVOKE ALL ON FUNCTION public.record_fgis_legacy_quarantine_denial(');
    expect(migration).toContain("ARRAY['app_deal', 'app_service', 'app_runtime']");
  });
});
