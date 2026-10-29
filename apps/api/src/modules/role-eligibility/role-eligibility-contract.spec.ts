import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(__dirname, '../../../../..');
const migration = fs.readFileSync(path.join(root, 'apps/api/prisma/migrations/20260902140000_role_eligibility_shadow/migration.sql'), 'utf8');
const supersededMigration = fs.readFileSync(path.join(root, 'apps/api/prisma/migrations/20260902143000_role_eligibility_superseded_current_guard/migration.sql'), 'utf8');
const worker = fs.readFileSync(path.join(root, 'apps/api/src/modules/role-eligibility/role-eligibility-worker.service.ts'), 'utf8');
const appModule = fs.readFileSync(path.join(root, 'apps/api/src/app.module.ts'), 'utf8');
const registerDto = fs.readFileSync(path.join(root, 'apps/api/src/modules/auth/dto/register.dto.ts'), 'utf8');

describe('Role Eligibility production contract', () => {
  it('uses a separate PostgreSQL authority and bounded observer', () => {
    expect(migration).toContain('CREATE SCHEMA IF NOT EXISTS eligibility');
    expect(migration).toContain('CREATE ROLE pc_role_eligibility_observer');
    expect(migration).toMatch(/ALTER ROLE pc_role_eligibility_observer WITH\s+NOLOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE/);
    expect(migration).toContain('auth.read_role_eligibility_candidates');
    expect(migration).toContain('REVOKE ALL ON TABLE auth.registration_applications FROM pc_role_eligibility_observer');
    expect(migration).not.toMatch(/GRANT\s+(?:SELECT|INSERT|UPDATE|DELETE)[^;]+auth\.registration_applications\s+TO\s+pc_role_eligibility_observer/i);
  });

  it('does not mutate registration authority in eligibility migrations', () => {
    for (const source of [migration, supersededMigration]) {
      expect(source).not.toMatch(/(?:INSERT\s+INTO|UPDATE|DELETE\s+FROM)\s+auth\.registration_applications/i);
      expect(source).not.toMatch(/ALTER\s+TABLE\s+auth\.registration_applications/i);
    }
  });

  it('publishes terminal verdict, history, audit and outbox inside one PostgreSQL function', () => {
    expect(supersededMigration).toContain('CREATE OR REPLACE FUNCTION eligibility.publish_verdict');
    expect(supersededMigration).toContain('INSERT INTO eligibility.verdicts');
    expect(supersededMigration).toContain('INSERT INTO eligibility.verdict_history');
    expect(supersededMigration).toContain('INSERT INTO eligibility.audit_events');
    expect(supersededMigration).toContain('INSERT INTO eligibility.outbox');
    expect(supersededMigration).toContain('ELIGIBLE requires authoritative source provenance');
  });

  it('keeps SUPERSEDED as history only and never current', () => {
    expect(supersededMigration).toContain("v_is_current BOOLEAN := p_new_verdict <> 'SUPERSEDED'");
    expect(supersededMigration).toContain('IF v_is_current AND v_previous_id IS NOT NULL THEN');
    expect(supersededMigration).toContain('COALESCE(p_reason_codes');
    expect(supersededMigration).toMatch(/p_idempotency_key,\s*v_is_current,\s*v_now/);
  });

  it('has append-only evidence, history and audit', () => {
    expect(migration).toContain('CREATE TRIGGER evidence_append_only');
    expect(migration).toContain('CREATE TRIGGER verdict_history_append_only');
    expect(migration).toContain('CREATE TRIGGER audit_events_append_only');
  });

  it('uses an atomic validated generation switch', () => {
    expect(migration).toContain('eligibility.activate_registry_generation');
    expect(migration).toContain("status = 'VALIDATED'");
    expect(migration).toContain("status = 'ACTIVE'");
  });

  it('re-reads application authority before terminal publish and can SUPERSEDE', () => {
    expect(worker).toContain('beforePublish = await this.repository.readCandidate');
    expect(worker).toContain("this.publish(check, 'SUPERSEDED'");
    expect(worker).toContain('applicationVersion !== check.applicationVersion');
    expect(worker).toContain('requestedRole !== check.requestedRole');
    expect(worker).toContain('applicationStatus !== startCandidate.applicationStatus');
  });

  it('wires eligibility additively and leaves registration DTO semantics intact', () => {
    expect(appModule).toContain('RoleEligibilityModule');
    expect(registerDto).toContain("'seller'");
    expect(registerDto).toContain("'employee'");
    expect(registerDto).not.toContain('eligibility');
  });

  it('does not support production enforcement in first release', () => {
    const service = fs.readFileSync(path.join(root, 'apps/api/src/modules/role-eligibility/role-eligibility.service.ts'), 'utf8');
    expect(service).toContain('enforcement: false');
    expect(service).toContain('ROLE_ELIGIBILITY_ENFORCEMENT_UNSUPPORTED_IN_SHADOW_RELEASE');
  });
});
