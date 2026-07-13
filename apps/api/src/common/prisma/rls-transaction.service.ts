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
}>;

const SERIALIZABLE_MAX_ATTEMPTS = 6;
const SERIALIZABLE_BASE_BACKOFF_MS = 20;
const SERIALIZABLE_MAX_BACKOFF_MS = 400;

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
    const maxAttempts = isolationLevel === Prisma.TransactionIsolationLevel.Serializable
      ? SERIALIZABLE_MAX_ATTEMPTS
      : 1;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
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
          {
            maxWait: options.maxWait ?? 5_000,
            timeout: options.timeout ?? 15_000,
            isolationLevel,
          },
        );
      } catch (error) {
        if (attempt === maxAttempts || !isTransientTransactionConflict(error)) throw error;
        await waitForRetry(attempt);
      }
    }

    throw new Error('Serializable RLS transaction retry loop exhausted unexpectedly.');
  }
}

function isTransientTransactionConflict(error: unknown): boolean {
  const code = typeof error === 'object' && error !== null && 'code' in error
    ? String((error as { code?: unknown }).code ?? '')
    : '';
  if (code === 'P2034' || code === '40001' || code === '40P01') return true;
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2010') {
    const meta = error.meta as Record<string, unknown> | undefined;
    if (meta?.code === '40001' || meta?.code === '40P01') return true;
  }
  const message = error instanceof Error ? error.message : String(error);
  return /write conflict|deadlock|serialization failure|could not serialize/i.test(message);
}

function waitForRetry(attempt: number): Promise<void> {
  const ceiling = Math.min(
    SERIALIZABLE_BASE_BACKOFF_MS * (2 ** (attempt - 1)),
    SERIALIZABLE_MAX_BACKOFF_MS,
  );
  const delayMs = Math.max(1, Math.round(Math.random() * ceiling));
  return new Promise((resolve) => setTimeout(resolve, delayMs));
}
