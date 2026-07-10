import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import {
  RlsContextError,
  RlsTransactionService,
} from '../../common/prisma/rls-transaction.service';
import { RequestUser, Role } from '../../common/types/request-user';
import type {
  RuntimePersistenceWriteInput,
  RuntimePersistenceWriteReceipt,
} from './runtime-persistence.repository';
import { RuntimePersistenceService } from './runtime-persistence.service';

export type RuntimePersistenceAuthenticatedCommandInput = Omit<
  RuntimePersistenceWriteInput,
  'actorId' | 'actorRole' | 'tenantId' | 'organizationId'
>;

export type RuntimePersistenceCommandContextErrorCode =
  | 'authenticated_user_required'
  | 'session_required'
  | 'organization_required'
  | 'tenant_required'
  | 'guest_role_forbidden';

export class RuntimePersistenceCommandContextError extends Error {
  constructor(readonly code: RuntimePersistenceCommandContextErrorCode) {
    super('Trusted runtime persistence context is incomplete.');
    this.name = 'RuntimePersistenceCommandContextError';
  }
}

function requireTrustedContext(user: RequestUser | undefined): Readonly<RequestUser> {
  if (!user?.id?.trim()) {
    throw new RuntimePersistenceCommandContextError('authenticated_user_required');
  }
  if (!user.sessionId?.trim()) {
    throw new RuntimePersistenceCommandContextError('session_required');
  }
  if (!user.orgId?.trim()) {
    throw new RuntimePersistenceCommandContextError('organization_required');
  }
  if (!user.tenantId?.trim()) {
    throw new RuntimePersistenceCommandContextError('tenant_required');
  }
  if (user.role === Role.GUEST) {
    throw new RuntimePersistenceCommandContextError('guest_role_forbidden');
  }
  return user;
}

function isUniqueConstraintError(error: unknown): boolean {
  return Boolean(
    error &&
      typeof error === 'object' &&
      'code' in error &&
      (error as { code?: unknown }).code === 'P2002',
  );
}

function databaseFailure(
  input: RuntimePersistenceAuthenticatedCommandInput,
): RuntimePersistenceWriteReceipt {
  return {
    status: 'failed',
    runtimeSnapshotId: input.runtimeSnapshotId,
    idempotencyKey: input.idempotencyKey,
    state: 'ready_to_persist',
    reasonCode: 'database_write_failed',
  };
}

function mapRlsContextError(error: RlsContextError): RuntimePersistenceCommandContextError {
  return new RuntimePersistenceCommandContextError(error.code);
}

@Injectable()
export class RuntimePersistenceCommandService {
  constructor(
    private readonly persistence: RuntimePersistenceService,
    private readonly rlsTransactions: RlsTransactionService,
  ) {}

  async persistAuthenticated(
    user: RequestUser | undefined,
    command: RuntimePersistenceAuthenticatedCommandInput,
  ): Promise<RuntimePersistenceWriteReceipt> {
    const trusted = requireTrustedContext(user);
    const input: RuntimePersistenceWriteInput = {
      ...command,
      actorId: trusted.id,
      actorRole: trusted.role,
      tenantId: trusted.tenantId,
      organizationId: trusted.orgId,
    };

    try {
      return await this.rlsTransactions.withTrustedContext(trusted, (tx) =>
        this.persistence.persistWithinTransaction(tx, input),
      );
    } catch (error) {
      if (error instanceof RlsContextError) {
        throw mapRlsContextError(error);
      }
      if (!isUniqueConstraintError(error)) {
        return databaseFailure(command);
      }
    }

    try {
      const classified = await this.rlsTransactions.withTrustedContext(
        trusted,
        (tx: Prisma.TransactionClient) =>
          this.persistence.classifyExistingWithinTransaction(tx, input),
      );
      return classified ?? databaseFailure(command);
    } catch (error) {
      if (error instanceof RlsContextError) {
        throw mapRlsContextError(error);
      }
      return databaseFailure(command);
    }
  }
}
