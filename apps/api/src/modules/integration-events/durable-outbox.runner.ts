import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { hostname } from 'node:os';
import { KafkaProducerService } from '../../common/kafka/kafka-producer.service';
import {
  ClaimedOutboxEntry,
  DurableOutboxWorker,
  OutboxDeliveryError,
  OutboxDrainReport,
  OutboxLeaseLostError,
} from './durable-outbox.worker';

const DEFAULT_INTERVAL_MS = 1_000;
const DEFAULT_BATCH_SIZE = 25;
const DEFAULT_HEARTBEAT_MS = 20_000;

function positiveInteger(value: string | undefined, fallback: number, maximum: number): number {
  if (!value) return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > maximum) return fallback;
  return parsed;
}

export interface DurableOutboxRunnerHealth {
  enabled: boolean;
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
export class DurableOutboxRunner implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DurableOutboxRunner.name);
  private readonly enabled = process.env.OUTBOX_WORKER_ENABLED === 'true';
  private readonly workerId = process.env.OUTBOX_WORKER_ID ?? `${hostname()}-${process.pid}`;
  private readonly intervalMs = positiveInteger(process.env.OUTBOX_WORKER_INTERVAL_MS, DEFAULT_INTERVAL_MS, 60_000);
  private readonly batchSize = positiveInteger(process.env.OUTBOX_WORKER_BATCH_SIZE, DEFAULT_BATCH_SIZE, 500);
  private readonly heartbeatMs = positiveInteger(process.env.OUTBOX_WORKER_HEARTBEAT_MS, DEFAULT_HEARTBEAT_MS, 60_000);
  private timer?: ReturnType<typeof setInterval>;
  private running?: Promise<void>;
  private started = false;
  private stopped = false;
  private lastDrainStartedAt: Date | null = null;
  private lastDrainCompletedAt: Date | null = null;
  private lastError: string | null = null;
  private lastReport: OutboxDrainReport | null = null;

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
    this.started = true;
    this.scheduleDrain();
    this.logger.log(`Durable outbox runner started workerId=${this.workerId} batchSize=${this.batchSize}`);
  }

  async onModuleDestroy(): Promise<void> {
    this.stopped = true;
    if (this.timer) clearInterval(this.timer);
    await this.running;
    this.logger.log(`Durable outbox runner stopped workerId=${this.workerId}`);
  }

  health(): DurableOutboxRunnerHealth {
    return {
      enabled: this.enabled,
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

  private scheduleDrain(): void {
    if (this.stopped || this.running) return;

    // Readiness probing is part of the serialized drain cycle so a slow broker
    // probe cannot overlap with another claim attempt.
    this.running = this.drainWhenReady().finally(() => {
      this.running = undefined;
    });
  }

  private async drainWhenReady(): Promise<void> {
    // A process-local connection flag is insufficient here: Kafka may disappear
    // after startup. Probe the broker before claiming durable rows so a known
    // platform-wide outage cannot turn into ambiguous post-send outcomes.
    let ready = false;
    try {
      ready = await this.kafka.isReady();
    } catch (error) {
      this.lastError = error instanceof Error ? error.message : String(error);
      this.logger.error(`Kafka readiness probe failed: ${this.lastError}`);
      return;
    }

    if (!ready) {
      this.lastError = 'Kafka transport is not ready';
      return;
    }

    this.lastDrainStartedAt = new Date();
    try {
      const report = await this.worker.drainOnce(this.workerId, this.batchSize);
      this.lastReport = report;
      this.lastError = null;
      if (report.claimed > 0) {
        this.logger.log(
          `Outbox drain claimed=${report.claimed} delivered=${report.delivered} retried=${report.retried} dead=${report.deadLettered} manualReview=${report.manualReview} leaseLost=${report.leaseLost}`,
        );
      }
    } catch (error) {
      this.lastError = error instanceof Error ? error.message : String(error);
      this.logger.error(`Outbox drain failed: ${this.lastError}`);
    } finally {
      this.lastDrainCompletedAt = new Date();
    }
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
      if (!this.kafka.isConnected()) {
        throw new OutboxDeliveryError(
          'TRANSIENT',
          'KAFKA_TRANSPORT_UNAVAILABLE',
          'Kafka transport became unavailable before delivery attempt',
        );
      }

      let delivered: boolean;
      try {
        delivered = await this.kafka.send({
          topic: entry.type.startsWith('BANK_') ? 'grainflow.bank.events' : 'grainflow.domain.events',
          key: entry.idempotencyKey ?? entry.id,
          value: entry.payload as Record<string, unknown>,
          headers: {
            'x-outbox-id': entry.id,
            ...(entry.correlationId ? { 'x-correlation-id': entry.correlationId } : {}),
          },
        });
      } catch (error) {
        if (error instanceof OutboxLeaseLostError || error instanceof OutboxDeliveryError) throw error;
        throw new OutboxDeliveryError(
          'AMBIGUOUS',
          'TRANSPORT_OUTCOME_UNKNOWN',
          `Kafka delivery outcome is unknown: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
      if (heartbeatFailure) throw heartbeatFailure;
      if (!delivered) {
        // KafkaProducerService currently collapses producer.send() failures into
        // false. Once the transport was connected and delivery was attempted,
        // false therefore cannot prove that Kafka did not accept the record.
        // Quarantine rather than retrying an outcome that may already exist.
        throw new OutboxDeliveryError(
          'AMBIGUOUS',
          'TRANSPORT_OUTCOME_UNKNOWN',
          'Kafka send returned without durable acknowledgement; delivery outcome is unknown',
        );
      }
    } finally {
      clearInterval(heartbeat);
    }
  }
}
