import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import {
  evaluateAuthPrincipalBoundary,
  resolveAuthDatabaseUrl,
  shouldEnforceDatabasePrincipalBoundary,
} from '../../common/prisma/database-principal-boundary';
import { inspectDatabasePrincipal } from '../../common/prisma/database-principal-inspection';

@Injectable()
export class AuthPrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AuthPrismaService.name);

  constructor() {
    const url = resolveAuthDatabaseUrl();
    super(url ? { datasources: { db: { url } } } : undefined);
  }

  async onModuleInit(): Promise<void> {
    const strict = shouldEnforceDatabasePrincipalBoundary();
    try {
      await this.$connect();
      if (strict) {
        const snapshot = await inspectDatabasePrincipal(this);
        const errors = evaluateAuthPrincipalBoundary(snapshot);
        if (errors.length > 0) {
          throw new Error(
            `Auth PostgreSQL principal ${snapshot.currentUser} violates the production boundary: ${errors.join('; ')}`,
          );
        }
        this.logger.log(`Auth database principal verified: ${snapshot.currentUser}`);
      } else {
        this.logger.log('Auth database connected');
      }
    } catch (error) {
      if (strict) throw error;
      this.logger.warn(`Auth database unavailable in non-production mode: ${(error as Error).message}`);
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
