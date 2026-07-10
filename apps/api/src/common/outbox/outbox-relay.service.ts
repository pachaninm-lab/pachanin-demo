import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from '@nestjs/common';
import { hostname } from 'os';
import { KafkaProducerService } from '../kafka/kafka-producer.service';
import { ClaimedOutboxEntry } from './outbox.repository';
import { OutboxService } from './outbox.service';

type WorkerMode = 'disabled' | 'api' | 'worker';

type RelayResult = Readonly<{
  claimed: number;
  sent: number;
  retry: number;
  dead: number;
  staleAck: number;
}>;

@Injectable()
export class OutboxRelayService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(OutboxRelayService.name);
  private readonly mode: WorkerMode;
  private readonly workerId: string;
  private readonly intervalMs: number;
  private readonly batchSize: number;
  private readonly leaseSeconds: number;
  private intervalHandle?: ReturnType<typeof setInterval>;
  private runningPromise: Promise<RelayResult> | null = null;
  private stopping = false;

  constructor(
    private readonly outbox: OutboxService,
    private readonly kafka: KafkaProducerService,
  ) {
    this.mode = workerMode();
    this.workerId = normalizeWorkerId(
      process.env.OUTBOX_WORKER_ID || `${this.mode}:${hostname()}:${process.pid}`,
    );
    this.intervalMs = boundedEnv('OUTBOX_RELAY_INTERVAL_MS', 5_000, 250, 60_000);
    this.batchSize = boundedEnv('OUTBOX_RELAY_BATCH_SIZE', 100, 1, 500);
    this.leaseSeconds = boundedEnv('OUTBOX_RELAY_LEASE_SECONDS', 30, 5, 900);
  }

  onApplicationBootstrap(): void {
    if (this.mode === 'disabled') {
      this.logger.log('Durable outbox relay disabled for this process');
      return;
    }
    if (!this.kafka.isReady()) {
      if (isProduction()) {
        throw new Error('OUTBOX_WORKER_MODE is enabled but Kafka producer is not ready.');
      }
      this.logger.warn('Outbox relay enabled without Kafka readiness; claimed rows will retry.');
    }

    this.intervalHandle = setInterval(() => {
      void this.relay().catch((error) => {
        this.logger.error(`Outbox relay cycle failed: ${safeErrorMessage(error)}`);
      });
    }, this.intervalMs);
    this.intervalHandle.unref?.();
    void this.relay().catch((error) => {
      this.logger.error(`Initial outbox relay cycle failed: ${safeErrorMessage(error)}`);
    });
    this.logger.log(`Durable outbox relay started mode=${this.mode} worker=${this.workerId}`);
  }

  async onModuleDestroy(): Promise<void> {
    this.stopping = true;
    if (this.intervalHandle) clearInterval(this.intervalHandle);
    const running = this.runningPromise;
    if (!running) return;
    await Promise.race([
      running.catch(() => undefined),
      new Promise<void>((resolve) => setTimeout(resolve, Math.min(30_000, this.leaseSeconds * 1_000))),
    ]);
  }

  relay(): Promise<RelayResult> {
    if (this.stopping || this.mode === 'disabled') {
      return Promise.resolve({ claimed: 0, sent: 0, retry: 0, dead: 0, staleAck: 0 });
    }
    if (this.runningPromise) return this.runningPromise;
    this.runningPromise = this.runCycle().finally(() => {
      this.runningPromise = null;
    });
    return this.runningPromise;
  }

  async getStats() {
    return {
      mode: this.mode,
      workerId: this.workerId,
      ...(await this.outbox.stats()),
    };
  }

  private async runCycle(): Promise<RelayResult> {
    const claimed = await this.outbox.claimBatch(this.workerId, this.batchSize, this.leaseSeconds);
    const result = { claimed: claimed.length, sent: 0, retry: 0, dead: 0, staleAck: 0 };

    for (const entry of claimed) {
      if (this.stopping) break;
      await this.deliver(entry, result);
    }

    if (result.claimed > 0 || result.dead > 0 || result.staleAck > 0) {
      this.logger.log(
        `Outbox relay worker=${this.workerId} claimed=${result.claimed} sent=${result.sent} retry=${result.retry} dead=${result.dead} staleAck=${result.staleAck}`,
      );
    }
    return result;
  }

  private async deliver(entry: ClaimedOutboxEntry, result: { sent: number; retry: number; dead: number; staleAck: number }): Promise<void> {
    const topic = topicFor(entry.type);
    try {
      const sent = await this.kafka.send({
        topic,
        key: entry.idempotencyKey || entry.id,
        value: toRecord(entry.payload),
        headers: {
          'outbox-id': entry.id,
          'idempotency-key': entry.idempotencyKey || entry.id,
          'delivery-attempt': String(entry.retryCount + 1),
          'delivery-semantics': 'at-least-once',
        },
      });
      if (!sent) {
        const decision = await this.outbox.failClaim(
          entry.id,
          entry.claimToken,
          'kafka_send_false',
          'Kafka producer returned false',
        );
        if (decision?.status === 'DEAD') result.dead += 1;
        else result.retry += 1;
        return;
      }

      const completed = await this.outbox.completeClaim(entry.id, entry.claimToken);
      if (completed) result.sent += 1;
      else {
        // The external publish may have succeeded. Never mark failure or create a
        // new claim here: lease expiry will replay with the stable idempotency key.
        result.staleAck += 1;
        this.logger.warn(`Outbox publish succeeded but claim acknowledgement was stale id=${entry.id}`);
      }
    } catch (error) {
      const decision = await this.outbox.failClaim(
        entry.id,
        entry.claimToken,
        errorCode(error),
        error,
      );
      if (decision?.status === 'DEAD') result.dead += 1;
      else result.retry += 1;
    }
  }
}

function workerMode(): WorkerMode {
  const raw = String(process.env.OUTBOX_WORKER_MODE ?? (isProduction() ? '' : 'disabled')).trim().toLowerCase();
  if (raw !== 'disabled' && raw !== 'api' && raw !== 'worker') {
    throw new Error('OUTBOX_WORKER_MODE must be explicitly set to disabled, api or worker.');
  }
  return raw;
}

function boundedEnv(name: string, fallback: number, min: number, max: number): number {
  const raw = process.env[name];
  const value = raw === undefined || raw === '' ? fallback : Number(raw);
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(`${name} must be an integer between ${min} and ${max}.`);
  }
  return value;
}

function normalizeWorkerId(value: string): string {
  const normalized = value.trim();
  if (!normalized || normalized.length > 160 || /[\u0000-\u001f\u007f]/.test(normalized)) {
    throw new Error('OUTBOX_WORKER_ID is invalid.');
  }
  return normalized;
}

function topicFor(type: string): string {
  if (type.startsWith('BANK_')) return 'grainflow.bank.commands';
  if (type.startsWith('FGIS_')) return 'grainflow.fgis.commands';
  if (type.startsWith('EDO_')) return 'grainflow.edo.commands';
  return 'grainflow.domain.events';
}

function toRecord(payload: unknown): Record<string, unknown> {
  if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
    return payload as Record<string, unknown>;
  }
  return { value: payload };
}

function errorCode(error: unknown): string {
  const name = error instanceof Error ? error.name : 'unknown';
  return `transport_${name.replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase()}`.slice(0, 96);
}

function safeErrorMessage(error: unknown): string {
  return error instanceof Error ? `${error.name}: ${error.message}`.slice(0, 512) : 'unknown error';
}

function isProduction(): boolean {
  return String(process.env.NODE_ENV ?? '').toLowerCase() === 'production';
}
