import { ForbiddenException, Injectable } from '@nestjs/common';
import { RequestUser, Role } from '../types/request-user';
import { DomainAction, ROLE_ALLOWED_ACTIONS } from './action-policy';
import { AuditService } from '../../modules/audit/audit.service';
import { OutboxService } from '../outbox/outbox.service';

export interface StateGates {
  /** Current deal status */
  dealStatus?: string;
  /** The statuses from which this action is allowed */
  allowedFromStatuses?: string[];
  /** Whether required documents are complete — false blocks release actions */
  documentsComplete?: boolean;
  /** Whether an active dispute exists — blocks money release */
  disputeOpen?: boolean;
  /** Whether bank reserve has been confirmed */
  reserveConfirmed?: boolean;
}

export interface ObjectScope {
  objectType: string;
  objectId: string;
  /** For deal: seller or buyer orgId to check org-scope access */
  ownerOrgId?: string;
  /** Secondary party's orgId (e.g. buyer in a seller-owned deal) */
  counterpartyOrgId?: string;
  /** For shipment: the driver userId assigned */
  assignedDriverUserId?: string;
}

export interface ExecuteParams<T> {
  user: RequestUser;
  action: DomainAction;
  scope: ObjectScope;
  gates?: StateGates;
  /** If set, an outbox entry is created instead of calling the bank directly */
  bankOutbox?: { type: string; payload: any };
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

  /**
   * Check that the role is allowed to perform action.
   * Throws ForbiddenException with audit entry on deny.
   */
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

  /**
   * Check object-level scope: org isolation, driver isolation, EXECUTIVE read-only.
   */
  assertObjectScope(user: RequestUser, action: DomainAction, scope: ObjectScope): void {
    if (PRIVILEGED.has(user.role)) return;

    // EXECUTIVE is always read-only regardless of role-allowed-actions
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

    // DRIVER: can only access their own assigned shipment
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

    // Org-scope: FARMER and BUYER can only access deals their org is party to
    if (user.role === Role.FARMER || user.role === Role.BUYER) {
      const userIsParty =
        scope.ownerOrgId === user.orgId || scope.counterpartyOrgId === user.orgId;
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

  /**
   * Check business state gates.
   * Throws ForbiddenException with a clear reason when a gate blocks the action.
   */
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
   * Full execution pipeline: permission → object scope → state gates → outbox → fn → audit.
   */
  async execute<T>(params: ExecuteParams<T>): Promise<ExecuteResult<T>> {
    const { user, action, scope, gates, bankOutbox, fn } = params;

    this.assertPermission(user, action);
    this.assertObjectScope(user, action, scope);
    if (gates) this.assertStateGates(action, gates);

    let outboxId: string | undefined;
    if (bankOutbox) {
      const entry = this.outbox.enqueue({
        type: bankOutbox.type,
        dealId: scope.objectId,
        payload: bankOutbox.payload,
        triggeredByUserId: user.id,
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
