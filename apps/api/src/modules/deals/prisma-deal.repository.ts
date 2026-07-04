import { ConflictException, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { createHash } from 'node:crypto';
import type { RequestUser } from '../../common/types/request-user';
import type { DealRepository } from './deal.repository';
import { PrismaService } from '../../common/prisma/prisma.service';
import { RuntimeStateMachine } from '../runtime-core/runtime-state-machine';

/**
 * DB-backed deal repository skeleton (pre-integration, disabled by default).
 *
 * Selected only under the explicit PLATFORM_V7_DEAL_REPOSITORY=prisma flag.
 * Only read snapshots (list/get) are implemented; workspace/passport/timeline
 * and all writes are NOT supported yet and fail loudly rather than silently
 * falling back to the runtime store. There is no silent Prisma activation.
 */
@Injectable()
export class PrismaDealRepository implements DealRepository {
  constructor(@Optional() private readonly prisma?: PrismaService) {
    if (!this.prisma) {
      throw new Error(
        'PrismaDealRepository requires PrismaService, but it is not available. ' +
          'DB-backed deal path is not active.',
      );
    }
  }

  private get db(): PrismaService {
    if (!this.prisma) {
      throw new Error('PrismaDealRepository: PrismaService unavailable — DB-backed deal path not active.');
    }
    return this.prisma;
  }

  async list(): Promise<unknown[]> {
    return this.db.deal.findMany({ orderBy: { createdAt: 'desc' } });
  }

  async getById(id: string): Promise<any> {
    const row = await this.db.deal.findUnique({ where: { id } });
    if (!row) {
      throw new Error(`Deal ${id} not found in DB-backed deal repository.`);
    }
    return row;
  }

  workspace(): any {
    throw new Error('PrismaDealRepository.workspace is not supported — DB-backed deal workspace path is not active.');
  }

  passport(): any {
    throw new Error('PrismaDealRepository.passport is not supported — DB-backed deal passport path is not active.');
  }

  timeline(): any {
    throw new Error('PrismaDealRepository.timeline is not supported — DB-backed deal timeline path is not active.');
  }

  create(): any {
    throw new Error('PrismaDealRepository.create is not supported — DB-backed deal write path is not active.');
  }

  /**
   * Переход статуса сделки с защитой от гонки.
   *
   * Легальность перехода проверяет единая state machine (DEAL_TRANSITIONS).
   * Запись выполняется в транзакции оптимистической блокировкой:
   * `updateMany WHERE id AND status AND version` + инкремент version.
   * Ноль затронутых строк = конкурентный переход уже случился (второй
   * оператор, повтор офлайн-синка водителя) — транзакция откатывается
   * с 409, а не молча перетирает статус. Событие пишется в hash-цепочку
   * deal_events той же транзакцией.
   */
  async transition(id: string, nextState: string, user: RequestUser, comment?: string): Promise<any> {
    const stateMachine = new RuntimeStateMachine();

    return this.db.$transaction(async (tx) => {
      const deal = await tx.deal.findUnique({ where: { id }, select: { id: true, status: true, version: true, tenantId: true } });
      if (!deal) throw new NotFoundException(`Deal ${id} not found`);

      stateMachine.assertDealTransition(deal.status, nextState);

      const updated = await tx.deal.updateMany({
        where: { id, status: deal.status, version: deal.version },
        data: { status: nextState, version: { increment: 1 } },
      });
      if (updated.count === 0) {
        throw new ConflictException(
          `Deal ${id} was modified concurrently (expected status=${deal.status}, version=${deal.version}) — retry with fresh state`,
        );
      }

      const prevEvent = await tx.dealEvent.findFirst({
        where: { dealId: id },
        orderBy: { createdAt: 'desc' },
        select: { hash: true },
      });
      const prevHash = prevEvent?.hash ?? null;
      const payload = {
        from: deal.status,
        to: nextState,
        version: deal.version + 1,
        comment: comment ?? null,
      };
      const eventId = `${id}-ev-${deal.version + 1}`;
      const hash = createHash('sha256')
        .update([eventId, id, 'DEAL_STATUS_CHANGED', JSON.stringify(payload), prevHash ?? ''].join('|'))
        .digest('hex');

      await tx.dealEvent.create({
        data: {
          id: eventId,
          dealId: id,
          eventType: 'DEAL_STATUS_CHANGED',
          actorId: user?.id ?? 'system',
          actorRole: user?.role ?? 'SYSTEM',
          tenantId: deal.tenantId,
          payload,
          hash,
          prevHash,
        },
      });

      return tx.deal.findUnique({ where: { id } });
    });
  }
}
