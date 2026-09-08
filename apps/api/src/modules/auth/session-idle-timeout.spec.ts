import { readFileSync } from 'fs';
import { join } from 'path';
import { UnauthorizedException } from '@nestjs/common';
import { Role, ROLES_REQUIRING_MFA, type RequestUser } from '../../common/types/request-user';
import { signAccessToken } from './access-token';
import {
  AuthService,
  PRIVILEGED_SESSION_IDLE_TIMEOUT_MS,
  SESSION_IDLE_TIMEOUT_MS,
  idleTimeoutMsForRole,
} from './auth.service';
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

describe('the two limits are reviewed numbers, in one place', () => {
  const ABSOLUTE_LIFETIME_MS = 30 * 24 * 60 * 60 * 1000;

  it('is one hour for an ordinary session and fifteen minutes for a privileged one', () => {
    expect(SESSION_IDLE_TIMEOUT_MS).toBe(60 * 60 * 1000);
    expect(PRIVILEGED_SESSION_IDLE_TIMEOUT_MS).toBe(15 * 60 * 1000);
  });

  it('orders the limits so a privileged session is never the longest-lived', () => {
    expect(PRIVILEGED_SESSION_IDLE_TIMEOUT_MS).toBeLessThan(SESSION_IDLE_TIMEOUT_MS);
    expect(SESSION_IDLE_TIMEOUT_MS).toBeLessThan(ABSOLUTE_LIFETIME_MS / 100);
  });

  it('gives the shorter limit to exactly the roles this platform already calls privileged', () => {
    for (const role of ROLES_REQUIRING_MFA) {
      expect(idleTimeoutMsForRole(role)).toBe(PRIVILEGED_SESSION_IDLE_TIMEOUT_MS);
    }
    for (const role of [Role.FARMER, Role.BUYER, Role.DRIVER, Role.LOGISTICIAN, Role.ELEVATOR]) {
      expect(idleTimeoutMsForRole(role)).toBe(SESSION_IDLE_TIMEOUT_MS);
    }
  });

  it('falls to the ordinary limit, never to no limit, for an unknown role', () => {
    // A malformed or absent role must not become an unbounded session. The
    // ordinary limit is the floor, not an exemption.
    for (const value of ['', 'NOT_A_ROLE', null, undefined]) {
      expect(idleTimeoutMsForRole(value)).toBe(SESSION_IDLE_TIMEOUT_MS);
    }
  });

  it('is shared by both session pathways rather than restated', () => {
    const product = readFileSync(join(__dirname, 'product-session.service.ts'), 'utf8');
    expect(product).toContain('SESSION_IDLE_TIMEOUT_MS');
    // A locally declared idle constant would be a second policy. The 30-day
    // absolute TTLs in that file are a different limit and legitimately local.
    expect(product).not.toMatch(/const\s+\w*IDLE\w*\s*=/u);
  });

  it('does not invent a second authority for who is privileged', () => {
    const auth = readFileSync(join(__dirname, 'auth.service.ts'), 'utf8');
    // The tier is decided from the role on the session row being validated.
    expect(auth).toContain('idleTimeoutMsForRole(context.role)');
    // staffRoles is a separate internal authority; using it here would mean two
    // answers to the same question.
    expect(auth).not.toMatch(/idleTimeoutMsForRole\(\s*[^)]*staffRoles/u);
  });

  it('is documented where a reviewer would look for it', () => {
    const policy = readFileSync(join(__dirname, '..', '..', '..', '..', '..', 'docs', 'security', 'SESSION_POLICY.md'), 'utf8');
    expect(policy).toContain('1 hour');
    expect(policy).toContain('15 minutes');
    expect(policy).toContain('30 days');
    expect(policy).toContain('SESSION_IDLE_TIMEOUT_MS');
    expect(policy).toContain('PRIVILEGED_SESSION_IDLE_TIMEOUT_MS');
  });
});
