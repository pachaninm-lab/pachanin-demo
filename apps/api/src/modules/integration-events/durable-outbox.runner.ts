import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { hostname } from 'os';
import { randomUUID } from 'crypto';
import { KafkaProducerService } from '../../common/kafka/kafka-producer.service';
import { DurableOutboxWorker } from './durable-outbox.worker';

const DEFAULT_INTERVAL_MS = 1_000;
const DEFAULT_BATCH_SIZE = 50;

/**
 * Explicit worker-topology runner. Importing the API module does not start an
 * outbox relay. Processing starts only when OUTBOX_WORKER_ENABLED=true.
 */
@Injectable()
export class DurableOutboxRunner implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DurableOutboxRunner.name);
  private readonly enabled = process.env.OUTBOX_WORKER_ENABLED === 'true';
  private readonly workerId = process.env.OUTBOX_WORKER_ID?.trim()
    || `outbox-worker:${hostname()}:${process.pid}:${randomUUID()}`;
  private readonly intervalMs = integerEnv(
    process.env.OUTBOX_WORKER_INTERVAL_MS,
    100,
    60_000,
    DEFAULT_INTERVAL_MS,
  );
  private readonly batchSize = integerEnv(
    process.env.OUTBOX_WORKER_BATCH_SIZE,
    1,
    500,
    DEFAULT_BATCH_SIZE,
  );
  private timer?: ReturnType<typeof setInterval>;
  private draining = false;

  constructor(
    private readonly worker: DurableOutboxWorker,
    private readonly kafka: KafkaProducerService,
  ) {}

  onModuleInit(): void {
    if (!this.enabled) {
      this.logger.log('Durable outbox runner disabled; API topology will not claim queue work');
      return;
    }

    this.worker.registerDefaultHandler(async (entry) => {
      const delivered = await this.kafka.send({
        topic: topicFor(entry.type),
        key: entry.idempotencyKey ?? entry.id,
        value: payloadRecord(entry.payload),
        headers: {
          'x-outbox-entry-id': entry.id,
          'x-outbox-lease-token': entry.leaseToken,
          ...(entry.correlationId ? { 'x-correlation-id': entry.correlationId } : {}),
        },
      });
      if (!delivered) {
        throw new Error('OUTBOX_TRANSPORT_UNAVAILABLE: Kafka send was not confirmed');
      }
    });

    this.timer = setInterval(() => {
      void this.tick();
    }, this.intervalMs);
    this.timer.unref?.();
    void this.tick();
    this.logger.log(`Durable outbox runner started: worker=${this.workerId}`);
  }

  async onModuleDestroy(): Promise<void> {
    if (this.timer) clearInterval(this.timer);
    this.worker.clearDefaultHandler();
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  private async tick(): Promise<void> {
    if (!this.enabled || this.draining) return;
    this.draining = true;
    try {
      const report = await this.worker.drainOnce(this.workerId, this.batchSize);
      if (
        report.claimed > 0
        || report.delivered > 0
        || report.retried > 0
        || report.deadLettered > 0
        || report.leaseLost > 0
      ) {
        this.logger.log(JSON.stringify({ event: 'outbox.drain', ...report }));
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Durable outbox drain failed closed: ${message}`);
    } finally {
      this.draining = false;
    }
  }
}

function topicFor(type: string): string {
  return type.startsWith('BANK_') || type.startsWith('bank.')
    ? 'grainflow.bank.events'
    : 'grainflow.domain.events';
}

function payloadRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return { value };
}

function integerEnv(value: string | undefined, min: number, max: number, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) return fallback;
  return parsed;
}
