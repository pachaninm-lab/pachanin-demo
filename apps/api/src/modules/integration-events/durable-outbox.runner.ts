import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { hostname } from 'node:os';
import { KafkaProducerService } from '../../common/kafka/kafka-producer.service';
import { ClaimedOutboxEntry, DurableOutboxWorker, OutboxLeaseLostError } from './durable-outbox.worker';

const DEFAULT_INTERVAL_MS = 1_000;
const DEFAULT_BATCH_SIZE = 25;
const DEFAULT_HEARTBEAT_MS = 20_000;

function positiveInteger(value: string | undefined, fallback: number, maximum: number): number {
  if (!value) return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > maximum) return fallback;
  return parsed;
}

@Injectable()
export class DurableOutboxRunner implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DurableOutboxRunner.name);
  private readonly enabled = process.env.OUTBOX_WORKER_ENABLED === 'true';
  private readonly workerId = process.env.OUTBOX_WORKER_ID ?? `${hostname()}-${process.pid}`;
  private readonly intervalMs = positiveInteger(process.env.OUTBOX_WORKER_INTERVAL_MS, DEFAULT_INTERVAL_MS, 60_000);
  private readonly batchSize = positiveInteger(process.env.OUTBOX_WORKER_BATCH_SIZE, DEFAULT_BATCH_SIZE, 500);
  private readonly heartbeatMs = positiveInteger(process.env.OUTBOX_WORKER_HEARTBEAT_MS, DEFAULT_HEARTBEAT_MS, 60_000);
  private timer?: ReturnType<typeof setInterval>;
  private running?: Promise<void>;
  private stopped = false;

  constructor(
    private readonly worker: DurableOutboxWorker,
    private readonly kafka: KafkaProducerService,
  ) {}

  onModuleInit(): void {
    if (!this.enabled) {
      this.logger.log('Durable outbox runner disabled; set OUTBOX_WORKER_ENABLED=true only in the worker topology');
      return;
    }

    this.worker.registerFallbackHandler((entry) => this.deliver(entry));
    this.timer = setInterval(() => this.scheduleDrain(), this.intervalMs);
    this.timer.unref?.();
    this.scheduleDrain();
    this.logger.log(`Durable outbox runner started workerId=${this.workerId} batchSize=${this.batchSize}`);
  }

  async onModuleDestroy(): Promise<void> {
    this.stopped = true;
    if (this.timer) clearInterval(this.timer);
    await this.running;
  }

  private scheduleDrain(): void {
    if (this.stopped || this.running) return;
    this.running = this.worker
      .drainOnce(this.workerId, this.batchSize)
      .then((report) => {
        if (report.claimed > 0) {
          this.logger.log(
            `Outbox drain claimed=${report.claimed} delivered=${report.delivered} retried=${report.retried} dead=${report.deadLettered} leaseLost=${report.leaseLost}`,
          );
        }
      })
      .catch((error) => this.logger.error(`Outbox drain failed: ${error instanceof Error ? error.message : String(error)}`))
      .finally(() => {
        this.running = undefined;
      });
  }

  private async deliver(entry: ClaimedOutboxEntry): Promise<void> {
    let heartbeatFailure: Error | undefined;
    const heartbeat = setInterval(() => {
      void this.worker
        .heartbeat(this.workerId, entry.id, entry.leaseToken)
        .then((renewed) => {
          if (!renewed) heartbeatFailure = new OutboxLeaseLostError(entry.id, this.workerId);
        })
        .catch((error) => {
          heartbeatFailure = error instanceof Error ? error : new Error(String(error));
        });
    }, this.heartbeatMs);
    heartbeat.unref?.();

    try {
      const delivered = await this.kafka.send({
        topic: entry.type.startsWith('BANK_') ? 'grainflow.bank.events' : 'grainflow.domain.events',
        key: entry.idempotencyKey ?? entry.id,
        value: entry.payload as Record<string, unknown>,
        headers: {
          'x-outbox-id': entry.id,
          ...(entry.correlationId ? { 'x-correlation-id': entry.correlationId } : {}),
        },
      });
      if (heartbeatFailure) throw heartbeatFailure;
      if (!delivered) throw new Error('Kafka transport is disabled or delivery failed');
    } finally {
      clearInterval(heartbeat);
    }
  }
}
