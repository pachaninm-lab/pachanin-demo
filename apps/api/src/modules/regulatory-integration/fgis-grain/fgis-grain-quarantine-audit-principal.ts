/**
 * P0.2-1A — what makes `public.audit_events` append-only for the running
 * platform.
 *
 * This slice deliberately adds no trigger to that table. A table-wide
 * BEFORE UPDATE OR DELETE OR TRUNCATE guard broke six industrial suites, and
 * the only way to keep it was to publish a `DISABLE TRIGGER` bypass — which is
 * worse than a narrower guarantee that actually holds.
 *
 * The guarantee this slice relies on instead is a privilege boundary, and a
 * claimed boundary is worth nothing unless it is checked. `audit_events` has
 * RLS enabled with exactly two policies — `audit_insert_only` (FOR INSERT) and
 * `audit_select_all` (FOR SELECT) — and no UPDATE or DELETE policy, so RLS
 * denies both. That holds only while the principal the platform connects as:
 *
 *   - is not SUPERUSER and does not have BYPASSRLS, either of which skips RLS;
 *   - does not own the table, since an owner is exempt unless RLS is FORCEd;
 *   - inherits neither of the above through a role membership;
 *   - holds no direct UPDATE, DELETE or TRUNCATE grant, none of which RLS
 *     policies can restore once granted — TRUNCATE in particular is not subject
 *     to RLS at all, so only the absent grant stops it.
 *
 * The evaluator is pure so it can be exercised without a database; the live
 * snapshot is captured by `inspectFgisQuarantineAuditPrincipal`.
 *
 * The residual owner/BYPASSRLS gap on this table is tracked separately in
 * issue #3618 and is not hidden by anything here.
 */

export type FgisQuarantineAuditPrincipalSnapshot = {
  currentUser: string;
  superuser: boolean;
  bypassRls: boolean;
  roleInherit: boolean;
  hasRoleMemberships: boolean;
  ownsAuditEvents: boolean;
  rowSecurity: string;
  auditEventsRlsEnabled: boolean;
  auditEventsInsert: boolean;
  auditEventsSelect: boolean;
  auditEventsUpdate: boolean;
  auditEventsDelete: boolean;
  auditEventsTruncate: boolean;
  /** Policy commands defined on public.audit_events, e.g. ['INSERT', 'SELECT']. */
  auditEventsPolicyCommands: string[];
  /** EXECUTE on the quarantine denial command is the only write path allowed. */
  quarantineDenialExecute: boolean;
};

const ALLOWED_POLICY_COMMANDS = new Set(['INSERT', 'SELECT']);

export function evaluateFgisQuarantineAuditPrincipal(
  snapshot: FgisQuarantineAuditPrincipalSnapshot,
): string[] {
  const errors: string[] = [];

  if (snapshot.superuser) {
    errors.push('quarantine audit principal must not be SUPERUSER');
  }
  if (snapshot.bypassRls) {
    errors.push('quarantine audit principal must not have BYPASSRLS');
  }
  if (snapshot.roleInherit && snapshot.hasRoleMemberships) {
    errors.push(
      'quarantine audit principal must not inherit privileges through role membership',
    );
  }
  if (snapshot.ownsAuditEvents) {
    errors.push('quarantine audit principal must not own public.audit_events');
  }
  if (snapshot.rowSecurity.toLowerCase() !== 'on') {
    errors.push('row_security must be on for the quarantine audit principal');
  }
  if (!snapshot.auditEventsRlsEnabled) {
    errors.push('public.audit_events must have row level security enabled');
  }

  // The append path itself.
  if (!snapshot.auditEventsInsert) {
    errors.push('quarantine audit principal requires INSERT on public.audit_events');
  }
  if (!snapshot.auditEventsSelect) {
    errors.push('quarantine audit principal requires SELECT on public.audit_events');
  }
  if (!snapshot.quarantineDenialExecute) {
    errors.push(
      'quarantine audit principal requires EXECUTE on public.record_fgis_legacy_quarantine_denial',
    );
  }

  // The append-only half. A grant here cannot be walked back by a policy.
  if (snapshot.auditEventsUpdate) {
    errors.push('quarantine audit principal must not hold UPDATE on public.audit_events');
  }
  if (snapshot.auditEventsDelete) {
    errors.push('quarantine audit principal must not hold DELETE on public.audit_events');
  }
  if (snapshot.auditEventsTruncate) {
    // TRUNCATE ignores RLS entirely, so the absent grant is the only guard.
    errors.push('quarantine audit principal must not hold TRUNCATE on public.audit_events');
  }

  const unexpectedPolicies = snapshot.auditEventsPolicyCommands
    .map((command) => command.toUpperCase())
    .filter((command) => !ALLOWED_POLICY_COMMANDS.has(command));
  if (unexpectedPolicies.length > 0) {
    errors.push(
      `public.audit_events must define only INSERT and SELECT policies, found: ${unexpectedPolicies.join(', ')}`,
    );
  }

  return errors;
}
