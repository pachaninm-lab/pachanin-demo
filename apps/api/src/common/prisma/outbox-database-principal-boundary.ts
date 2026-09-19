export type OutboxDatabasePrincipalSnapshot = {
  currentUser: string;
  superuser: boolean;
  bypassRls: boolean;
  roleInherit: boolean;
  hasRoleMemberships: boolean;
  ownsOutboxEntries: boolean;
  rowSecurity: string;
  outboxSelect: boolean;
  outboxRequiredColumnUpdates: boolean;
  outboxInsert: boolean;
  outboxDelete: boolean;
  dealAnyPrivilege: boolean;
  redriveAnyPrivilege: boolean;
  authSchemaUsage: boolean;
};

export function evaluateOutboxPrincipalBoundary(
  snapshot: OutboxDatabasePrincipalSnapshot,
): string[] {
  const errors: string[] = [];
  if (snapshot.roleInherit) errors.push('outbox principal must be NOINHERIT');
  if (snapshot.hasRoleMemberships) errors.push('outbox principal must not belong to other PostgreSQL roles');
  if (snapshot.superuser) errors.push('outbox principal must not be SUPERUSER');
  if (snapshot.bypassRls) errors.push('outbox principal must not have BYPASSRLS');
  if (snapshot.ownsOutboxEntries) errors.push('outbox principal must not own public.outbox_entries');
  if (snapshot.rowSecurity.toLowerCase() !== 'on') errors.push('row_security must be on');
  if (!snapshot.outboxSelect) errors.push('outbox principal requires SELECT on public.outbox_entries');
  if (!snapshot.outboxRequiredColumnUpdates) {
    errors.push('outbox principal requires UPDATE only on durable lease, retry and receipt columns');
  }
  if (snapshot.outboxInsert) errors.push('outbox worker principal must not INSERT outbox entries');
  if (snapshot.outboxDelete) errors.push('outbox worker principal must not DELETE outbox entries');
  if (snapshot.dealAnyPrivilege) errors.push('outbox worker principal must have no privileges on public.deals');
  if (snapshot.redriveAnyPrivilege) {
    errors.push('outbox worker principal must have no privileges on public.outbox_redrive_events');
  }
  if (snapshot.authSchemaUsage) errors.push('outbox worker principal must have no USAGE on auth schema');
  return errors;
}
