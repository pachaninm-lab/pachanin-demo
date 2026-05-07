import type { PlatformV7ExecutionCommandId } from './execution-command-contracts';

export type PlatformV7ApiMethod = 'GET' | 'POST' | 'PATCH';

export type PlatformV7ApiBoundaryId =
  | 'list_batches'
  | 'create_batch'
  | 'publish_lot'
  | 'create_rfq'
  | 'submit_proposal'
  | 'accept_proposal'
  | 'confirm_deal_terms'
  | 'request_money_reserve'
  | 'confirm_money_reserved'
  | 'mark_money_ready_to_release'
  | 'confirm_money_released'
  | 'upload_document'
  | 'accept_document'
  | 'assign_driver'
  | 'mark_trip_arrived'
  | 'accept_trip'
  | 'open_incident'
  | 'open_dispute'
  | 'resolve_dispute'
  | 'create_support_case'
  | 'append_support_message'
  | 'read_audit_events';

export type PlatformV7ApiBoundaryContract = {
  readonly id: PlatformV7ApiBoundaryId;
  readonly method: PlatformV7ApiMethod;
  readonly path: string;
  readonly actorRoles: readonly string[];
  readonly commandId?: PlatformV7ExecutionCommandId;
  readonly requiresAuth: boolean;
  readonly requiresEntityAcl: boolean;
  readonly requiresDealId: boolean;
  readonly requiresIdempotencyKey: boolean;
  readonly writesAuditEvent: boolean;
  readonly affectsMoney: boolean;
  readonly requiresExternalConfirmation: boolean;
  readonly rateLimitScope: 'actor' | 'deal' | 'ip_actor' | 'none';
  readonly runtimeStatus: 'contract_only';
  readonly summary: string;
};

export const PLATFORM_V7_API_BOUNDARIES: readonly PlatformV7ApiBoundaryContract[] = [
  {
    id: 'list_batches',
    method: 'GET',
    path: '/api/platform-v7/batches',
    actorRoles: ['seller', 'operator'],
    requiresAuth: true,
    requiresEntityAcl: true,
    requiresDealId: false,
    requiresIdempotencyKey: false,
    writesAuditEvent: false,
    affectsMoney: false,
    requiresExternalConfirmation: false,
    rateLimitScope: 'actor',
    runtimeStatus: 'contract_only',
    summary: 'Reads seller-side grain batches through actor-scoped access control.',
  },
  {
    id: 'create_batch',
    method: 'POST',
    path: '/api/platform-v7/batches',
    actorRoles: ['seller', 'operator'],
    requiresAuth: true,
    requiresEntityAcl: true,
    requiresDealId: false,
    requiresIdempotencyKey: true,
    writesAuditEvent: true,
    affectsMoney: false,
    requiresExternalConfirmation: false,
    rateLimitScope: 'actor',
    runtimeStatus: 'contract_only',
    summary: 'Creates a batch boundary before any lot, RFQ match or deal action.',
  },
  {
    id: 'publish_lot',
    method: 'POST',
    path: '/api/platform-v7/lots/:lotId/publish',
    actorRoles: ['seller', 'operator'],
    commandId: 'publish_lot',
    requiresAuth: true,
    requiresEntityAcl: true,
    requiresDealId: false,
    requiresIdempotencyKey: true,
    writesAuditEvent: true,
    affectsMoney: false,
    requiresExternalConfirmation: false,
    rateLimitScope: 'actor',
    runtimeStatus: 'contract_only',
    summary: 'Publishes a lot only after readiness and document boundaries are satisfied.',
  },
  {
    id: 'create_rfq',
    method: 'POST',
    path: '/api/platform-v7/rfqs',
    actorRoles: ['buyer', 'operator'],
    commandId: 'submit_rfq',
    requiresAuth: true,
    requiresEntityAcl: true,
    requiresDealId: false,
    requiresIdempotencyKey: true,
    writesAuditEvent: true,
    affectsMoney: false,
    requiresExternalConfirmation: false,
    rateLimitScope: 'actor',
    runtimeStatus: 'contract_only',
    summary: 'Creates a buyer demand boundary with defined quality, volume, basis and documents.',
  },
  {
    id: 'submit_proposal',
    method: 'POST',
    path: '/api/platform-v7/proposals',
    actorRoles: ['seller', 'buyer'],
    commandId: 'submit_proposal',
    requiresAuth: true,
    requiresEntityAcl: true,
    requiresDealId: false,
    requiresIdempotencyKey: true,
    writesAuditEvent: true,
    affectsMoney: false,
    requiresExternalConfirmation: false,
    rateLimitScope: 'actor',
    runtimeStatus: 'contract_only',
    summary: 'Submits commercial terms without creating money movement.',
  },
  {
    id: 'accept_proposal',
    method: 'POST',
    path: '/api/platform-v7/proposals/:proposalId/accept',
    actorRoles: ['seller', 'buyer'],
    commandId: 'accept_proposal',
    requiresAuth: true,
    requiresEntityAcl: true,
    requiresDealId: false,
    requiresIdempotencyKey: true,
    writesAuditEvent: true,
    affectsMoney: false,
    requiresExternalConfirmation: false,
    rateLimitScope: 'actor',
    runtimeStatus: 'contract_only',
    summary: 'Accepts a proposal as the final commercial boundary before deal creation.',
  },
  {
    id: 'confirm_deal_terms',
    method: 'POST',
    path: '/api/platform-v7/deals/:dealId/confirm-terms',
    actorRoles: ['seller', 'buyer', 'operator'],
    commandId: 'confirm_deal_terms',
    requiresAuth: true,
    requiresEntityAcl: true,
    requiresDealId: true,
    requiresIdempotencyKey: true,
    writesAuditEvent: true,
    affectsMoney: false,
    requiresExternalConfirmation: false,
    rateLimitScope: 'deal',
    runtimeStatus: 'contract_only',
    summary: 'Confirms deal terms before reserve request, logistics or document gates can move forward.',
  },
  {
    id: 'request_money_reserve',
    method: 'POST',
    path: '/api/platform-v7/deals/:dealId/money/request-reserve',
    actorRoles: ['buyer', 'operator'],
    commandId: 'request_money_reserve',
    requiresAuth: true,
    requiresEntityAcl: true,
    requiresDealId: true,
    requiresIdempotencyKey: true,
    writesAuditEvent: true,
    affectsMoney: true,
    requiresExternalConfirmation: false,
    rateLimitScope: 'deal',
    runtimeStatus: 'contract_only',
    summary: 'Requests a money reserve; does not confirm that money is reserved.',
  },
  {
    id: 'confirm_money_reserved',
    method: 'POST',
    path: '/api/platform-v7/deals/:dealId/money/confirm-reserved',
    actorRoles: ['bank'],
    commandId: 'confirm_money_reserved',
    requiresAuth: true,
    requiresEntityAcl: true,
    requiresDealId: true,
    requiresIdempotencyKey: true,
    writesAuditEvent: true,
    affectsMoney: true,
    requiresExternalConfirmation: true,
    rateLimitScope: 'deal',
    runtimeStatus: 'contract_only',
    summary: 'Records bank confirmation that money is reserved; platform must not self-confirm this boundary.',
  },
  {
    id: 'mark_money_ready_to_release',
    method: 'POST',
    path: '/api/platform-v7/deals/:dealId/money/ready-to-release',
    actorRoles: ['bank', 'operator'],
    commandId: 'mark_money_ready_to_release',
    requiresAuth: true,
    requiresEntityAcl: true,
    requiresDealId: true,
    requiresIdempotencyKey: true,
    writesAuditEvent: true,
    affectsMoney: true,
    requiresExternalConfirmation: false,
    rateLimitScope: 'deal',
    runtimeStatus: 'contract_only',
    summary: 'Marks money ready for bank-side decision only after documents and acceptance evidence boundaries.',
  },
  {
    id: 'confirm_money_released',
    method: 'POST',
    path: '/api/platform-v7/deals/:dealId/money/confirm-released',
    actorRoles: ['bank'],
    commandId: 'confirm_money_released',
    requiresAuth: true,
    requiresEntityAcl: true,
    requiresDealId: true,
    requiresIdempotencyKey: true,
    writesAuditEvent: true,
    affectsMoney: true,
    requiresExternalConfirmation: true,
    rateLimitScope: 'deal',
    runtimeStatus: 'contract_only',
    summary: 'Records bank confirmation that money was released; platform does not release money by itself.',
  },
  {
    id: 'upload_document',
    method: 'POST',
    path: '/api/platform-v7/deals/:dealId/documents',
    actorRoles: ['seller', 'buyer', 'elevator', 'lab', 'surveyor', 'logistics'],
    commandId: 'mark_document_uploaded',
    requiresAuth: true,
    requiresEntityAcl: true,
    requiresDealId: true,
    requiresIdempotencyKey: true,
    writesAuditEvent: true,
    affectsMoney: false,
    requiresExternalConfirmation: false,
    rateLimitScope: 'deal',
    runtimeStatus: 'contract_only',
    summary: 'Uploads a document but keeps it unconfirmed until review or external confirmation boundary.',
  },
  {
    id: 'accept_document',
    method: 'POST',
    path: '/api/platform-v7/deals/:dealId/documents/:documentId/accept',
    actorRoles: ['operator', 'compliance'],
    commandId: 'accept_document',
    requiresAuth: true,
    requiresEntityAcl: true,
    requiresDealId: true,
    requiresIdempotencyKey: true,
    writesAuditEvent: true,
    affectsMoney: true,
    requiresExternalConfirmation: true,
    rateLimitScope: 'deal',
    runtimeStatus: 'contract_only',
    summary: 'Accepts a document only with explicit confirmation boundary because it can affect money.',
  },
  {
    id: 'assign_driver',
    method: 'POST',
    path: '/api/platform-v7/deals/:dealId/trips/:tripId/assign-driver',
    actorRoles: ['logistics', 'operator'],
    commandId: 'assign_driver',
    requiresAuth: true,
    requiresEntityAcl: true,
    requiresDealId: true,
    requiresIdempotencyKey: true,
    writesAuditEvent: true,
    affectsMoney: false,
    requiresExternalConfirmation: false,
    rateLimitScope: 'deal',
    runtimeStatus: 'contract_only',
    summary: 'Assigns a driver to a linked trip without exposing money controls to the driver role.',
  },
  {
    id: 'mark_trip_arrived',
    method: 'POST',
    path: '/api/platform-v7/deals/:dealId/trips/:tripId/arrived',
    actorRoles: ['driver'],
    commandId: 'mark_trip_arrived',
    requiresAuth: true,
    requiresEntityAcl: true,
    requiresDealId: true,
    requiresIdempotencyKey: true,
    writesAuditEvent: true,
    affectsMoney: false,
    requiresExternalConfirmation: false,
    rateLimitScope: 'deal',
    runtimeStatus: 'contract_only',
    summary: 'Records driver arrival as field evidence with audit trail and deal link.',
  },
  {
    id: 'accept_trip',
    method: 'POST',
    path: '/api/platform-v7/deals/:dealId/trips/:tripId/accept',
    actorRoles: ['elevator', 'surveyor', 'operator'],
    commandId: 'accept_trip',
    requiresAuth: true,
    requiresEntityAcl: true,
    requiresDealId: true,
    requiresIdempotencyKey: true,
    writesAuditEvent: true,
    affectsMoney: true,
    requiresExternalConfirmation: false,
    rateLimitScope: 'deal',
    runtimeStatus: 'contract_only',
    summary: 'Accepts a trip with receiving, weight and evidence records; may influence money decision.',
  },
  {
    id: 'open_incident',
    method: 'POST',
    path: '/api/platform-v7/deals/:dealId/trips/:tripId/incidents',
    actorRoles: ['driver', 'logistics', 'operator'],
    commandId: 'open_incident',
    requiresAuth: true,
    requiresEntityAcl: true,
    requiresDealId: true,
    requiresIdempotencyKey: true,
    writesAuditEvent: true,
    affectsMoney: true,
    requiresExternalConfirmation: false,
    rateLimitScope: 'deal',
    runtimeStatus: 'contract_only',
    summary: 'Opens incident evidence that may block acceptance or money decision.',
  },
  {
    id: 'open_dispute',
    method: 'POST',
    path: '/api/platform-v7/deals/:dealId/disputes',
    actorRoles: ['seller', 'buyer', 'operator'],
    commandId: 'open_dispute',
    requiresAuth: true,
    requiresEntityAcl: true,
    requiresDealId: true,
    requiresIdempotencyKey: true,
    writesAuditEvent: true,
    affectsMoney: true,
    requiresExternalConfirmation: false,
    rateLimitScope: 'deal',
    runtimeStatus: 'contract_only',
    summary: 'Opens a dispute with evidence link and money decision impact boundary.',
  },
  {
    id: 'resolve_dispute',
    method: 'POST',
    path: '/api/platform-v7/deals/:dealId/disputes/:disputeId/resolve',
    actorRoles: ['arbitrator', 'bank', 'operator'],
    commandId: 'resolve_dispute',
    requiresAuth: true,
    requiresEntityAcl: true,
    requiresDealId: true,
    requiresIdempotencyKey: true,
    writesAuditEvent: true,
    affectsMoney: true,
    requiresExternalConfirmation: false,
    rateLimitScope: 'deal',
    runtimeStatus: 'contract_only',
    summary: 'Resolves dispute with decision, money impact and audit event references.',
  },
  {
    id: 'create_support_case',
    method: 'POST',
    path: '/api/platform-v7/support/cases',
    actorRoles: ['seller', 'buyer', 'logistics', 'driver', 'elevator', 'lab', 'surveyor', 'bank', 'operator', 'compliance'],
    requiresAuth: true,
    requiresEntityAcl: true,
    requiresDealId: false,
    requiresIdempotencyKey: true,
    writesAuditEvent: true,
    affectsMoney: false,
    requiresExternalConfirmation: false,
    rateLimitScope: 'ip_actor',
    runtimeStatus: 'contract_only',
    summary: 'Creates support case linked to execution context without becoming a generic chat.',
  },
  {
    id: 'append_support_message',
    method: 'POST',
    path: '/api/platform-v7/support/cases/:caseId/messages',
    actorRoles: ['seller', 'buyer', 'logistics', 'driver', 'elevator', 'lab', 'surveyor', 'bank', 'operator', 'compliance'],
    requiresAuth: true,
    requiresEntityAcl: true,
    requiresDealId: false,
    requiresIdempotencyKey: true,
    writesAuditEvent: true,
    affectsMoney: false,
    requiresExternalConfirmation: false,
    rateLimitScope: 'ip_actor',
    runtimeStatus: 'contract_only',
    summary: 'Appends support message while preserving execution context and audit trail.',
  },
  {
    id: 'read_audit_events',
    method: 'GET',
    path: '/api/platform-v7/deals/:dealId/audit-events',
    actorRoles: ['operator', 'compliance', 'bank', 'arbitrator'],
    requiresAuth: true,
    requiresEntityAcl: true,
    requiresDealId: true,
    requiresIdempotencyKey: false,
    writesAuditEvent: false,
    affectsMoney: false,
    requiresExternalConfirmation: false,
    rateLimitScope: 'actor',
    runtimeStatus: 'contract_only',
    summary: 'Reads append-only audit events for control, compliance, bank or dispute review.',
  },
];

export function getPlatformV7ApiBoundary(id: PlatformV7ApiBoundaryId) {
  return PLATFORM_V7_API_BOUNDARIES.find((boundary) => boundary.id === id);
}

export function getPlatformV7ApiBoundariesForRole(role: string) {
  return PLATFORM_V7_API_BOUNDARIES.filter((boundary) => boundary.actorRoles.includes(role));
}

export function getPlatformV7ApiBoundariesForCommand(commandId: PlatformV7ExecutionCommandId) {
  return PLATFORM_V7_API_BOUNDARIES.filter((boundary) => boundary.commandId === commandId);
}

export function getPlatformV7MoneyAffectingApiBoundaries() {
  return PLATFORM_V7_API_BOUNDARIES.filter((boundary) => boundary.affectsMoney);
}

export function canPlatformV7RoleCallApiBoundary(role: string, id: PlatformV7ApiBoundaryId): boolean {
  return getPlatformV7ApiBoundary(id)?.actorRoles.includes(role) === true;
}

export function getPlatformV7ApiBoundaryReadinessSummary() {
  const writingBoundaries = PLATFORM_V7_API_BOUNDARIES.filter((boundary) => boundary.method !== 'GET');
  const moneyAffecting = getPlatformV7MoneyAffectingApiBoundaries();

  return {
    total: PLATFORM_V7_API_BOUNDARIES.length,
    writes: writingBoundaries.length,
    moneyAffecting: moneyAffecting.length,
    authProtected: PLATFORM_V7_API_BOUNDARIES.filter((boundary) => boundary.requiresAuth).length,
    aclProtected: PLATFORM_V7_API_BOUNDARIES.filter((boundary) => boundary.requiresEntityAcl).length,
    idempotentWrites: writingBoundaries.filter((boundary) => boundary.requiresIdempotencyKey).length,
    auditedWrites: writingBoundaries.filter((boundary) => boundary.writesAuditEvent).length,
    mode: 'contract_only_requires_server_routes' as const,
  };
}
