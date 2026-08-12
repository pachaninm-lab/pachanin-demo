import { GektaAccessService } from './gekta-access.service';
import { GektaPhoneService } from './gekta-phone.service';
import { permissionsFor, gektaRolesFromStaffRoles, resolveGektaRoles, GektaOperatorGuard } from './gekta-operator.guard';
import type { PrismaService } from '../../common/prisma/prisma.service';

const NOW = new Date('2026-08-12T12:00:00.000Z');

function accessServiceWith(account: unknown): GektaAccessService {
  const prisma = {
    gektaAccount: { findUnique: async () => account },
  } as unknown as PrismaService;
  return new GektaAccessService(prisma);
}

const BASE_ACCOUNT = {
  id: 'acc-1',
  suspended: false,
  lifetimeAccess: false,
  trialStartedAt: NOW,
  trialEndsAt: new Date('2026-09-11T12:00:00.000Z'),
  trialGranted: true,
  subscription: { status: 'NONE', currentPeriodEnd: null },
  grants: [] as unknown[],
};

describe('Gekta entitlement resolution', () => {
  it('gives a registered account an active trial by the server clock', async () => {
    const entitlement = await accessServiceWith(BASE_ACCOUNT).resolveEntitlement('u-1', NOW);
    expect(entitlement.state).toBe('TRIAL_ACTIVE');
    expect(entitlement.canAsk).toBe(true);
    expect(entitlement.expiresAt).toBe('2026-09-11T12:00:00.000Z');
    expect(entitlement.serverTime).toBe(NOW.toISOString());
  });

  it('blocks once the trial has expired', async () => {
    const expired = { ...BASE_ACCOUNT, trialEndsAt: new Date('2026-08-01T00:00:00.000Z') };
    const entitlement = await accessServiceWith(expired).resolveEntitlement('u-1', NOW);
    expect(entitlement.state).toBe('TRIAL_EXPIRED');
    expect(entitlement.canAsk).toBe(false);
  });

  it('lets a manual grant outrank an expired trial', async () => {
    const account = {
      ...BASE_ACCOUNT,
      trialEndsAt: new Date('2026-08-01T00:00:00.000Z'),
      grants: [{ kind: 'MANUAL', expiresAt: new Date('2026-08-20T00:00:00.000Z'), revokedAt: null }],
    };
    const entitlement = await accessServiceWith(account).resolveEntitlement('u-1', NOW);
    expect(entitlement.state).toBe('MANUAL_ACCESS');
    expect(entitlement.canAsk).toBe(true);
  });

  it('ignores a manual grant that already lapsed', async () => {
    const account = {
      ...BASE_ACCOUNT,
      trialEndsAt: new Date('2026-08-01T00:00:00.000Z'),
      grants: [{ kind: 'MANUAL', expiresAt: new Date('2026-08-05T00:00:00.000Z'), revokedAt: null }],
    };
    expect((await accessServiceWith(account).resolveEntitlement('u-1', NOW)).state).toBe('TRIAL_EXPIRED');
  });

  it('puts suspension above every grant, including lifetime', async () => {
    const account = { ...BASE_ACCOUNT, suspended: true, lifetimeAccess: true };
    const entitlement = await accessServiceWith(account).resolveEntitlement('u-1', NOW);
    expect(entitlement.state).toBe('SUSPENDED');
    expect(entitlement.canAsk).toBe(false);
  });

  it('treats a paid subscription as stronger than the trial window', async () => {
    const account = {
      ...BASE_ACCOUNT,
      trialEndsAt: new Date('2026-08-01T00:00:00.000Z'),
      subscription: { status: 'ACTIVE', currentPeriodEnd: new Date('2026-09-01T00:00:00.000Z') },
    };
    expect((await accessServiceWith(account).resolveEntitlement('u-1', NOW)).state).toBe('PAID_ACTIVE');
  });

  it('blocks a past-due subscription', async () => {
    const account = { ...BASE_ACCOUNT, subscription: { status: 'PAST_DUE', currentPeriodEnd: null } };
    const entitlement = await accessServiceWith(account).resolveEntitlement('u-1', NOW);
    expect(entitlement.state).toBe('PAST_DUE');
    expect(entitlement.canAsk).toBe(false);
  });

  it('requires registration when no Gekta account exists', async () => {
    expect((await accessServiceWith(null).resolveEntitlement('u-1', NOW)).state).toBe('REGISTRATION_REQUIRED');
  });

  it('never grants a second trial to the same account', async () => {
    const created: unknown[] = [];
    const prisma = {
      gektaAccount: {
        findUnique: async () => ({ ...BASE_ACCOUNT, trialGranted: true }),
        create: async (args: unknown) => {
          created.push(args);
          return BASE_ACCOUNT;
        },
      },
    } as unknown as PrismaService;

    await new GektaAccessService(prisma).ensureAccount('u-1', NOW);
    // The account already exists, so no second trial is written.
    expect(created).toHaveLength(0);
  });
});

describe('Gekta phone identity', () => {
  const service = new GektaPhoneService({} as unknown as PrismaService);

  beforeEach(() => {
    process.env.GEKTA_PHONE_ENCRYPTION_KEY = Buffer.alloc(32, 9).toString('base64');
    process.env.GEKTA_PHONE_LOOKUP_PEPPER = 'pepper-value-for-api-tests';
  });

  it('canonicalises every Russian spelling of one number', () => {
    for (const input of ['+7 916 277-89-89', '8 (916) 277-89-89', '79162778989', '9162778989']) {
      expect(service.normalize(input)).toBe('+79162778989');
    }
    expect(service.normalize('123')).toBeNull();
    expect(service.normalize('')).toBeNull();
  });

  it('encrypts the number and searches through a separate index', () => {
    const stored = service.encrypt('+79162778989');
    expect(stored).not.toContain('79162778989');
    expect(service.decrypt(stored)).toBe('+79162778989');
    // Encryption is non-deterministic; the lookup index is deterministic.
    expect(service.encrypt('+79162778989')).not.toBe(stored);
    expect(service.lookupHash('+79162778989')).toBe(service.lookupHash('+79162778989'));
    expect(service.lookupHash('+79162778989')).not.toContain('79162778989');
    expect(service.lookupHash('+79162778988')).not.toBe(service.lookupHash('+79162778989'));
  });

  it('masks the number everywhere it is shown to an operator', () => {
    expect(service.mask('+79162778989')).not.toContain('916277');
    expect(service.mask('+79162778989').endsWith('89')).toBe(true);
  });

  it('reports the storage as unavailable instead of failing open', () => {
    delete process.env.GEKTA_PHONE_ENCRYPTION_KEY;
    expect(service.available()).toBe(false);
  });
});

describe('Gekta operator permissions', () => {
  it('does not give support any owner power', () => {
    const support = permissionsFor(['GEKTA_SUPPORT']);
    expect(support.has('account.search')).toBe(true);
    expect(support.has('entitlement.grant_manual')).toBe(false);
    expect(support.has('entitlement.grant_lifetime')).toBe(false);
    expect(support.has('account.read_conversation_content')).toBe(false);
    expect(support.has('metrics.read_global')).toBe(false);
  });

  it('keeps lifetime access and global metrics for the owner only', () => {
    expect(permissionsFor(['GEKTA_ADMIN']).has('entitlement.grant_manual')).toBe(true);
    expect(permissionsFor(['GEKTA_ADMIN']).has('entitlement.grant_lifetime')).toBe(false);
    expect(permissionsFor(['GEKTA_OWNER']).has('entitlement.grant_lifetime')).toBe(true);
    expect(permissionsFor(['GEKTA_OWNER']).has('metrics.read_global')).toBe(true);
  });

  it('ignores unknown roles instead of granting on them', () => {
    expect(permissionsFor(['SOMETHING_ELSE']).size).toBe(0);
    expect(permissionsFor([]).size).toBe(0);
  });

  it('refuses a request whose roles lack the required permission', async () => {
    const guard = new GektaOperatorGuard({
      getAllAndOverride: () => 'entitlement.grant_lifetime',
    } as never);
    const context = {
      getHandler: () => undefined,
      getClass: () => undefined,
      switchToHttp: () => ({ getRequest: () => ({ user: { gektaRoles: ['GEKTA_SUPPORT'] } }) }),
    } as never;
    await expect(guard.canActivate(context)).rejects.toThrow('gekta_permission_denied');
  });

  it('allows the request when the role carries the permission', async () => {
    const guard = new GektaOperatorGuard({
      getAllAndOverride: () => 'entitlement.grant_lifetime',
    } as never);
    const context = {
      getHandler: () => undefined,
      getClass: () => undefined,
      switchToHttp: () => ({ getRequest: () => ({ user: { gektaRoles: ['GEKTA_OWNER'] } }) }),
    } as never;
    await expect(guard.canActivate(context)).resolves.toBe(true);
  });

  it('resolves staff assignments itself, because the global guard does not do it on Gekta routes', async () => {
    const asked: string[] = [];
    const guard = new GektaOperatorGuard(
      { getAllAndOverride: () => 'metrics.read_global' } as never,
      {
        enrichActor: async (user: { id: string }) => {
          asked.push(user.id);
          return { staffRoles: ['PLATFORM_OWNER'] };
        },
      },
    );
    const request = { user: { id: 'u-1' } as { id: string; staffRoles?: string[] } };
    const context = {
      getHandler: () => undefined,
      getClass: () => undefined,
      switchToHttp: () => ({ getRequest: () => request }),
    } as never;

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(asked).toEqual(['u-1']);
    expect(request.user.staffRoles).toEqual(['PLATFORM_OWNER']);
  });

  it('does not re-read assignments that the platform already resolved', async () => {
    let calls = 0;
    const guard = new GektaOperatorGuard(
      { getAllAndOverride: () => 'account.search' } as never,
      {
        enrichActor: async () => {
          calls += 1;
          return { staffRoles: ['PLATFORM_OWNER'] };
        },
      },
    );
    const context = {
      getHandler: () => undefined,
      getClass: () => undefined,
      switchToHttp: () => ({ getRequest: () => ({ user: { id: 'u-1', staffRoles: ['SUPPORT_L1'] } }) }),
    } as never;

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(calls).toBe(0);
  });

  it('denies an unassigned user rather than failing open', async () => {
    const guard = new GektaOperatorGuard(
      { getAllAndOverride: () => 'metrics.read_global' } as never,
      { enrichActor: async () => ({ staffRoles: [] }) },
    );
    const context = {
      getHandler: () => undefined,
      getClass: () => undefined,
      switchToHttp: () => ({ getRequest: () => ({ user: { id: 'u-2' } }) }),
    } as never;
    await expect(guard.canActivate(context)).rejects.toThrow('gekta_permission_denied');
  });
});

describe('Gekta roles derived from platform staff authority', () => {
  it('maps the platform owner onto the Gekta owner', () => {
    expect(gektaRolesFromStaffRoles(['PLATFORM_OWNER'])).toEqual(['GEKTA_OWNER']);
    expect(gektaRolesFromStaffRoles(['PLATFORM_ADMIN'])).toEqual(['GEKTA_ADMIN']);
    expect(gektaRolesFromStaffRoles(['SUPPORT_L2'])).toEqual(['GEKTA_OPERATOR']);
    expect(gektaRolesFromStaffRoles(['SUPPORT_L1'])).toEqual(['GEKTA_SUPPORT']);
  });

  it('gives a privileged platform role nothing in Gekta unless it is mapped', () => {
    // Такие роли существуют на платформе и не должны сами по себе открывать кабинет Гекты.
    expect(gektaRolesFromStaffRoles(['BREAK_GLASS_ADMIN', 'DEVELOPER', 'SRE_ONCALL', 'FINANCE_OPS'])).toEqual([]);
    expect(gektaRolesFromStaffRoles([])).toEqual([]);
  });

  it('opens the owner console for the platform owner instead of leaving it unreachable', () => {
    const roles = resolveGektaRoles({ staffRoles: ['PLATFORM_OWNER'] });
    expect(permissionsFor(roles).has('metrics.read_global')).toBe(true);
    expect(permissionsFor(roles).has('entitlement.grant_lifetime')).toBe(true);
  });

  it('does not read roles from anywhere except the verified server context', () => {
    // Ни поле roles из токена, ни что-либо ещё в запросе ролью Гекты не считается.
    expect(resolveGektaRoles({ ...({ roles: ['GEKTA_OWNER'] } as object) })).toEqual([]);
    expect(resolveGektaRoles(undefined)).toEqual([]);
    expect(resolveGektaRoles({ gektaRoles: ['NOT_A_ROLE'], staffRoles: ['SUPPORT_L1'] })).toEqual(['GEKTA_SUPPORT']);
  });
});
