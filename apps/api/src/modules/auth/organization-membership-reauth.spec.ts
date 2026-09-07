import { ForbiddenException } from '@nestjs/common';

import { OrganizationInvitationService } from './organization-invitation.service';

/**
 * ASVS V7.5.1 на трёх командах членства в организации.
 *
 * Проверяется поведение, а не наличие строки: у сервиса вызываются настоящие
 * методы с несвежим фактором, и каждый обязан отказать РАНЬШЕ, чем дойдёт до
 * разрешения администратора или базы. Если бы отказ стоял позже, перехваченная
 * сессия администратора уже успела бы что-то изменить.
 */
describe('organization membership commands require a fresh factor', () => {
  const service = Object.create(OrganizationInvitationService.prototype) as OrganizationInvitationService;

  // Anything the commands would touch after the gate must never be reached.
  const unreachable = () => { throw new Error('reached past the fresh-factor gate'); };
  Object.assign(service, {
    requireAdmin: unreachable,
    prisma: { $transaction: unreachable },
    requireIdempotencyKey: unreachable,
  });

  const stale = {
    id: 'u1',
    mfaVerified: true,
    mfaVerifiedAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
  } as never;
  const absent = { id: 'u1' } as never;

  const commands: Array<[string, (user: never) => Promise<unknown>]> = [
    ['changeMembershipRole', (user) => service.changeMembershipRole(user, 'm1', 'MEMBER' as never, 1n, 'r', 'k', 'c')],
    ['revokeMembership', (user) => service.revokeMembership(user, 'm1', 1n, 'r', 'k', 'c')],
    ['resetMembershipMfa', (user) => service.resetMembershipMfa(user, 'm1', 1n, 'r', 'k', 'c')],
  ];

  for (const [name, invoke] of commands) {
    it(`${name} refuses a factor confirmed an hour ago`, async () => {
      await expect(invoke(stale)).rejects.toBeInstanceOf(ForbiddenException);
      await expect(invoke(stale)).rejects.toMatchObject({
        response: { code: 'FRESH_MFA_REQUIRED' },
      });
    });

    it(`${name} refuses a caller with no confirmed factor at all`, async () => {
      await expect(invoke(absent)).rejects.toBeInstanceOf(ForbiddenException);
    });
  }

  it('refuses before resolving the administrator, not after', async () => {
    // The stubs above throw a plain Error if reached. A ForbiddenException means
    // the gate ran first; a plain Error would mean the command had already begun.
    for (const [, invoke] of commands) {
      await expect(invoke(stale)).rejects.toBeInstanceOf(ForbiddenException);
    }
  });
});
