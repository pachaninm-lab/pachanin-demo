import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd().endsWith(path.join('apps', 'web'))
  ? path.resolve(process.cwd(), '..', '..')
  : process.cwd();
const read = (relativePath: string) => fs.readFileSync(path.join(root, relativePath), 'utf8');

describe('P0 first-customer completion boundaries', () => {
  it('keeps invitation delivery secrets and raw tokens inside server-only routes', () => {
    const api = read('apps/api/src/modules/auth/organization-invitation.service.ts');
    const bff = read('apps/web/app/api/auth/organization-invitations/route.ts');
    const client = read('apps/web/app/platform-v7/profile/team/OrganizationTeamAdminClient.tsx');
    expect(api).toContain('token_hash');
    expect(api).toContain("makeOpaqueToken('iv')");
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
    expect(api).toContain("makeOpaqueToken('ms')");
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

  it('keeps team commands tenant-scoped, MFA-gated, optimistic and auditable', () => {
    const invitations = read('apps/api/src/modules/auth/organization-invitation.service.ts');
    const decisions = read('apps/api/src/modules/auth/registration-decision.service.ts');
    expect(invitations).toContain('FRESH_MFA_REQUIRED');
    expect(invitations).toContain('membership.version =');
    expect(invitations).toContain('organization_membership_command_events');
    expect(decisions).toContain('SELF_APPROVAL_FORBIDDEN');
    expect(decisions).toContain('application.organization_id !== administrator.organizationId');
    expect(decisions).toContain('ROLE_PERMISSION_CEILING_EXCEEDED');
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
    const initiate = read('apps/web/app/api/auth/organization-memberships/[membershipId]/mfa-recovery/route.ts');
    const confirm = read('apps/web/app/api/auth/mfa-recovery/confirm/route.ts');
    const client = read('apps/web/app/platform-v7/profile/team/OrganizationTeamAdminClient.tsx');
    const publicClient = read('apps/web/app/platform-v7/mfa-recovery/MfaRecoveryClient.tsx');
    const genericProxy = read('apps/web/app/api/proxy/[...path]/route.ts');
    expect(api).toContain("makeOpaqueToken('mr')");
    expect(api).toContain('MFA_RECOVERY_PLATFORM_REVIEW_REQUIRED');
    expect(api).toContain("SET status = 'CONSUMED'");
    expect(api).toContain("mfa_secret_ciphertext = NULL");
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
  });

  it('does not render the staff control plane for an ordinary authenticated business user', () => {
    const staffPage = read('apps/web/app/platform-v7/staff/page.tsx');
    expect(staffPage).toContain('fetch(`${API_ORIGIN}/staff/assignments/me`');
    expect(staffPage).toContain('staffRoles.length === 0 || identity.mfaVerified !== true');
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
