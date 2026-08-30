import fs from 'node:fs';
import path from 'node:path';
import { NextRequest } from 'next/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ACCESS_COOKIE } from '@/lib/auth-cookies';
import { sendTransactionalMail } from '@/lib/server/transactional-mail';

vi.mock('@/lib/server-request-security', () => ({
  assertCsrf: vi.fn(() => ({ ok: true })),
}));

vi.mock('@/lib/server/transactional-mail', () => ({
  sendTransactionalMail: vi.fn(),
}));

const root = process.cwd().endsWith(path.join('apps', 'web'))
  ? path.resolve(process.cwd(), '..', '..')
  : process.cwd();
const read = (relativePath: string) => fs.readFileSync(path.join(root, relativePath), 'utf8');

describe('P0 first-customer completion boundaries', () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('keeps invitation delivery secrets and raw tokens inside server-only routes', () => {
    const api = read('apps/api/src/modules/auth/organization-invitation.service.ts');
    const bff = read('apps/web/app/api/auth/organization-invitations/route.ts');
    const client = read('apps/web/app/platform-v7/profile/team/OrganizationTeamAdminClient.tsx');
    expect(api).toContain('token_hash');
    expect(api).toContain('issueInvitationCredential()');
    expect(api).toContain('!result.replayed && deliveryAuthorized(deliveryKey)');
    expect(bff).toContain('ORGANIZATION_INVITATION_DELIVERY_KEY');
    expect(bff).toContain('deliverOrganizationInvitation');
    expect(client).not.toContain('ORGANIZATION_INVITATION_DELIVERY_KEY');
    expect(client).not.toContain('emailDelivery');
  });

  it('accepts an invitation without creating a browser session or choosing a role', () => {
    const accept = read('apps/web/app/api/auth/organization-invitations/accept/route.ts');
    const form = read('apps/web/app/platform-v7/invitation/InvitationAcceptClient.tsx');
    expect(accept).toContain("nextAction: 'LOGIN'");
    expect(accept).not.toContain('applyAuthenticatedSession');
    expect(form).not.toContain("name='role'");
    expect(form).toContain("href='/platform-v7/login'");
  });

  it('requires a one-time server membership challenge before multi-organization session creation', () => {
    const api = read('apps/api/src/modules/auth/auth.service.ts');
    const route = read('apps/web/app/api/auth/membership-select/route.ts');
    const login = read('apps/web/app/platform-v7/login/LoginFormClient.tsx');
    expect(api).toContain('issueMembershipSelectionCredential()');
    expect(api).toContain('consumeMembershipSelectionChallenge');
    expect(api).toContain('findIdentityByUserAndMembership');
    expect(route).toContain('MEMBERSHIP_SELECTION_COOKIE');
    expect(login).toContain("requestJson('/api/auth/membership-select'");
  });

  it('guards every public credential mutation with the same-origin CSRF nonce', () => {
    const middleware = read('apps/web/middleware.ts');
    for (const route of [
      'apps/web/app/api/auth/login/route.ts',
      'apps/web/app/api/auth/mfa-login/route.ts',
      'apps/web/app/api/auth/register/route.ts',
      'apps/web/app/api/auth/registration/verify/route.ts',
      'apps/web/app/api/auth/forgot-password/route.ts',
      'apps/web/app/api/auth/reset-password/route.ts',
      'apps/web/app/api/auth/organization-invitations/accept/route.ts',
      'apps/web/app/api/auth/mfa-recovery/confirm/route.ts',
    ]) expect(read(route)).toContain('assertCsrf(request)');
    expect(middleware).toContain('ensureCsrfCookie(req, response)');
  });

  it('clears every writable presentation role at the public registration boundary', () => {
    const middleware = read('apps/web/middleware.ts');
    expect(middleware).toContain("p === '/platform-v7/register'");
    expect(middleware).toContain("p === '/api/auth/register'");
    expect(middleware).toContain("p.startsWith('/api/auth/registration/')");
    expect(middleware).toContain("isPublicRegistrationPath(p) ? 'organization' : presentationRole");
    expect(middleware).toContain('if (isPublicRegistrationPath(p)) clearPresentationRoleCookie(response)');
    expect(middleware).toContain("response.cookies.set('pc-role', '', {");
    expect(middleware).toContain('maxAge: 0');
  });

  it('keeps team commands tenant-scoped, MFA-gated, optimistic and auditable', () => {
    const invitations = read('apps/api/src/modules/auth/organization-invitation.service.ts');
    const teamAuthority = read('apps/api/prisma/migrations/20260808130000_p0_organization_team_authority/migration.sql');
    const commandAuthority = read('apps/api/prisma/migrations/20260808150000_p0_invitation_recovery_authority/migration.sql');
    const decisions = read('apps/api/src/modules/auth/registration-decision.service.ts');
    expect(invitations).toContain('FROM auth.resolve_organization_admin_session(');
    expect(teamAuthority).toContain("session.mfa_verified_at >= now() - interval '15 minutes'");
    expect(invitations).toContain('FROM auth.change_organization_membership_role(');
    expect(commandAuthority).toContain('membership."version" = p_expected_version');
    expect(invitations).toContain('organization_membership_command_events');
    expect(decisions).toContain('SELF_APPROVAL_FORBIDDEN');
    expect(decisions).toContain('application.organization_id !== administrator.organizationId');
    expect(decisions).toContain('ROLE_PERMISSION_CEILING_EXCEEDED');
  });

  it('keeps organization join decisions inside coherent API, mail and browser time budgets', () => {
    const api = read('apps/api/src/modules/auth/registration-decision.service.ts');
    const bff = read('apps/web/app/api/auth/organization-join-requests/[applicationId]/decision/route.ts');
    const client = read('apps/web/app/platform-v7/profile/team/OrganizationTeamAdminClient.tsx');
    const mail = read('apps/web/lib/server/transactional-mail.ts');
    const acceptance = read('scripts/production-p0-all-role-registration.sh');
    const decideJoin = client.slice(
      client.indexOf('async function decideJoin'),
      client.indexOf('async function memberCommand'),
    );

    expect(api).toContain('timeout: 15_000, maxWait: 5_000');
    expect(bff).toContain('export const maxDuration = 100;');
    expect(bff).toContain('const JOIN_DECISION_UPSTREAM_TIMEOUT_MS = 75_000;');
    expect(bff).toContain('signal: AbortSignal.timeout(JOIN_DECISION_UPSTREAM_TIMEOUT_MS)');
    expect(bff).toContain('let upstreamResponse: Response;');
    expect(bff).toContain('await sendTransactionalMail({');
    expect(bff).toContain('organization_join_decision_notification_failure');
    expect(bff).toContain("failureClass: 'NOTIFICATION_TRANSPORT'");
    expect(mail).toContain('const MAIL_TIMEOUT_MS = 5_000;');
    expect(mail).toContain('}, MAIL_TIMEOUT_MS + 2_500);');
    expect(decideJoin).toContain('signal: AbortSignal.timeout(120_000)');
    expect(decideJoin).not.toContain('signal: AbortSignal.timeout(15_000)');
    expect(acceptance).toContain("'HTTP_REQUEST_TIMEOUT_ENVELOPE'");
    expect(acceptance).toContain("'--max-time 110'");

    expect(bff).toContain('assertCsrf(request)');
    expect(bff).toContain('request.cookies.get(ACCESS_COOKIE)?.value');
    expect(bff).toContain("'Idempotency-Key': idempotencyKey");
    expect(bff).toContain("'X-Registration-Delivery-Key': deliveryKey");
    expect(bff).toContain("code: 'JOIN_REQUEST_SERVICE_UNAVAILABLE', correlationId }, 503");

    expect(bff).toContain("error instanceof Error && error.name === 'TimeoutError'");
    expect(bff).toContain("? 'UPSTREAM_TIMEOUT'");
    expect(bff).toContain(": 'UPSTREAM_TRANSPORT'");
    expect(bff).toMatch(/console\.warn\('organization_join_decision_upstream_failure', JSON\.stringify\(\{\s*correlationId,\s*failureClass,\s*\}\)\);/);
    expect(bff).not.toContain('error.message');
    expect(bff).not.toContain('String(error)');
  });

  it('does not relabel a committed join decision as upstream 503 when notification code throws', async () => {
    vi.stubEnv('API_URL', 'https://api.example.test');
    vi.stubEnv('REGISTRATION_DELIVERY_KEY', 'r'.repeat(32));
    vi.mocked(sendTransactionalMail).mockRejectedValue(new Error('synthetic notification failure'));
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      status: 'ACTIVATED',
      nextAction: 'LOGIN',
      replayed: false,
      notificationDelivery: {
        email: 'synthetic-employee@example.test',
        status: 'ACTIVATED',
        reason: 'approved',
      },
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }));
    vi.stubGlobal('fetch', fetchMock);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { POST } = await import('@/app/api/auth/organization-join-requests/[applicationId]/decision/route');
    const request = new NextRequest(
      'https://app.example.test/api/auth/organization-join-requests/reg_employee/decision',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': 'p0-employee-join-post-commit-boundary',
          'x-correlation-id': 'p0-employee-join-post-commit-boundary',
          cookie: `${ACCESS_COOKIE}=seller-access-token`,
        },
        body: JSON.stringify({
          decision: 'APPROVE',
          reason: 'Production employee organization join approval',
          locale: 'ru',
        }),
      },
    );
    request.cookies.set(ACCESS_COOKIE, 'seller-access-token');

    const response = await POST(request, {
      params: Promise.resolve({ applicationId: 'reg_employee' }),
    });
    const payload = await response.json() as Record<string, unknown>;

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({
      status: 'ACTIVATED',
      nextAction: 'LOGIN',
      replayed: false,
      notificationDelivered: false,
      correlationId: 'p0-employee-join-post-commit-boundary',
    });
    expect(payload).not.toHaveProperty('notificationDelivery');
    expect(warn).toHaveBeenCalledWith(
      'organization_join_decision_notification_failure',
      JSON.stringify({
        correlationId: 'p0-employee-join-post-commit-boundary',
        failureClass: 'NOTIFICATION_TRANSPORT',
      }),
    );
  });

  it('offers an authenticated one-time MFA step-up instead of requiring a new login', () => {
    const api = read('apps/api/src/modules/auth/auth.service.ts');
    const start = read('apps/web/app/api/auth/mfa-step-up/start/route.ts');
    const verify = read('apps/web/app/api/auth/mfa-step-up/verify/route.ts');
    const client = read('apps/web/app/platform-v7/profile/team/OrganizationTeamAdminClient.tsx');
    expect(api).toContain("type: 'STEP_UP'");
    expect(api).toContain('challenge.session_id !== user.sessionId');
    expect(start).toContain('MFA_STEP_UP_COOKIE');
    expect(start).toContain('assertCsrf(request)');
    expect(verify).toContain('Authorization: `Bearer ${accessToken}`');
    expect(verify).toContain('clearMfaStepUpCookieOptions');
    expect(client).toContain("fetch('/api/auth/mfa-step-up/start'");
    expect(client).toContain("fetch('/api/auth/mfa-step-up/verify'");
  });

  it('uses controlled subject-confirmed MFA recovery instead of an administrator-side reset', () => {
    const api = read('apps/api/src/modules/auth/organization-invitation.service.ts');
    const migration = read('apps/api/prisma/migrations/20260801133000_p0_mfa_recovery/migration.sql');
    const recoveryAuthority = read('apps/api/prisma/migrations/20260808150000_p0_invitation_recovery_authority/migration.sql');
    const initiate = read('apps/web/app/api/auth/organization-memberships/[membershipId]/mfa-recovery/route.ts');
    const confirm = read('apps/web/app/api/auth/mfa-recovery/confirm/route.ts');
    const client = read('apps/web/app/platform-v7/profile/team/OrganizationTeamAdminClient.tsx');
    const publicClient = read('apps/web/app/platform-v7/mfa-recovery/MfaRecoveryClient.tsx');
    const genericProxy = read('apps/web/app/api/proxy/[...path]/route.ts');
    expect(api).toContain('issueMfaRecoveryCredential()');
    expect(api).toContain('MFA_RECOVERY_PLATFORM_REVIEW_REQUIRED');
    expect(recoveryAuthority).toContain("SET status = 'CONSUMED'");
    expect(recoveryAuthority).toContain('mfa_secret_ciphertext = NULL');
    expect(api).toContain("revokeAllUserSessions(tx, challenge.user_id, 'CONTROLLED_MFA_RECOVERY')");
    expect(migration).toContain('mfa_recovery_one_pending_user_idx');
    expect(migration).toContain('mfa_recovery_events_append_only');
    expect(initiate).toContain('ORGANIZATION_INVITATION_DELIVERY_KEY');
    expect(initiate).toContain('deliverMfaRecovery');
    expect(initiate).not.toContain('token: delivery.token');
    expect(confirm).toContain('/auth/mfa-recovery/confirm');
    expect(confirm).toContain('clearAuthenticatedSession(response)');
    expect(client).toContain('/mfa-recovery`');
    expect(client).toContain('subject confirmation required');
    expect(client).not.toContain('recoveryDelivery');
    expect(publicClient).toContain("autoComplete='current-password'");
    expect(publicClient).not.toContain('useSearchParams');
    expect(genericProxy).toContain('requiresDedicatedDeliveryBff(request.method, path)');
    expect(genericProxy).toContain("headers.delete('x-organization-invitation-delivery-key')");
  });

  it('admits organizations only through durable staff authority, never a client ADMIN role', () => {
    const authController = read('apps/api/src/modules/auth/auth.controller.ts');
    const staffController = read('apps/api/src/modules/staff-access/staff-access.controller.ts');
    const permissions = read('apps/api/src/modules/staff-access/staff-access.types.ts');
    const decisions = read('apps/api/src/modules/auth/registration-decision.service.ts');
    const proxy = read('apps/web/app/api/staff/[...path]/route.ts');
    expect(authController).not.toContain("@Post('registration/:applicationId/decision')");
    expect(staffController).toContain("@Post('registration/applications/:applicationId/decision')");
    expect(staffController).toContain('StaffPermission.STAFF_REQUEST_APPROVE');
    expect(permissions).toContain("STAFF_REQUEST_APPROVE: 'staff-request:approve'");
    expect(decisions).toContain('this.requirePlatformReviewer(reviewer)');
    expect(decisions).toContain("'PLATFORM_OWNER', 'PLATFORM_ADMIN', 'COMPLIANCE_STAFF'");
    expect(proxy).toContain('/^registration\\/applications\\/[^/]+\\/decision$/');
    expect(proxy).toContain("request.headers.get('idempotency-key')");
    expect(proxy).toContain("'idempotency-key': idempotencyKey");
    expect(proxy).toContain("code: 'IDEMPOTENCY_KEY_REQUIRED'");
  });

  it('does not render the staff control plane for an ordinary authenticated business user', () => {
    const staffPage = read('apps/web/app/platform-v7/staff/page.tsx');
    expect(staffPage).toContain('fetch(`${API_BASE_URL}/staff/capabilities/me`');
    expect(staffPage).toContain('parseStaffCapabilitiesContract(');
    expect(staffPage).toContain('capabilities.identity.id !== identity.id');
    expect(staffPage).not.toContain('fetch(`${API_BASE_URL}/staff/assignments/me`');
    expect(staffPage).not.toContain('staffRoles.length === 0 || identity.mfaVerified !== true');
    expect(staffPage).toContain("capabilitiesResponse.status === 403");
    expect(staffPage).toContain("verification.status === 'forbidden'");
    expect(staffPage).toContain('platformHome(role, verification.identity.isOrgAdmin === true)');
  });

  it('forces every public business role landing onto a PostgreSQL-backed queue in production', () => {
    const boundary = read('apps/web/lib/first-customer-workspace-server.ts');
    expect(boundary).toContain("if (String(env.NODE_ENV || '').toLowerCase() === 'production') return true");
    expect(boundary).toContain("serverApiUrl(QUEUE_ENDPOINT[surface])");
    expect(boundary).toContain("headers: await serverAuthHeaders()");
    expect(boundary).not.toContain('STATIC_FALLBACK');

    const landings: ReadonlyArray<readonly [string, string]> = [
      ['apps/web/app/platform-v7/seller/page.tsx', 'seller'],
      ['apps/web/app/platform-v7/buyer/page.tsx', 'buyer'],
      ['apps/web/app/platform-v7/logistics/page.tsx', 'logistics'],
      ['apps/web/app/platform-v7/driver/field/page.tsx', 'driver'],
      ['apps/web/app/platform-v7/elevator/page.tsx', 'elevator'],
      ['apps/web/app/platform-v7/lab/page.tsx', 'lab'],
      ['apps/web/app/platform-v7/surveyor/page.tsx', 'surveyor'],
      ['apps/web/app/platform-v7/bank/page.tsx', 'bank'],
    ];
    for (const [file, surface] of landings) {
      const page = read(file);
      expect(page).toContain('firstCustomerWorkspaceRequired()');
      expect(page).toContain(`<FirstCustomerWorkspace surface='${surface}' />`);
    }
  });

  it('never substitutes laboratory, document or settlement fixtures when an API is unavailable', () => {
    const labs = read('apps/web/lib/labs-server.ts');
    const documents = read('apps/web/lib/documents-server.ts');
    const settlement = read('apps/web/lib/settlement-server.ts');
    expect(labs).not.toContain('STATIC_FALLBACK');
    expect(labs).toContain('return [];');
    expect(documents).not.toContain('mapRuntime');
    expect(documents).toContain('return [];');
    expect(settlement).not.toContain('getRuntimeSnapshot');
    expect(settlement).not.toContain('fallback-runtime-snapshot');
    expect(settlement).toContain("source: 'unavailable'");
  });

  it('routes an approved employee to a restricted organization cabinet and an organization admin to team control', () => {
    const response = read('apps/web/lib/server/auth-session-response.ts');
    const verified = read('apps/web/lib/platform-v7/verified-session.ts');
    const middleware = read('apps/web/middleware.ts');
    const layout = read('apps/web/app/platform-v7/layout.tsx');
    expect(response).toContain("normalized === 'GUEST'");
    expect(response).toContain("organization: '/platform-v7/profile'");
    expect(response).toContain("if (isOrganizationAdmin) return '/platform-v7/profile/team'");
    expect(verified).toContain("GUEST: 'organization'");
    expect(middleware).toContain("context?.role === 'organization'");
    expect(layout).toContain("role === 'organization'");
    expect(layout).toContain('OrganizationAccessShell');
  });
});
