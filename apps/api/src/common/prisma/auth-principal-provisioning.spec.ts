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
    // Comments are stripped first. These files explain at length why the
    // attribute is gone, and a guard that cannot tell an explanation from a
    // grant would force the explanations out — the opposite of what it is for.
    const statements = repositoryFile(file)
      .split('\n')
      .filter((line) => !/^\s*(#|--)/.test(line))
      .join('\n');
    // NOBYPASSRLS contains BYPASSRLS as a substring, so the boundary matters:
    // only an occurrence not preceded by NO is a grant of the attribute.
    expect(statements.match(/(?<!NO)BYPASSRLS/g) ?? []).toEqual([]);
    // And no proof may demand it, which is how the attribute survived the last
    // two reviews: the assertion said "count roles that are NOT bypassrls".
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
    // Revoking the attribute without these leaves authentication unable to read
    // an identity at all, which is a broken product rather than a boundary.
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
    // A blanket "ALL FUNCTIONS IN SCHEMA auth" grant used to do exactly that the
    // moment 20260806103000 created those functions.
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
  });

  it('asserts NOBYPASSRLS in the acceptance proofs rather than demanding the attribute', () => {
    const oneDeal = repositoryFile('scripts/platform-v7-one-deal-e2e.sh');
    // The proof reads super:bypass:deal-select. It used to require "false:true:false".
    expect(oneDeal).toContain('"$AUTH_ROLE_PROOF" != "false:false:false"');
    expect(oneDeal).toContain('AUTH_IDENTITY_PROOF');
    expect(oneDeal).toContain('AUTH_BOOTSTRAP_PROOF');

    const kubernetes = repositoryFile('scripts/release/production-like-kubernetes-cluster.sh');
    // app_auth is counted alongside the other runtimes now, rather than being
    // held to the inverse condition.
    expect(kubernetes).toContain("rolname IN ('app_runtime','app_auth','app_storage','app_outbox') AND (rolsuper OR rolbypassrls OR rolinherit)");
    expect(kubernetes).toContain('auth_identity_proof');
    expect(kubernetes).toContain('auth_bootstrap_proof');
    // The bootstrap proof plants a probe identity, so it cannot pass merely
    // because the database is empty at that point in the deployment.
    expect(kubernetes).toContain('user-rls-probe');
    expect(kubernetes).toContain('auth_bootstrap_proof" = "0:0:1:1');
  });

  it('re-establishes definer ownership after a no-owner no-acl restore', () => {
    // pg_restore --no-owner --no-acl is what keeps a restore independent of the
    // source cluster's roles, and it is also what returns every SECURITY DEFINER
    // function to the restoring superuser. Recovery has to put them back.
    const rehearsal = repositoryFile('scripts/platform-v7-database-dr-rehearsal.sh');
    expect(rehearsal).toContain('--no-owner');
    expect(rehearsal).toContain('ALTER FUNCTION %s OWNER TO pc_identity_bootstrap');
    expect(rehearsal).toContain('ALTER FUNCTION %s OWNER TO pc_staff_authority');
    expect(rehearsal).toContain('RESTORE_IDENTITY_PROOF');
    expect(rehearsal).toContain('RESTORE_AUTH_ISOLATION');
  });

  it('documents the auth principal without BYPASSRLS', () => {
    const runbook = repositoryFile('docs/platform-v7/production-database-deployment-runbook.md');
    expect(runbook).toMatch(/\| Auth runtime \|[^|]*auth\.resolve_login_\*/);
    expect(runbook).toMatch(/\| Auth runtime \|[^|]*\|[^|]*`BYPASSRLS`/);

    const example = repositoryFile('.env.example');
    expect(example).toContain('AUTH_DATABASE_URL: identity role, NOSUPERUSER + NOBYPASSRLS');
  });
});
