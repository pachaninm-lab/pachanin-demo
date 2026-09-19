import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

function migrationSource(): string {
  const relative = 'apps/api/prisma/migrations/20260808180000_production_app_service_auth_principal_drift/migration.sql';
  const candidates = [path.resolve(process.cwd(), relative), path.resolve(process.cwd(), '../..', relative)];
  const source = candidates.find(existsSync);
  if (!source) throw new Error(`Missing production app_service drift migration: ${relative}`);
  return readFileSync(source, 'utf8');
}

const P0_AUTH_RUNTIME_FUNCTIONS = [
  'auth.resolve_login_credential(text)',
  'auth.resolve_login_default_membership(text)',
  'auth.resolve_login_context_by_membership(text,text)',
  'auth.resolve_session_identity(text,text,text,text)',
  'auth.resolve_post_password_membership_ids(text)',
  'auth.resolve_post_password_membership_context(text,text)',
  'auth.resolve_session_identity_v2(text,text,text,text)',
  'auth.finalize_authenticated_user_mfa(text,text,text)',
  'auth.prepare_pending_registration_identity(text,text,text,text,text,text,text,text,text,text,text,text,text,text,text)',
  'auth.restart_pending_registration_identity(text,text,text,text,text,text,text,text,text,text,text,text,text,text,text)',
  'auth.mark_registration_email_verified(text,text,text)',
  'auth.registration_join_notification_recipients(text,text,text)',
  'auth.resolve_password_reset_subject(text)',
  'auth.replace_password_after_reset(text,text,text,timestamp with time zone)',
  'auth.organization_team_snapshot(text,text,text,text,text)',
  'auth.resolve_organization_admin_session(text,text,text,text,text)',
  'auth.organization_membership_exists_for_email(text,text,text,text,text,text)',
  'auth.resolve_invitation_acceptance_credential(text,text)',
  'auth.accept_organization_invitation_identity(text,text,bigint,text,text,boolean,text,text,text,text)',
  'auth.change_organization_membership_role(text,text,text,text,text,text,bigint,text)',
  'auth.revoke_organization_membership(text,text,text,text,text,text,bigint)',
  'auth.prepare_organization_mfa_recovery_target(text,text,text,text,text,text,bigint)',
  'auth.organization_mfa_recovery_snapshot(text,text,text,text,text,text)',
  'auth.resolve_mfa_recovery_identity(text,text)',
  'auth.finalize_mfa_recovery_identity(text,text,text,bigint)',
  'auth.registration_platform_actor_authorized(text,text)',
  'auth.registration_organization_admin_context(text,text,text,text,text)',
  'auth.registration_platform_review_queue(text,text,integer)',
  'auth.registration_organization_join_queue(text,text,text,text,text,integer)',
  'auth.lock_registration_decision_application(text,text,text,text,text,text,text)',
  'auth.apply_registration_identity_transition(text,text,text,text,text,text,text,text)',
  'auth.account_data_export(text,text,text,text,text)',
  'auth.anonymize_account_identity(text,text,text,text,text)',
] as const;

describe('production app_service auth-principal drift repair', () => {
  const migration = migrationSource().toLowerCase();

  it('removes superuser and BYPASSRLS without changing RLS policy authority', () => {
    expect(migration).toContain("if not exists (select 1 from pg_roles where rolname = 'app_service') then");
    expect(migration).toContain("execute 'alter role app_service nosuperuser nobypassrls';");
    expect(migration).toContain('and (rolsuper or rolbypassrls)');
    expect(migration).not.toMatch(/(?:disable|no\s+force)\s+row\s+level\s+security/i);
  });

  it('rebuilds exactly the named external P0 auth surface, never broad EXECUTE', () => {
    expect(migration).toContain("execute 'revoke all on all functions in schema auth from app_service';");
    expect(migration).toContain("execute format('grant execute on function %s to app_service', function_signature);");
    expect(migration).not.toMatch(/grant\s+execute\s+on\s+all\s+functions/i);
    for (const signature of P0_AUTH_RUNTIME_FUNCTIONS) expect(migration).toContain(`'${signature}'`);
  });

  it('asserts every required grant and rejects all unexpected auth EXECUTE rights', () => {
    expect(migration).toContain("if not has_function_privilege('app_service', function_signature, 'execute') then");
    expect(migration).toContain('p.oid::regprocedure::text <> all(auth_runtime_functions)');
    expect(migration).toContain("raise exception 'app_service has unexpected auth execute grant: %'");
  });
});
