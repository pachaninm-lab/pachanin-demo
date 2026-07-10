import { ForbiddenException, Injectable } from '@nestjs/common';
import { AuditService } from '../../modules/audit/audit.service';
import { OutboxService } from '../outbox/outbox.service';
import { DomainAction, getAllowedRoles, isActionAllowedForRole } from './action-policy';
import { RequestUser, Role } from '../types/request-user';

export interface ObjectScope {
  objectType: string;
  objectId: string;
  ownerOrgId?: string;
  counterpartyOrgId?: string;
  assignedDriverUserId?: string;
  allowedOrgIds?: string[];
}

export interface StateGates {
  dealStatus?: string;
  allowedFromStatuses?: string[];
  disputeOpen?: boolean;
  documentsComplete?: boolean;
  reserveConfirmed?: boolean;
}

export interface ExecuteParams<T> {
  user: RequestUser;
  action: DomainAction;
  scope: ObjectScope;
  gates?: StateGates;
  bankOutbox?: {
    type: string;
    payload: Record<string, unknown>;
    idempotencyKey?: string;
  };
  fn: () => T | Promise<T>;
}

export interface ExecuteResult<T> {
  result: T;
  auditId: string;
  outboxId?: string;
}

@Injectable()
export class ActionExecutorService {
  constructor(
    private readonly audit: AuditService,
    private readonly outbox: OutboxService,
  ) {}

  assertPermission(user: RequestUser, action: DomainAction): void {
    if (!isActionAllowedForRole(action, user.role)) {
      const allowedRoles = getAllowedRoles(action);
      throw new ForbiddenException(
        `Role ${user.role} cannot perform ${action}. Allowed roles: [${allowedRoles.join(', ')}]`,
      );
    }
  }

  assertObjectScope(user: RequestUser, action: DomainAction, scope: ObjectScope): void {
    if (user.role === Role.ADMIN) return;
    if (user.role === Role.EXECUTIVE && action.endsWith('.view')) return;
    if (user.role === Role.EXECUTIVE) {
      throw new ForbiddenException(`Executive role is read-only and cannot perform ${action}`);
    }

    if (scope.assignedDriverUserId !== undefined && user.role === Role.DRIVER) {
      if (scope.assignedDriverUserId !== user.id) {
        throw new ForbiddenException(
          `Driver ${user.id} cannot access ${scope.objectType}:${scope.objectId} assigned to another driver`,
        );
      }
      return;
    }

    const orgId = user.orgId;
    if (!orgId) {
      throw new ForbiddenException(`User ${user.id} has no organization scope`);
    }

    const allowedOrgIds = new Set(
      [scope.ownerOrgId, scope.counterpartyOrgId, ...(scope.allowedOrgIds ?? [])].filter(Boolean),
    );
    if (allowedOrgIds.size > 0 && !allowedOrgIds.has(orgId)) {
      throw new ForbiddenException(
        `Organization ${orgId} cannot access ${scope.objectType}:${scope.objectId}`,
      );
    }
  }

  assertStateGates(action: DomainAction, gates: StateGates): void {
    if (gates.disputeOpen) {
      throw new ForbiddenException(`Action ${action} is blocked: active dispute must be resolved first`);
    }
    if (
      gates.allowedFromStatuses &&
      gates.dealStatus &&
      !gates.allowedFromStatuses.includes(gates.dealStatus)
    ) {
      throw new ForbiddenException(
        `Action ${action} not allowed from status '${gates.dealStatus}'. Allowed: [${gates.allowedFromStatuses.join(', ')}]`,
      );
    }
    if (gates.documentsComplete === false) {
      throw new ForbiddenException(`Action ${action} is blocked: required documents are not complete`);
    }
    if (gates.reserveConfirmed === false) {
      throw new ForbiddenException(`Action ${action} is blocked: bank reserve not confirmed`);
    }
  }

  /**
   * Legacy execution pipeline. Canonical Deal commands use DealCommandService,
   * where Deal/payment/audit/outbox are committed in one PostgreSQL transaction.
   * This compatibility path now awaits durable enqueue and never uses memory as
   * authority; it must not be represented as atomic with RuntimeCore memory.
   */
  async execute<T>(params: ExecuteParams<T>): Promise<ExecuteResult<T>> {
    const { user, action, scope, gates, bankOutbox, fn } = params;

    this.assertPermission(user, action);
    this.assertObjectScope(user, action, scope);
    if (gates) this.assertStateGates(action, gates);

    let outboxId: string | undefined;
    if (bankOutbox) {
      const entry = await this.outbox.enqueue({
        type: bankOutbox.type,
        dealId: scope.objectId,
        payload: bankOutbox.payload,
        triggeredByUserId: user.id,
        idempotencyKey: bankOutbox.idempotencyKey,
      });
      outboxId = entry.id;
    }

    const result = await fn();

    const auditEntry = this.audit.log({
      action,
      entityType: scope.objectType,
      entityId: scope.objectId,
      actorUserId: user.id,
      meta: { outboxId },
    });

    return { result, auditId: auditEntry.id, outboxId };
  }
}
