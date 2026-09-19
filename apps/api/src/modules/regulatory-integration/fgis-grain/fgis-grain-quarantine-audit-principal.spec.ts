import {
  evaluateFgisQuarantineAuditPrincipal,
  type FgisQuarantineAuditPrincipalSnapshot,
} from './fgis-grain-quarantine-audit-principal';

/**
 * P0.2-1A relies on a privilege boundary rather than a trigger to keep
 * `public.audit_events` append-only for the running platform. These tests are
 * what turns that from an assertion in a comment into something checked.
 */
function productionPrincipal(): FgisQuarantineAuditPrincipalSnapshot {
  return {
    currentUser: 'app_deal',
    superuser: false,
    bypassRls: false,
    roleInherit: false,
    hasRoleMemberships: false,
    ownsAuditEvents: false,
    rowSecurity: 'on',
    auditEventsRlsEnabled: true,
    auditEventsInsert: true,
    auditEventsSelect: true,
    auditEventsUpdate: false,
    auditEventsDelete: false,
    auditEventsTruncate: false,
    auditEventsPolicyCommands: ['INSERT', 'SELECT'],
    quarantineDenialExecute: true,
  };
}

describe('ФГИС quarantine audit principal boundary', () => {
  it('accepts a principal that can only append', () => {
    expect(evaluateFgisQuarantineAuditPrincipal(productionPrincipal())).toEqual([]);
  });

  describe('the three ways RLS stops protecting the table', () => {
    it('rejects SUPERUSER, which skips row level security entirely', () => {
      const errors = evaluateFgisQuarantineAuditPrincipal({
        ...productionPrincipal(),
        superuser: true,
      });
      expect(errors.join('; ')).toContain('must not be SUPERUSER');
    });

    it('rejects BYPASSRLS', () => {
      const errors = evaluateFgisQuarantineAuditPrincipal({
        ...productionPrincipal(),
        bypassRls: true,
      });
      expect(errors.join('; ')).toContain('must not have BYPASSRLS');
    });

    it('rejects owning the table, since an owner is exempt unless RLS is FORCEd', () => {
      const errors = evaluateFgisQuarantineAuditPrincipal({
        ...productionPrincipal(),
        ownsAuditEvents: true,
      });
      expect(errors.join('; ')).toContain('must not own public.audit_events');
    });

    it('rejects inheriting either of those through a role membership', () => {
      const errors = evaluateFgisQuarantineAuditPrincipal({
        ...productionPrincipal(),
        roleInherit: true,
        hasRoleMemberships: true,
      });
      expect(errors.join('; ')).toContain('must not inherit privileges through role membership');
    });

    it('allows NOINHERIT with memberships, and INHERIT with none', () => {
      // Either alone is harmless: a membership cannot leak into a NOINHERIT
      // role, and INHERIT with no memberships has nothing to inherit.
      expect(
        evaluateFgisQuarantineAuditPrincipal({
          ...productionPrincipal(),
          roleInherit: false,
          hasRoleMemberships: true,
        }),
      ).toEqual([]);
      expect(
        evaluateFgisQuarantineAuditPrincipal({
          ...productionPrincipal(),
          roleInherit: true,
          hasRoleMemberships: false,
        }),
      ).toEqual([]);
    });
  });

  describe('direct grants a policy cannot walk back', () => {
    it.each([
      ['auditEventsUpdate', 'must not hold UPDATE'],
      ['auditEventsDelete', 'must not hold DELETE'],
      ['auditEventsTruncate', 'must not hold TRUNCATE'],
    ] as const)('rejects %s', (field, fragment) => {
      const errors = evaluateFgisQuarantineAuditPrincipal({
        ...productionPrincipal(),
        [field]: true,
      });
      expect(errors.join('; ')).toContain(fragment);
    });

    it('rejects TRUNCATE even with RLS on, because TRUNCATE ignores RLS', () => {
      const errors = evaluateFgisQuarantineAuditPrincipal({
        ...productionPrincipal(),
        auditEventsRlsEnabled: true,
        rowSecurity: 'on',
        auditEventsTruncate: true,
      });
      expect(errors).toHaveLength(1);
      expect(errors[0]).toContain('TRUNCATE');
    });
  });

  describe('the table side of the boundary', () => {
    it('requires row level security to be enabled on audit_events', () => {
      const errors = evaluateFgisQuarantineAuditPrincipal({
        ...productionPrincipal(),
        auditEventsRlsEnabled: false,
      });
      expect(errors.join('; ')).toContain('row level security enabled');
    });

    it('requires row_security to be on for the session', () => {
      const errors = evaluateFgisQuarantineAuditPrincipal({
        ...productionPrincipal(),
        rowSecurity: 'off',
      });
      expect(errors.join('; ')).toContain('row_security must be on');
    });

    it.each([['UPDATE'], ['DELETE'], ['ALL']])(
      'rejects a %s policy appearing on audit_events',
      (command) => {
        const errors = evaluateFgisQuarantineAuditPrincipal({
          ...productionPrincipal(),
          auditEventsPolicyCommands: ['INSERT', 'SELECT', command],
        });
        expect(errors.join('; ')).toContain('only INSERT and SELECT policies');
        expect(errors.join('; ')).toContain(command);
      },
    );
  });

  describe('the append path stays usable', () => {
    it.each([
      ['auditEventsInsert', 'requires INSERT'],
      ['auditEventsSelect', 'requires SELECT'],
      ['quarantineDenialExecute', 'requires EXECUTE on public.record_fgis_legacy_quarantine_denial'],
    ] as const)('rejects a principal missing %s', (field, fragment) => {
      const errors = evaluateFgisQuarantineAuditPrincipal({
        ...productionPrincipal(),
        [field]: false,
      });
      expect(errors.join('; ')).toContain(fragment);
    });
  });

  it('reports every violation at once rather than stopping at the first', () => {
    const errors = evaluateFgisQuarantineAuditPrincipal({
      ...productionPrincipal(),
      bypassRls: true,
      ownsAuditEvents: true,
      auditEventsUpdate: true,
      auditEventsDelete: true,
      auditEventsTruncate: true,
    });
    expect(errors).toHaveLength(5);
  });
});
