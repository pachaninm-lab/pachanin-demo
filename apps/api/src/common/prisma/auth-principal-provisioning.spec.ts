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

const AUTH_RUNTIME_FUNCTIONS = [
  'auth.resolve_login_credential(TEXT)',
  'auth.resolve_login_default_membership(TEXT)',
  'auth.resolve_login_context_by_membership(TEXT, TEXT)',
  'auth.resolve_session_identity(TEXT, TEXT, TEXT, TEXT)',
  'auth.resolve_post_password_membership_ids(TEXT)',
  'auth.resolve_post_password_membership_context(TEXT, TEXT)',
  'auth.resolve_session_identity_v2(TEXT, TEXT, TEXT, TEXT)',
  'auth.finalize_authenticated_user_mfa(TEXT, TEXT, TEXT)',
  'auth.prepare_pending_registration_identity(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT)',
  'auth.restart_pending_registration_identity(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT)',
  'auth.mark_registration_email_verified(TEXT, TEXT, TEXT)',
  'auth.registration_join_notification_recipients(TEXT, TEXT, TEXT)',
  'auth.resolve_password_reset_subject(TEXT)',
  'auth.replace_password_after_reset(TEXT, TEXT, TEXT, TIMESTAMPTZ)',
  'auth.upgrade_password_hash_format(TEXT, TEXT, TEXT)',
  'auth.organization_team_snapshot(TEXT, TEXT, TEXT, TEXT, TEXT)',
  'auth.resolve_organization_admin_session(TEXT, TEXT, TEXT, TEXT, TEXT)',
  'auth.organization_membership_exists_for_email(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT)',
  'auth.resolve_invitation_acceptance_credential(TEXT, TEXT)',
  'auth.accept_organization_invitation_identity(TEXT, TEXT, BIGINT, TEXT, TEXT, BOOLEAN, TEXT, TEXT, TEXT, TEXT)',
  'auth.change_organization_membership_role(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, BIGINT, TEXT)',
  'auth.revoke_organization_membership(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, BIGINT)',
  'auth.prepare_organization_mfa_recovery_target(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, BIGINT)',
  'auth.organization_mfa_recovery_snapshot(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT)',
  'auth.resolve_mfa_recovery_identity(TEXT, TEXT)',
  'auth.finalize_mfa_recovery_identity(TEXT, TEXT, TEXT, BIGINT)',
  'auth.registration_platform_actor_authorized(TEXT, TEXT)',
  'auth.registration_organization_admin_context(TEXT, TEXT, TEXT, TEXT, TEXT)',
  'auth.registration_platform_review_queue(TEXT, TEXT, INTEGER)',
  'auth.registration_organization_join_queue(TEXT, TEXT, TEXT, TEXT, TEXT, INTEGER)',
  'auth.lock_registration_decision_application(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT)',
  'auth.apply_registration_identity_transition(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT)',
  'auth.account_data_export(TEXT, TEXT, TEXT, TEXT, TEXT)',
  'auth.anonymize_account_identity(TEXT, TEXT, TEXT, TEXT, TEXT)',
] as const;

const RETIRED_AUTH_FUNCTIONS = [
  'auth.resolve_login_identity(TEXT)',
  'auth.resolve_login_identity_by_id(TEXT)',
  'auth.resolve_login_memberships(TEXT)',
  'auth.resolve_login_memberships_ordered(TEXT)',
  'auth.resolve_login_context_by_email(TEXT)',
  'auth.create_pending_registration_identity(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT)',
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

function normalizeSqlFunctionSignature(source: string): string {
  return source
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/\(\s+/g, '(')
    .replace(/\s+\)/g, ')')
    .replace(/\s*,\s*/g, ',')
    .trim();
}

describe('auth and staff principal provisioning', () => {
  it.each(PROVISIONING_SOURCES)('never grants BYPASSRLS in the %s', (_label, file) => {
    const statements = repositoryFile(file)
      .split('\n')
      .filter((line) => !/^\s*(#|--)/.test(line))
      .join('\n');

    // Match the PostgreSQL capability token itself, while allowing catalog
    // safety proofs such as `NOT rolbypassrls`. Those predicates verify that a
    // role cannot bypass RLS; they do not grant or alter the capability.
    expect(statements.match(/(?<!NO)BYPASSRLS/g) ?? []).toEqual([]);
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

  it('keeps MFA finalization behind a confined non-inheritable authority', () => {
    const migration = repositoryFile(
      'apps/api/prisma/migrations/20260808100000_p0_password_first_multi_membership/migration.sql',
    );

    expect(migration).toMatch(
      /CREATE ROLE pc_auth_mfa_authority\s+NOLOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE/,
    );
    expect(migration).toContain('pc_auth_mfa_authority must have no members');
    expect(migration).toContain(
      'ALTER FUNCTION auth.finalize_authenticated_user_mfa(text, text, text)',
    );
    expect(migration).toContain('OWNER TO pc_auth_mfa_authority');
    expect(migration).toContain(
      'GRANT SELECT ("id"), UPDATE ("mfaEnabled") ON public."users"',
    );
    expect(migration).not.toMatch(
      /GRANT (?:SELECT|INSERT|UPDATE|DELETE)[^;]*ON public\."(?:user_orgs|organizations)"[^;]*TO pc_auth_mfa_authority/,
    );
  });

  it('reconciles the compatibility MFA flag only from a fresh bound TOTP proof', () => {
    const migration = repositoryFile(
      'apps/api/prisma/migrations/20260822143000_p0_authenticated_totp_compatibility/migration.sql',
    );
    const repository = repositoryFile(
      'apps/api/src/modules/auth/persistent-auth.repository.ts',
    );

    for (const proof of [
      "challenge.\"type\" IN ('TOTP_ENROLL', 'TOTP_VERIFY')",
      'challenge.verified_at = pg_catalog.transaction_timestamp()',
      'challenge.expires_at > pg_catalog.transaction_timestamp()',
      "session.mfa_verified_method = 'TOTP'",
      'session.mfa_verified_at = pg_catalog.transaction_timestamp()',
      'challenge.verified_at = session.mfa_verified_at',
      'session.revoked_at IS NULL',
      'session.expires_at > pg_catalog.transaction_timestamp()',
      'session.credential_version = credential.credential_version',
      "credential.mfa_key_version = 'v1'",
    ]) {
      expect(migration).toContain(proof);
    }
    expect(migration).toContain('UPDATE public."users" subject');
    expect(migration).toContain('SET "mfaEnabled" = true');
    expect(migration).toContain('OWNER TO pc_auth_mfa_authority');
    expect(migration).toContain(
      'REVOKE ALL ON FUNCTION auth.finalize_authenticated_user_mfa(text, text, text)',
    );
    expect(migration).toContain('pg_catalog.aclexplode(');
    expect(migration).toContain('privilege.grantee = 0');
    expect(migration).not.toMatch(/CREATE ROLE|GRANT EXECUTE/);
    expect(migration).not.toMatch(
      /(?:INSERT|UPDATE|DELETE|TRUNCATE)\s+(?:INTO\s+|FROM\s+)?auth\./i,
    );

    expect(repository).toContain('AND session_id = ${input.sessionId}');
    expect(repository).toContain('AND user_id = ${input.userId}');
    expect(repository).toContain("if (input.method === 'TOTP')");
    expect(repository).toContain('mfa_key_version = CASE');
  });

  it('keeps password reset behind a column-bounded non-inheritable authority', () => {
    const migration = repositoryFile(
      'apps/api/prisma/migrations/20260808120000_p0_password_reset_authority/migration.sql',
    );

    expect(migration).toMatch(
      /CREATE ROLE pc_password_reset_authority\s+NOLOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE/,
    );
    expect(migration).toContain('pc_password_reset_authority must have no members');
    expect(migration).toContain(
      'GRANT UPDATE ("passwordHash", "updatedAt") ON public."users"',
    );
    expect(migration).not.toMatch(
      /GRANT (?:SELECT|INSERT|UPDATE|DELETE)[^;]*ON public\."(?:user_orgs|organizations)"[^;]*TO pc_password_reset_authority/,
    );
  });

  it('keeps the organization team projection session-bound and read-only', () => {
    const migration = repositoryFile(
      'apps/api/prisma/migrations/20260808130000_p0_organization_team_authority/migration.sql',
    );

    expect(migration).toMatch(
      /CREATE ROLE pc_organization_access_authority\s+NOLOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE/,
    );
    expect(migration).toContain('pc_organization_access_authority must have no members');
    expect(migration).toContain('credential.credential_version = session.credential_version');
    expect(migration).toContain(
      "session.mfa_verified_at >= now() - interval '15 minutes'",
    );
    expect(migration).not.toMatch(
      /GRANT (?:INSERT|UPDATE|DELETE)[^;]*ON public\."(?:users|user_orgs|organizations)"[^;]*TO pc_organization_access_authority/,
    );
  });

  it('keeps invitation acceptance token-bound and atomic under its own authority', () => {
    const migration = repositoryFile(
      'apps/api/prisma/migrations/20260808140000_p0_invitation_acceptance_authority/migration.sql',
    );

    expect(migration).toMatch(
      /CREATE ROLE pc_invitation_acceptance_authority\s+NOLOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE/,
    );
    expect(migration).toContain('pc_invitation_acceptance_authority must have no members');
    expect(migration).toContain('candidate.token_hash = p_token_hash');
    expect(migration).toContain(
      'SELECT candidate.*, organization."name" AS accepted_organization_name',
    );
    expect(migration).toMatch(/INTO invitation\s+FROM auth\.organization_invitations candidate/);
    expect(migration).not.toMatch(/INTO invitation\s*,/);
    expect(migration).toContain('subject."passwordHash" IS DISTINCT FROM p_expected_password_hash');
    expect(migration).toContain("SET status = 'ACCEPTED'");
    expect(migration).not.toMatch(
      /GRANT UPDATE[^;]*ON public\."(?:users|user_orgs|organizations)"[^;]*TO pc_invitation_acceptance_authority/,
    );
  });

  it('separates organization commands from token-bound MFA recovery', () => {
    const migration = repositoryFile(
      'apps/api/prisma/migrations/20260808150000_p0_invitation_recovery_authority/migration.sql',
    );

    expect(migration).toMatch(
      /CREATE ROLE pc_organization_membership_command_authority\s+NOLOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE/,
    );
    expect(migration).toMatch(
      /CREATE ROLE pc_mfa_recovery_identity_authority\s+NOLOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE/,
    );
    expect(migration).toContain('Membership and MFA recovery authorities must have no members');
    expect(migration).toContain('auth.resolve_organization_admin_session(');
    expect(migration).toContain('challenge.token_hash = p_token_hash');
    expect(migration).toContain('IF (CASE administrator_role');
    expect(migration).toContain('END) IS NOT TRUE THEN');
    expect(migration).not.toContain('IF NOT CASE administrator_role');
    expect(migration).toContain('credential_version = credential.credential_version + 1');
    expect(migration).toContain('GRANT UPDATE ("mfaEnabled", "updatedAt") ON public."users"');
    expect(migration).not.toMatch(
      /GRANT (?:INSERT|UPDATE|DELETE)[^;]*ON public\."users"[^;]*TO pc_organization_membership_command_authority/,
    );
    expect(migration).not.toMatch(
      /GRANT (?:INSERT|UPDATE|DELETE)[^;]*ON public\."(?:user_orgs|organizations)"[^;]*TO pc_mfa_recovery_identity_authority/,
    );
  });

  it('locks only rows each MFA recovery authority may mutate', () => {
    const migration = repositoryFile(
      'apps/api/prisma/migrations/20260808170000_p0_mfa_recovery_membership_lock_scope/migration.sql',
    );

    expect(migration).toMatch(/^\s*FOR UPDATE OF membership;$/mu);
    expect(migration).not.toMatch(/^\s*FOR UPDATE OF membership,\s*subject;/mu);
    expect(migration).toMatch(/^\s*FOR UPDATE OF challenge, subject;$/mu);
    expect(migration).not.toMatch(/^\s*FOR UPDATE OF challenge, subject, membership;/mu);
    expect(migration).toContain('subject."deletedAt"::timestamptz');
    expect(migration).toMatch(/^\s*FOR UPDATE OF candidate, subject;$/mu);
    expect(migration).not.toMatch(/^\s*FOR UPDATE OF candidate, subject, membership;/mu);
    expect(migration).toContain(
      "has_table_privilege(\n    'pc_organization_membership_command_authority', 'public.users', 'UPDATE'",
    );
    expect(migration).not.toMatch(
      /GRANT UPDATE[^;]*ON public\."users"[^;]*TO pc_organization_membership_command_authority/,
    );
    expect(migration).not.toMatch(
      /GRANT UPDATE[^;]*ON public\."user_orgs"[^;]*TO pc_mfa_recovery_identity_authority/,
    );
  });

  it('keeps registration decisions session-, MFA- and scope-bound in PostgreSQL', () => {
    const migration = repositoryFile(
      'apps/api/prisma/migrations/20260808140000_p0_registration_decision_authority/migration.sql',
    );

    expect(migration).toMatch(
      /CREATE ROLE pc_registration_decision_authority\s+NOLOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE/,
    );
    expect(migration).toContain('pc_registration_decision_authority must have no members');
    expect(migration).toContain("session.mfa_verified_at >= now() - INTERVAL '15 minutes'");
    expect(migration).toContain('candidate.decision_actor_user_id = p_actor_user_id');
    expect(migration).toContain('auth.registration_role_assignment_allowed(');
    expect(migration).not.toMatch(
      /GRANT (?:INSERT|DELETE)[^;]*ON public\."(?:users|user_orgs|organizations)"[^;]*TO pc_registration_decision_authority/,
    );
  });

  it('keeps both registration application row locks with only id-column UPDATE authority', () => {
    const authority = repositoryFile(
      'apps/api/prisma/migrations/20260808140000_p0_registration_decision_authority/migration.sql',
    );
    const migration = repositoryFile(
      'apps/api/prisma/migrations/20260826180000_p0_registration_decision_application_lock_privilege/migration.sql',
    );

    expect(authority).toMatch(/^\s*FOR UPDATE OF application, organization;$/mu);
    expect(authority).toMatch(/^\s*FOR UPDATE OF candidate, organization;$/mu);
    expect(migration.match(
      /GRANT UPDATE\s*\([^)]*\)\s*ON TABLE auth\.registration_applications/gi,
    )).toEqual(['GRANT UPDATE (id) ON TABLE auth.registration_applications']);
    expect(migration).not.toMatch(
      /GRANT UPDATE\s*\([^)]*(?:status|version)[^)]*\)\s*ON TABLE auth\.registration_applications/i,
    );
    expect(migration).not.toMatch(
      /GRANT UPDATE\s+ON TABLE auth\.registration_applications/i,
    );
    expect(migration).not.toMatch(
      /GRANT UPDATE\s*\(id\)\s*ON TABLE auth\.registration_applications[^;]*WITH GRANT OPTION/i,
    );
    expect(migration).not.toMatch(/\b(?:REVOKE|ALTER)\b/i);
    expect(migration).not.toContain('CREATE OR REPLACE FUNCTION');
    expect(migration).toContain(
      "has_column_privilege(\n       'pc_registration_decision_authority',\n       'auth.registration_applications',\n       'id',\n       'UPDATE'",
    );
    expect(migration).toContain(
      "has_any_column_privilege(\n       'pc_registration_decision_authority',\n       'auth.registration_applications',\n       'UPDATE WITH GRANT OPTION'",
    );
    expect(migration).toContain("attribute.attrelid = 'auth.registration_applications'::regclass");
    expect(migration).toContain('attribute.attnum > 0');
    expect(migration).toContain('NOT attribute.attisdropped');
    expect(migration).toContain(') <> 1 THEN');
    expect(migration).toContain("'INSERT'\n     )");
    expect(migration).toContain("'DELETE'\n     )");
    expect(migration).toContain('procedure.proconfig @> ARRAY[');
    expect(migration).toContain("acl.grantee = 0");
    expect(migration).toContain("acl.privilege_type = 'EXECUTE'");
    expect(migration).toContain('NOT role.rolreplication');

    const rehearsal = repositoryFile('scripts/platform-v7-database-dr-rehearsal.sh');
    expect(rehearsal).toContain(
      'REVOKE ALL PRIVILEGES ON auth.registration_applications\n      FROM pc_registration_decision_authority;',
    );
    expect(rehearsal).toContain(
      'GRANT UPDATE (id) ON TABLE auth.registration_applications\n      TO pc_registration_decision_authority;',
    );

    const integration = repositoryFile('scripts/platform-v7-rls-integration.sh');
    expect(integration).toContain('P0_REGISTRATION_DECISION_LOCK_PRIVILEGE_MIGRATION=');
    expect(integration).toContain('[[ -f "$P0_REGISTRATION_DECISION_LOCK_PRIVILEGE_MIGRATION" ]]');
    expect(integration).toContain('admin -f "$P0_REGISTRATION_DECISION_LOCK_PRIVILEGE_MIGRATION"');
    expect(integration).toContain('SET LOCAL ROLE pc_registration_decision_authority;');
    expect(integration).toMatch(
      /SELECT id\s+FROM auth\.registration_applications\s+WHERE false\s+FOR UPDATE;/m,
    );
    expect(integration).toMatch(
      /UPDATE auth\.registration_applications\s+SET status = status, version = version\s+WHERE false;/m,
    );
    expect(integration).toContain("grep -Fq '42501'");
  });

  it('separates read-only account export from bounded anonymization', () => {
    const migration = repositoryFile(
      'apps/api/prisma/migrations/20260808160000_p0_account_lifecycle_authority/migration.sql',
    );

    expect(migration).toMatch(
      /CREATE ROLE pc_account_export_authority\s+NOLOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE/,
    );
    expect(migration).toMatch(
      /CREATE ROLE pc_account_anonymization_authority\s+NOLOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE/,
    );
    expect(migration).toContain('Account lifecycle authorities must have no members');
    expect(migration).toContain('session.credential_version = credential.credential_version');
    expect(migration).toContain("revocation_reason = 'ACCOUNT_ANONYMIZED'");
    expect(migration).toContain('credential_version = credential.credential_version + 1');
    expect(migration).toContain('password_changed_at = NULL');
    expect(migration).toContain('last_login_at = NULL');
    expect(migration).not.toMatch(
      /GRANT (?:INSERT|UPDATE|DELETE)[^;]*TO pc_account_export_authority/,
    );
    expect(migration).not.toMatch(
      /GRANT (?:INSERT|UPDATE|DELETE)[^;]*ON public\."(?:user_orgs|organizations)"[^;]*TO pc_account_anonymization_authority/,
    );
  });

  it('provisions only the minimal login surface and revokes the retired bootstrap surface', () => {
    for (const file of [
      'scripts/platform-v7-one-deal-e2e.sh',
      'infra/kind/production-like/postgresql-runtime-grants.sql',
    ]) {
      const source = repositoryFile(file);
      const normalizedSource = normalizeSqlFunctionSignature(source);
      for (const signature of AUTH_RUNTIME_FUNCTIONS) {
        expect(normalizedSource).toContain(
          `grant execute on function ${normalizeSqlFunctionSignature(signature)}`,
        );
      }
      for (const signature of RETIRED_AUTH_FUNCTIONS) {
        const normalizedSignature = normalizeSqlFunctionSignature(signature);
        expect(normalizedSource).toContain(`revoke all on function ${normalizedSignature}`);
        expect(normalizedSource).not.toContain(
          `grant execute on function ${normalizedSignature} to one_deal_auth`,
        );
        expect(normalizedSource).not.toContain(
          `grant execute on function ${normalizedSignature} to app_auth`,
        );
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
    const normalizedOneDeal = normalizeSqlFunctionSignature(oneDeal);
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
    for (const signature of AUTH_RUNTIME_FUNCTIONS) {
      expect(normalizedOneDeal).toContain(
        `revoke all on function ${normalizeSqlFunctionSignature(signature)} from one_deal_staff`,
      );
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
    const normalizedGrants = normalizeSqlFunctionSignature(grants);
    expect(grants).toContain('REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public, auth FROM app_staff');
    for (const signature of STAFF_EXTERNAL_FUNCTIONS) {
      expect(grants).toContain(`GRANT EXECUTE ON FUNCTION ${signature} TO app_staff`);
    }
    for (const signature of STAFF_INTERNAL_FUNCTIONS) {
      expect(grants).toContain(`REVOKE ALL ON FUNCTION ${signature} FROM app_staff`);
    }
    for (const signature of AUTH_RUNTIME_FUNCTIONS) {
      expect(normalizedGrants).toContain(
        `revoke all on function ${normalizeSqlFunctionSignature(signature)} from app_staff`,
      );
    }

    const kubernetes = repositoryFile('scripts/release/production-like-kubernetes-cluster.sh');
    expect(kubernetes).toContain('STAFF_DATABASE_URL="postgresql://app_staff:');
    expect(kubernetes).toContain("rolname IN ('app_runtime','app_auth','app_staff','app_storage','app_outbox')");
    expect(kubernetes).toContain('staff_authority_proof');

    const runbook = repositoryFile('docs/platform-v7/production-database-deployment-runbook.md');
    expect(runbook).toContain('`DATABASE_URL`, `AUTH_DATABASE_URL`, `STAFF_DATABASE_URL` and `STORAGE_DATABASE_URL`');
  });

  it('restores the same minimal auth/staff split after no-owner no-acl DR', () => {
    const rehearsal = repositoryFile('scripts/platform-v7-database-dr-rehearsal.sh');
    const normalizedRehearsal = normalizeSqlFunctionSignature(rehearsal);
    expect(rehearsal).toContain('--no-owner');
    expect(rehearsal).toContain('--no-acl');
    expect(rehearsal).toContain('DR_RESTORE_STAFF_URL');
    expect(rehearsal).toContain('ALTER FUNCTION %s OWNER TO pc_identity_bootstrap');
    expect(rehearsal).toContain('ALTER FUNCTION %s OWNER TO pc_staff_authority');
    expect(rehearsal).toContain('ALTER FUNCTION %s OWNER TO pc_auth_mfa_authority');
    expect(rehearsal).toContain('ALTER FUNCTION %s OWNER TO pc_password_reset_authority');
    expect(rehearsal).toContain('ALTER FUNCTION %s OWNER TO pc_organization_access_authority');
    expect(rehearsal).toContain('ALTER FUNCTION %s OWNER TO pc_invitation_acceptance_authority');
    expect(rehearsal).toContain(
      'ALTER FUNCTION %s OWNER TO pc_organization_membership_command_authority',
    );
    expect(rehearsal).toContain('ALTER FUNCTION %s OWNER TO pc_mfa_recovery_identity_authority');
    expect(rehearsal).toContain('ALTER FUNCTION %s OWNER TO pc_registration_decision_authority');
    expect(rehearsal).toContain('ALTER FUNCTION %s OWNER TO pc_account_export_authority');
    expect(rehearsal).toContain('ALTER FUNCTION %s OWNER TO pc_account_anonymization_authority');
    for (const signature of AUTH_RUNTIME_FUNCTIONS) {
      expect(normalizedRehearsal).toContain(
        `grant execute on function ${normalizeSqlFunctionSignature(signature)} to one_deal_auth`,
      );
    }
    for (const signature of RETIRED_AUTH_FUNCTIONS) {
      expect(normalizedRehearsal).toContain(
        `revoke all on function ${normalizeSqlFunctionSignature(signature)} from one_deal_auth`,
      );
    }
    for (const signature of STAFF_EXTERNAL_FUNCTIONS) {
      expect(normalizedRehearsal).toContain(
        `grant execute on function ${normalizeSqlFunctionSignature(signature)} to one_deal_staff`,
      );
    }
    expect(rehearsal).toContain('RESTORE_IDENTITY_PROOF');
    expect(rehearsal).toContain('RESTORE_MFA_AUTHORITY_PROOF');
    expect(rehearsal).toContain('RESTORE_PASSWORD_RESET_PROOF');
    expect(rehearsal).toContain('RESTORE_ORGANIZATION_TEAM_PROOF');
    expect(rehearsal).toContain('RESTORE_INVITATION_MEMBERSHIP_RECOVERY_PROOF');
    expect(rehearsal).toContain('RESTORE_REGISTRATION_DECISION_PROOF');
    expect(rehearsal).toContain('RESTORE_ACCOUNT_LIFECYCLE_PROOF');
    expect(rehearsal).toContain('RESTORE_STAFF_PROOF');
    expect(rehearsal).toContain('RESTORE_AUTH_ISOLATION');
    expect(rehearsal).toContain('STAFF_DATABASE_URL="$RESTORE_STAFF_URL"');
  });

  it('asserts NOBYPASSRLS and the minimal bootstrap in acceptance proofs', () => {
    const oneDeal = repositoryFile('scripts/platform-v7-one-deal-e2e.sh');
    expect(oneDeal).toContain('"$AUTH_ROLE_PROOF" != "false:false:false"');
    expect(oneDeal).toContain('AUTH_IDENTITY_PROOF');
    expect(oneDeal).toContain('AUTH_BOOTSTRAP_PROOF');
    expect(oneDeal).toContain('resolve_login_credential');
    expect(oneDeal).toContain('resolve_login_default_membership');
    expect(oneDeal).toContain('resolve_post_password_membership_ids');
    expect(oneDeal).toContain('finalize_authenticated_user_mfa');
    expect(oneDeal).toContain('PASSWORD_RESET_AUTHORITY_PROOF');
    expect(oneDeal).toContain('ORGANIZATION_TEAM_AUTHORITY_PROOF');
    expect(oneDeal).toContain('INVITATION_MEMBERSHIP_RECOVERY_AUTHORITY_PROOF');
    for (const proof of [
      oneDeal,
      repositoryFile('scripts/platform-v7-database-dr-rehearsal.sh'),
      repositoryFile('scripts/release/production-like-kubernetes-cluster.sh'),
    ]) {
      expect(proof).toContain(
        "has_column_privilege('pc_invitation_acceptance_authority', 'auth.organization_invitations', 'status', 'UPDATE')",
      );
      expect(proof).toContain(
        "NOT has_table_privilege('pc_invitation_acceptance_authority', 'auth.organization_invitations', 'UPDATE')",
      );
      expect(proof).toContain(
        "has_column_privilege('pc_mfa_recovery_identity_authority', 'auth.credential_states', 'mfa_enabled', 'UPDATE')",
      );
      expect(proof).toContain(
        "NOT has_table_privilege('pc_mfa_recovery_identity_authority', 'auth.credential_states', 'UPDATE')",
      );
      expect(proof).toContain(
        "NOT has_table_privilege('pc_registration_decision_authority', 'auth.registration_applications', 'UPDATE')",
      );
      expect(proof).toContain(
        "has_column_privilege('pc_registration_decision_authority', 'auth.registration_applications', 'id', 'UPDATE')",
      );
      expect(proof).toContain(
        "NOT has_any_column_privilege('pc_registration_decision_authority', 'auth.registration_applications', 'UPDATE WITH GRANT OPTION')",
      );
      expect(proof).toContain(
        "NOT has_any_column_privilege('pc_registration_decision_authority', 'auth.registration_applications', 'INSERT')",
      );
      expect(proof).toContain(
        "NOT has_table_privilege('pc_registration_decision_authority', 'auth.registration_applications', 'INSERT')",
      );
      expect(proof).toContain(
        "NOT has_table_privilege('pc_registration_decision_authority', 'auth.registration_applications', 'DELETE')",
      );
      expect(proof).toContain(
        "attribute.attrelid = 'auth.registration_applications'::regclass",
      );
      expect(proof).toContain(')) = 1');
    }
    expect(oneDeal).toContain('REGISTRATION_DECISION_AUTHORITY_PROOF');
    expect(oneDeal).toContain('ACCOUNT_LIFECYCLE_AUTHORITY_PROOF');
    expect(oneDeal).toContain('STAFF_ROLE_PROOF');

    const kubernetes = repositoryFile('scripts/release/production-like-kubernetes-cluster.sh');
    expect(kubernetes).toContain("rolname IN ('app_runtime','app_auth','app_staff','app_storage','app_outbox') AND (rolsuper OR rolbypassrls OR rolinherit)");
    expect(kubernetes).toContain('auth_identity_proof');
    expect(kubernetes).toContain('auth_bootstrap_proof');
    expect(kubernetes).toContain('staff_authority_proof');
    expect(kubernetes).toContain('mfa_authority_proof');
    expect(kubernetes).toContain('password_reset_authority_proof');
    expect(kubernetes).toContain('organization_team_authority_proof');
    expect(kubernetes).toContain('invitation_membership_recovery_authority_proof');
    expect(kubernetes).toContain('registration_decision_authority_proof');
    expect(kubernetes).toContain('account_lifecycle_authority_proof');
  });

  it('documents the auth and staff principals without BYPASSRLS in the production runbook', () => {
    const runbook = repositoryFile('docs/platform-v7/production-database-deployment-runbook.md');
    expect(runbook).toMatch(/\| Auth runtime \|[^|]*auth\.resolve_login_/);
    expect(runbook).toMatch(/\| Auth runtime \|[^|]*\|[^|]*`BYPASSRLS`/);
    expect(runbook).toMatch(/\| Staff runtime[^|]*\|[^|]*auth\.resolve_staff_target_scope/);
    expect(runbook).toMatch(/\| Staff runtime[^|]*\|[^|]*auth\.staff_admission_/);
    expect(runbook).toContain('`DATABASE_URL`, `AUTH_DATABASE_URL`, `STAFF_DATABASE_URL` and `STORAGE_DATABASE_URL`');
  });
});
