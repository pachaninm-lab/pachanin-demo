import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { RequestUser } from '../types/request-user';
import { Role } from '../types/request-user';
import { PrismaService } from './prisma.service';

export type RlsContextErrorCode =
  | 'authenticated_user_required'
  | 'session_required'
  | 'organization_required'
  | 'tenant_required'
  | 'guest_role_forbidden';

export class RlsContextError extends Error {
  constructor(readonly code: RlsContextErrorCode) {
    super('Trusted PostgreSQL RLS context is incomplete.');
    this.name = 'RlsContextError';
  }
}

export type TrustedRlsContext = Readonly<{
  userId: string;
  orgId: string;
  tenantId: string;
  role: string;
  sessionId: string;
}>;

export type RlsTransactionOptions = Readonly<{
  maxWait?: number;
  timeout?: number;
  isolationLevel?: Prisma.TransactionIsolationLevel;
  /**
   * Override the retry count for PostgreSQL serialization failures and deadlocks.
   * Serializable transactions default to three retries; other isolation levels
   * default to none. Callbacks must keep non-database side effects outside the
   * transaction because PostgreSQL can require the callback to execute again.
   */
  maxConflictRetries?: number;
  retryDelayMs?: number;
}>;

export function deriveTrustedRlsContext(user: RequestUser | undefined): TrustedRlsContext {
  if (!user?.id?.trim()) {
    throw new RlsContextError('authenticated_user_required');
  }
  if (!user.sessionId?.trim()) {
    throw new RlsContextError('session_required');
  }
  if (!user.orgId?.trim()) {
    throw new RlsContextError('organization_required');
  }
  if (!user.tenantId?.trim()) {
    throw new RlsContextError('tenant_required');
  }
  if (user.role === Role.GUEST) {
    throw new RlsContextError('guest_role_forbidden');
  }

  return Object.freeze({
    userId: user.id,
    orgId: user.orgId,
    tenantId: user.tenantId,
    role: user.role,
    sessionId: user.sessionId,
  });
}

@Injectable()
export class RlsTransactionService {
  constructor(private readonly prisma: PrismaService) {}

  async withTrustedContext<T>(
    user: RequestUser | undefined,
    work: (tx: Prisma.TransactionClient, context: TrustedRlsContext) => Promise<T>,
    options: RlsTransactionOptions = {},
  ): Promise<T> {
    const context = deriveTrustedRlsContext(user);
    const isolationLevel = options.isolationLevel ?? Prisma.TransactionIsolationLevel.ReadCommitted;
    const defaultConflictRetries = isolationLevel === Prisma.TransactionIsolationLevel.Serializable ? 3 : 0;
    const maxConflictRetries = boundedInteger(
      options.maxConflictRetries,
      0,
      5,
      defaultConflictRetries,
    );
    const retryDelayMs = boundedInteger(options.retryDelayMs, 0, 1_000, 10);
    const transactionOptions = {
      maxWait: options.maxWait ?? 5_000,
      timeout: options.timeout ?? 15_000,
      isolationLevel,
    };

    for (let attempt = 0; ; attempt += 1) {
      try {
        return await this.prisma.$transaction(
          async (tx) => {
            await tx.$queryRaw(
              Prisma.sql`
                SELECT
                  set_config('app.current_user_id', ${context.userId}, true),
                  set_config('app.current_org_id', ${context.orgId}, true),
                  set_config('app.current_tenant_id', ${context.tenantId}, true),
                  set_config('app.current_role', ${context.role}, true),
                  set_config('app.current_session_id', ${context.sessionId}, true)
              `,
            );

            return work(tx, context);
          },
          transactionOptions,
        );
      } catch (error) {
        if (!isRetryableTransactionConflict(error) || attempt >= maxConflictRetries) throw error;
        await conflictBackoff(retryDelayMs, attempt);
      }
    }
  }
}

export function isRetryableTransactionConflict(error: unknown): boolean {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2034') return true;
    const databaseCode = readDatabaseCode(error.meta);
    return databaseCode === '40001' || databaseCode === '40P01';
  }
  if (!error || typeof error !== 'object') return false;
  const candidate = error as { code?: unknown; meta?: unknown };
  if (candidate.code === 'P2034' || candidate.code === '40001' || candidate.code === '40P01') return true;
  const databaseCode = readDatabaseCode(candidate.meta);
  return databaseCode === '40001' || databaseCode === '40P01';
}

function readDatabaseCode(meta: unknown): string | null {
  if (!meta || typeof meta !== 'object') return null;
  const record = meta as Record<string, unknown>;
  for (const key of ['code', 'database_error_code', 'dbErrorCode', 'sqlState']) {
    if (typeof record[key] === 'string') return record[key];
  }
  return null;
}

async function conflictBackoff(baseDelayMs: number, attempt: number): Promise<void> {
  if (baseDelayMs <= 0) return;
  const exponential = Math.min(baseDelayMs * 2 ** attempt, 1_000);
  const jitter = Math.floor(Math.random() * Math.max(1, baseDelayMs));
  await new Promise((resolve) => setTimeout(resolve, exponential + jitter));
}

function boundedInteger(
  value: number | undefined,
  minimum: number,
  maximum: number,
  fallback: number,
): number {
  if (value === undefined) return fallback;
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw new RangeError(`Transaction option must be an integer between ${minimum} and ${maximum}.`);
  }
  return value;
}
