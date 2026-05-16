import type { PlatformV7Role } from './role-access';
import type { PlatformV7StateEntity, PlatformV7TransitionGuard } from './state-transition-contracts';

export type PlatformV7ExecutionCommandId =
  | 'submit_lot_readiness'
  | 'publish_lot'
  | 'submit_rfq'
  | 'submit_proposal'
  | 'accept_proposal'
  | 'confirm_deal_terms'
  | 'request_money_reserve'
  | 'confirm_money_reserved'
  | 'mark_document_uploaded'
  | 'accept_document'
  | 'assign_driver'
  | 'mark_trip_arrived'
  | 'accept_trip'
  | 'open_incident'
  | 'open_dispute'
  | 'resolve_dispute'
  | 'mark_money_ready_to_release'
  | 'confirm_money_released';

export type PlatformV7ExecutionCommandContract = {
  readonly id: PlatformV7ExecutionCommandId;
  readonly label: string;
  readonly actorRoles: readonly PlatformV7Role[];
  readonly entity: PlatformV7StateEntity;
  readonly from: string;
  readonly to: string;
  readonly guard: PlatformV7TransitionGuard;
  readonly requiresDealId: boolean;
  readonly requiresAuditEvent: boolean;
  readonly requiresIdempotencyKey: boolean;
  readonly affectsMoney: boolean;
  readonly persistenceEntity: string;
  readonly summary: string;
};

export const PLATFORM_V7_EXECUTION_COMMANDS: readonly PlatformV7ExecutionCommandContract[] = [
  {
    id: 'submit_lot_readiness',
    label: 'Передать партию на проверку готовности',
    actorRoles: ['seller', 'operator'],
    entity: 'lot',
    from: 'draft',
    to: 'readiness_review',
    guard: 'readiness_required',
    requiresDealId: false,
    requiresAuditEvent: true,
    requiresIdempotencyKey: true,
    affectsMoney: false,
    persistenceEntity: 'market_lot',
    summary: 'Seller-side lot cannot move toward publication without readiness review boundary.',
  },
  {
    id: 'publish_lot',
    label: 'Опубликовать лот',
    actorRoles: ['seller', 'operator'],
    entity: 'lot',
    from: 'readiness_review',
    to: 'published',
    guard: 'documents_required',
    requiresDealId: false,
    requiresAuditEvent: true,
    requiresIdempotencyKey: true,
    affectsMoney: false,
    persistenceEntity: 'market_lot',
    summary: 'Publication requires readiness, quality and document boundary before market visibility.',
  },
  {
    id: 'submit_rfq',
    label: 'Опубликовать закупочный запрос',
    actorRoles: ['buyer', 'operator'],
    entity: 'rfq',
    from: 'draft',
    to: 'published',
    guard: 'readiness_required',
    requiresDealId: false,
    requiresAuditEvent: true,
    requiresIdempotencyKey: true,
    affectsMoney: false,
    persistenceEntity: 'buyer_rfq',
    summary: 'Buyer demand becomes visible only with defined quality, volume, basis and documents.',
  },
  {
    id: 'submit_proposal',
    label: 'Подать предложение',
    actorRoles: ['seller', 'buyer'],
    entity: 'proposal',
    from: 'submitted',
    to: 'under_review',
    guard: 'counterparty_required',
    requiresDealId: false,
    requiresAuditEvent: true,
    requiresIdempotencyKey: true,
    affectsMoney: false,
    persistenceEntity: 'proposal',
    summary: 'Proposal enters review before acceptance and deal creation.',
  },
  {
    id: 'accept_proposal',
    label: 'Принять предложение',
    actorRoles: ['seller', 'buyer'],
    entity: 'proposal',
    from: 'under_review',
    to: 'accepted',
    guard: 'counterparty_required',
    requiresDealId: false,
    requiresAuditEvent: true,
    requiresIdempotencyKey: true,
    affectsMoney: false,
    persistenceEntity: 'proposal',
    summary: 'Accepted proposal is the last commercial boundary before deal container creation.',
  },
  {
    id: 'confirm_deal_terms',
    label: 'Подтвердить условия сделки',
    actorRoles: ['seller', 'buyer', 'operator'],
    entity: 'deal',
    from: 'draft',
    to: 'terms_confirmed',
    guard: 'counterparty_required',
    requiresDealId: true,
    requiresAuditEvent: true,
    requiresIdempotencyKey: true,
    affectsMoney: false,
    persistenceEntity: 'deal',
    summary: 'Deal terms must be confirmed by linked sides before money reserve request.',
  },
  {
    id: 'request_money_reserve',
    label: 'Запросить резерв денег',
    actorRoles: ['buyer', 'operator'],
    entity: 'money',
    from: 'not_requested',
    to: 'reserve_requested',
    guard: 'deal_required',
    requiresDealId: true,
    requiresAuditEvent: true,
    requiresIdempotencyKey: true,
    affectsMoney: true,
    persistenceEntity: 'money_record',
    summary: 'Reserve request is money-sensitive and must be deal-bound and repeat-safe.',
  },
  {
    id: 'confirm_money_reserved',
    label: 'Подтвердить резерв денег',
    actorRoles: ['bank'],
    entity: 'money',
    from: 'reserve_requested',
    to: 'reserved',
    guard: 'external_confirmation_required',
    requiresDealId: true,
    requiresAuditEvent: true,
    requiresIdempotencyKey: true,
    affectsMoney: true,
    persistenceEntity: 'money_record',
    summary: 'Reserved state requires bank-side confirmation boundary; platform does not self-confirm money.',
  },
  {
    id: 'mark_document_uploaded',
    label: 'Загрузить документ',
    actorRoles: ['seller', 'buyer', 'elevator', 'lab', 'surveyor', 'logistics'],
    entity: 'document',
    from: 'requested',
    to: 'uploaded',
    guard: 'none',
    requiresDealId: true,
    requiresAuditEvent: true,
    requiresIdempotencyKey: true,
    affectsMoney: false,
    persistenceEntity: 'document_record',
    summary: 'Uploaded document remains unconfirmed until review or external confirmation boundary.',
  },
  {
    id: 'accept_document',
    label: 'Принять документ',
    actorRoles: ['operator', 'compliance'],
    entity: 'document',
    from: 'under_review',
    to: 'accepted',
    guard: 'external_confirmation_required',
    requiresDealId: true,
    requiresAuditEvent: true,
    requiresIdempotencyKey: true,
    affectsMoney: true,
    persistenceEntity: 'document_record',
    summary: 'Accepted document may influence money only with explicit confirmation boundary.',
  },
  {
    id: 'assign_driver',
    label: 'Назначить водителя',
    actorRoles: ['logistics', 'operator'],
    entity: 'trip',
    from: 'planned',
    to: 'driver_assigned',
    guard: 'counterparty_required',
    requiresDealId: true,
    requiresAuditEvent: true,
    requiresIdempotencyKey: true,
    affectsMoney: false,
    persistenceEntity: 'trip',
    summary: 'Driver assignment requires linked logistics order and actor boundary.',
  },
  {
    id: 'mark_trip_arrived',
    label: 'Отметить прибытие',
    actorRoles: ['driver'],
    entity: 'trip',
    from: 'in_transit',
    to: 'arrived',
    guard: 'none',
    requiresDealId: true,
    requiresAuditEvent: true,
    requiresIdempotencyKey: true,
    affectsMoney: false,
    persistenceEntity: 'trip',
    summary: 'Arrival is a field command that must create an auditable trip event.',
  },
  {
    id: 'accept_trip',
    label: 'Принять рейс',
    actorRoles: ['elevator', 'surveyor', 'operator'],
    entity: 'trip',
    from: 'arrived',
    to: 'accepted',
    guard: 'documents_required',
    requiresDealId: true,
    requiresAuditEvent: true,
    requiresIdempotencyKey: true,
    affectsMoney: true,
    persistenceEntity: 'trip',
    summary: 'Accepted trip can affect money only with receiving, weight and evidence records.',
  },
  {
    id: 'open_incident',
    label: 'Открыть инцидент',
    actorRoles: ['driver', 'logistics', 'operator'],
    entity: 'trip',
    from: 'arrived',
    to: 'incident_opened',
    guard: 'evidence_required',
    requiresDealId: true,
    requiresAuditEvent: true,
    requiresIdempotencyKey: true,
    affectsMoney: true,
    persistenceEntity: 'trip',
    summary: 'Incident is evidence-bound and may block acceptance or money decision.',
  },
  {
    id: 'open_dispute',
    label: 'Открыть спор',
    actorRoles: ['seller', 'buyer', 'operator'],
    entity: 'dispute',
    from: 'draft',
    to: 'opened',
    guard: 'evidence_required',
    requiresDealId: true,
    requiresAuditEvent: true,
    requiresIdempotencyKey: true,
    affectsMoney: true,
    persistenceEntity: 'dispute',
    summary: 'Dispute opening requires evidence and freezes relevant money decision path.',
  },
  {
    id: 'resolve_dispute',
    label: 'Закрыть спор решением',
    actorRoles: ['arbitrator', 'bank', 'operator'],
    entity: 'dispute',
    from: 'decision_ready',
    to: 'resolved',
    guard: 'decision_required',
    requiresDealId: true,
    requiresAuditEvent: true,
    requiresIdempotencyKey: true,
    affectsMoney: true,
    persistenceEntity: 'dispute',
    summary: 'Dispute resolution must point to decision, money impact and audit event.',
  },
  {
    id: 'mark_money_ready_to_release',
    label: 'Передать основание банку',
    actorRoles: ['bank', 'operator'],
    entity: 'money',
    from: 'reserved',
    to: 'ready_to_release',
    guard: 'documents_required',
    requiresDealId: true,
    requiresAuditEvent: true,
    requiresIdempotencyKey: true,
    affectsMoney: true,
    persistenceEntity: 'money_record',
    summary: 'Money basis can move to bank confirmation only after document and acceptance evidence boundaries.',
  },
  {
    id: 'confirm_money_released',
    label: 'Подтвердить банковское решение',
    actorRoles: ['bank'],
    entity: 'money',
    from: 'ready_to_release',
    to: 'released',
    guard: 'external_confirmation_required',
    requiresDealId: true,
    requiresAuditEvent: true,
    requiresIdempotencyKey: true,
    affectsMoney: true,
    persistenceEntity: 'money_record',
    summary: 'Bank confirmation is required; platform only records the confirmed boundary.',
  },
];

export function getPlatformV7ExecutionCommand(id: PlatformV7ExecutionCommandId) {
  return PLATFORM_V7_EXECUTION_COMMANDS.find((command) => command.id === id);
}

export function getPlatformV7ExecutionCommandsForRole(role: PlatformV7Role) {
  return PLATFORM_V7_EXECUTION_COMMANDS.filter((command) => command.actorRoles.includes(role));
}

export function getPlatformV7ExecutionCommandsForEntity(entity: PlatformV7StateEntity) {
  return PLATFORM_V7_EXECUTION_COMMANDS.filter((command) => command.entity === entity);
}

export function canPlatformV7RoleRunCommand(role: PlatformV7Role, id: PlatformV7ExecutionCommandId): boolean {
  return getPlatformV7ExecutionCommand(id)?.actorRoles.includes(role) === true;
}

export function getPlatformV7MoneyAffectingExecutionCommands() {
  return PLATFORM_V7_EXECUTION_COMMANDS.filter((command) => command.affectsMoney);
}

export function getPlatformV7ExecutionCommandReadinessSummary() {
  const moneyAffecting = getPlatformV7MoneyAffectingExecutionCommands();
  const requiringDealId = PLATFORM_V7_EXECUTION_COMMANDS.filter((command) => command.requiresDealId);
  const requiringAudit = PLATFORM_V7_EXECUTION_COMMANDS.filter((command) => command.requiresAuditEvent);
  const requiringIdempotency = PLATFORM_V7_EXECUTION_COMMANDS.filter((command) => command.requiresIdempotencyKey);

  return {
    total: PLATFORM_V7_EXECUTION_COMMANDS.length,
    moneyAffecting: moneyAffecting.length,
    requiringDealId: requiringDealId.length,
    requiringAudit: requiringAudit.length,
    requiringIdempotency: requiringIdempotency.length,
    mode: 'contract_only_requires_action_runtime' as const,
  };
}
