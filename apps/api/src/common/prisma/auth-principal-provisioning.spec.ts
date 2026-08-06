import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

// Every place the authentication principal is created, altered or asserted
// about. The role goes by three names — pc_auth_runtime in the isolation gate,
// one_deal_auth in the one-deal harness and its DR restore, app_auth under
// Kubernetes — and it carried BYPASSRLS in each of them, because the pre-context
// identity lookup had no other way to read a row.
//
// It has one now (#3670), so the attribute is forbidden. These assertions exist
// because the grant is invisible at the call site: a provisioning script that
// quietly restores BYPASSRLS would pass every other test in this repository
// while disabling row-level security for every statement authentication runs.
function repositoryFile(...segments: string[]): string {
  const candidates = [
    path.resolve(process.cwd(), ...segments),
    path.resolve(process.cwd(), '../..', ...segments),
  ];
  const found = candidates.find((candidate) => existsSync(candidate));
  if (!found) throw new Error(`Repository path not found: ${segments.join('/')}`);
  return readFileSync(found, 'utf8');
}

const PROVISIONING_SOURCES = [
  ['one-deal harness', 'scripts/platform-v7-one-deal-e2e.sh'],
  ['DR restore rehearsal', 'scripts/platform-v7-database-dr-rehearsal.sh'],
  ['identity isolation gate', 'scripts/platform-v7-rls-integration.sh'],
  ['Kubernetes principals', 'infra/kind/production-like/postgresql-principals-bootstrap.sql'],
  ['Kubernetes grants', 'infra/kind/production-like/postgresql-runtime-grants.sql'],
  ['Kubernetes acceptance', 'scripts/release/production-like-kubernetes-cluster.sh'],
] as const;

describe('auth principal provisioning', () => {
  it.each(PROVISIONING_SOURCES)('never grants BYPASSRLS in the %s', (_label, file) => {
    const statements = repositoryFile(file)
      .split('\n')
      .filter((line) => !/^\s*(#|--)/.test(line))
      .join('\n');
    expect(statements.match(/(?<!NO)BYPASSRLS/g) ?? []).toEqual([]);
    expect(statements).not.toMatch(/NOT\s+rolbypassrls/i);
  });

  it('creates every authentication principal as NOSUPERUSER NOBYPASSRLS', () => {
    const oneDeal = repositoryFile('scripts/platform-v7-one-deal-e2e.sh');
    expect(oneDeal).toMatch(
      /CREATE ROLE one_deal_auth LOGIN NOSUPERUSER[^;]*NOINHERIT NOBYPASSRLS/,
    );

    const kubernetes = repositoryFile('infra/kind/production-like/postgresql-principals-bootstrap.sql');
    expect(kubernetes).toMatch(
      /ALTER ROLE app_auth LOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS/,
    );

    const gate = repositoryFile('scripts/platform-v7-rls-integration.sh');
    expect(gate).toMatch(
      /CREATE ROLE pc_auth_runtime LOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS/,
    );
  });

  it('grants the bounded pre-auth surface by exact signature wherever BYPASSRLS was removed', () => {
    for (const file of [
      'scripts/platform-v7-one-deal-e2e.sh',
      'infra/kind/production-like/postgresql-runtime-grants.sql',
    ]) {
      const source = repositoryFile(file);
      expect(source).toContain('GRANT EXECUTE ON FUNCTION auth.resolve_login_identity(TEXT)');
      expect(source).toContain('GRANT EXECUTE ON FUNCTION auth.resolve_login_identity_by_id(TEXT)');
      expect(source).toContain('GRANT EXECUTE ON FUNCTION auth.resolve_login_memberships(TEXT)');
    }
  });

  it('never hands the authentication principal the staff admission surface', () => {
    const kubernetes = repositoryFile('infra/kind/production-like/postgresql-runtime-grants.sql');
    expect(kubernetes).not.toMatch(/GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA auth TO app_auth/);

    for (const file of [
      'scripts/platform-v7-one-deal-e2e.sh',
      'infra/kind/production-like/postgresql-runtime-grants.sql',
    ]) {
      const source = repositoryFile(file);
      expect(source).toMatch(/REVOKE ALL ON FUNCTION auth\.staff_admission_queue/);
      expect(source).toMatch(/REVOKE ALL ON FUNCTION auth\.staff_admission_decision/);
    }
    expect(kubernetes).toMatch(
      /REVOKE ALL ON FUNCTION auth\.resolve_staff_target_scope\(TEXT, TEXT, TEXT, TEXT, TEXT\) FROM app_auth/,
    );
  });

  it('provisions a separate function-only staff runtime in production-like Kubernetes', () => {
    const principals = repositoryFile('infra/kind/production-like/postgresql-principals-bootstrap.sql');
    expect(principals).toContain("rolname='app_staff'");
    expect(principals).toMatch(
      /ALTER ROLE app_staff LOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE/,
    );

    const grants = repositoryFile('infra/kind/production-like/postgresql-runtime-grants.sql');
    expect(grants).toContain('REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public, auth FROM app_staff');
    expect(grants).toContain('GRANT EXECUTE ON FUNCTION auth.resolve_staff_target_scope(TEXT, TEXT, TEXT, TEXT, TEXT) TO app_staff');
    expect(grants).toContain('GRANT EXECUTE ON FUNCTION auth.staff_admission_queue(TEXT, TEXT, TEXT, INTEGER) TO app_staff');
    expect(grants).toContain('GRANT EXECUTE ON FUNCTION auth.staff_admission_application(TEXT, TEXT, TEXT, TEXT) TO app_staff');
    expect(grants).toContain('GRANT EXECUTE ON FUNCTION auth.staff_admission_decision(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO app_staff');
    expect(grants).toContain('REVOKE ALL ON FUNCTION auth.staff_admission_capability(TEXT, TEXT, TEXT, TEXT, TEXT) FROM app_staff');

    const kubernetes = repositoryFile('scripts/release/production-like-kubernetes-cluster.sh');
    expect(kubernetes).toContain('STAFF_DATABASE_URL="postgresql://app_staff:');
    expect(kubernetes).toContain("rolname IN ('app_runtime','app_auth','app_staff','app_storage','app_outbox')");
    expect(kubernetes).toContain('staff_authority_proof');
    expect(kubernetes).toContain('staff_authority_proof" = "0:0:1:1:1:1:0:0');

    const example = repositoryFile('.env.example');
    expect(example).toContain('STAFF_DATABASE_URL: dedicated staff authority runtime');
  });

  it('asserts NOBYPASSRLS in the acceptance proofs rather than demanding the attribute', () => {
    const oneDeal = repositoryFile('scripts/platform-v7-one-deal-e2e.sh');
    expect(oneDeal).toContain('"$AUTH_ROLE_PROOF" != "false:false:false"');
    expect(oneDeal).toContain('AUTH_IDENTITY_PROOF');
    expect(oneDeal).toContain('AUTH_BOOTSTRAP_PROOF');

    const kubernetes = repositoryFile('scripts/release/production-like-kubernetes-cluster.sh');
    expect(kubernetes).toContain("rolname IN ('app_runtime','app_auth','app_staff','app_storage','app_outbox') AND (rolsuper OR rolbypassrls OR rolinherit)");
    expect(kubernetes).toContain('auth_identity_proof');
    expect(kubernetes).toContain('auth_bootstrap_proof');
    expect(kubernetes).toContain('user-rls-probe');
    expect(kubernetes).toContain('auth_bootstrap_proof" = "0:0:1:1');
  });

  it('re-establishes definer ownership after a no-owner no-acl restore', () => {
    const rehearsal = repositoryFile('scripts/platform-v7-database-dr-rehearsal.sh');
    expect(rehearsal).toContain('--no-owner');
    expect(rehearsal).toContain('ALTER FUNCTION %s OWNER TO pc_identity_bootstrap');
    expect(rehearsal).toContain('ALTER FUNCTION %s OWNER TO pc_staff_authority');
    expect(rehearsal).toContain('RESTORE_IDENTITY_PROOF');
    expect(rehearsal).toContain('RESTORE_AUTH_ISOLATION');
  });

  it('documents the auth and staff principals without BYPASSRLS', () => {
    const runbook = repositoryFile('docs/platform-v7/production-database-deployment-runbook.md');
    expect(runbook).toMatch(/\| Auth runtime \|[^|]*auth\.resolve_login_\*/);
    expect(runbook).toMatch(/\| Auth runtime \|[^|]*\|[^|]*`BYPASSRLS`/);
    expect(runbook).toMatch(/\| Staff runtime \|[^|]*auth\.staff_admission_\*/);

    const example = repositoryFile('.env.example');
    expect(example).toContain('AUTH_DATABASE_URL: identity role, NOSUPERUSER + NOBYPASSRLS');
    expect(example).toContain('STAFF_DATABASE_URL: dedicated staff authority runtime');
  });
});
