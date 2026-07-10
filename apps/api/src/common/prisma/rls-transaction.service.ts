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

function required(value: string | undefined, code: RlsContextErrorCode): string {
  const normalized = value?.trim();
  if (!normalized) throw new RlsContextError(code);
  return normalized;
}

export function normalizeTrustedRlsContext(context: TrustedRlsContext): TrustedRlsContext {
  const role = required(context.role, 'guest_role_forbidden');
  if (role === Role.GUEST) throw new RlsContextError('guest_role_forbidden');

  return Object.freeze({
    userId: required(context.userId, 'authenticated_user_required'),
    orgId: required(context.orgId, 'organization_required'),
    tenantId: required(context.tenantId, 'tenant_required'),
    role,
    sessionId: required(context.sessionId, 'session_required'),
  });
}

export function deriveTrustedRlsContext(user: RequestUser | undefined): TrustedRlsContext {
  if (!user) throw new RlsContextError('authenticated_user_required');

  return normalizeTrustedRlsContext({
    userId: user.id,
    orgId: user.orgId ?? '',
    tenantId: user.tenantId ?? '',
    role: user.role,
    sessionId: user.sessionId ?? '',
  });
}

@Injectable()
export class RlsTransactionService {
  constructor(private readonly prisma: PrismaService) {}

  withTrustedContext<T>(
    user: RequestUser | undefined,
    work: (tx: Prisma.TransactionClient, context: TrustedRlsContext) => Promise<T>,
    options: RlsTransactionOptions = {},
  ): Promise<T> {
    return this.withContext(deriveTrustedRlsContext(user), work, options);
  }

  async withContext<T>(
    context: TrustedRlsContext,
    work: (tx: Prisma.TransactionClient, context: TrustedRlsContext) => Promise<T>,
    options: RlsTransactionOptions = {},
  ): Promise<T> {
    const trusted = normalizeTrustedRlsContext(context);

    return this.prisma.$transaction(
      async (tx) => {
        await tx.$queryRaw(
          Prisma.sql`
            SELECT
              set_config('app.current_user_id', ${trusted.userId}, true),
              set_config('app.current_org_id', ${trusted.orgId}, true),
              set_config('app.current_tenant_id', ${trusted.tenantId}, true),
              set_config('app.current_role', ${trusted.role}, true),
              set_config('app.current_session_id', ${trusted.sessionId}, true)
          `,
        );

        return work(tx, trusted);
      },
      {
        maxWait: options.maxWait ?? 5_000,
        timeout: options.timeout ?? 15_000,
        isolationLevel: options.isolationLevel ?? Prisma.TransactionIsolationLevel.ReadCommitted,
      },
    );
  }
}
