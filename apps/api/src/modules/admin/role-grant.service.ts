import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  OnApplicationBootstrap,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { RequestUser, Role } from '../../common/types/request-user';

/**
 * Выдача операторских ролей (PHASE1_BACKLOG №3, конституция §0.1).
 *
 * Роль — это membership в user_orgs; её смена журналируется, а действующие
 * сессии пользователя отзываются триггером БД (auth_revoke_on_membership_change),
 * так что новая роль действует только после повторного входа.
 */
const GRANTABLE_ROLES: ReadonlySet<string> = new Set([
  Role.SUPPORT_MANAGER,
  Role.COMPLIANCE_OFFICER,
  Role.EXECUTIVE,
  Role.ADMIN,
]);

@Injectable()
export class RoleGrantService implements OnApplicationBootstrap {
  private readonly logger = new Logger(RoleGrantService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Бутстрап первого администратора: PC_BOOTSTRAP_ADMIN_EMAIL действует только
   * пока в системе нет ни одного ADMIN. Дальше все выдачи — через API с аудитом.
   */
  async onApplicationBootstrap(): Promise<void> {
    const email = String(process.env.PC_BOOTSTRAP_ADMIN_EMAIL ?? '').trim().toLowerCase();
    if (!email) return;
    try {
      const adminCount = await this.prisma.userOrg.count({ where: { role: Role.ADMIN } });
      if (adminCount > 0) {
        this.logger.log(`Bootstrap admin skipped: ADMIN memberships already exist (${adminCount}).`);
        return;
      }
      const user = await this.prisma.user.findUnique({ where: { email }, include: { orgs: true } });
      const membership = user?.orgs?.[0];
      if (!user || !membership) {
        this.logger.warn(`Bootstrap admin skipped: user ${email} or membership not found.`);
        return;
      }
      await this.applyGrant(membership.id, Role.ADMIN, 'Бутстрап первого администратора платформы (PC_BOOTSTRAP_ADMIN_EMAIL).', {
        id: 'system-bootstrap',
        role: 'SYSTEM',
      });
      this.logger.log(`Bootstrap admin granted to ${email}; existing sessions revoked, re-login required.`);
    } catch (error) {
      this.logger.error(`Bootstrap admin failed: ${(error as Error).message}`);
    }
  }

  async grantRole(userId: string, role: string, reason: string, actor: RequestUser) {
    if (!GRANTABLE_ROLES.has(role)) {
      throw new ConflictException(
        `Роль ${role} не выдаётся этим путём. Допустимо: ${[...GRANTABLE_ROLES].join(', ')}.`,
      );
    }
    const normalizedReason = String(reason ?? '').trim();
    if (normalizedReason.length < 10) {
      throw new ConflictException('Укажите основание выдачи роли (не короче 10 символов) — оно попадает в журнал.');
    }
    const membership = await this.prisma.userOrg.findFirst({ where: { userId } });
    if (!membership) {
      throw new NotFoundException(`Пользователь ${userId} не найден или не состоит в организации.`);
    }
    return this.applyGrant(membership.id, role, normalizedReason, { id: actor.id, role: String(actor.role) });
  }

  private async applyGrant(
    membershipId: string,
    role: string,
    reason: string,
    actor: { id: string; role: string },
  ) {
    const before = await this.prisma.userOrg.findUnique({ where: { id: membershipId } });
    if (!before) throw new NotFoundException(`Membership ${membershipId} не найден.`);

    const updated = await this.prisma.userOrg.update({
      where: { id: membershipId },
      data: { role },
    });

    await this.prisma.auditEvent.create({
      data: {
        action: 'ROLE_GRANT_DECISION',
        actorUserId: actor.id,
        actorRole: actor.role,
        orgId: before.organizationId,
        objectType: 'membership',
        objectId: membershipId,
        beforeState: { role: before.role },
        afterState: { role: updated.role },
        outcome: role,
        reason,
      },
    }).catch((e) => this.logger.error(`Audit write failed for role grant ${membershipId}: ${e.message}`));

    return {
      userId: updated.userId,
      organizationId: updated.organizationId,
      role: updated.role,
      sessionsRevoked: true,
      note: 'Действующие сессии пользователя отозваны — новая роль применится после повторного входа.',
    };
  }
}
