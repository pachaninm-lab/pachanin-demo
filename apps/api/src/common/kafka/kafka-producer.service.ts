/**
 * Kafka Producer — publishes events from the durable PostgreSQL outbox.
 * Delivery contract is at-least-once. A boolean false is an explicit failure
 * and must never be interpreted by the relay as sent or confirmed.
 */

import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';

export interface KafkaMessage {
  topic: string;
  key?: string;
  value: Record<string, unknown>;
  headers?: Record<string, string>;
}

let Kafka: typeof import('kafkajs').Kafka | undefined;

@Injectable()
export class KafkaProducerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(KafkaProducerService.name);
  private producer: import('kafkajs').Producer | null = null;
  private connected = false;

  async onModuleInit() {
    const brokers = process.env.KAFKA_BROKERS;
    if (!brokers) {
      this.logger.warn('KAFKA_BROKERS not set — Kafka producer disabled');
      return;
    }

    try {
      const kafkajs = await import('kafkajs').catch(() => null);
      if (!kafkajs) {
        this.logger.warn('kafkajs not installed — Kafka producer disabled');
        return;
      }
      Kafka = kafkajs.Kafka;
      const kafka = new Kafka({
        clientId: process.env.KAFKA_CLIENT_ID || 'grainflow-api',
        brokers: brokers.split(',').map((item) => item.trim()).filter(Boolean),
        retry: { retries: 5, initialRetryTime: 300 },
      });
      this.producer = kafka.producer({
        transactionalId: process.env.KAFKA_TRANSACTIONAL_ID || `grainflow-outbox-${process.pid}`,
        idempotent: true,
        maxInFlightRequests: 1,
      });
      await this.producer.connect();
      this.connected = true;
      this.logger.log('Kafka producer connected');
    } catch (error) {
      this.connected = false;
      this.producer = null;
      this.logger.error(`Kafka producer initialization failed: ${errorMessage(error)}`);
    }
  }

  async onModuleDestroy() {
    const producer = this.producer;
    this.connected = false;
    this.producer = null;
    if (producer) await producer.disconnect().catch(() => undefined);
  }

  isReady(): boolean {
    return Boolean(this.producer && this.connected);
  }

  async send(message: KafkaMessage): Promise<boolean> {
    if (!this.producer || !this.connected) {
      this.logger.debug(`Kafka unavailable for topic=${message.topic}`);
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
            service: 'grainflow-api',
            ...message.headers,
          },
        }],
        compression: 2,
      });
      return true;
    } catch (error) {
      this.logger.error(`Kafka send failed topic=${message.topic}: ${errorMessage(error)}`);
      return false;
    }
  }

  async sendBatch(messages: KafkaMessage[]): Promise<number> {
    if (!this.producer || !this.connected) {
      this.logger.debug(`Kafka unavailable for batch size=${messages.length}`);
      return 0;
    }

    const grouped = messages.reduce<Record<string, KafkaMessage[]>>((acc, message) => {
      (acc[message.topic] = acc[message.topic] ?? []).push(message);
      return acc;
    }, {});

    try {
      await this.producer.sendBatch({
        topicMessages: Object.entries(grouped).map(([topic, topicMessages]) => ({
          topic,
          messages: topicMessages.map((message) => ({
            key: message.key,
            value: JSON.stringify(message.value),
            headers: { 'content-type': 'application/json', service: 'grainflow-api', ...message.headers },
          })),
          compression: 2,
        })),
      });
      return messages.length;
    } catch (error) {
      this.logger.error(`Kafka sendBatch failed: ${errorMessage(error)}`);
      return 0;
    }
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? `${error.name}: ${error.message}`.slice(0, 512) : 'unknown error';
}
