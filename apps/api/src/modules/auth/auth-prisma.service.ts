import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import {
  evaluateAuthPrincipalBoundary,
  resolveAuthDatabaseUrl,
  shouldEnforceDatabasePrincipalBoundary,
} from '../../common/prisma/database-principal-boundary';
import { inspectDatabasePrincipal } from '../../common/prisma/database-principal-inspection';

@Injectable()
export class AuthPrismaService extends PrismaService {
  private readonly authLogger = new Logger(AuthPrismaService.name);

  constructor() {
    const url = resolveAuthDatabaseUrl();
    super(url ? { datasources: { db: { url } } } : undefined);
  }

  override async onModuleInit(): Promise<void> {
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
        this.authLogger.log(`Auth database principal verified: ${snapshot.currentUser}`);
      } else {
        this.authLogger.log('Auth database connected');
      }
    } catch (error) {
      if (strict) throw error;
      this.authLogger.warn(`Auth database unavailable in non-production mode: ${(error as Error).message}`);
    }
  }

  override async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
