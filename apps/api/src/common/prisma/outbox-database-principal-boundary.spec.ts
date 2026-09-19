import {
  evaluateOutboxPrincipalBoundary,
  type OutboxDatabasePrincipalSnapshot,
} from './outbox-database-principal-boundary';

function validSnapshot(): OutboxDatabasePrincipalSnapshot {
  return {
    currentUser: 'app_outbox',
    superuser: false,
    bypassRls: false,
    roleInherit: false,
    hasRoleMemberships: false,
    ownsOutboxEntries: false,
    rowSecurity: 'on',
    outboxSelect: true,
    outboxRequiredColumnUpdates: true,
    outboxInsert: false,
    outboxDelete: false,
    dealAnyPrivilege: false,
    redriveAnyPrivilege: false,
    authSchemaUsage: false,
  };
}

describe('outbox PostgreSQL principal boundary', () => {
  it('accepts only the isolated delivery principal', () => {
    expect(evaluateOutboxPrincipalBoundary(validSnapshot())).toEqual([]);
  });

  it.each([
    ['roleInherit', true, 'NOINHERIT'],
    ['hasRoleMemberships', true, 'must not belong'],
    ['superuser', true, 'SUPERUSER'],
    ['bypassRls', true, 'BYPASSRLS'],
    ['ownsOutboxEntries', true, 'must not own'],
    ['outboxInsert', true, 'must not INSERT'],
    ['outboxDelete', true, 'must not DELETE'],
    ['dealAnyPrivilege', true, 'no privileges on public.deals'],
    ['redriveAnyPrivilege', true, 'no privileges on public.outbox_redrive_events'],
    ['authSchemaUsage', true, 'no USAGE on auth schema'],
  ] as const)('rejects %s=%s', (field, value, fragment) => {
    const snapshot = { ...validSnapshot(), [field]: value };
    expect(evaluateOutboxPrincipalBoundary(snapshot).join('; ')).toContain(fragment);
  });

  it('rejects missing queue read or required column updates', () => {
    const errors = evaluateOutboxPrincipalBoundary({
      ...validSnapshot(),
      outboxSelect: false,
      outboxRequiredColumnUpdates: false,
    });
    expect(errors).toEqual(expect.arrayContaining([
      expect.stringContaining('SELECT'),
      expect.stringContaining('UPDATE only'),
    ]));
  });
});
