import { ForbiddenException, ServiceUnavailableException } from '@nestjs/common';
import { SupportService } from './support.service';
import { Role, RequestUser } from '../../common/types/request-user';

/**
 * ASVS V6.4.6: an administrator may initiate the reset, but must not be able to
 * change or choose the user's password — otherwise they know it.
 *
 * The endpoint is live: app.module.ts registers SupportModule, and
 * support.controller.ts exposes POST users/:userId/reset-password. It used to
 * return `RESET-${Date.now().toString(36)}`, a fully predictable value that was
 * never stored and wired to nothing.
 */

const freshMfa = () => ({ mfaVerified: true, mfaVerifiedAt: new Date().toISOString() });
const admin = { id: 'adm-1', role: Role.ADMIN, ...freshMfa() } as RequestUser;
const supportManager = { id: 'sup-1', role: Role.SUPPORT_MANAGER, ...freshMfa() } as RequestUser;
const farmer = { id: 'usr-9', role: Role.FARMER, ...freshMfa() } as RequestUser;

function makeService(options: {
  email?: string | null;
  lookupThrows?: boolean;
  withPrisma?: boolean;
  withReset?: boolean;
} = {}) {
  const {
    email = 'ivan@example.com',
    lookupThrows = false,
    withPrisma = true,
    withReset = true,
  } = options;

  const requested: unknown[][] = [];
  const audited: Array<{ action: string; objectId: string; payload: unknown }> = [];

  const prisma = withPrisma
    ? ({
        user: {
          findUnique: jest.fn(async () => {
            if (lookupThrows) throw new Error('db down');
            return email === null ? null : { email };
          }),
        },
      } as any)
    : undefined;

  const audit = {
    log: jest.fn((payload: any) => {
      audited.push({ action: payload.action, objectId: payload.objectId, payload });
    }),
  } as any;

  const passwordReset = withReset
    ? ({
        request: jest.fn(async (...args: unknown[]) => {
          requested.push(args);
          return { accepted: true, message: 'universal' };
        }),
      } as any)
    : undefined;

  return {
    service: new SupportService(prisma, audit, passwordReset),
    requested,
    audited,
    prisma,
    passwordReset,
  };
}

describe('SupportService.resetUserPassword (V6.4.6)', () => {
  const originalKey = process.env.PASSWORD_RESET_DELIVERY_KEY;
  beforeEach(() => {
    process.env.PASSWORD_RESET_DELIVERY_KEY = 'k'.repeat(48);
  });
  afterAll(() => {
    if (originalKey === undefined) delete process.env.PASSWORD_RESET_DELIVERY_KEY;
    else process.env.PASSWORD_RESET_DELIVERY_KEY = originalKey;
  });

  describe('authorization', () => {
    it.each([admin, supportManager])('permits %o', async (actor) => {
      const { service } = makeService();
      await expect(service.resetUserPassword('usr-1', actor as RequestUser)).resolves.toBeDefined();
    });

    it('refuses a non-support role before doing anything', async () => {
      const { service, requested } = makeService();
      await expect(service.resetUserPassword('usr-1', farmer)).rejects.toBeInstanceOf(ForbiddenException);
      expect(requested).toHaveLength(0);
    });
  });

  describe('fresh MFA for an administrative action on someone else\'s account', () => {
    it('refuses when MFA was never verified in this session', async () => {
      const { service, requested } = makeService();
      const stale = { id: 'adm-1', role: Role.ADMIN } as RequestUser;
      await expect(service.resetUserPassword('usr-1', stale))
        .rejects.toMatchObject({ response: { code: 'RECENT_ADMIN_MFA_REQUIRED' } });
      expect(requested).toHaveLength(0);
    });

    it('refuses when the MFA verification has aged out', async () => {
      const { service, requested } = makeService();
      const old = {
        id: 'adm-1',
        role: Role.ADMIN,
        mfaVerified: true,
        mfaVerifiedAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
      } as RequestUser;
      await expect(service.resetUserPassword('usr-1', old))
        .rejects.toMatchObject({ response: { code: 'RECENT_ADMIN_MFA_REQUIRED' } });
      expect(requested).toHaveLength(0);
    });

    it('does not leak the settlement-flavoured code to this caller', async () => {
      const { service } = makeService();
      const stale = { id: 'adm-1', role: Role.ADMIN } as RequestUser;
      await expect(service.resetUserPassword('usr-1', stale))
        .rejects.not.toMatchObject({ response: { code: 'RECENT_FINANCIAL_MFA_REQUIRED' } });
    });
  });

  describe('the administrator learns nothing usable', () => {
    it('returns no token, no password and no secret of any kind', async () => {
      const { service } = makeService();
      const result: any = await service.resetUserPassword('usr-1', admin);
      expect(result).toEqual({ accepted: true, message: expect.any(String) });
      // The old shape must be gone, not merely renamed.
      expect(result.resetToken).toBeUndefined();
      expect(Object.keys(result)).toEqual(['accepted', 'message']);
      expect(JSON.stringify(result)).not.toMatch(/RESET-/i);
      expect(JSON.stringify(result)).not.toContain('ivan@example.com');
    });

    it('never produces a time-derived token again', async () => {
      const { service } = makeService();
      const first: any = await service.resetUserPassword('usr-1', admin);
      const second: any = await service.resetUserPassword('usr-1', admin);
      // Identical responses: nothing in them varies with the clock, because
      // nothing in them is a token.
      expect(first).toEqual(second);
      expect(JSON.stringify(first)).not.toMatch(/RESET/i);
    });

    it('delegates issuance to the real authority instead of minting its own', async () => {
      const { service, requested, passwordReset } = makeService();
      await service.resetUserPassword('usr-1', admin);
      expect(passwordReset.request).toHaveBeenCalledTimes(1);
      expect(requested[0][0]).toBe('ivan@example.com');
      // The delivery key comes from the process, not from the caller.
      expect(requested[0][2]).toBe('k'.repeat(48));
    });
  });

  describe('enumeration safety', () => {
    it('answers identically whether or not the account exists', async () => {
      const present = await makeService({ email: 'ivan@example.com' }).service
        .resetUserPassword('usr-1', admin);
      const absent = await makeService({ email: null }).service
        .resetUserPassword('usr-404', admin);
      expect(present).toEqual(absent);
    });

    it('does not call the reset authority for an account that does not exist', async () => {
      const { service, requested } = makeService({ email: null });
      await service.resetUserPassword('usr-404', admin);
      expect(requested).toHaveLength(0);
    });

    it('answers identically when the lookup itself fails', async () => {
      const broken = await makeService({ lookupThrows: true }).service
        .resetUserPassword('usr-1', admin);
      const present = await makeService().service.resetUserPassword('usr-1', admin);
      expect(broken).toEqual(present);
    });
  });

  describe('fail-closed when the machinery is absent', () => {
    it('refuses rather than pretending, with no database', async () => {
      const { service } = makeService({ withPrisma: false });
      await expect(service.resetUserPassword('usr-1', admin))
        .rejects.toBeInstanceOf(ServiceUnavailableException);
    });

    it('refuses rather than pretending, with no reset authority', async () => {
      const { service } = makeService({ withReset: false });
      await expect(service.resetUserPassword('usr-1', admin))
        .rejects.toBeInstanceOf(ServiceUnavailableException);
    });

    it('records the refusal, so an unavailable control is visible', async () => {
      const { service, audited } = makeService({ withReset: false });
      await expect(service.resetUserPassword('usr-1', admin)).rejects.toBeTruthy();
      expect(audited.map((entry) => entry.action)).toContain('support:user:password_reset:unavailable');
    });
  });

  describe('audit', () => {
    it('records the administrative initiation without the address or any secret', async () => {
      const { service, audited } = makeService();
      await service.resetUserPassword('usr-1', admin);
      const entry = audited.find((item) => item.action === 'support:user:password_reset');
      expect(entry).toBeDefined();
      expect(entry!.objectId).toBe('usr-1');
      const serialized = JSON.stringify(entry!.payload);
      expect(serialized).not.toContain('ivan@example.com');
      expect(serialized).not.toMatch(/RESET-/i);
    });
  });
});
