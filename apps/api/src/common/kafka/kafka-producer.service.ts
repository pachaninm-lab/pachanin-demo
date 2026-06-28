/**
 * Kafka Producer — публикует события через Transactional Outbox паттерн.
 * В dev-режиме без KAFKA_BROKERS все сообщения логируются (no-op).
 */

import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';

export interface KafkaMessage {
  topic: string;
  key?: string;
  value: Record<string, unknown>;
  headers?: Record<string, string>;
}

// Lazy import — не ломаем старт если kafkajs не установлен
let Kafka: typeof import('kafkajs').Kafka | undefined;

@Injectable()
export class KafkaProducerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(KafkaProducerService.name);
  private producer: import('kafkajs').Producer | null = null;
  private connected = false;

  async onModuleInit() {
    const brokers = process.env.KAFKA_BROKERS;
    if (!brokers) {
      this.logger.warn('KAFKA_BROKERS not set — Kafka producer disabled (dev mode)');
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
        clientId: 'grainflow-api',
        brokers: brokers.split(','),
        retry: { retries: 5, initialRetryTime: 300 },
      });
      this.producer = kafka.producer({
        transactionalId: 'grainflow-api-tx',
        idempotent: true,
        maxInFlightRequests: 1,
      });
      await this.producer.connect();
      this.connected = true;
      this.logger.log('Kafka producer connected');
    } catch (err) {
      this.logger.warn(`Kafka producer init failed: ${err} — running in no-op mode`);
    }
  }

  async onModuleDestroy() {
    if (this.producer && this.connected) {
      await this.producer.disconnect().catch(() => {});
    }
  }

  async send(message: KafkaMessage): Promise<boolean> {
    if (!this.producer || !this.connected) {
      this.logger.debug(`[no-op] Kafka → ${message.topic}: ${JSON.stringify(message.value)}`);
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
            'service': 'grainflow-api',
            ...message.headers,
          },
        }],
        compression: 2, // lz4
      });
      return true;
    } catch (err) {
      this.logger.error(`Kafka send failed [${message.topic}]: ${err}`);
      return false;
    }
  }

  async sendBatch(messages: KafkaMessage[]): Promise<number> {
    if (!this.producer || !this.connected) {
      for (const m of messages) {
        this.logger.debug(`[no-op] Kafka → ${m.topic}`);
      }
      return 0;
    }

    const grouped = messages.reduce<Record<string, typeof messages>>((acc, m) => {
      (acc[m.topic] = acc[m.topic] ?? []).push(m);
      return acc;
    }, {});

    let sent = 0;
    try {
      await this.producer.sendBatch({
        topicMessages: Object.entries(grouped).map(([topic, msgs]) => ({
          topic,
          messages: msgs.map((m) => ({
            key: m.key,
            value: JSON.stringify(m.value),
            headers: { 'content-type': 'application/json', 'service': 'grainflow-api', ...m.headers },
          })),
          compression: 2,
        })),
      });
      sent = messages.length;
    } catch (err) {
      this.logger.error(`Kafka sendBatch failed: ${err}`);
    }
    return sent;
  }
}
