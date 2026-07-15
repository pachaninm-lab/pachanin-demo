/**
 * Kafka Producer used by the durable PostgreSQL outbox transport.
 *
 * Kafka availability never changes business authority: when the transport is
 * disabled or unavailable, send() returns false and the outbox entry remains
 * retryable. A dedicated worker can additionally set KAFKA_REQUIRED=true to
 * fail startup instead of entering a misleading healthy no-op mode.
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

@Injectable()
export class KafkaProducerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(KafkaProducerService.name);
  private readonly required = process.env.KAFKA_REQUIRED === 'true';
  private readonly component = process.env.RUNTIME_COMPONENT?.trim() || 'api';
  private readonly clientId =
    process.env.KAFKA_CLIENT_ID?.trim() ||
    `grainflow-${this.component}-${hostname()}-${process.pid}`;
  private producer: import('kafkajs').Producer | null = null;
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
      this.producer = kafka.producer({
        idempotent: true,
        maxInFlightRequests: 1,
      });
      await this.producer.connect();
      this.connected = true;
      this.logger.log(`Kafka producer connected clientId=${this.clientId}`);
    } catch (error) {
      this.connected = false;
      this.producer = null;
      const message = error instanceof Error ? error.message : String(error);
      if (this.required) throw new Error(`Kafka producer startup failed: ${message}`);
      this.logger.warn(`Kafka producer init failed: ${message} — delivery remains fail closed`);
    }
  }

  async onModuleDestroy(): Promise<void> {
    const producer = this.producer;
    this.producer = null;
    this.connected = false;
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

  async send(message: KafkaMessage): Promise<boolean> {
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
        compression: 2,
      });
      return true;
    } catch (error) {
      this.logger.error(`Kafka send failed [${message.topic}]: ${error instanceof Error ? error.message : String(error)}`);
      return false;
    }
  }

  async sendBatch(messages: KafkaMessage[]): Promise<number> {
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
        compression: 2,
      });
      return messages.length;
    } catch (error) {
      this.logger.error(`Kafka sendBatch failed: ${error instanceof Error ? error.message : String(error)}`);
      return 0;
    }
  }
}
