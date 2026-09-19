import { Injectable, Logger } from '@nestjs/common';
import { shouldEnforceDatabasePrincipalBoundary } from './database-principal-boundary';
import { evaluateOutboxPrincipalBoundary } from './outbox-database-principal-boundary';
import { inspectOutboxDatabasePrincipal } from './outbox-database-principal-inspection';
import { PrismaService } from './prisma.service';

@Injectable()
export class OutboxPrismaService extends PrismaService {
  private readonly outboxLogger = new Logger(OutboxPrismaService.name);

  override async onModuleInit(): Promise<void> {
    const strict = shouldEnforceDatabasePrincipalBoundary();
    try {
      await this.$connect();
      if (strict) {
        const snapshot = await inspectOutboxDatabasePrincipal(this);
        const errors = evaluateOutboxPrincipalBoundary(snapshot);
        if (errors.length > 0) {
          throw new Error(
            `Outbox PostgreSQL principal ${snapshot.currentUser} violates the production boundary: ${errors.join('; ')}`,
          );
        }
        this.outboxLogger.log(`Outbox database principal verified: ${snapshot.currentUser}`);
      } else {
        this.outboxLogger.log('Outbox database connected');
      }
    } catch (error) {
      if (strict) throw error;
      this.outboxLogger.warn(`Outbox database unavailable — running in degraded mode: ${(error as Error).message}`);
    }
  }
}
