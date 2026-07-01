import { Injectable, Logger } from '@nestjs/common';

/**
 * In-process ABAC Policy Engine per ТЗ 5.2.
 * Evaluates named policies in rule priority order.
 * Deny rules always override allow rules (deny-overrides strategy).
 */

export interface PolicyInput {
  action: string;
  user: {
    id: string;
    role: string;
    organizationId?: string;
    mfaVerified?: boolean;
  };
  resource: {
    type: string;
    id?: string;
    sellerOrgId?: string;
    buyerOrgId?: string;
    ownerOrgId?: string;
    assignedArbitratorId?: string;
    requiresMfa?: boolean;
    amountKopecks?: number;
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

interface PolicyRule {
  name: string;
  effect: 'allow' | 'deny';
  evaluate(input: PolicyInput): boolean;
  reason: string;
}

const MFA_REQUIRED_AMOUNT_KOPECKS = 100_000_00; // 100 000 ₽

function ownsDealOrg(i: PolicyInput): boolean {
  const orgId = i.user.organizationId;
  if (!orgId) return false;
  return i.resource.sellerOrgId === orgId || i.resource.buyerOrgId === orgId || i.resource.ownerOrgId === orgId;
}

const RULES: PolicyRule[] = [
  // ─── DENY rules (highest priority) ───────────────────────────────────────

  {
    name: 'deny.guest.all',
    effect: 'deny',
    reason: 'GUEST не имеет доступа к защищённым ресурсам',
    evaluate: (i) => i.user.role === 'GUEST',
  },

  {
    name: 'deny.deal.cross-org-read',
    effect: 'deny',
    reason: 'Пользователь не может читать сделки чужой организации',
    evaluate: (i) =>
      i.action === 'deal:read' &&
      !['ADMIN', 'SUPPORT_MANAGER', 'COMPLIANCE_OFFICER', 'ARBITRATOR', 'EXECUTIVE'].includes(i.user.role) &&
      !ownsDealOrg(i),
  },

  {
    name: 'deny.dispute.not-assigned-arbitrator',
    effect: 'deny',
    reason: 'Арбитр видит только назначенные ему дела',
    evaluate: (i) =>
      i.action === 'dispute:read' &&
      i.user.role === 'ARBITRATOR' &&
      !!i.resource.assignedArbitratorId &&
      i.resource.assignedArbitratorId !== i.user.id,
  },

  {
    name: 'deny.executive.raw-payment',
    effect: 'deny',
    reason: 'EXECUTIVE не может читать сырые платёжные данные — только агрегаты',
    evaluate: (i) =>
      i.user.role === 'EXECUTIVE' &&
      i.resource.type === 'payment' &&
      i.action !== 'payment:aggregate:read',
  },

  {
    name: 'deny.financial.no-mfa',
    effect: 'deny',
    reason: 'Финансовые операции > 100 000 ₽ требуют MFA',
    evaluate: (i) =>
      (i.action === 'payment:release' || i.action === 'payment:reserve') &&
      i.user.mfaVerified === false &&
      (i.resource.amountKopecks ?? 0) >= MFA_REQUIRED_AMOUNT_KOPECKS,
  },

  {
    name: 'deny.admin-cockpit.no-mfa',
    effect: 'deny',
    reason: 'Admin / Compliance / Arbitrator — MFA обязателен',
    evaluate: (i) =>
      ['ADMIN', 'COMPLIANCE_OFFICER', 'ARBITRATOR'].includes(i.user.role) &&
      i.user.mfaVerified === false &&
      i.action.startsWith('admin:'),
  },

  {
    name: 'deny.document.sign.no-mfa',
    effect: 'deny',
    reason: 'Подписание документов УКЭП требует MFA',
    evaluate: (i) => i.action === 'document:sign' && i.user.mfaVerified === false,
  },

  {
    name: 'deny.driver.financial-transition',
    effect: 'deny',
    reason: 'Водитель не может инициировать финансовые переходы',
    evaluate: (i) =>
      i.user.role === 'DRIVER' &&
      ['payment:release', 'payment:reserve', 'deal:settle'].includes(i.action),
  },

  // ─── ALLOW rules ──────────────────────────────────────────────────────────

  {
    name: 'allow.admin.all',
    effect: 'allow',
    reason: 'ADMIN имеет полный доступ',
    evaluate: (i) => i.user.role === 'ADMIN',
  },

  {
    name: 'allow.deal.own-org',
    effect: 'allow',
    reason: 'Пользователь может читать сделки своей организации',
    evaluate: (i) => i.action === 'deal:read' && ownsDealOrg(i),
  },

  {
    name: 'allow.support.read-any-deal',
    effect: 'allow',
    reason: 'Support Manager может читать любую сделку (только чтение)',
    evaluate: (i) => i.user.role === 'SUPPORT_MANAGER' && i.action.endsWith(':read'),
  },

  {
    name: 'allow.compliance.all-read',
    effect: 'allow',
    reason: 'Compliance Officer имеет полный read-доступ',
    evaluate: (i) => i.user.role === 'COMPLIANCE_OFFICER' && i.action.endsWith(':read'),
  },

  {
    name: 'allow.arbitrator.assigned-dispute',
    effect: 'allow',
    reason: 'Арбитр может читать назначенные ему дела',
    evaluate: (i) =>
      i.user.role === 'ARBITRATOR' &&
      i.resource.type === 'dispute' &&
      i.resource.assignedArbitratorId === i.user.id,
  },

  {
    name: 'allow.executive.aggregate',
    effect: 'allow',
    reason: 'EXECUTIVE может читать агрегированные данные',
    evaluate: (i) =>
      i.user.role === 'EXECUTIVE' &&
      (i.action.endsWith(':aggregate:read') || i.action.endsWith(':read')) &&
      i.resource.type !== 'payment',
  },

  {
    name: 'allow.farmer.own-lots',
    effect: 'allow',
    reason: 'Фермер может управлять своими лотами',
    evaluate: (i) =>
      i.user.role === 'FARMER' &&
      i.resource.type === 'lot' &&
      !!i.user.organizationId &&
      i.resource.ownerOrgId === i.user.organizationId,
  },

  {
    name: 'allow.buyer.read-published-lots',
    effect: 'allow',
    reason: 'Покупатель может читать опубликованные лоты',
    evaluate: (i) =>
      i.user.role === 'BUYER' &&
      i.resource.type === 'lot' &&
      i.action === 'lot:read',
  },

  {
    name: 'allow.lab.lab-actions',
    effect: 'allow',
    reason: 'Лаборант может выполнять лабораторные операции',
    evaluate: (i) =>
      i.user.role === 'LAB' &&
      (i.resource.type === 'lab_sample' || i.resource.type === 'lab_test') &&
      ['lab:read', 'lab:write', 'lab:sign'].includes(i.action),
  },

  {
    name: 'allow.driver.own-shipment',
    effect: 'allow',
    reason: 'Водитель может читать/обновлять свои рейсы',
    evaluate: (i) =>
      i.user.role === 'DRIVER' &&
      i.resource.type === 'shipment' &&
      (i.action === 'shipment:read' || i.action === 'shipment:update'),
  },

  {
    name: 'allow.elevator.acceptance',
    effect: 'allow',
    reason: 'Оператор элеватора может выполнять приёмку грузов',
    evaluate: (i) =>
      i.user.role === 'ELEVATOR' &&
      i.resource.type === 'acceptance_act' &&
      ['acceptance:read', 'acceptance:write', 'acceptance:sign'].includes(i.action),
  },

  {
    name: 'allow.accounting.financial-read',
    effect: 'allow',
    reason: 'Бухгалтер может читать финансовые данные',
    evaluate: (i) =>
      i.user.role === 'ACCOUNTING' &&
      ['payment:read', 'payment:aggregate:read', 'ledger:read', 'deal:read'].includes(i.action),
  },
];

@Injectable()
export class PolicyEngineService {
  private readonly logger = new Logger(PolicyEngineService.name);

  evaluate(input: PolicyInput): PolicyResult {
    const reasons: string[] = [];

    // Deny rules run first — one match blocks the request
    for (const rule of RULES.filter((r) => r.effect === 'deny')) {
      if (rule.evaluate(input)) {
        this.logger.debug(`Policy DENY: rule=${rule.name} action=${input.action} user=${input.user.id}`);
        return { allowed: false, matchedPolicy: rule.name, reasons: [rule.reason] };
      }
    }

    // Allow rules — first match grants access
    for (const rule of RULES.filter((r) => r.effect === 'allow')) {
      if (rule.evaluate(input)) {
        this.logger.debug(`Policy ALLOW: rule=${rule.name} action=${input.action} user=${input.user.id}`);
        return { allowed: true, matchedPolicy: rule.name, reasons: [rule.reason] };
      }
    }

    // Default deny
    this.logger.debug(`Policy DEFAULT-DENY: action=${input.action} user=${input.user.id} role=${input.user.role}`);
    return {
      allowed: false,
      matchedPolicy: 'default-deny',
      reasons: ['Нет применимого правила — доступ запрещён по умолчанию'],
    };
  }

  /** Convenience: throw ForbiddenException if not allowed */
  assertAllowed(input: PolicyInput): void {
    const result = this.evaluate(input);
    if (!result.allowed) {
      const { ForbiddenException } = require('@nestjs/common');
      throw new ForbiddenException(result.reasons[0] ?? 'Доступ запрещён');
    }
  }

  /** List all rules (for admin introspection) */
  listRules(): Array<{ name: string; effect: string; reason: string }> {
    return RULES.map(({ name, effect, reason }) => ({ name, effect, reason }));
  }
}
