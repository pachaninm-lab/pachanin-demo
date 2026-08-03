import { Prisma } from '@prisma/client';
import type { PrincipalInspectionClient } from '../../../common/prisma/database-principal-inspection';
import type { FgisQuarantineAuditPrincipalSnapshot } from './fgis-grain-quarantine-audit-principal';

type InspectionRow = {
  current_user: string;
  superuser: boolean;
  bypass_rls: boolean;
  role_inherit: boolean;
  has_role_memberships: boolean;
  owns_audit_events: boolean;
  row_security: string;
  audit_events_rls_enabled: boolean;
  audit_events_insert: boolean;
  audit_events_select: boolean;
  audit_events_update: boolean;
  audit_events_delete: boolean;
  audit_events_truncate: boolean;
  audit_events_policy_commands: string[];
  quarantine_denial_execute: boolean;
};

/**
 * Captures the live privilege boundary around `public.audit_events` for the
 * principal the caller is connected as. Read-only: every clause is a catalogue
 * lookup or a `has_*_privilege` probe.
 */
export async function inspectFgisQuarantineAuditPrincipal(
  client: PrincipalInspectionClient,
): Promise<FgisQuarantineAuditPrincipalSnapshot> {
  const rows = await client.$queryRaw<InspectionRow[]>(Prisma.sql`
    SELECT
      current_user,
      roles.rolsuper AS superuser,
      roles.rolbypassrls AS bypass_rls,
      roles.rolinherit AS role_inherit,
      EXISTS (
        SELECT 1 FROM pg_auth_members members WHERE members.member = roles.oid
      ) AS has_role_memberships,
      pg_get_userbyid(audit.relowner) = current_user AS owns_audit_events,
      current_setting('row_security', true) AS row_security,
      audit.relrowsecurity AS audit_events_rls_enabled,
      has_table_privilege(current_user, 'public.audit_events', 'INSERT') AS audit_events_insert,
      has_table_privilege(current_user, 'public.audit_events', 'SELECT') AS audit_events_select,
      has_table_privilege(current_user, 'public.audit_events', 'UPDATE') AS audit_events_update,
      has_table_privilege(current_user, 'public.audit_events', 'DELETE') AS audit_events_delete,
      has_table_privilege(current_user, 'public.audit_events', 'TRUNCATE') AS audit_events_truncate,
      COALESCE(
        (
          SELECT array_agg(DISTINCT
            CASE policies.polcmd
              WHEN 'r' THEN 'SELECT'
              WHEN 'a' THEN 'INSERT'
              WHEN 'w' THEN 'UPDATE'
              WHEN 'd' THEN 'DELETE'
              ELSE 'ALL'
            END
          )
          FROM pg_policy policies
          WHERE policies.polrelid = audit.oid
        ),
        ARRAY[]::text[]
      ) AS audit_events_policy_commands,
      has_function_privilege(
        current_user,
        'public.record_fgis_legacy_quarantine_denial(text,text,text,text,text,text,text,text)',
        'EXECUTE'
      ) AS quarantine_denial_execute
    FROM pg_roles roles
    CROSS JOIN pg_class audit
    WHERE roles.rolname = current_user
      AND audit.oid = 'public.audit_events'::regclass
  `);

  const row = rows[0];
  if (!row) {
    throw new Error('quarantine audit principal inspection returned no row');
  }

  return {
    currentUser: row.current_user,
    superuser: row.superuser,
    bypassRls: row.bypass_rls,
    roleInherit: row.role_inherit,
    hasRoleMemberships: row.has_role_memberships,
    ownsAuditEvents: row.owns_audit_events,
    rowSecurity: row.row_security ?? 'off',
    auditEventsRlsEnabled: row.audit_events_rls_enabled,
    auditEventsInsert: row.audit_events_insert,
    auditEventsSelect: row.audit_events_select,
    auditEventsUpdate: row.audit_events_update,
    auditEventsDelete: row.audit_events_delete,
    auditEventsTruncate: row.audit_events_truncate,
    auditEventsPolicyCommands: row.audit_events_policy_commands ?? [],
    quarantineDenialExecute: row.quarantine_denial_execute,
  };
}
