import { Prisma } from '@prisma/client';
import type { PrincipalInspectionClient } from './database-principal-inspection';
import type { OutboxDatabasePrincipalSnapshot } from './outbox-database-principal-boundary';

type OutboxInspectionRow = {
  current_user: string;
  superuser: boolean;
  bypass_rls: boolean;
  role_inherit: boolean;
  has_role_memberships: boolean;
  owns_outbox_entries: boolean;
  row_security: string;
  outbox_select: boolean;
  outbox_required_column_updates: boolean;
  outbox_insert: boolean;
  outbox_delete: boolean;
  deal_any_privilege: boolean;
  redrive_any_privilege: boolean;
  auth_schema_usage: boolean;
};

export async function inspectOutboxDatabasePrincipal(
  client: PrincipalInspectionClient,
): Promise<OutboxDatabasePrincipalSnapshot> {
  const rows = await client.$queryRaw<OutboxInspectionRow[]>(Prisma.sql`
    SELECT
      current_user,
      roles.rolsuper AS superuser,
      roles.rolbypassrls AS bypass_rls,
      roles.rolinherit AS role_inherit,
      EXISTS (
        SELECT 1 FROM pg_auth_members memberships WHERE memberships.member = roles.oid
      ) AS has_role_memberships,
      outbox.relowner = roles.oid AS owns_outbox_entries,
      current_setting('row_security') AS row_security,
      has_table_privilege(current_user, 'public.outbox_entries', 'SELECT') AS outbox_select,
      (
        has_column_privilege(current_user, 'public.outbox_entries', 'status', 'UPDATE')
        AND has_column_privilege(current_user, 'public.outbox_entries', 'retryCount', 'UPDATE')
        AND has_column_privilege(current_user, 'public.outbox_entries', 'nextRetryAt', 'UPDATE')
        AND has_column_privilege(current_user, 'public.outbox_entries', 'lastError', 'UPDATE')
        AND has_column_privilege(current_user, 'public.outbox_entries', 'sentAt', 'UPDATE')
        AND has_column_privilege(current_user, 'public.outbox_entries', 'confirmedAt', 'UPDATE')
        AND has_column_privilege(current_user, 'public.outbox_entries', 'failedAt', 'UPDATE')
        AND has_column_privilege(current_user, 'public.outbox_entries', 'deadLetterAt', 'UPDATE')
        AND has_column_privilege(current_user, 'public.outbox_entries', 'leaseOwner', 'UPDATE')
        AND has_column_privilege(current_user, 'public.outbox_entries', 'leaseToken', 'UPDATE')
        AND has_column_privilege(current_user, 'public.outbox_entries', 'leaseExpiresAt', 'UPDATE')
        AND has_column_privilege(current_user, 'public.outbox_entries', 'heartbeatAt', 'UPDATE')
      ) AS outbox_required_column_updates,
      has_table_privilege(current_user, 'public.outbox_entries', 'INSERT') AS outbox_insert,
      has_table_privilege(current_user, 'public.outbox_entries', 'DELETE') AS outbox_delete,
      (
        has_table_privilege(current_user, 'public.deals', 'SELECT')
        OR has_table_privilege(current_user, 'public.deals', 'INSERT')
        OR has_table_privilege(current_user, 'public.deals', 'UPDATE')
        OR has_table_privilege(current_user, 'public.deals', 'DELETE')
        OR has_any_column_privilege(current_user, 'public.deals', 'SELECT')
        OR has_any_column_privilege(current_user, 'public.deals', 'INSERT')
        OR has_any_column_privilege(current_user, 'public.deals', 'UPDATE')
      ) AS deal_any_privilege,
      (
        has_table_privilege(current_user, 'public.outbox_redrive_events', 'SELECT')
        OR has_table_privilege(current_user, 'public.outbox_redrive_events', 'INSERT')
        OR has_table_privilege(current_user, 'public.outbox_redrive_events', 'UPDATE')
        OR has_table_privilege(current_user, 'public.outbox_redrive_events', 'DELETE')
        OR has_any_column_privilege(current_user, 'public.outbox_redrive_events', 'SELECT')
        OR has_any_column_privilege(current_user, 'public.outbox_redrive_events', 'INSERT')
        OR has_any_column_privilege(current_user, 'public.outbox_redrive_events', 'UPDATE')
      ) AS redrive_any_privilege,
      has_schema_privilege(current_user, 'auth', 'USAGE') AS auth_schema_usage
    FROM pg_roles roles
    JOIN pg_class outbox ON outbox.oid = 'public.outbox_entries'::regclass
    WHERE roles.rolname = current_user
  `);

  const row = rows[0];
  if (!row) throw new Error('Unable to inspect current outbox PostgreSQL principal.');
  return {
    currentUser: row.current_user,
    superuser: row.superuser,
    bypassRls: row.bypass_rls,
    roleInherit: row.role_inherit,
    hasRoleMemberships: row.has_role_memberships,
    ownsOutboxEntries: row.owns_outbox_entries,
    rowSecurity: row.row_security,
    outboxSelect: row.outbox_select,
    outboxRequiredColumnUpdates: row.outbox_required_column_updates,
    outboxInsert: row.outbox_insert,
    outboxDelete: row.outbox_delete,
    dealAnyPrivilege: row.deal_any_privilege,
    redriveAnyPrivilege: row.redrive_any_privilege,
    authSchemaUsage: row.auth_schema_usage,
  };
}
