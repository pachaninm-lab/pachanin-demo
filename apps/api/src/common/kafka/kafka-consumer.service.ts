/**
 * Kafka Consumer — подписывается на топики и обрабатывает события.
 * В dev-режиме без KAFKA_BROKERS — no-op.
 */

import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';

type MessageHandler = (value: Record<string, unknown>, key?: string) => Promise<void>;

@Injectable()
export class KafkaConsumerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(KafkaConsumerService.name);
  private consumer: import('kafkajs').Consumer | null = null;
  private readonly handlers = new Map<string, MessageHandler[]>();
  private connected = false;

  subscribe(topic: string, handler: MessageHandler) {
    const existing = this.handlers.get(topic) ?? [];
    this.handlers.set(topic, [...existing, handler]);
  }

  async onModuleInit() {
    const brokers = process.env.KAFKA_BROKERS;
    if (!brokers || this.handlers.size === 0) {
      this.logger.warn('Kafka consumer disabled (no brokers or no subscriptions)');
      return;
    }

    try {
      const kafkajs = await import('kafkajs').catch(() => null);
      if (!kafkajs) return;

      const kafka = new kafkajs.Kafka({
        clientId: 'grainflow-api-consumer',
        brokers: brokers.split(','),
        retry: { retries: 5 },
      });

      this.consumer = kafka.consumer({
        groupId: 'grainflow-api-group',
        sessionTimeout: 30000,
        heartbeatInterval: 3000,
      });

      await this.consumer.connect();

      for (const topic of this.handlers.keys()) {
        await this.consumer.subscribe({ topic, fromBeginning: false });
        this.logger.log(`Subscribed to Kafka topic: ${topic}`);
      }

      await this.consumer.run({
        eachMessage: async ({ topic, message }) => {
          const handlers = this.handlers.get(topic) ?? [];
          let value: Record<string, unknown> = {};
          try {
            value = JSON.parse(message.value?.toString() ?? '{}');
          } catch {
            this.logger.warn(`Invalid JSON in topic ${topic}`);
            return;
          }
          const key = message.key?.toString();
          for (const handler of handlers) {
            await handler(value, key).catch((err) =>
              this.logger.error(`Handler error for ${topic}: ${err}`)
            );
          }
        },
      });

      this.connected = true;
      this.logger.log('Kafka consumer started');
    } catch (err) {
      this.logger.warn(`Kafka consumer init failed: ${err}`);
    }
  }

  async onModuleDestroy() {
    if (this.consumer && this.connected) {
      await this.consumer.disconnect().catch(() => {});
    }
  }
}
