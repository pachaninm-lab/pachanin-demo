import { Injectable } from '@nestjs/common';
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
  if (!user?.id) {
    throw new RuntimePersistenceCommandContextError('authenticated_user_required');
  }
  if (!user.sessionId) {
    throw new RuntimePersistenceCommandContextError('session_required');
  }
  if (!user.orgId) {
    throw new RuntimePersistenceCommandContextError('organization_required');
  }
  if (!user.tenantId) {
    throw new RuntimePersistenceCommandContextError('tenant_required');
  }
  if (user.role === Role.GUEST) {
    throw new RuntimePersistenceCommandContextError('guest_role_forbidden');
  }
  return user;
}

@Injectable()
export class RuntimePersistenceCommandService {
  constructor(private readonly persistence: RuntimePersistenceService) {}

  persistAuthenticated(
    user: RequestUser | undefined,
    command: RuntimePersistenceAuthenticatedCommandInput,
  ): Promise<RuntimePersistenceWriteReceipt> {
    const trusted = requireTrustedContext(user);

    return this.persistence.persist({
      ...command,
      actorId: trusted.id,
      actorRole: trusted.role,
      tenantId: trusted.tenantId,
      organizationId: trusted.orgId,
    });
  }
}
