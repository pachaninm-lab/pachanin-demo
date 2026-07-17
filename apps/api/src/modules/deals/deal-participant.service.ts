import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { RequestUser, Role } from '../../common/types/request-user';

/**
 * Назначение участника сделки (PHASE2_EXECUTION.md, CANONICAL_SCENARIO.md §3).
 *
 * Мост «аукцион → сделка» назначает только продавца и покупателя; исполнение
 * требует явно назначенных организаций на роли логистики, приёмки, качества и
 * расчёта. Назначение — привилегированное решение оператора с обязательным
 * основанием и журналом. Реализация назначает участников любых
 * допущенных организаций, в т.ч. из других tenant'ов (решение A).
 */
const ASSIGNABLE_ROLES: ReadonlySet<string> = new Set<string>([
  Role.FARMER,
  Role.BUYER,
  Role.LOGISTICIAN,
  Role.DRIVER,
  Role.SURVEYOR,
  Role.LAB,
  Role.ELEVATOR,
  Role.ACCOUNTING,
  Role.COMPLIANCE_OFFICER,
]);
const ACCESS_LEVELS: ReadonlySet<string> = new Set(['READ', 'WORK', 'APPROVE']);
const ACTIVE_ORG_STATUSES = new Set(['VERIFIED', 'ACTIVE']);

export type AssignParticipantInput = Readonly<{
  organizationId: string;
  userId: string;
  role: string;
  accessLevel?: string;
  reason: string;
}>;

@Injectable()
export class DealParticipantService {
  private readonly logger = new Logger(DealParticipantService.name);

  constructor(private readonly prisma: PrismaService) {}

  async assign(dealId: string, input: AssignParticipantInput, actor: RequestUser) {
    const role = String(input.role ?? '').toUpperCase();
    if (!ASSIGNABLE_ROLES.has(role)) {
      throw new ConflictException(
        `Роль ${role} не назначается участником сделки. Допустимо: ${[...ASSIGNABLE_ROLES].join(', ')}.`,
      );
    }
    const accessLevel = String(input.accessLevel ?? 'WORK').toUpperCase();
    if (!ACCESS_LEVELS.has(accessLevel)) {
      throw new ConflictException(`Недопустимый уровень доступа: ${accessLevel}.`);
    }
    const reason = String(input.reason ?? '').trim();
    if (reason.length < 10) {
      throw new ConflictException('Укажите основание назначения (не короче 10 символов) — оно попадает в журнал.');
    }

    const deal = await this.prisma.deal.findUnique({
      where: { id: dealId },
      select: { id: true, tenantId: true },
    });
    if (!deal) throw new NotFoundException(`Сделка ${dealId} не найдена.`);

    const organization = await this.prisma.organization.findUnique({
      where: { id: input.organizationId },
      select: { id: true, tenantId: true, status: true, kycStatus: true },
    });
    if (!organization) throw new NotFoundException(`Организация ${input.organizationId} не найдена.`);
    // Кросс-tenant участие (решение A): организация участника может быть в
    // собственном tenant'е. Требуем лишь допуск (VERIFIED + KYC). Строка
    // участника хранится в tenant'е сделки — это внутренняя целостность.
    if (!ACTIVE_ORG_STATUSES.has(organization.status) || organization.kycStatus !== 'APPROVED') {
      throw new ConflictException('Организация не допущена (нужны VERIFIED и KYC APPROVED).');
    }

    const membership = await this.prisma.userOrg.findUnique({
      where: { userId_organizationId: { userId: input.userId, organizationId: input.organizationId } },
      include: { user: { select: { status: true, deletedAt: true } } },
    });
    if (!membership || membership.role !== role) {
      throw new ConflictException(`Пользователь ${input.userId} не состоит в организации с ролью ${role}.`);
    }
    if (membership.user.status !== 'ACTIVE' || membership.user.deletedAt) {
      throw new ConflictException('Пользователь неактивен.');
    }

    const participantId = `participant:${dealId}:${role.toLowerCase()}:${input.organizationId}`;
    const participant = await this.prisma.dealParticipant.upsert({
      where: { id: participantId },
      update: { userId: input.userId, accessLevel, status: 'ACTIVE', revokedAt: null },
      create: {
        id: participantId,
        dealId,
        tenantId: deal.tenantId,
        organizationId: input.organizationId,
        userId: input.userId,
        role,
        accessLevel,
        status: 'ACTIVE',
        assignedByUserId: actor.id,
      },
    });

    await this.prisma.auditEvent.create({
      data: {
        action: 'DEAL_PARTICIPANT_ASSIGNED',
        actorUserId: actor.id,
        actorRole: String(actor.role),
        tenantId: deal.tenantId,
        dealId,
        orgId: input.organizationId,
        objectType: 'deal_participant',
        objectId: participantId,
        afterState: { role, accessLevel, userId: input.userId },
        outcome: 'ASSIGNED',
        reason,
      },
    }).catch((e) => this.logger.error(`Audit write failed for participant assign ${participantId}: ${e.message}`));

    return {
      participantId: participant.id,
      dealId,
      role,
      organizationId: input.organizationId,
      userId: input.userId,
      accessLevel,
      status: participant.status,
    };
  }
}
