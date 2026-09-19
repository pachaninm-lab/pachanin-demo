import { describe, expect, it } from 'vitest';
import {
  platformV7AssertActorMatchesSession,
  platformV7ResolveTrustedActor,
  type PlatformV7TrustedActor,
} from '@/lib/platform-v7/server-actor-identity';

const session: PlatformV7TrustedActor = {
  actorId: 'user-1',
  actorRole: 'seller',
  organizationId: 'org-1',
};

describe('SEC-001 actor↔session binding', () => {
  it('accepts a matching body claim and returns the session actor', () => {
    const d = platformV7AssertActorMatchesSession(
      { actorId: 'user-1', actorRole: 'seller', organizationId: 'org-1' },
      session,
    );
    expect(d.ok).toBe(true);
    expect(d.actor).toEqual(session);
    expect(d.audit).toBeNull();
  });

  it('accepts a body with no actor claim (session is authoritative)', () => {
    const d = platformV7AssertActorMatchesSession({}, session);
    expect(d.ok).toBe(true);
    expect(d.actor?.actorId).toBe('user-1');
  });

  it('rejects role escalation from the body (the headline SEC-001 attack)', () => {
    const d = platformV7AssertActorMatchesSession(
      { actorId: 'user-1', actorRole: 'bank_officer', organizationId: 'org-1' },
      session,
    );
    expect(d.ok).toBe(false);
    expect(d.actor).toBeNull();
    expect(d.auditCode).toBe('ROLE_MISMATCH');
    expect(d.audit?.eventType).toBe('identity.mismatch');
    expect(d.audit?.trustedActorId).toBe('user-1');
  });

  it('rejects actor impersonation and org spoofing', () => {
    expect(platformV7AssertActorMatchesSession({ actorId: 'user-2' }, session).auditCode).toBe('ACTOR_MISMATCH');
    expect(platformV7AssertActorMatchesSession({ organizationId: 'org-9' }, session).auditCode).toBe('ORG_MISMATCH');
  });

  it('rejects when there is no trusted session', () => {
    const d = platformV7AssertActorMatchesSession({ actorId: 'user-1' }, null);
    expect(d.ok).toBe(false);
    expect(d.auditCode).toBe('NO_SESSION');
  });

  it('resolves trusted actor or null for one-line gate use', () => {
    expect(platformV7ResolveTrustedActor({ actorRole: 'seller' }, session)).toEqual(session);
    expect(platformV7ResolveTrustedActor({ actorRole: 'bank_officer' }, session)).toBeNull();
    expect(platformV7ResolveTrustedActor({}, null)).toBeNull();
  });

  it('carries a deterministic timestamp into the audit record', () => {
    const d = platformV7AssertActorMatchesSession({ actorId: 'evil' }, session, '2026-06-15T00:00:00.000Z');
    expect(d.ok).toBe(false);
    expect(d.audit?.occurredAt).toBe('2026-06-15T00:00:00.000Z');
  });
});
