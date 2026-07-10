import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import {
  evaluateDealPrincipalBoundary,
  shouldEnforceDatabasePrincipalBoundary,
} from './database-principal-boundary';
import { inspectDatabasePrincipal } from './database-principal-inspection';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  async onModuleInit(): Promise<void> {
    const strict = shouldEnforceDatabasePrincipalBoundary();
    try {
      await this.$connect();
      if (strict) {
        const snapshot = await inspectDatabasePrincipal(this);
        const errors = evaluateDealPrincipalBoundary(snapshot);
        if (errors.length > 0) {
          throw new Error(
            `Deal PostgreSQL principal ${snapshot.currentUser} violates the production boundary: ${errors.join('; ')}`,
          );
        }
        this.logger.log(`Deal database principal verified: ${snapshot.currentUser}`);
      } else {
        this.logger.log('Database connected');
      }
    } catch (error) {
      if (strict) throw error;
      this.logger.warn(`Database unavailable — running in degraded mode: ${(error as Error).message}`);
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
