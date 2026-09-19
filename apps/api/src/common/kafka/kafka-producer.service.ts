/**
 * Kafka Producer used by the durable PostgreSQL outbox transport.
 *
 * Kafka availability never changes business authority. The durable worker uses
 * a protocol-level readiness probe before claiming work; once a delivery has
 * been attempted, a missing acknowledgement remains an ambiguous outcome.
 * The legacy send()/sendBatch() APIs remain boolean/count and never surface a
 * definitive broker rejection as an exception. The durable outbox uses the
 * explicit sendOrThrow()/sendBatchOrThrow() boundary when it needs rejection
 * evidence for permanent-vs-ambiguous classification.
 * A dedicated worker can additionally set KAFKA_REQUIRED=true to fail startup
 * instead of entering a misleading healthy no-op mode.
 */

import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { hostname } from 'node:os';

export interface KafkaMessage {
  topic: string;
  key?: string;
  value: Record<string, unknown>;
  headers?: Record<string, string>;
}

export interface KafkaProducerHealth {
  required: boolean;
  configured: boolean;
  connected: boolean;
  clientId: string;
}

export type KafkaDefinitiveRejectionCode =
  | 'KAFKA_MESSAGE_TOO_LARGE'
  | 'KAFKA_RECORD_LIST_TOO_LARGE';

export class KafkaDefinitiveRejectionError extends Error {
  constructor(
    readonly code: KafkaDefinitiveRejectionCode,
    message: string,
  ) {
    super(message);
    this.name = 'KafkaDefinitiveRejectionError';
  }
}

type KafkaProtocolErrorShape = Readonly<{
  name?: unknown;
  type?: unknown;
  code?: unknown;
  originalError?: unknown;
}>;

function kafkaProtocolError(error: unknown): KafkaProtocolErrorShape | null {
  const direct = typeof error === 'object' && error !== null
    ? error as KafkaProtocolErrorShape
    : null;
  if (direct?.name === 'KafkaJSProtocolError') return direct;
  const original = direct?.originalError;
  if (typeof original === 'object' && original !== null) {
    const nested = original as KafkaProtocolErrorShape;
    if (nested.name === 'KafkaJSProtocolError') return nested;
  }
  return null;
}

function definitiveKafkaRejection(error: unknown): KafkaDefinitiveRejectionError | null {
  const protocol = kafkaProtocolError(error);
  if (!protocol) return null;

  const type = typeof protocol.type === 'string' ? protocol.type : '';
  const code = typeof protocol.code === 'number' ? protocol.code : Number.NaN;
  const message = error instanceof Error ? error.message : String(error);

  // Kafka protocol errors 10 and 18 are explicit broker rejections: the broker
  // states that the record/request is too large to accept. Retrying the same
  // immutable payload cannot make it valid and does not carry an unknown
  // acknowledgement window, so preserve this as a permanent rejection.
  if (type === 'MESSAGE_TOO_LARGE' || code === 10) {
    return new KafkaDefinitiveRejectionError('KAFKA_MESSAGE_TOO_LARGE', message);
  }
  if (type === 'RECORD_LIST_TOO_LARGE' || code === 18) {
    return new KafkaDefinitiveRejectionError('KAFKA_RECORD_LIST_TOO_LARGE', message);
  }
  return null;
}

@Injectable()
export class KafkaProducerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(KafkaProducerService.name);
  private readonly required = process.env.KAFKA_REQUIRED === 'true';
  private readonly component = process.env.RUNTIME_COMPONENT?.trim() || 'api';
  private readonly clientId =
    process.env.KAFKA_CLIENT_ID?.trim() ||
    `grainflow-${this.component}-${hostname()}-${process.pid}`;
  private producer: import('kafkajs').Producer | null = null;
  private admin: import('kafkajs').Admin | null = null;
  private connected = false;

  async onModuleInit(): Promise<void> {
    const brokers = process.env.KAFKA_BROKERS?.trim();
    if (!brokers) {
      const message = 'KAFKA_BROKERS not set — Kafka producer disabled';
      if (this.required) throw new Error(`${message}; KAFKA_REQUIRED=true`);
      this.logger.warn(message);
      return;
    }

    try {
      const kafkajs = await import('kafkajs').catch(() => null);
      if (!kafkajs) {
        throw new Error('kafkajs is not installed');
      }

      const kafka = new kafkajs.Kafka({
        clientId: this.clientId,
        brokers: brokers.split(',').map((broker) => broker.trim()).filter(Boolean),
        retry: { retries: 5, initialRetryTime: 300 },
      });

      // The outbox provides durable idempotency and KafkaJS enables idempotent
      // producer semantics. No transactionalId is configured: sharing a fixed
      // transactional identity across replicas would fence healthy producers.
      const producer = kafka.producer({
        idempotent: true,
        maxInFlightRequests: 1,
      });
      const admin = kafka.admin();

      await producer.connect();
      try {
        await admin.connect();
      } catch (error) {
        await producer.disconnect().catch(() => undefined);
        throw error;
      }

      this.producer = producer;
      this.admin = admin;
      this.connected = true;
      this.logger.log(`Kafka producer connected clientId=${this.clientId}`);
    } catch (error) {
      this.connected = false;
      this.producer = null;
      this.admin = null;
      const message = error instanceof Error ? error.message : String(error);
      if (this.required) throw new Error(`Kafka producer startup failed: ${message}`);
      this.logger.warn(`Kafka producer init failed: ${message} — delivery remains fail closed`);
    }
  }

  async onModuleDestroy(): Promise<void> {
    const producer = this.producer;
    const admin = this.admin;
    this.producer = null;
    this.admin = null;
    this.connected = false;

    if (admin) {
      await admin.disconnect().catch((error) => {
        this.logger.warn(`Kafka admin disconnect failed: ${error instanceof Error ? error.message : String(error)}`);
      });
    }
    if (producer) {
      await producer.disconnect().catch((error) => {
        this.logger.warn(`Kafka producer disconnect failed: ${error instanceof Error ? error.message : String(error)}`);
      });
    }
  }

  health(): KafkaProducerHealth {
    return {
      required: this.required,
      configured: Boolean(process.env.KAFKA_BROKERS?.trim()),
      connected: this.connected,
      clientId: this.clientId,
    };
  }

  isConnected(): boolean {
    return this.connected && this.producer !== null;
  }

  async isReady(): Promise<boolean> {
    if (!this.connected || !this.producer || !this.admin) return false;

    try {
      // A lifecycle flag only proves that startup once succeeded. This broker
      // request detects a Kafka outage before the durable worker claims rows.
      await this.admin.describeCluster();
      return true;
    } catch (error) {
      this.logger.debug(
        `Kafka readiness probe failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      return false;
    }
  }

  async send(message: KafkaMessage): Promise<boolean> {
    try {
      return await this.sendOrThrow(message);
    } catch (error) {
      if (error instanceof KafkaDefinitiveRejectionError) return false;
      throw error;
    }
  }

  async sendOrThrow(message: KafkaMessage): Promise<boolean> {
    if (!this.producer || !this.connected) {
      this.logger.debug(`[transport-unavailable] Kafka → ${message.topic}: ${JSON.stringify(message.value)}`);
      return false;
    }

    try {
      await this.producer.send({
        topic: message.topic,
        messages: [{
          key: message.key,
          value: JSON.stringify(message.value),
          headers: {
            'content-type': 'application/json',
            service: `grainflow-${this.component}`,
            ...message.headers,
          },
        }],
      });
      return true;
    } catch (error) {
      const rejection = definitiveKafkaRejection(error);
      if (rejection) {
        this.logger.warn(`Kafka rejected message [${message.topic}] code=${rejection.code}: ${rejection.message}`);
        throw rejection;
      }
      this.logger.error(`Kafka send failed [${message.topic}]: ${error instanceof Error ? error.message : String(error)}`);
      return false;
    }
  }

  async sendBatch(messages: KafkaMessage[]): Promise<number> {
    try {
      return await this.sendBatchOrThrow(messages);
    } catch (error) {
      if (error instanceof KafkaDefinitiveRejectionError) return 0;
      throw error;
    }
  }

  async sendBatchOrThrow(messages: KafkaMessage[]): Promise<number> {
    if (!this.producer || !this.connected) {
      for (const message of messages) {
        this.logger.debug(`[transport-unavailable] Kafka → ${message.topic}`);
      }
      return 0;
    }

    const grouped = messages.reduce<Record<string, KafkaMessage[]>>((accumulator, message) => {
      (accumulator[message.topic] = accumulator[message.topic] ?? []).push(message);
      return accumulator;
    }, {});

    try {
      // Use KafkaJS's built-in uncompressed record batches. The previous
      // numeric compression=2 selected Snappy, whose codec is not bundled by
      // KafkaJS and caused every durable delivery to fail at runtime.
      await this.producer.sendBatch({
        topicMessages: Object.entries(grouped).map(([topic, topicMessages]) => ({
          topic,
          messages: topicMessages.map((message) => ({
            key: message.key,
            value: JSON.stringify(message.value),
            headers: {
              'content-type': 'application/json',
              service: `grainflow-${this.component}`,
              ...message.headers,
            },
          })),
        })),
      });
      return messages.length;
    } catch (error) {
      const rejection = definitiveKafkaRejection(error);
      if (rejection) {
        this.logger.warn(`Kafka rejected batch code=${rejection.code}: ${rejection.message}`);
        throw rejection;
      }
      this.logger.error(`Kafka sendBatch failed: ${error instanceof Error ? error.message : String(error)}`);
      return 0;
    }
  }
}
