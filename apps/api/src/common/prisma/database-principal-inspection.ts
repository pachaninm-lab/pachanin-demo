import { Prisma } from '@prisma/client';
import type { DatabasePrincipalSnapshot } from './database-principal-boundary';

export type PrincipalInspectionClient = {
  $queryRaw<T = unknown>(query: Prisma.Sql): Promise<T>;
};

export type PrincipalInspectionScope = 'deal' | 'auth';

type DealInspectionRow = {
  current_user: string;
  superuser: boolean;
  bypass_rls: boolean;
  role_inherit: boolean;
  has_role_memberships: boolean;
  owns_deals: boolean;
  deals_rls_enabled: boolean;
  deals_force_rls: boolean;
  row_security: string;
  deal_select: boolean;
  deal_insert: boolean;
  deal_update: boolean;
  deal_delete: boolean;
};

type AuthInspectionRow = DealInspectionRow & {
  auth_schema_usage: boolean;
  users_select: boolean;
  users_insert: boolean;
  users_update: boolean;
  user_orgs_select: boolean;
  user_orgs_insert: boolean;
  user_orgs_update: boolean;
  organizations_select: boolean;
  organizations_insert: boolean;
  organizations_update: boolean;
  auth_tables_read_write: boolean;
  auth_audit_read_insert: boolean;
};

function baseSnapshot(row: DealInspectionRow): DatabasePrincipalSnapshot {
  return {
    currentUser: row.current_user,
    superuser: row.superuser,
    bypassRls: row.bypass_rls,
    roleInherit: row.role_inherit,
    hasRoleMemberships: row.has_role_memberships,
    ownsDeals: row.owns_deals,
    dealsRlsEnabled: row.deals_rls_enabled,
    dealsForceRls: row.deals_force_rls,
    rowSecurity: row.row_security,
    dealSelect: row.deal_select,
    dealInsert: row.deal_insert,
    dealUpdate: row.deal_update,
    dealDelete: row.deal_delete,
    authSchemaUsage: false,
    usersSelect: false,
    usersInsert: false,
    usersUpdate: false,
    userOrgsSelect: false,
    userOrgsInsert: false,
    userOrgsUpdate: false,
    organizationsSelect: false,
    organizationsInsert: false,
    organizationsUpdate: false,
    authTablesReadWrite: false,
    authAuditReadInsert: false,
  };
}

async function inspectDealPrincipal(
  client: PrincipalInspectionClient,
): Promise<DatabasePrincipalSnapshot> {
  const rows = await client.$queryRaw<DealInspectionRow[]>(Prisma.sql`
    SELECT
      current_user,
      roles.rolsuper AS superuser,
      roles.rolbypassrls AS bypass_rls,
      roles.rolinherit AS role_inherit,
      EXISTS (SELECT 1 FROM pg_auth_members memberships WHERE memberships.member = roles.oid) AS has_role_memberships,
      deals.relowner = roles.oid AS owns_deals,
      deals.relrowsecurity AS deals_rls_enabled,
      deals.relforcerowsecurity AS deals_force_rls,
      current_setting('row_security') AS row_security,
      has_table_privilege(current_user, 'public.deals', 'SELECT') AS deal_select,
      has_table_privilege(current_user, 'public.deals', 'INSERT') AS deal_insert,
      has_table_privilege(current_user, 'public.deals', 'UPDATE') AS deal_update,
      has_table_privilege(current_user, 'public.deals', 'DELETE') AS deal_delete
    FROM pg_roles roles
    JOIN pg_class deals ON deals.oid = 'public.deals'::regclass
    WHERE roles.rolname = current_user
  `);
  const row = rows[0];
  if (!row) throw new Error('Unable to inspect current deal PostgreSQL principal.');
  return baseSnapshot(row);
}

async function inspectAuthPrincipal(
  client: PrincipalInspectionClient,
): Promise<DatabasePrincipalSnapshot> {
  const rows = await client.$queryRaw<AuthInspectionRow[]>(Prisma.sql`
    SELECT
      current_user,
      roles.rolsuper AS superuser,
      roles.rolbypassrls AS bypass_rls,
      roles.rolinherit AS role_inherit,
      EXISTS (SELECT 1 FROM pg_auth_members memberships WHERE memberships.member = roles.oid) AS has_role_memberships,
      deals.relowner = roles.oid AS owns_deals,
      deals.relrowsecurity AS deals_rls_enabled,
      deals.relforcerowsecurity AS deals_force_rls,
      current_setting('row_security') AS row_security,
      has_table_privilege(current_user, 'public.deals', 'SELECT') AS deal_select,
      has_table_privilege(current_user, 'public.deals', 'INSERT') AS deal_insert,
      has_table_privilege(current_user, 'public.deals', 'UPDATE') AS deal_update,
      has_table_privilege(current_user, 'public.deals', 'DELETE') AS deal_delete,
      has_schema_privilege(current_user, 'auth', 'USAGE') AS auth_schema_usage,
      has_table_privilege(current_user, 'public.users', 'SELECT') AS users_select,
      has_table_privilege(current_user, 'public.users', 'INSERT') AS users_insert,
      has_table_privilege(current_user, 'public.users', 'UPDATE') AS users_update,
      has_table_privilege(current_user, 'public.user_orgs', 'SELECT') AS user_orgs_select,
      has_table_privilege(current_user, 'public.user_orgs', 'INSERT') AS user_orgs_insert,
      has_table_privilege(current_user, 'public.user_orgs', 'UPDATE') AS user_orgs_update,
      has_table_privilege(current_user, 'public.organizations', 'SELECT') AS organizations_select,
      has_table_privilege(current_user, 'public.organizations', 'INSERT') AS organizations_insert,
      has_table_privilege(current_user, 'public.organizations', 'UPDATE') AS organizations_update,
      (
        has_table_privilege(current_user, 'auth.login_throttles', 'SELECT')
        AND has_table_privilege(current_user, 'auth.login_throttles', 'INSERT')
        AND has_table_privilege(current_user, 'auth.login_throttles', 'UPDATE')
        AND has_table_privilege(current_user, 'auth.credential_states', 'SELECT')
        AND has_table_privilege(current_user, 'auth.credential_states', 'INSERT')
        AND has_table_privilege(current_user, 'auth.credential_states', 'UPDATE')
        AND has_table_privilege(current_user, 'auth.sessions', 'SELECT')
        AND has_table_privilege(current_user, 'auth.sessions', 'INSERT')
        AND has_table_privilege(current_user, 'auth.sessions', 'UPDATE')
        AND has_table_privilege(current_user, 'auth.refresh_tokens', 'SELECT')
        AND has_table_privilege(current_user, 'auth.refresh_tokens', 'INSERT')
        AND has_table_privilege(current_user, 'auth.refresh_tokens', 'UPDATE')
        AND has_table_privilege(current_user, 'auth.mfa_challenges', 'SELECT')
        AND has_table_privilege(current_user, 'auth.mfa_challenges', 'INSERT')
        AND has_table_privilege(current_user, 'auth.mfa_challenges', 'UPDATE')
        AND has_table_privilege(current_user, 'auth.password_reset_challenges', 'SELECT')
        AND has_table_privilege(current_user, 'auth.password_reset_challenges', 'INSERT')
        AND has_table_privilege(current_user, 'auth.password_reset_challenges', 'UPDATE')
      ) AS auth_tables_read_write,
      (
        has_table_privilege(current_user, 'auth.audit_events', 'SELECT')
        AND has_table_privilege(current_user, 'auth.audit_events', 'INSERT')
      ) AS auth_audit_read_insert
    FROM pg_roles roles
    JOIN pg_class deals ON deals.oid = 'public.deals'::regclass
    WHERE roles.rolname = current_user
  `);

  const row = rows[0];
  if (!row) throw new Error('Unable to inspect current auth PostgreSQL principal.');
  return {
    ...baseSnapshot(row),
    authSchemaUsage: row.auth_schema_usage,
    usersSelect: row.users_select,
    usersInsert: row.users_insert,
    usersUpdate: row.users_update,
    userOrgsSelect: row.user_orgs_select,
    userOrgsInsert: row.user_orgs_insert,
    userOrgsUpdate: row.user_orgs_update,
    organizationsSelect: row.organizations_select,
    organizationsInsert: row.organizations_insert,
    organizationsUpdate: row.organizations_update,
    authTablesReadWrite: row.auth_tables_read_write,
    authAuditReadInsert: row.auth_audit_read_insert,
  };
}

export async function inspectDatabasePrincipal(
  client: PrincipalInspectionClient,
  scope: PrincipalInspectionScope,
): Promise<DatabasePrincipalSnapshot> {
  return scope === 'auth'
    ? inspectAuthPrincipal(client)
    : inspectDealPrincipal(client);
}
