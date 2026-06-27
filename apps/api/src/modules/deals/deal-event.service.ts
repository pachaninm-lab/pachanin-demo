import { Injectable, Logger } from '@nestjs/common';
import { createHash } from 'crypto';
import { PrismaService } from '../../common/prisma/prisma.service';

export type DealEventType =
  | 'CREATED' | 'PUBLISHED' | 'OFFER_SENT' | 'OFFER_ACCEPTED' | 'COUNTER_OFFER'
  | 'CONTRACT_GENERATED' | 'CONTRACT_SIGNED' | 'PAYMENT_RESERVED' | 'LOGISTICS_ASSIGNED'
  | 'SHIPMENT_STARTED' | 'CHECKPOINT_REACHED' | 'DELIVERED'
  | 'LAB_SAMPLE_TAKEN' | 'LAB_RESULT_RECEIVED' | 'QUALITY_ACCEPTED' | 'QUALITY_DISPUTED'
  | 'DOCUMENT_SIGNED' | 'EDO_SENT' | 'EDO_SIGNED'
  | 'PAYMENT_RELEASED' | 'COMMISSION_CHARGED' | 'DISPUTE_OPENED' | 'DISPUTE_RESOLVED'
  | 'CANCELLED' | 'CLOSED';

@Injectable()
export class DealEventService {
  private readonly logger = new Logger(DealEventService.name);
  private readonly lastHashByDeal = new Map<string, string>();

  constructor(private readonly prisma: PrismaService) {}

  private computeHash(id: string, dealId: string, eventType: string, payload: string, prevHash: string): string {
    return createHash('sha256').update(JSON.stringify({ id, dealId, eventType, payload, prevHash })).digest('hex');
  }

  async emit(params: {
    dealId: string;
    eventType: DealEventType;
    actorId: string;
    actorRole: string;
    tenantId?: string;
    payload?: Record<string, unknown>;
  }): Promise<{ id: string; hash: string }> {
    const id = `de-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const payloadStr = JSON.stringify(params.payload ?? {});
    const prevHash = await this.getLastHash(params.dealId);
    const hash = this.computeHash(id, params.dealId, params.eventType, payloadStr, prevHash);
    this.lastHashByDeal.set(params.dealId, hash);

    await this.prisma.dealEvent.create({
      data: {
        id,
        dealId: params.dealId,
        eventType: params.eventType,
        actorId: params.actorId,
        actorRole: params.actorRole,
        tenantId: params.tenantId,
        payload: payloadStr,
        hash,
        prevHash: prevHash || null,
      },
    }).catch((err) => this.logger.debug(`DealEvent DB: ${err.message}`));

    return { id, hash };
  }

  private async getLastHash(dealId: string): Promise<string> {
    if (this.lastHashByDeal.has(dealId)) return this.lastHashByDeal.get(dealId)!;
    const last = await this.prisma.dealEvent.findFirst({
      where: { dealId },
      orderBy: { createdAt: 'desc' },
    }).catch(() => null);
    const hash = last?.hash ?? '';
    this.lastHashByDeal.set(dealId, hash);
    return hash;
  }

  async getDealTimeline(dealId: string) {
    return this.prisma.dealEvent.findMany({
      where: { dealId },
      orderBy: { createdAt: 'asc' },
    }).catch(() => []);
  }

  async verifyDealChain(dealId: string): Promise<{ valid: boolean; brokenAt?: string; eventCount: number }> {
    const events = await this.prisma.dealEvent.findMany({
      where: { dealId },
      orderBy: { createdAt: 'asc' },
    }).catch(() => []);

    let prevHash = '';
    for (let i = 0; i < events.length; i++) {
      const e = events[i];
      const expected = this.computeHash(e.id, e.dealId, e.eventType, e.payload, prevHash);
      if (e.hash !== expected) return { valid: false, brokenAt: e.id, eventCount: events.length };
      prevHash = e.hash;
    }
    return { valid: true, eventCount: events.length };
  }
}
