import { of } from 'rxjs';
import { StaffWorkspaceAuditInterceptor } from '../../src/modules/staff-access/staff-workspace-audit.interceptor';

describe('StaffWorkspaceAuditInterceptor', () => {
  const actor: any = { id: 'staff-1' };
  const access: any = {
    accessSessionId: 'sas-1',
    grantId: 'grant-1',
    staffRole: 'PLATFORM_OWNER',
    accessMode: 'CONTROL_PLANE',
    permissions: [],
    effectiveTenantId: null,
    effectiveOrganizationId: null,
    effectiveUserId: null,
    effectiveRole: null,
    reason: 'Operational read',
    ticketId: 'OPS-1',
    expiresAt: new Date(Date.now() + 60_000),
  };

  function context(method: string): any {
    return {
      switchToHttp: () => ({
        getRequest: () => ({
          method,
          route: { path: '/staff/workspaces/support' },
          params: {},
          query: {},
          headers: {},
          user: actor,
          staffAccess: access,
        }),
      }),
    };
  }

  async function consume(observable: ReturnType<StaffWorkspaceAuditInterceptor['intercept']>) {
    await new Promise<void>((resolve, reject) => observable.subscribe({
      next: () => undefined,
      complete: resolve,
      error: reject,
    }));
  }

  it('persists a successful read audit before returning the projection', async () => {
    const audit = { record: jest.fn().mockResolvedValue('corr') } as any;
    const interceptor = new StaffWorkspaceAuditInterceptor(audit);
    await consume(interceptor.intercept(context('GET'), { handle: () => of({ ok: true }) } as any));
    expect(audit.record).toHaveBeenCalledWith(
      actor,
      access,
      expect.objectContaining({ action: 'staff.workspace.read' }),
    );
  });

  it('does not append a second post-commit audit for mutations', async () => {
    const audit = { record: jest.fn() } as any;
    const interceptor = new StaffWorkspaceAuditInterceptor(audit);
    await consume(interceptor.intercept(context('POST'), { handle: () => of({ ok: true }) } as any));
    expect(audit.record).not.toHaveBeenCalled();
  });
});
