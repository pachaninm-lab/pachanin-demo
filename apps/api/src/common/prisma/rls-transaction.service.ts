import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { RequestUser } from '../types/request-user';
import { Role } from '../types/request-user';
import { currentCommandExecutionId } from '../command-execution.context';
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
    const commandId = currentCommandExecutionId()?.trim() ?? '';

    return this.prisma.$transaction(
      async (tx) => {
        await tx.$queryRaw(
          Prisma.sql`
            SELECT
              set_config('app.current_user_id', ${context.userId}, true),
              set_config('app.current_org_id', ${context.orgId}, true),
              set_config('app.current_tenant_id', ${context.tenantId}, true),
              set_config('app.current_role', ${context.role}, true),
              set_config('app.current_session_id', ${context.sessionId}, true),
              set_config('app.current_command_id', ${commandId}, true)
          `,
        );

        return work(tx, context);
      },
      {
        maxWait: options.maxWait ?? 5_000,
        timeout: options.timeout ?? 15_000,
        isolationLevel: options.isolationLevel ?? Prisma.TransactionIsolationLevel.ReadCommitted,
      },
    );
  }
}
