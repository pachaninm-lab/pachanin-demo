import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type { RequestUser } from '../types/request-user';
import { Role } from '../types/request-user';
import { PrismaService } from '../prisma/prisma.service';

export const RLS_CONTEXT_MODE_ENV = 'PLATFORM_V7_RLS_CONTEXT_MODE';
export type RlsContextMode = 'disabled' | 'transactional';

export interface TrustedRlsContext {
  readonly userId: string;
  readonly organizationId: string;
  readonly tenantId: string;
  readonly role: string;
  readonly sessionId: string;
}

function nonEmpty(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

@Injectable()
export class RlsContextService {
  constructor(private readonly prisma: PrismaService) {}

  mode(): RlsContextMode {
    const raw = String(process.env[RLS_CONTEXT_MODE_ENV] ?? 'disabled')
      .trim()
      .toLowerCase();

    if (raw === 'disabled' || raw === 'transactional') return raw;

    throw new Error(
      `${RLS_CONTEXT_MODE_ENV} must be either "disabled" or "transactional"; received "${raw}".`,
    );
  }

  isTransactional(): boolean {
    return this.mode() === 'transactional';
  }

  trustedContext(user: RequestUser | null | undefined): TrustedRlsContext {
    if (!user || !nonEmpty(user.id) || !nonEmpty(user.orgId)) {
      throw new UnauthorizedException({
        code: 'RLS_AUTH_CONTEXT_REQUIRED',
        message: 'Authenticated user and organization are required for database access.',
      });
    }

    if (!nonEmpty(user.tenantId) || !nonEmpty(user.sessionId)) {
      throw new UnauthorizedException({
        code: 'RLS_TENANT_SESSION_REQUIRED',
        message: 'Verified tenant and session context are required for database access.',
      });
    }

    if (!nonEmpty(user.role) || user.role === Role.GUEST) {
      throw new ForbiddenException({
        code: 'RLS_ROLE_NOT_ALLOWED',
        message: 'Guest or missing role cannot establish database context.',
      });
    }

    return Object.freeze({
      userId: user.id,
      organizationId: user.orgId,
      tenantId: user.tenantId,
      role: String(user.role),
      sessionId: user.sessionId,
    });
  }

  async run<T>(
    user: RequestUser,
    work: (tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    if (!this.isTransactional()) {
      return work(this.prisma as unknown as Prisma.TransactionClient);
    }

    const trusted = this.trustedContext(user);

    return this.prisma.runInTransactionContext(async (tx) => {
      await tx.$queryRaw`
        SELECT
          set_config('app.current_user_id', ${trusted.userId}, true),
          set_config('app.current_org_id', ${trusted.organizationId}, true),
          set_config('app.current_tenant_id', ${trusted.tenantId}, true),
          set_config('app.current_role', ${trusted.role}, true),
          set_config('app.current_session_id', ${trusted.sessionId}, true)
      `;

      return work(tx);
    });
  }
}
