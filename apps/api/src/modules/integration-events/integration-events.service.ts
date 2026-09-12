import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import {
  safeIntegrationErrorCode,
  summarizeIntegrationPayload,
  toSafeIntegrationEventView,
} from './integration-event-redaction.policy';

export interface LogIntegrationEventParams {
  adapterName: string;
  direction: 'INBOUND' | 'OUTBOUND';
  eventType: string;
  externalId?: string;
  dealId?: string;
  requestPayload?: unknown;
  responsePayload?: unknown;
  status: 'SUCCESS' | 'ERROR' | 'PENDING' | 'TIMEOUT';
  errorMessage?: string;
  httpStatus?: number;
  durationMs?: number;
  idempotencyKey?: string;
}

@Injectable()
export class IntegrationEventsService {
  private readonly logger = new Logger(IntegrationEventsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async log(params: LogIntegrationEventParams): Promise<void> {
    await this.prisma.integrationEvent.create({
      data: {
        adapterName: params.adapterName,
        direction: params.direction,
        eventType: params.eventType,
        externalId: params.externalId,
        dealId: params.dealId,
        // Never persist the original request/response. Even when a caller hands
        // us a token/password by mistake, only structural metadata survives.
        requestPayload: summarizeIntegrationPayload(params.requestPayload),
        responsePayload: summarizeIntegrationPayload(params.responsePayload),
        status: params.status,
        // Exception text often contains URLs, headers or upstream bodies. Keep
        // only an explicitly machine-safe code, otherwise collapse it.
        errorMessage: safeIntegrationErrorCode(params.errorMessage),
        httpStatus: params.httpStatus,
        durationMs: params.durationMs,
        idempotencyKey: params.idempotencyKey,
      },
    }).catch(() => {
      // Do not echo the database exception into application logs: it can contain
      // values from the rejected row. Integration telemetry is not business
      // authority, so the external operation is not failed by telemetry outage.
      this.logger.debug('Integration event log write failed');
    });
  }

  async withLogging<T>(
    params: Omit<LogIntegrationEventParams, 'status' | 'durationMs' | 'responsePayload' | 'errorMessage'>,
    fn: () => Promise<T>,
  ): Promise<T> {
    const start = Date.now();
    try {
      const result = await fn();
      await this.log({
        ...params,
        status: 'SUCCESS',
        responsePayload: result,
        durationMs: Date.now() - start,
      });
      return result;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      await this.log({
        ...params,
        status: 'ERROR',
        errorMessage: message,
        durationMs: Date.now() - start,
      });
      throw err;
    }
  }

  async listByAdapter(adapterName: string, limit = 50) {
    const take = boundedTake(limit, 50);
    const rows = await this.prisma.integrationEvent.findMany({
      where: { adapterName },
      orderBy: { createdAt: 'desc' },
      take,
    }).catch(() => []);
    return rows.map(toSafeIntegrationEventView);
  }

  async listFailed(limit = 100) {
    const take = boundedTake(limit, 100);
    const rows = await this.prisma.integrationEvent.findMany({
      where: { status: { in: ['ERROR', 'TIMEOUT'] } },
      orderBy: { createdAt: 'desc' },
      take,
    }).catch(() => []);
    return rows.map(toSafeIntegrationEventView);
  }

  async getStats() {
    const events = await this.prisma.integrationEvent.findMany({
      where: { createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
    }).catch(() => []);

    const stats: Record<string, { total: number; ok: number; error: number; avgMs: number }> = {};
    for (const e of events) {
      if (!stats[e.adapterName]) stats[e.adapterName] = { total: 0, ok: 0, error: 0, avgMs: 0 };
      stats[e.adapterName].total++;
      if (e.status === 'SUCCESS') stats[e.adapterName].ok++;
      else stats[e.adapterName].error++;
      stats[e.adapterName].avgMs += e.durationMs ?? 0;
    }
    for (const name of Object.keys(stats)) {
      if (stats[name].total > 0) stats[name].avgMs = Math.round(stats[name].avgMs / stats[name].total);
    }
    return stats;
  }
}

function boundedTake(value: number, fallback: number): number {
  if (!Number.isSafeInteger(value) || value < 1) return fallback;
  return Math.min(value, 500);
}
