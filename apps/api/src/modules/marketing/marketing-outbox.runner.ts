import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { hostname } from 'node:os';
import type { OutboxDrainReport } from '../integration-events/durable-outbox.worker';
import { MARKETING_SOCIAL_PUBLISH_EVENT_TYPE } from './marketing-outbox.contract';
import { MarketingOutboxDispatchHandler } from './marketing-outbox-dispatch.handler';
import { MarketingDurableOutboxWorker } from './marketing-durable-outbox.worker';

const DEFAULT_INTERVAL_MS = 1_000;
const DEFAULT_BATCH_SIZE = 10;

function positiveInteger(value: string | undefined, fallback: number, maximum: number): number {
  if (!value) return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > maximum) return fallback;
  return parsed;
}

export interface MarketingOutboxRunnerHealth {
  enabled: boolean;
  outboundEnabled: boolean;
  started: boolean;
  stopped: boolean;
  draining: boolean;
  workerId: string;
  intervalMs: number;
  batchSize: number;
  lastDrainStartedAt: string | null;
  lastDrainCompletedAt: string | null;
  lastError: string | null;
  lastReport: OutboxDrainReport | null;
}

@Injectable()
export class MarketingOutboxRunner implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MarketingOutboxRunner.name);
  private readonly enabled = process.env.MARKETING_OUTBOX_WORKER_ENABLED === 'true';
  private readonly workerId = process.env.MARKETING_OUTBOX_WORKER_ID
    ?? `marketing-social-${hostname()}-${process.pid}`;
  private readonly intervalMs = positiveInteger(
    process.env.MARKETING_OUTBOX_WORKER_INTERVAL_MS,
    DEFAULT_INTERVAL_MS,
    60_000,
  );
  private readonly batchSize = positiveInteger(
    process.env.MARKETING_OUTBOX_WORKER_BATCH_SIZE,
    DEFAULT_BATCH_SIZE,
    100,
  );
  private timer?: ReturnType<typeof setInterval>;
  private running?: Promise<void>;
  private started = false;
  private stopped = false;
  private lastDrainStartedAt: Date | null = null;
  private lastDrainCompletedAt: Date | null = null;
  private lastError: string | null = null;
  private lastReport: OutboxDrainReport | null = null;

  constructor(
    private readonly worker: MarketingDurableOutboxWorker,
    private readonly handler: MarketingOutboxDispatchHandler,
  ) {}

  onModuleInit(): void {
    if (!this.enabled) {
      this.logger.log(
        'Marketing outbox runner disabled; set MARKETING_OUTBOX_WORKER_ENABLED=true only in the dedicated worker topology',
      );
      return;
    }

    this.worker.registerHandler(
      MARKETING_SOCIAL_PUBLISH_EVENT_TYPE,
      (entry) => this.handler.dispatch(entry),
    );
    this.timer = setInterval(() => this.scheduleDrain(), this.intervalMs);
    this.timer.unref?.();
    this.started = true;
    this.scheduleDrain();
    this.logger.log(`Marketing outbox runner started workerId=${this.workerId} batchSize=${this.batchSize}`);
  }

  async onModuleDestroy(): Promise<void> {
    this.stopped = true;
    if (this.timer) clearInterval(this.timer);
    await this.running;
    this.logger.log(`Marketing outbox runner stopped workerId=${this.workerId}`);
  }

  health(): MarketingOutboxRunnerHealth {
    return {
      enabled: this.enabled,
      outboundEnabled: this.outboundEnabled(),
      started: this.started,
      stopped: this.stopped,
      draining: Boolean(this.running),
      workerId: this.workerId,
      intervalMs: this.intervalMs,
      batchSize: this.batchSize,
      lastDrainStartedAt: this.lastDrainStartedAt?.toISOString() ?? null,
      lastDrainCompletedAt: this.lastDrainCompletedAt?.toISOString() ?? null,
      lastError: this.lastError,
      lastReport: this.lastReport,
    };
  }

  private outboundEnabled(): boolean {
    return process.env.MARKETING_OUTBOUND_ENABLED === 'true';
  }

  private scheduleDrain(): void {
    if (this.stopped || this.running) return;

    // Kill switch pauses claims rather than converting a deliberate shutdown
    // into retries/dead letters. Queued work remains durable and untouched.
    if (!this.outboundEnabled()) {
      this.lastError = null;
      return;
    }

    this.lastDrainStartedAt = new Date();
    this.running = this.worker
      .drainOnce(this.workerId, this.batchSize)
      .then((report) => {
        this.lastReport = report;
        this.lastError = null;
        if (report.claimed > 0) {
          this.logger.log(
            `Marketing drain claimed=${report.claimed} delivered=${report.delivered} retried=${report.retried} dead=${report.deadLettered} leaseLost=${report.leaseLost}`,
          );
        }
      })
      .catch((error) => {
        this.lastError = error instanceof Error ? error.message : String(error);
        this.logger.error(`Marketing outbox drain failed: ${this.lastError}`);
      })
      .finally(() => {
        this.lastDrainCompletedAt = new Date();
        this.running = undefined;
      });
  }
}
