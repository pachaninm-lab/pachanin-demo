import { AsyncLocalStorage } from 'node:async_hooks';
import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';

const BASE_CLIENT_PROPERTIES = new Set<PropertyKey>([
  'constructor',
  'onModuleInit',
  'onModuleDestroy',
  'runInTransactionContext',
  'currentTransaction',
  'transactionStorage',
  'logger',
  '$connect',
  '$disconnect',
  '$on',
  '$use',
  '$extends',
]);

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);
  private readonly transactionStorage = new AsyncLocalStorage<Prisma.TransactionClient>();

  constructor() {
    super();

    return new Proxy(this, {
      get: (target, property, receiver) => {
        const transaction = target.transactionStorage.getStore();

        if (transaction && !BASE_CLIENT_PROPERTIES.has(property)) {
          if (property === '$transaction') {
            return (
              input: unknown,
              _options?: unknown,
            ): unknown => target.runNestedTransaction(transaction, input);
          }

          const transactionValue = Reflect.get(
            transaction as unknown as object,
            property,
            transaction,
          );

          if (transactionValue !== undefined) {
            return typeof transactionValue === 'function'
              ? transactionValue.bind(transaction)
              : transactionValue;
          }
        }

        const value = Reflect.get(target, property, receiver);
        return typeof value === 'function' ? value.bind(target) : value;
      },
    });
  }

  async onModuleInit(): Promise<void> {
    try {
      await this.$connect();
      this.logger.log('Database connected');
    } catch (error) {
      this.logger.warn(
        `Database unavailable — running in degraded mode: ${(error as Error).message}`,
      );
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }

  currentTransaction(): Prisma.TransactionClient | undefined {
    return this.transactionStorage.getStore();
  }

  async runInTransactionContext<T>(
    work: (tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    const active = this.transactionStorage.getStore();
    if (active) return work(active);

    return this.$transaction(async (transaction) =>
      this.transactionStorage.run(transaction, () => work(transaction)),
    );
  }

  private runNestedTransaction(
    transaction: Prisma.TransactionClient,
    input: unknown,
  ): unknown {
    if (typeof input === 'function') {
      return (input as (tx: Prisma.TransactionClient) => unknown)(transaction);
    }

    if (Array.isArray(input)) {
      return Promise.all(input);
    }

    throw new TypeError('Nested Prisma transaction requires a callback or operation array.');
  }
}
