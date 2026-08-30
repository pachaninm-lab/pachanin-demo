import { readFileSync } from 'fs';
import { join } from 'path';
import { UnauthorizedException } from '@nestjs/common';
import { Role, type RequestUser } from '../../common/types/request-user';
import { signAccessToken } from './access-token';
import { AuthService, SESSION_IDLE_TIMEOUT_MS } from './auth.service';
import type { SessionContextRow } from './persistent-auth.repository';

/**
 * ASVS V7.3.1 asks for an inactivity timeout; V7.3.2 asks that the absolute
 * maximum follow risk analysis rather than being a number nobody reviewed.
 *
 * The two are separate gaps and the distinction is the point: an absolute cap
 * does not bound idle exposure. A session left on a shared or lost device used
 * to stay valid for the full thirty days, because nothing read the
 * last_seen_at the sessions table had stored since it was created.
 *
 * These cases drive the real verifier rather than the private predicate, so
 * what is proven is that an idle session is refused where a request is
 * actually admitted.
 */

const actor: RequestUser = {
  id: 'user-1', email: 'idle@example.test', orgId: 'org-1', tenantId: 'tenant-1',
  membershipId: 'membership-1', role: Role.FARMER, sessionId: 'session-1', isOrgAdmin: false,
};

function session(lastSeenAt: Date): SessionContextRow {
  return {
    user_id: actor.id, email: actor.email, full_name: 'Idle', phone: null,
    user_status: 'ACTIVE', membership_id: actor.membershipId as string, role: actor.role,
    is_org_admin: false, membership_status: 'ACTIVE', organization_id: actor.orgId,
    organization_status: 'VERIFIED', tenant_id: actor.tenantId as string,
    session_id: actor.sessionId as string, session_status: 'ACTIVE',
    refresh_family_id: 'family-1', session_credential_version: 1,
    mfa_level: 'TOTP', mfa_verified_at: new Date(Date.now() - 60_000),
    // Deliberately far from expiry: an idle refusal must not be an expiry
    // refusal wearing a different name.
    session_expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    revoked_at: null, revocation_reason: null,
    session_last_seen_at: lastSeenAt,
    current_credential_version: 1, current_mfa_enabled: true,
  };
}

function serviceFor(lastSeenAt: Date) {
  const repository = {
    prisma: {},
    transaction: jest.fn(async (work: (tx: unknown) => Promise<unknown>) => work({})),
    getSessionContext: jest.fn().mockResolvedValue(session(lastSeenAt)),
    revokeSession: jest.fn(),
    touchSession: jest.fn(),
    latestAuditChainPosition: jest.fn().mockResolvedValue({ chainKey: 'auth-global', prevHash: null, nextSequence: 1n }),
    insertAudit: jest.fn(),
  };
  return { service: new AuthService(repository as never), repository };
}

const token = () => signAccessToken(actor.id, actor.sessionId as string, 1);

describe('session inactivity timeout (ASVS V7.3.1)', () => {
  it('admits a session that has been used recently', async () => {
    const { service } = serviceFor(new Date(Date.now() - 60_000));
    await expect(service.verifyAccessToken(token())).resolves.toMatchObject({ id: actor.id });
  });

  it('refuses a session idle for longer than the limit, well inside its absolute lifetime', async () => {
    const { service } = serviceFor(new Date(Date.now() - SESSION_IDLE_TIMEOUT_MS - 1_000));
    await expect(service.verifyAccessToken(token())).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('revokes the idle session rather than only refusing the request', async () => {
    const idle = new Date(Date.now() - SESSION_IDLE_TIMEOUT_MS - 1_000);
    const { service, repository } = serviceFor(idle);
    await expect(service.verifyAccessToken(token())).rejects.toBeInstanceOf(UnauthorizedException);
    expect(repository.revokeSession).toHaveBeenCalledWith(
      expect.anything(), actor.sessionId, 'SESSION_IDLE_TIMEOUT',
    );
  });

  it('decides at the boundary rather than near it', async () => {
    const justInside = serviceFor(new Date(Date.now() - SESSION_IDLE_TIMEOUT_MS + 5_000));
    await expect(justInside.service.verifyAccessToken(token())).resolves.toMatchObject({ id: actor.id });

    const justOutside = serviceFor(new Date(Date.now() - SESSION_IDLE_TIMEOUT_MS - 5_000));
    await expect(justOutside.service.verifyAccessToken(token())).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('does not touch a session it refused', async () => {
    const { service, repository } = serviceFor(new Date(Date.now() - SESSION_IDLE_TIMEOUT_MS - 1_000));
    await expect(service.verifyAccessToken(token())).rejects.toBeInstanceOf(UnauthorizedException);
    expect(repository.touchSession).not.toHaveBeenCalled();
  });
});

describe('the limit is one reviewed number, in one place', () => {
  const ABSOLUTE_LIFETIME_MS = 30 * 24 * 60 * 60 * 1000;

  it('bounds idle exposure far more tightly than the absolute cap', () => {
    expect(SESSION_IDLE_TIMEOUT_MS).toBeLessThan(ABSOLUTE_LIFETIME_MS / 10);
    // Long enough that an ordinary interruption inside a working day does not
    // end the session; the reasoning is recorded at the constant.
    expect(SESSION_IDLE_TIMEOUT_MS).toBeGreaterThanOrEqual(4 * 60 * 60 * 1000);
  });

  it('is shared by both session pathways rather than restated', () => {
    const product = readFileSync(join(__dirname, 'product-session.service.ts'), 'utf8');
    expect(product).toContain('SESSION_IDLE_TIMEOUT_MS');
    // A second literal would be a second policy. Only the definition may carry
    // the number.
    expect(product).not.toMatch(/12 \* 60 \* 60 \* 1000/u);
  });

  it('is documented where a reviewer would look for it', () => {
    const policy = readFileSync(join(__dirname, '..', '..', '..', '..', '..', 'docs', 'security', 'SESSION_POLICY.md'), 'utf8');
    expect(policy).toContain('12 hours');
    expect(policy).toContain('30 days');
    expect(policy).toContain('SESSION_IDLE_TIMEOUT_MS');
  });
});
