import { ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { FORBIDDEN_STAFF_ACTIONS } from '../../modules/staff-access/staff-access.types';

/**
 * Central server-side authorization decision point.
 *
 * Business RBAC, tenant attributes and a verified staff access context are
 * evaluated together. No business role receives an implicit global bypass.
 */
export interface PolicyInput {
  action: string;
  user: {
    id: string;
    role: string;
    organizationId?: string;
    tenantId?: string;
    mfaVerified?: boolean;
  };
  resource: {
    type: string;
    id?: string;
    tenantId?: string;
    organizationId?: string;
    sellerOrgId?: string;
    buyerOrgId?: string;
    ownerOrgId?: string;
    assignedArbitratorId?: string;
    assignedDriverId?: string;
    requiresMfa?: boolean;
    amountKopecks?: number;
  };
  staffAccess?: {
    actorUserId: string;
    accessMode: string;
    permissions: string[];
    effectiveTenantId?: string | null;
    effectiveOrganizationId?: string | null;
    effectiveUserId?: string | null;
    expiresAt: string | Date;
  };
  context?: {
    ip?: string;
    timestamp?: string;
  };
}

export interface PolicyResult {
  allowed: boolean;
  matchedPolicy: string;
  reasons: string[];
}

const MFA_REQUIRED_AMOUNT_KOPECKS = 10_000_000;
const STAFF_READ_ONLY_MODES = new Set(['VIEW_AS']);

function ownsDealOrg(input: PolicyInput): boolean {
  const orgId = input.user.organizationId;
  if (!orgId) return false;
  return [input.resource.sellerOrgId, input.resource.buyerOrgId, input.resource.ownerOrgId].includes(orgId);
}

function isReadAction(action: string): boolean {
  return action.endsWith(':read') || action.endsWith(':list') || action.endsWith(':aggregate:read') || action === 'cabinet:view-as';
}

function staffScopeMatches(input: PolicyInput): boolean {
  const access = input.staffAccess;
  if (!access) return false;
  if (access.actorUserId !== input.user.id) return false;
  const expiresAt = new Date(access.expiresAt).getTime();
  if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) return false;
  if (access.effectiveTenantId && input.resource.tenantId && access.effectiveTenantId !== input.resource.tenantId) return false;
  if (
    access.effectiveOrganizationId
    && input.resource.organizationId
    && access.effectiveOrganizationId !== input.resource.organizationId
  ) return false;
  return true;
}

@Injectable()
export class PolicyEngineService {
  private readonly logger = new Logger(PolicyEngineService.name);

  evaluate(input: PolicyInput): PolicyResult {
    const deny = this.deny(input);
    if (deny) return this.result(false, deny.policy, deny.reason, input);

    const allow = this.allow(input);
    if (allow) return this.result(true, allow.policy, allow.reason, input);

    return this.result(false, 'default-deny', 'Нет применимого разрешающего правила', input);
  }

  assertAllowed(input: PolicyInput): void {
    const result = this.evaluate(input);
    if (!result.allowed) throw new ForbiddenException(result.reasons[0] ?? 'Доступ запрещён');
  }

  private deny(input: PolicyInput): { policy: string; reason: string } | null {
    if (input.user.role === 'GUEST') {
      return { policy: 'deny.guest.all', reason: 'GUEST не имеет доступа к защищённым ресурсам' };
    }

    if (input.staffAccess) {
      if (!staffScopeMatches(input)) {
        return { policy: 'deny.staff.invalid-or-cross-scope', reason: 'Staff access session is expired, invalid or outside its target scope' };
      }
      if (FORBIDDEN_STAFF_ACTIONS.has(input.action)) {
        return { policy: 'deny.staff.authoritative-action', reason: 'Действие должен выполнить авторитетный участник сделки или проверенный внешний callback' };
      }
      if (STAFF_READ_ONLY_MODES.has(input.staffAccess.accessMode) && !isReadAction(input.action)) {
        return { policy: 'deny.staff.view-as-write', reason: 'VIEW_AS разрешает только чтение' };
      }
      if (!input.staffAccess.permissions.includes(input.action)) {
        return { policy: 'deny.staff.permission-missing', reason: `Staff grant does not contain ${input.action}` };
      }
    }

    if (
      ['payment:release', 'payment:reserve'].includes(input.action)
      && input.user.mfaVerified === false
      && (input.resource.amountKopecks ?? 0) >= MFA_REQUIRED_AMOUNT_KOPECKS
    ) {
      return { policy: 'deny.financial.no-mfa', reason: 'Финансовые операции от 100 000 ₽ требуют MFA' };
    }

    if (input.action === 'document:sign' && input.user.mfaVerified === false) {
      return { policy: 'deny.document.sign.no-mfa', reason: 'Подписание документов требует MFA' };
    }

    if (
      input.user.role === 'DRIVER'
      && ['payment:release', 'payment:reserve', 'deal:settle'].includes(input.action)
    ) {
      return { policy: 'deny.driver.financial-transition', reason: 'Водитель не может инициировать финансовые переходы' };
    }

    if (
      input.action === 'deal:read'
      && !input.staffAccess
      && !ownsDealOrg(input)
      && !['COMPLIANCE_OFFICER'].includes(input.user.role)
    ) {
      return { policy: 'deny.deal.cross-org-read', reason: 'Пользователь не может читать сделки чужой организации' };
    }

    if (
      input.user.role === 'ARBITRATOR'
      && input.action === 'dispute:read'
      && input.resource.assignedArbitratorId
      && input.resource.assignedArbitratorId !== input.user.id
    ) {
      return { policy: 'deny.dispute.not-assigned-arbitrator', reason: 'Арбитр видит только назначенные ему споры' };
    }

    if (
      input.user.role === 'EXECUTIVE'
      && input.resource.type === 'payment'
      && input.action !== 'payment:aggregate:read'
    ) {
      return { policy: 'deny.executive.raw-payment', reason: 'EXECUTIVE видит только агрегированные финансовые показатели' };
    }

    return null;
  }

  private allow(input: PolicyInput): { policy: string; reason: string } | null {
    if (input.staffAccess && staffScopeMatches(input) && input.staffAccess.permissions.includes(input.action)) {
      return { policy: 'allow.staff.scoped-grant', reason: 'Разрешено активным time-bound staff grant' };
    }

    if (input.action === 'deal:read' && ownsDealOrg(input)) {
      return { policy: 'allow.deal.own-org', reason: 'Организация является участником сделки' };
    }

    if (input.user.role === 'COMPLIANCE_OFFICER' && isReadAction(input.action)) {
      return { policy: 'allow.compliance.read', reason: 'Compliance имеет явный read-доступ' };
    }

    if (
      input.user.role === 'ARBITRATOR'
      && input.resource.type === 'dispute'
      && input.resource.assignedArbitratorId === input.user.id
      && ['dispute:read', 'dispute:decide'].includes(input.action)
    ) {
      return { policy: 'allow.arbitrator.assigned', reason: 'Арбитр назначен на этот спор' };
    }

    if (
      input.user.role === 'EXECUTIVE'
      && (input.action.endsWith(':aggregate:read') || (isReadAction(input.action) && input.resource.type !== 'payment'))
    ) {
      return { policy: 'allow.executive.aggregate', reason: 'EXECUTIVE разрешены агрегаты и нефинансовое чтение' };
    }

    if (
      input.user.role === 'FARMER'
      && input.resource.type === 'lot'
      && input.resource.ownerOrgId === input.user.organizationId
      && ['lot:read', 'lot:write'].includes(input.action)
    ) {
      return { policy: 'allow.farmer.own-lot', reason: 'Фермер управляет лотом своей организации' };
    }

    if (input.user.role === 'BUYER' && input.resource.type === 'lot' && input.action === 'lot:read') {
      return { policy: 'allow.buyer.lot-read', reason: 'Покупателю разрешён просмотр опубликованных лотов' };
    }

    if (
      input.user.role === 'LAB'
      && ['lab_sample', 'lab_test'].includes(input.resource.type)
      && ['lab:read', 'lab:write', 'lab:sign'].includes(input.action)
    ) {
      return { policy: 'allow.lab.assigned-work', reason: 'Лабораторная роль выполняет лабораторный workflow' };
    }

    if (
      input.user.role === 'DRIVER'
      && input.resource.type === 'shipment'
      && input.resource.assignedDriverId === input.user.id
      && ['shipment:read', 'shipment:update'].includes(input.action)
    ) {
      return { policy: 'allow.driver.own-shipment', reason: 'Водитель назначен на рейс' };
    }

    if (
      input.user.role === 'ELEVATOR'
      && input.resource.type === 'acceptance_act'
      && ['acceptance:read', 'acceptance:write', 'acceptance:sign'].includes(input.action)
    ) {
      return { policy: 'allow.elevator.acceptance', reason: 'Элеватор выполняет приёмку' };
    }

    if (
      input.user.role === 'ACCOUNTING'
      && ['payment:read', 'payment:aggregate:read', 'ledger:read', 'deal:read'].includes(input.action)
    ) {
      return { policy: 'allow.accounting.read', reason: 'Бухгалтерии разрешено явное финансовое чтение' };
    }

    if (
      input.user.role === 'ADMIN'
      && ['admin:system:read', 'admin:user:read', 'admin:health:read'].includes(input.action)
    ) {
      return { policy: 'allow.legacy-admin-explicit-read', reason: 'Legacy ADMIN has only explicitly listed read authority' };
    }

    if (
      input.user.role === 'SUPPORT_MANAGER'
      && ['support-case:read', 'support-case:update'].includes(input.action)
    ) {
      return { policy: 'allow.legacy-support-case', reason: 'Legacy support role is limited to support cases' };
    }

    return null;
  }

  private result(allowed: boolean, matchedPolicy: string, reason: string, input: PolicyInput): PolicyResult {
    this.logger.debug(`Policy ${allowed ? 'ALLOW' : 'DENY'}: rule=${matchedPolicy} action=${input.action} user=${input.user.id}`);
    return { allowed, matchedPolicy, reasons: [reason] };
  }

  listRules(): Array<{ name: string; effect: string; reason: string }> {
    return [
      { name: 'deny.staff.authoritative-action', effect: 'deny', reason: 'Staff cannot replace authoritative business actors' },
      { name: 'deny.staff.view-as-write', effect: 'deny', reason: 'View-as is read-only' },
      { name: 'deny.staff.invalid-or-cross-scope', effect: 'deny', reason: 'Staff grant must be active and resource-scoped' },
      { name: 'allow.staff.scoped-grant', effect: 'allow', reason: 'Explicit permission in an active scoped grant' },
      { name: 'default-deny', effect: 'deny', reason: 'No implicit role bypass' },
    ];
  }
}
