export type DatabasePrincipalSnapshot = {
  currentUser: string;
  superuser: boolean;
  bypassRls: boolean;
  roleInherit: boolean;
  hasRoleMemberships: boolean;
  ownsDeals: boolean;
  dealsRlsEnabled: boolean;
  dealsForceRls: boolean;
  rowSecurity: string;
  dealSelect: boolean;
  dealInsert: boolean;
  dealUpdate: boolean;
  dealDelete: boolean;
  authSchemaUsage: boolean;
  usersSelect: boolean;
  usersInsert: boolean;
  usersUpdate: boolean;
  userOrgsSelect: boolean;
  userOrgsInsert: boolean;
  userOrgsUpdate: boolean;
  organizationsSelect: boolean;
  organizationsInsert: boolean;
  organizationsUpdate: boolean;
  authTablesReadWrite: boolean;
  authAuditReadInsert: boolean;
  /**
   * The identity tables under ENABLE + FORCE row-level security.
   *
   * The auth principal holds SELECT on all three. That grant is only ever
   * narrow because a policy stands underneath it — on a database where the
   * identity migration has not run, the very same grant is an unrestricted
   * read of every tenant. Measuring it here is what makes "no broad SELECT"
   * a checked property of the deployment rather than an assumption about it.
   */
  identityRlsForced: boolean;
  /** The auth principal must never own the tables its policies confine it to. */
  ownsIdentityTables: boolean;
  /**
   * EXECUTE on auth.resolve_login_identity, ...identity_by_id and
   * ...login_memberships — the bounded pre-authentication surface that
   * replaced BYPASSRLS. Without these the login path cannot read an identity
   * at all and fails closed at the first request.
   */
  identityBootstrapExecute: boolean;
  /**
   * EXECUTE on any of the auth.staff_admission_* functions. The staff surface
   * belongs to pc_staff_runtime; an auth principal holding it would have the
   * cross-tenant read back by another name.
   */
  staffAdmissionExecute: boolean;
  /**
   * Membership of pc_identity_bootstrap specifically. hasRoleMemberships
   * already forbids belonging to anything, but this is the membership that
   * would matter — it would let the auth runtime SET ROLE into the principal
   * the bootstrap policies admit unconditionally.
   */
  identityBootstrapMember: boolean;
};

export type DatabaseEnvironment = Record<string, string | undefined>;

function enabled(value?: string): boolean {
  return String(value ?? '').trim().toLowerCase() === 'true';
}

export function isProductionEnvironment(environment: DatabaseEnvironment = process.env): boolean {
  return String(environment.NODE_ENV ?? '').trim().toLowerCase() === 'production';
}

export function shouldEnforceDatabasePrincipalBoundary(
  environment: DatabaseEnvironment = process.env,
): boolean {
  return isProductionEnvironment(environment) || enabled(environment.DB_PRINCIPAL_BOUNDARY_ENFORCED);
}

export function resolveAuthDatabaseUrl(
  environment: DatabaseEnvironment = process.env,
): string | undefined {
  const authUrl = String(environment.AUTH_DATABASE_URL ?? '').trim();
  const dealUrl = String(environment.DATABASE_URL ?? '').trim();
  const production = isProductionEnvironment(environment);

  if (production && !dealUrl) {
    throw new Error('DATABASE_URL is required in production.');
  }
  if (production && !authUrl) {
    throw new Error('AUTH_DATABASE_URL is required in production.');
  }
  if (production && authUrl === dealUrl) {
    throw new Error('AUTH_DATABASE_URL must use a different PostgreSQL principal than DATABASE_URL.');
  }

  return authUrl || dealUrl || undefined;
}

function databasePrincipal(url: string): string {
  try {
    return decodeURIComponent(new URL(url).username).trim();
  } catch {
    throw new Error('PostgreSQL datasource URL is invalid.');
  }
}

export function resolveStorageDatabaseUrl(
  environment: DatabaseEnvironment = process.env,
): string | undefined {
  const storageUrl = String(environment.STORAGE_DATABASE_URL ?? '').trim();
  const dealUrl = String(environment.DATABASE_URL ?? '').trim();
  const authUrl = String(environment.AUTH_DATABASE_URL ?? '').trim();
  const production = isProductionEnvironment(environment);

  if (production && !storageUrl) {
    throw new Error('STORAGE_DATABASE_URL is required in production.');
  }
  if (storageUrl) {
    const storagePrincipal = databasePrincipal(storageUrl);
    if (!storagePrincipal) throw new Error('STORAGE_DATABASE_URL must include a PostgreSQL principal.');
    for (const [label, candidate] of [['DATABASE_URL', dealUrl], ['AUTH_DATABASE_URL', authUrl]] as const) {
      if (candidate && databasePrincipal(candidate) === storagePrincipal) {
        throw new Error(`STORAGE_DATABASE_URL must use a different PostgreSQL principal than ${label}.`);
      }
    }
  }

  return storageUrl || dealUrl || undefined;
}

function evaluateRoleIsolation(snapshot: DatabasePrincipalSnapshot, label: 'deal' | 'auth'): string[] {
  const errors: string[] = [];
  if (snapshot.roleInherit) errors.push(`${label} principal must be NOINHERIT`);
  if (snapshot.hasRoleMemberships) errors.push(`${label} principal must not belong to other PostgreSQL roles`);
  return errors;
}

export function evaluateDealPrincipalBoundary(snapshot: DatabasePrincipalSnapshot): string[] {
  const errors: string[] = [...evaluateRoleIsolation(snapshot, 'deal')];
  if (snapshot.superuser) errors.push('deal principal must not be SUPERUSER');
  if (snapshot.bypassRls) errors.push('deal principal must not have BYPASSRLS');
  if (snapshot.ownsDeals) errors.push('deal principal must not own public.deals');
  if (!snapshot.dealsRlsEnabled) errors.push('public.deals must have RLS enabled');
  if (!snapshot.dealsForceRls) errors.push('public.deals must have FORCE RLS enabled');
  if (snapshot.rowSecurity.toLowerCase() !== 'on') errors.push('row_security must be on');
  if (!snapshot.dealSelect || !snapshot.dealInsert || !snapshot.dealUpdate || !snapshot.dealDelete) {
    errors.push('deal principal requires CRUD grants on public.deals, constrained by FORCE RLS');
  }
  return errors;
}

export function evaluateAuthPrincipalBoundary(snapshot: DatabasePrincipalSnapshot): string[] {
  const errors: string[] = [...evaluateRoleIsolation(snapshot, 'auth')];
  if (snapshot.superuser) errors.push('auth principal must not be SUPERUSER');
  // This assertion used to run the other way: the auth principal was *required*
  // to hold BYPASSRLS, because authentication has to read an identity before
  // any tenant context exists and nothing else could serve that read. BYPASSRLS
  // buys the login lookup at the price of every statement that follows it —
  // once the principal holds it, no policy on any table applies to anything it
  // does. The pre-auth read now goes through the bounded bootstrap functions in
  // 20260806090000_identity_row_level_security instead, so the privilege is not
  // merely unnecessary here, it is forbidden (#3670).
  if (snapshot.bypassRls) errors.push('auth principal must not have BYPASSRLS');
  if (snapshot.ownsDeals) errors.push('auth principal must not own public.deals');
  if (snapshot.dealSelect || snapshot.dealInsert || snapshot.dealUpdate || snapshot.dealDelete) {
    errors.push('auth principal must have no privileges on public.deals');
  }
  // The three assertions below are what stop the identity grants from being
  // broad. Ownership would exempt the principal from its own policies under
  // ENABLE; without FORCE the owner is exempt anyway; and a membership of
  // pc_identity_bootstrap would let it SET ROLE into the principal those
  // policies admit unconditionally.
  if (snapshot.ownsIdentityTables) {
    errors.push('auth principal must not own public.users, public.user_orgs or public.organizations');
  }
  if (!snapshot.identityRlsForced) {
    errors.push('public.users, public.user_orgs and public.organizations must have ENABLE and FORCE RLS');
  }
  if (snapshot.identityBootstrapMember) {
    errors.push('auth principal must not be a member of pc_identity_bootstrap');
  }
  // Pre-context identity reads go through the bounded bootstrap functions, by
  // exact grant. This is the privilege that replaced BYPASSRLS, so a principal
  // missing it has no working login rather than a tighter one.
  if (!snapshot.identityBootstrapExecute) {
    errors.push('auth principal requires EXECUTE on the auth.resolve_login_* bootstrap functions');
  }
  if (snapshot.staffAdmissionExecute) {
    errors.push('auth principal must have no EXECUTE on the auth.staff_admission_* functions');
  }
  if (!snapshot.authSchemaUsage) errors.push('auth principal requires USAGE on schema auth');
  if (!snapshot.usersSelect || !snapshot.usersInsert || !snapshot.usersUpdate) {
    errors.push('auth principal requires SELECT, INSERT and UPDATE on public.users');
  }
  if (!snapshot.userOrgsSelect || !snapshot.userOrgsInsert || !snapshot.userOrgsUpdate) {
    errors.push('auth principal requires SELECT, INSERT and UPDATE on public.user_orgs');
  }
  if (!snapshot.organizationsSelect || !snapshot.organizationsInsert || !snapshot.organizationsUpdate) {
    errors.push('auth principal requires SELECT, INSERT and UPDATE on public.organizations');
  }
  if (!snapshot.authTablesReadWrite) {
    errors.push('auth principal requires read/write privileges on persistent auth state tables');
  }
  if (!snapshot.authAuditReadInsert) {
    errors.push('auth principal requires SELECT and INSERT on auth.audit_events');
  }
  return errors;
}
