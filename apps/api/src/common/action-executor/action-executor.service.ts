import { ForbiddenException, Injectable } from '@nestjs/common';
import { RequestUser, Role } from '../types/request-user';
import { DomainAction, ROLE_ALLOWED_ACTIONS } from './action-policy';
import { AuditService } from '../../modules/audit/audit.service';
import { OutboxService } from '../outbox/outbox.service';

export interface StateGates {
  dealStatus?: string;
  allowedFromStatuses?: string[];
  documentsComplete?: boolean;
  disputeOpen?: boolean;
  reserveConfirmed?: boolean;
}

export interface ObjectScope {
  objectType: string;
  objectId: string;
  ownerOrgId?: string;
  counterpartyOrgId?: string;
  assignedDriverUserId?: string;
}

export interface ExecuteParams<T> {
  user: RequestUser;
  action: DomainAction;
  scope: ObjectScope;
  gates?: StateGates;
  /** Durable command envelope; enqueue failure aborts the action pipeline. */
  bankOutbox?: {
    type: string;
    payload: unknown;
    idempotencyKey: string;
    correlationId?: string;
    maxRetries?: number;
  };
  fn: () => T | Promise<T>;
}

export interface ExecuteResult<T> {
  result: T;
  auditId: string;
  outboxId?: string;
}

const PRIVILEGED: Set<Role> = new Set([Role.ADMIN, Role.SUPPORT_MANAGER]);

@Injectable()
export class ActionExecutorService {
  constructor(
    private readonly audit: AuditService,
    private readonly outbox: OutboxService,
  ) {}

  assertPermission(user: RequestUser, action: DomainAction): void {
    const allowed = ROLE_ALLOWED_ACTIONS[user.role];
    if (!allowed?.has(action)) {
      this.audit.log({
        action: `DENY.permission:${action}`,
        entityType: 'access',
        entityId: user.id,
        actorUserId: user.id,
        meta: { reason: 'role_not_allowed', role: user.role },
      });
      throw new ForbiddenException(`Role ${user.role} cannot perform ${action}`);
    }
  }

  assertObjectScope(user: RequestUser, action: DomainAction, scope: ObjectScope): void {
    if (PRIVILEGED.has(user.role)) return;

    if (user.role === Role.EXECUTIVE) {
      const readOnly: DomainAction[] = ['deal.view', 'document.view', 'shipment.view', 'lot.view'];
      if (!readOnly.includes(action)) {
        this.audit.log({
          action: `DENY.executive-mutation:${action}`,
          entityType: scope.objectType,
          entityId: scope.objectId,
          actorUserId: user.id,
          meta: { reason: 'executive_readonly' },
        });
        throw new ForbiddenException('Executive role is read-only');
      }
      return;
    }

    if (user.role === Role.DRIVER && scope.objectType === 'shipment') {
      if (scope.assignedDriverUserId && scope.assignedDriverUserId !== user.id) {
        this.audit.log({
          action: `DENY.driver-isolation:${action}`,
          entityType: scope.objectType,
          entityId: scope.objectId,
          actorUserId: user.id,
          meta: { reason: 'driver_isolation', assignedDriverUserId: scope.assignedDriverUserId },
        });
        throw new ForbiddenException('Driver can only access own assigned shipment');
      }
      return;
    }

    if (user.role === Role.FARMER || user.role === Role.BUYER) {
      const userIsParty = scope.ownerOrgId === user.orgId || scope.counterpartyOrgId === user.orgId;
      if (scope.ownerOrgId && !userIsParty) {
        this.audit.log({
          action: `DENY.cross-org:${action}`,
          entityType: scope.objectType,
          entityId: scope.objectId,
          actorUserId: user.id,
          meta: { reason: 'cross_org', userOrgId: user.orgId, ownerOrgId: scope.ownerOrgId },
        });
        throw new ForbiddenException(
          `Cross-organization access denied for ${scope.objectType}:${scope.objectId}`,
        );
      }
    }
  }

  assertStateGates(action: DomainAction, gates: StateGates): void {
    if (gates.disputeOpen) {
      throw new ForbiddenException(`Action ${action} is blocked: active dispute must be resolved first`);
    }
    if (
      gates.allowedFromStatuses
      && gates.dealStatus
      && !gates.allowedFromStatuses.includes(gates.dealStatus)
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
        correlationId: bankOutbox.correlationId,
        maxRetries: bankOutbox.maxRetries,
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
