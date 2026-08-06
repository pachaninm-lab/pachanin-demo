import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

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

const STAFF_EXTERNAL_FUNCTIONS = [
  'auth.resolve_staff_target_scope(TEXT, TEXT, TEXT, TEXT, TEXT)',
  'auth.resolve_staff_deal_target_scope(TEXT, TEXT, TEXT)',
  'auth.staff_admission_queue(TEXT, TEXT, TEXT, INTEGER)',
  'auth.staff_admission_application(TEXT, TEXT, TEXT, TEXT)',
  'auth.staff_admission_decision(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT)',
  'auth.staff_organization_directory(TEXT, TEXT, TEXT)',
  'auth.staff_organization_users(TEXT, TEXT, TEXT, TEXT)',
  'auth.staff_cabinet_deals(TEXT, TEXT, TEXT, TEXT, TEXT)',
] as const;

const STAFF_INTERNAL_FUNCTIONS = [
  'auth.staff_admission_capability(TEXT, TEXT, TEXT, TEXT, TEXT)',
  'auth.staff_projection_capability(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN)',
] as const;

describe('auth and staff principal provisioning', () => {
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

  it('grants the complete bounded pre-auth surface by exact signature where BYPASSRLS was removed', () => {
    for (const file of [
      'scripts/platform-v7-one-deal-e2e.sh',
      'infra/kind/production-like/postgresql-runtime-grants.sql',
    ]) {
      const source = repositoryFile(file);
      for (const signature of [
        'auth.resolve_login_identity(TEXT)',
        'auth.resolve_login_identity_by_id(TEXT)',
        'auth.resolve_login_memberships(TEXT)',
        'auth.resolve_login_memberships_ordered(TEXT)',
        'auth.resolve_login_context_by_email(TEXT)',
        'auth.resolve_login_context_by_membership(TEXT, TEXT)',
        'auth.resolve_session_identity(TEXT, TEXT, TEXT, TEXT)',
      ]) {
        expect(source).toContain(`GRANT EXECUTE ON FUNCTION ${signature}`);
      }
    }
  });

  it('never hands the authentication principal the staff authority surface', () => {
    const kubernetes = repositoryFile('infra/kind/production-like/postgresql-runtime-grants.sql');
    expect(kubernetes).not.toMatch(/GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA auth TO app_auth/);

    for (const file of [
      'scripts/platform-v7-one-deal-e2e.sh',
      'infra/kind/production-like/postgresql-runtime-grants.sql',
    ]) {
      const source = repositoryFile(file);
      for (const signature of STAFF_EXTERNAL_FUNCTIONS) {
        const escaped = signature.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        expect(source).toMatch(new RegExp(`REVOKE ALL ON FUNCTION ${escaped}`));
      }
    }
  });

  it('provisions a separate function-only staff runtime in the one-deal harness', () => {
    const oneDeal = repositoryFile('scripts/platform-v7-one-deal-e2e.sh');
    expect(oneDeal).toContain('ONE_DEAL_STAFF_URL');
    expect(oneDeal).toMatch(
      /CREATE ROLE one_deal_staff LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS/,
    );
    expect(oneDeal).toContain('REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public, auth FROM one_deal_staff');
    for (const signature of STAFF_EXTERNAL_FUNCTIONS) {
      expect(oneDeal).toContain(`GRANT EXECUTE ON FUNCTION ${signature} TO one_deal_staff`);
    }
    for (const signature of STAFF_INTERNAL_FUNCTIONS) {
      expect(oneDeal).toContain(`REVOKE ALL ON FUNCTION ${signature} FROM one_deal_staff`);
    }
    expect(oneDeal).toContain('STAFF_DATABASE_URL="$STAFF_URL"');
    expect(oneDeal).toContain('STAFF_ROLE_PROOF');
    expect(oneDeal).toContain('f:f:f:0:t:t:t:t:t:t:t:t:f:f');
  });

  it('provisions a separate function-only staff runtime in production-like Kubernetes', () => {
    const principals = repositoryFile('infra/kind/production-like/postgresql-principals-bootstrap.sql');
    expect(principals).toContain("rolname='app_staff'");
    expect(principals).toMatch(
      /ALTER ROLE app_staff LOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE/,
    );

    const grants = repositoryFile('infra/kind/production-like/postgresql-runtime-grants.sql');
    expect(grants).toContain('REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public, auth FROM app_staff');
    for (const signature of STAFF_EXTERNAL_FUNCTIONS) {
      expect(grants).toContain(`GRANT EXECUTE ON FUNCTION ${signature} TO app_staff`);
    }
    for (const signature of STAFF_INTERNAL_FUNCTIONS) {
      expect(grants).toContain(`REVOKE ALL ON FUNCTION ${signature} FROM app_staff`);
    }

    const kubernetes = repositoryFile('scripts/release/production-like-kubernetes-cluster.sh');
    expect(kubernetes).toContain('STAFF_DATABASE_URL="postgresql://app_staff:');
    expect(kubernetes).toContain("rolname IN ('app_runtime','app_auth','app_staff','app_storage','app_outbox')");
    expect(kubernetes).toContain('staff_authority_proof');
    expect(kubernetes).toContain('staff_authority_proof" = "0:0:1:1:1:1:1:1:1:1:0:0:0');

    const example = repositoryFile('.env.example');
    expect(example).toContain('STAFF_DATABASE_URL: dedicated staff authority runtime');
  });

  it('restores the same auth/staff split after no-owner no-acl DR', () => {
    const rehearsal = repositoryFile('scripts/platform-v7-database-dr-rehearsal.sh');
    expect(rehearsal).toContain('--no-owner');
    expect(rehearsal).toContain('--no-acl');
    expect(rehearsal).toContain('DR_RESTORE_STAFF_URL');
    expect(rehearsal).toContain('ALTER FUNCTION %s OWNER TO pc_identity_bootstrap');
    expect(rehearsal).toContain('ALTER FUNCTION %s OWNER TO pc_staff_authority');
    for (const signature of [
      'auth.resolve_staff_target_scope(text,text,text,text,text)',
      'auth.resolve_staff_deal_target_scope(text,text,text)',
      'auth.staff_admission_queue(text,text,text,integer)',
      'auth.staff_admission_application(text,text,text,text)',
      'auth.staff_admission_decision(text,text,text,text,text,text)',
      'auth.staff_organization_directory(text,text,text)',
      'auth.staff_organization_users(text,text,text,text)',
      'auth.staff_cabinet_deals(text,text,text,text,text)',
    ]) {
      expect(rehearsal).toContain(`GRANT EXECUTE ON FUNCTION ${signature} TO one_deal_staff`);
    }
    expect(rehearsal).toContain('REVOKE ALL ON FUNCTION auth.staff_projection_capability(text,text,text,text,text,text,boolean) FROM one_deal_staff');
    expect(rehearsal).toContain('REVOKE ALL ON FUNCTION auth.resolve_staff_target_scope(text,text,text,text,text) FROM one_deal_auth');
    expect(rehearsal).toContain('REVOKE ALL ON FUNCTION auth.resolve_staff_deal_target_scope(text,text,text) FROM one_deal_auth');
    expect(rehearsal).toContain('REVOKE ALL ON FUNCTION auth.staff_organization_directory(text,text,text) FROM one_deal_auth');
    expect(rehearsal).toContain('RESTORE_IDENTITY_PROOF');
    expect(rehearsal).toContain('RESTORE_STAFF_PROOF');
    expect(rehearsal).toContain('RESTORE_AUTH_ISOLATION');
    expect(rehearsal).toContain('STAFF_DATABASE_URL="$RESTORE_STAFF_URL"');
    expect(rehearsal).toContain('0:1:1:1:1:1:1:1:1:0:0:0:0:0');
  });

  it('asserts NOBYPASSRLS in the acceptance proofs rather than demanding the attribute', () => {
    const oneDeal = repositoryFile('scripts/platform-v7-one-deal-e2e.sh');
    expect(oneDeal).toContain('"$AUTH_ROLE_PROOF" != "false:false:false"');
    expect(oneDeal).toContain('AUTH_IDENTITY_PROOF');
    expect(oneDeal).toContain('AUTH_BOOTSTRAP_PROOF');
    expect(oneDeal).toContain('STAFF_ROLE_PROOF');

    const kubernetes = repositoryFile('scripts/release/production-like-kubernetes-cluster.sh');
    expect(kubernetes).toContain("rolname IN ('app_runtime','app_auth','app_staff','app_storage','app_outbox') AND (rolsuper OR rolbypassrls OR rolinherit)");
    expect(kubernetes).toContain('auth_identity_proof');
    expect(kubernetes).toContain('auth_bootstrap_proof');
    expect(kubernetes).toContain('staff_authority_proof');
    expect(kubernetes).toContain('user-rls-probe');
    expect(kubernetes).toContain('auth_bootstrap_proof" = "0:0:1:1');
  });

  it('documents the auth and staff principals without BYPASSRLS', () => {
    const runbook = repositoryFile('docs/platform-v7/production-database-deployment-runbook.md');
    expect(runbook).toMatch(/\| Auth runtime \|[^|]*auth\.resolve_login_\*/);
    expect(runbook).toMatch(/\| Auth runtime \|[^|]*\|[^|]*`BYPASSRLS`/);
    expect(runbook).toMatch(/\| Staff runtime[^|]*\|[^|]*auth\.resolve_staff_target_scope/);
    expect(runbook).toMatch(/\| Staff runtime[^|]*\|[^|]*auth\.staff_admission_\*/);
    expect(runbook).toMatch(/\| Staff runtime[^|]*\|[^|]*auth\.staff_(organization|cabinet)_/);

    const example = repositoryFile('.env.example');
    expect(example).toContain('AUTH_DATABASE_URL: identity role, NOSUPERUSER + NOBYPASSRLS');
    expect(example).toContain('STAFF_DATABASE_URL: dedicated staff authority runtime');
    expect(example).toContain('secret-bound staff projection');
  });
});
