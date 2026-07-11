import { ExecutionContext } from '@nestjs/common';
import { lastValueFrom, of } from 'rxjs';
import { RequestUser, Role } from '../../src/common/types/request-user';
import {
  StaffAccessContext,
  StaffAccessMode,
  StaffPermission,
  StaffRole,
} from '../../src/modules/staff-access/staff-access.types';
import { StaffWorkspaceAuditInterceptor } from '../../src/modules/staff-access/staff-workspace-audit.interceptor';

const actor: RequestUser = {
  id: 'staff-owner',
  email: 'owner@example.test',
  fullName: 'Platform Owner',
  orgId: 'platform-org',
  tenantId: 'platform-tenant',
  membershipId: 'platform-membership',
  role: Role.ADMIN,
  sessionId: 'auth-session',
  mfaVerified: true,
  mfaVerifiedAt: new Date().toISOString(),
};

const access: StaffAccessContext = {
  accessSessionId: 'staff-session',
  grantId: 'staff-grant',
  actorUserId: actor.id,
  staffRole: StaffRole.PLATFORM_OWNER,
  accessMode: StaffAccessMode.CONTROL_PLANE,
  permissions: [StaffPermission.SUPPORT_CASE_READ],
  effectiveTenantId: 'tenant-1',
  effectiveOrganizationId: 'org-1',
  effectiveUserId: null,
  effectiveRole: null,
  targetDealId: null,
  reason: 'Support review',
  ticketId: 'SUP-1',
  expiresAt: new Date(Date.now() + 60_000),
};

function context(request: Record<string, unknown>): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

describe('StaffWorkspaceAuditInterceptor', () => {
  it('awaits a successful read audit before returning the controller result', async () => {
    let auditFinished = false;
    const audit = {
      record: jest.fn(async () => {
        await Promise.resolve();
        auditFinished = true;
      }),
    };
    const interceptor = new StaffWorkspaceAuditInterceptor(audit as any);
    const result = await lastValueFrom(interceptor.intercept(context({
      method: 'GET',
      route: { path: '/staff/workspaces/support/cases' },
      originalUrl: '/staff/workspaces/support/cases?limit=100',
      params: {},
      query: { limit: '100' },
      headers: { 'x-correlation-id': '2ac7c13c-3f5d-4f7e-9a7d-145e4fd3b93b' },
      user: actor,
      staffAccess: access,
    }), { handle: () => of({ items: [] }) }));
    expect(auditFinished).toBe(true);
    expect(result).toEqual({ items: [] });
    expect(audit.record).toHaveBeenCalledWith(actor, access, expect.objectContaining({
      action: 'staff.workspace.read',
      resourceType: 'cases',
      correlationId: '2ac7c13c-3f5d-4f7e-9a7d-145e4fd3b93b',
      metadata: expect.objectContaining({ method: 'GET', queryNames: ['limit'] }),
    }));
  });

  it('records mutation attribution without copying request bodies into audit metadata', async () => {
    const audit = { record: jest.fn().mockResolvedValue('correlation') };
    const interceptor = new StaffWorkspaceAuditInterceptor(audit as any);
    await lastValueFrom(interceptor.intercept(context({
      method: 'POST',
      route: { path: '/staff/workspaces/support/cases/:id/transition' },
      params: { id: 'sup-1' },
      query: {},
      headers: {},
      body: { note: 'sensitive support note' },
      user: actor,
      staffAccess: access,
    }), { handle: () => of({ id: 'sup-1', status: 'RESOLVED' }) }));
    expect(audit.record).toHaveBeenCalledWith(actor, access, expect.objectContaining({
      action: 'staff.workspace.mutate',
      resourceType: 'staff-resource',
      resourceId: 'sup-1',
      metadata: expect.objectContaining({ parameterNames: ['id'], queryNames: [] }),
    }));
    expect(JSON.stringify(audit.record.mock.calls[0])).not.toContain('sensitive support note');
  });
});
