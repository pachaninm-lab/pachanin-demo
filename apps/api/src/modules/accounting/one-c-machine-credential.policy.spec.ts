import {
  ONE_C_PROTOCOL_VERSION,
  OneCCommand,
} from './one-c-connector.protocol';
import {
  OneCMachineCredentialPolicyError,
  issueOneCMachineCredential,
  revokedOneCMachineCredential,
  verifyOneCMachineCredential,
  type OneCMachineCredentialExpectedScope,
  type OneCMachineCredentialScope,
} from './one-c-machine-credential.policy';

const now = new Date('2026-08-18T18:00:00Z');
const expires = new Date('2026-09-18T18:00:00Z');

const scope = (
  overrides: Partial<OneCMachineCredentialScope> = {},
): OneCMachineCredentialScope => ({
  connectorInstallationId: 'install-farm-1',
  connectionId: 'connection-farm-1',
  platformOrganizationId: 'platform-org-farm',
  oneCOrganizationGuid: 'one-c-org-farm',
  protocolVersion: ONE_C_PROTOCOL_VERSION,
  allowedCommands: [
    OneCCommand.UPSERT_COUNTERPARTY,
    OneCCommand.CREATE_SALES_DRAFT,
    OneCCommand.GET_DOCUMENT_STATUS,
  ],
  ...overrides,
});

const expected = (
  overrides: Partial<OneCMachineCredentialExpectedScope> = {},
): OneCMachineCredentialExpectedScope => ({
  connectorInstallationId: 'install-farm-1',
  connectionId: 'connection-farm-1',
  platformOrganizationId: 'platform-org-farm',
  oneCOrganizationGuid: 'one-c-org-farm',
  protocolVersion: ONE_C_PROTOCOL_VERSION,
  ...overrides,
});

describe('1C scoped machine credential', () => {
  it('returns the bearer once and keeps no plaintext secret in persistent state', () => {
    const issued = issueOneCMachineCredential(scope(), expires, now);

    expect(issued.bearer).toMatch(/^[^.]+\.[A-Za-z0-9_-]+$/);
    const secret = issued.bearer.slice(issued.bearer.indexOf('.') + 1);
    expect(secret).toHaveLength(43);
    expect(issued.record.secretHash).toMatch(/^[a-f0-9]{64}$/);
    expect(JSON.stringify(issued.record)).not.toContain(secret);
  });

  it('keeps scope server-side rather than embedding organization claims in the bearer', () => {
    const issued = issueOneCMachineCredential(scope(), expires, now);
    expect(issued.bearer).not.toContain('platform-org-farm');
    expect(issued.bearer).not.toContain('one-c-org-farm');
    expect(issued.bearer).not.toContain('connection-farm-1');
  });

  it('authorizes the exact installation, connection, platform org and 1C legal entity', () => {
    const issued = issueOneCMachineCredential(scope(), expires, now);
    expect(
      verifyOneCMachineCredential(
        issued.record,
        issued.bearer,
        expected({ command: OneCCommand.CREATE_SALES_DRAFT }),
        new Date('2026-08-19T00:00:00Z'),
      ),
    ).toEqual({ authorized: true, credentialId: issued.record.credentialId });
  });

  it.each([
    ['connectorInstallationId', { connectorInstallationId: 'install-other' }],
    ['connectionId', { connectionId: 'connection-other' }],
    ['platformOrganizationId', { platformOrganizationId: 'platform-org-other' }],
    ['oneCOrganizationGuid', { oneCOrganizationGuid: 'one-c-org-other' }],
  ] as const)('denies cross-scope use by %s', (_field, override) => {
    const issued = issueOneCMachineCredential(scope(), expires, now);
    expect(
      verifyOneCMachineCredential(
        issued.record,
        issued.bearer,
        expected(override),
        new Date('2026-08-19T00:00:00Z'),
      ),
    ).toEqual({ authorized: false, reason: 'SCOPE_MISMATCH' });
  });

  it('denies a command outside the binding capability profile', () => {
    const issued = issueOneCMachineCredential(scope(), expires, now);
    expect(
      verifyOneCMachineCredential(
        issued.record,
        issued.bearer,
        expected({ command: OneCCommand.PUSH_PAYMENT_STATUS }),
        new Date('2026-08-19T00:00:00Z'),
      ),
    ).toEqual({ authorized: false, reason: 'COMMAND_NOT_ALLOWED' });
  });

  it('denies a wrong secret', () => {
    const issued = issueOneCMachineCredential(scope(), expires, now);
    const wrong = `${issued.record.credentialId}.${'x'.repeat(43)}`;
    expect(
      verifyOneCMachineCredential(
        issued.record,
        wrong,
        expected(),
        new Date('2026-08-19T00:00:00Z'),
      ),
    ).toEqual({ authorized: false, reason: 'SECRET_MISMATCH' });
  });

  it('rejects malformed or oversized bearers before they can become an unbounded hash input', () => {
    const issued = issueOneCMachineCredential(scope(), expires, now);
    const at = new Date('2026-08-19T00:00:00Z');

    expect(
      verifyOneCMachineCredential(issued.record, `not-a-uuid.${'x'.repeat(43)}`, expected(), at),
    ).toEqual({ authorized: false, reason: 'SECRET_MISMATCH' });
    expect(
      verifyOneCMachineCredential(
        issued.record,
        `${issued.record.credentialId}.${'x'.repeat(4096)}`,
        expected(),
        at,
      ),
    ).toEqual({ authorized: false, reason: 'SECRET_MISMATCH' });
    expect(
      verifyOneCMachineCredential(
        issued.record,
        `${issued.record.credentialId}.${'!'.repeat(43)}`,
        expected(),
        at,
      ),
    ).toEqual({ authorized: false, reason: 'SECRET_MISMATCH' });
  });

  it('denies a bearer with a different credential id even if the secret portion is copied', () => {
    const issued = issueOneCMachineCredential(scope(), expires, now);
    const secret = issued.bearer.slice(issued.bearer.indexOf('.') + 1);
    expect(
      verifyOneCMachineCredential(
        issued.record,
        `00000000-0000-4000-8000-000000000000.${secret}`,
        expected(),
        new Date('2026-08-19T00:00:00Z'),
      ),
    ).toEqual({ authorized: false, reason: 'SECRET_MISMATCH' });
  });

  it('denies an expired credential at the boundary instant', () => {
    const issued = issueOneCMachineCredential(scope(), expires, now);
    expect(
      verifyOneCMachineCredential(issued.record, issued.bearer, expected(), expires),
    ).toEqual({ authorized: false, reason: 'EXPIRED' });
  });

  it('denies a credential before its server-recorded issue time', () => {
    const issued = issueOneCMachineCredential(scope(), expires, now);
    expect(
      verifyOneCMachineCredential(
        issued.record,
        issued.bearer,
        expected(),
        new Date('2026-08-18T17:59:59Z'),
      ),
    ).toEqual({ authorized: false, reason: 'NOT_YET_VALID' });
  });

  it('revokes immediately and increments the optimistic version', () => {
    const issued = issueOneCMachineCredential(scope(), expires, now);
    const revoked = revokedOneCMachineCredential(
      issued.record,
      new Date('2026-08-19T00:00:00Z'),
    );

    expect(revoked.revokedAt).toEqual(new Date('2026-08-19T00:00:00Z'));
    expect(revoked.version).toBe(2);
    expect(
      verifyOneCMachineCredential(
        revoked,
        issued.bearer,
        expected(),
        new Date('2026-08-19T00:00:01Z'),
      ),
    ).toEqual({ authorized: false, reason: 'REVOKED' });
  });

  it('is idempotent when asked to revoke an already revoked immutable value', () => {
    const issued = issueOneCMachineCredential(scope(), expires, now);
    const revoked = revokedOneCMachineCredential(
      issued.record,
      new Date('2026-08-19T00:00:00Z'),
    );
    expect(
      revokedOneCMachineCredential(revoked, new Date('2026-08-20T00:00:00Z')),
    ).toBe(revoked);
  });

  it('requires a finite expiry after issuance', () => {
    expect(() => issueOneCMachineCredential(scope(), now, now)).toThrow(
      'expiresAt must be after issuedAt',
    );
    expect(() =>
      issueOneCMachineCredential(scope(), new Date(Number.NaN), now),
    ).toThrow(OneCMachineCredentialPolicyError);
  });

  it('refuses protocol drift rather than silently widening a credential', () => {
    expect(() =>
      issueOneCMachineCredential(scope({ protocolVersion: '999' }), expires, now),
    ).toThrow('protocolVersion must be 1');
  });

  it('refuses duplicate or unknown allowed commands at issuance', () => {
    expect(() =>
      issueOneCMachineCredential(
        scope({
          allowedCommands: [
            OneCCommand.GET_DOCUMENT_STATUS,
            OneCCommand.GET_DOCUMENT_STATUS,
          ],
        }),
        expires,
        now,
      ),
    ).toThrow('duplicate allowed command');

    expect(() =>
      issueOneCMachineCredential(
        scope({ allowedCommands: ['RUN_SQL' as OneCCommand] }),
        expires,
        now,
      ),
    ).toThrow('unsupported allowed command');
  });

  it('fails closed on malformed persisted hash instead of throwing', () => {
    const issued = issueOneCMachineCredential(scope(), expires, now);
    expect(
      verifyOneCMachineCredential(
        { ...issued.record, secretHash: 'not-a-hash' },
        issued.bearer,
        expected(),
        new Date('2026-08-19T00:00:00Z'),
      ),
    ).toEqual({ authorized: false, reason: 'MALFORMED' });
  });

  it('fails closed on malformed persisted credential id, salt or revocation chronology', () => {
    const issued = issueOneCMachineCredential(scope(), expires, now);
    const at = new Date('2026-08-19T00:00:00Z');

    expect(
      verifyOneCMachineCredential(
        { ...issued.record, credentialId: 'credential-not-uuid' },
        issued.bearer,
        expected(),
        at,
      ),
    ).toEqual({ authorized: false, reason: 'MALFORMED' });
    expect(
      verifyOneCMachineCredential(
        { ...issued.record, salt: '00' },
        issued.bearer,
        expected(),
        at,
      ),
    ).toEqual({ authorized: false, reason: 'MALFORMED' });
    expect(
      verifyOneCMachineCredential(
        { ...issued.record, revokedAt: new Date('2026-08-18T17:59:59Z') },
        issued.bearer,
        expected(),
        at,
      ),
    ).toEqual({ authorized: false, reason: 'MALFORMED' });
  });

  it('fails closed when the caller expects another protocol version', () => {
    const issued = issueOneCMachineCredential(scope(), expires, now);
    expect(
      verifyOneCMachineCredential(
        issued.record,
        issued.bearer,
        expected({ protocolVersion: '2' }),
        new Date('2026-08-19T00:00:00Z'),
      ),
    ).toEqual({ authorized: false, reason: 'MALFORMED' });
  });
});
