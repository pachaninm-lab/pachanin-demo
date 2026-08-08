import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

function migrationSource(): string {
  const relative = 'apps/api/prisma/migrations/20260808180000_production_app_service_auth_principal_drift/migration.sql';
  const candidates = [path.resolve(process.cwd(), relative), path.resolve(process.cwd(), '../..', relative)];
  const source = candidates.find(existsSync);
  if (!source) throw new Error(`Missing production app_service drift migration: ${relative}`);
  return readFileSync(source, 'utf8');
}

describe('production app_service auth-principal drift repair', () => {
  const migration = migrationSource();

  it('removes superuser and BYPASSRLS while retaining RLS policy authority', () => {
    expect(migration).toContain("IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_service') THEN");
    expect(migration).toContain("EXECUTE 'ALTER ROLE app_service NOSUPERUSER NOBYPASSRLS';");
    expect(migration).toContain("AND (rolsuper OR rolbypassrls)");
    expect(migration).not.toMatch(/(?:DISABLE|NO\s+FORCE)\s+ROW\s+LEVEL\s+SECURITY/i);
    expect(migration).not.toMatch(/ALTER\s+TABLE[^;]+\s+(?:DISABLE|NO\s+FORCE)\s+ROW\s+LEVEL\s+SECURITY/i);
  });

  it('grants only the exact login, session and MFA bootstrap signatures', () => {
    for (const signature of [
      'auth.resolve_login_credential(TEXT)',
      'auth.resolve_login_default_membership(TEXT)',
      'auth.resolve_login_context_by_membership(TEXT, TEXT)',
      'auth.resolve_session_identity(TEXT, TEXT, TEXT, TEXT)',
      'auth.resolve_post_password_membership_ids(TEXT)',
      'auth.resolve_post_password_membership_context(TEXT, TEXT)',
      'auth.resolve_session_identity_v2(TEXT, TEXT, TEXT, TEXT)',
      'auth.finalize_authenticated_user_mfa(TEXT, TEXT, TEXT)',
    ]) {
      expect(migration).toContain(`EXECUTE 'GRANT EXECUTE ON FUNCTION ${signature} TO app_service';`);
    }
    expect(migration).not.toMatch(/GRANT\s+EXECUTE\s+ON\s+ALL\s+FUNCTIONS/i);
  });

  it('executes a production drift assertion and rejects historical login resolvers', () => {
    expect(migration).toContain("has_function_privilege('app_service', 'auth.resolve_login_credential(text)', 'EXECUTE')");
    expect(migration).toContain("p.proname LIKE 'resolve_login_%'");
    for (const retired of [
      'auth.resolve_login_identity(TEXT)',
      'auth.resolve_login_identity_by_id(TEXT)',
      'auth.resolve_login_memberships(TEXT)',
      'auth.resolve_login_memberships_ordered(TEXT)',
      'auth.resolve_login_context_by_email(TEXT)',
    ]) {
      expect(migration).toContain(`EXECUTE 'REVOKE ALL ON FUNCTION ${retired} FROM app_service';`);
    }
  });
});
