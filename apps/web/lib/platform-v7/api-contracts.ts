export type PlatformV7ApiRole =
  | 'platformAdmin'
  | 'operator'
  | 'seller'
  | 'buyer'
  | 'logisticsManager'
  | 'carrier'
  | 'driver'
  | 'elevatorOperator'
  | 'labSpecialist'
  | 'surveyor'
  | 'bankOfficer'
  | 'complianceOfficer'
  | 'arbitrator'
  | 'supportAgent'
  | 'executiveViewer';

export type PlatformV7HttpMethod = 'GET' | 'POST' | 'PATCH' | 'DELETE';

export type PlatformV7ApiResource =
  | 'me'
  | 'roles'
  | 'permissions'
  | 'lots'
  | 'rfqs'
  | 'offers'
  | 'deals'
  | 'documents'
  | 'money'
  | 'trips'
  | 'labProtocols'
  | 'disputes'
  | 'audit'
  | 'externalCalls';

export type PlatformV7Criticality = 'read' | 'write' | 'critical';

export interface PlatformV7ApiActorContext {
  readonly actorId: string;
  readonly organizationId: string;
  readonly role: PlatformV7ApiRole;
  readonly correlationId: string;
  readonly auditId: string;
  readonly idempotencyKey?: string;
}

export interface PlatformV7ApiErrorEnvelope {
  readonly error: {
    readonly code: string;
    readonly message: string;
    readonly details?: Record<string, unknown>;
    readonly correlationId: string;
  };
}

export interface PlatformV7ApiEventEnvelope<TPayload extends Record<string, unknown> = Record<string, unknown>> {
  readonly eventId: string;
  readonly eventType: string;
  readonly dealId?: string;
  readonly actorId: string;
  readonly actorRole: PlatformV7ApiRole;
  readonly occurredAt: string;
  readonly payload: TPayload;
  readonly correlationId: string;
  readonly auditId: string;
}

export interface PlatformV7ApiEndpointContract {
  readonly method: PlatformV7HttpMethod;
  readonly path: string;
  readonly resource: PlatformV7ApiResource;
  readonly criticality: PlatformV7Criticality;
  readonly requiresActorContext: true;
  readonly requiresIdempotencyKey: boolean;
  readonly emitsAuditEvent: boolean;
  readonly allowedRoles: readonly PlatformV7ApiRole[];
}

export interface PlatformV7DealDto {
  readonly dealId: string;
  readonly sellerOrganizationId: string;
  readonly buyerOrganizationId: string;
  readonly status: string;
  readonly moneyStatus: string;
  readonly documentStatus: string;
  readonly tripStatus?: string;
  readonly disputeStatus?: string;
}

export interface PlatformV7MoneyOperationDto {
  readonly dealId: string;
  readonly operationType: string;
  readonly amount: number;
  readonly currency: 'RUB';
  readonly basisDocumentIds: readonly string[];
  readonly idempotencyKey: string;
  readonly correlationId: string;
}

export interface PlatformV7DocumentDto {
  readonly documentId: string;
  readonly dealId: string;
  readonly type: string;
  readonly status: string;
  readonly ownerRole: PlatformV7ApiRole;
  readonly blocksAction?: string;
  readonly affectsMoney: boolean;
}

export interface PlatformV7TripEventDto {
  readonly tripId: string;
  readonly eventType: string;
  readonly occurredAt: string;
  readonly actorId: string;
  readonly evidenceIds: readonly string[];
  readonly offlineQueueId?: string;
}

export interface PlatformV7DisputeDto {
  readonly disputeId: string;
  readonly dealId: string;
  readonly reason: string;
  readonly claimAmount: number;
  readonly blockedAmount: number;
  readonly evidenceIds: readonly string[];
  readonly status: string;
}

export const PLATFORM_V7_API_ENDPOINTS: readonly PlatformV7ApiEndpointContract[] = [
  { method: 'GET', path: '/api/me', resource: 'me', criticality: 'read', requiresActorContext: true, requiresIdempotencyKey: false, emitsAuditEvent: false, allowedRoles: ['platformAdmin', 'operator', 'seller', 'buyer', 'logisticsManager', 'carrier', 'driver', 'elevatorOperator', 'labSpecialist', 'surveyor', 'bankOfficer', 'complianceOfficer', 'arbitrator', 'supportAgent', 'executiveViewer'] },
  { method: 'GET', path: '/api/roles', resource: 'roles', criticality: 'read', requiresActorContext: true, requiresIdempotencyKey: false, emitsAuditEvent: false, allowedRoles: ['platformAdmin', 'operator', 'seller', 'buyer', 'logisticsManager', 'carrier', 'driver', 'elevatorOperator', 'labSpecialist', 'surveyor', 'bankOfficer', 'complianceOfficer', 'arbitrator', 'supportAgent', 'executiveViewer'] },
  { method: 'GET', path: '/api/permissions/effective', resource: 'permissions', criticality: 'read', requiresActorContext: true, requiresIdempotencyKey: false, emitsAuditEvent: false, allowedRoles: ['platformAdmin', 'operator', 'seller', 'buyer', 'logisticsManager', 'carrier', 'driver', 'elevatorOperator', 'labSpecialist', 'surveyor', 'bankOfficer', 'complianceOfficer', 'arbitrator', 'supportAgent', 'executiveViewer'] },
  { method: 'POST', path: '/api/session/role', resource: 'roles', criticality: 'write', requiresActorContext: true, requiresIdempotencyKey: false, emitsAuditEvent: true, allowedRoles: ['platformAdmin', 'operator', 'seller', 'buyer', 'logisticsManager', 'carrier', 'driver', 'elevatorOperator', 'labSpecialist', 'surveyor', 'bankOfficer', 'complianceOfficer', 'arbitrator', 'supportAgent', 'executiveViewer'] },
  { method: 'GET', path: '/api/lots', resource: 'lots', criticality: 'read', requiresActorContext: true, requiresIdempotencyKey: false, emitsAuditEvent: false, allowedRoles: ['operator', 'seller', 'buyer'] },
  { method: 'POST', path: '/api/lots', resource: 'lots', criticality: 'write', requiresActorContext: true, requiresIdempotencyKey: true, emitsAuditEvent: true, allowedRoles: ['operator', 'seller'] },
  { method: 'POST', path: '/api/rfqs', resource: 'rfqs', criticality: 'write', requiresActorContext: true, requiresIdempotencyKey: true, emitsAuditEvent: true, allowedRoles: ['operator', 'buyer'] },
  { method: 'POST', path: '/api/offers', resource: 'offers', criticality: 'write', requiresActorContext: true, requiresIdempotencyKey: true, emitsAuditEvent: true, allowedRoles: ['operator', 'seller', 'buyer'] },
  { method: 'POST', path: '/api/offers/{id}/accept', resource: 'offers', criticality: 'critical', requiresActorContext: true, requiresIdempotencyKey: true, emitsAuditEvent: true, allowedRoles: ['operator', 'buyer', 'seller'] },
  { method: 'POST', path: '/api/deals', resource: 'deals', criticality: 'critical', requiresActorContext: true, requiresIdempotencyKey: true, emitsAuditEvent: true, allowedRoles: ['operator', 'buyer', 'seller'] },
  { method: 'GET', path: '/api/deals/{id}', resource: 'deals', criticality: 'read', requiresActorContext: true, requiresIdempotencyKey: false, emitsAuditEvent: false, allowedRoles: ['operator', 'seller', 'buyer', 'logisticsManager', 'elevatorOperator', 'labSpecialist', 'surveyor', 'bankOfficer', 'complianceOfficer', 'arbitrator', 'supportAgent'] },
  { method: 'POST', path: '/api/deals/{id}/actions/{action}', resource: 'deals', criticality: 'critical', requiresActorContext: true, requiresIdempotencyKey: true, emitsAuditEvent: true, allowedRoles: ['operator', 'seller', 'buyer', 'logisticsManager', 'elevatorOperator', 'labSpecialist', 'surveyor', 'complianceOfficer', 'supportAgent'] },
  { method: 'POST', path: '/api/deals/{id}/documents', resource: 'documents', criticality: 'write', requiresActorContext: true, requiresIdempotencyKey: true, emitsAuditEvent: true, allowedRoles: ['operator', 'seller', 'buyer', 'logisticsManager', 'elevatorOperator', 'labSpecialist', 'surveyor', 'arbitrator'] },
  { method: 'POST', path: '/api/deals/{id}/money/reserve', resource: 'money', criticality: 'critical', requiresActorContext: true, requiresIdempotencyKey: true, emitsAuditEvent: true, allowedRoles: ['operator', 'buyer'] },
  { method: 'POST', path: '/api/deals/{id}/money/release-request', resource: 'money', criticality: 'critical', requiresActorContext: true, requiresIdempotencyKey: true, emitsAuditEvent: true, allowedRoles: ['operator', 'seller', 'buyer'] },
  { method: 'POST', path: '/api/deals/{id}/trips', resource: 'trips', criticality: 'write', requiresActorContext: true, requiresIdempotencyKey: true, emitsAuditEvent: true, allowedRoles: ['operator', 'logisticsManager'] },
  { method: 'POST', path: '/api/trips/{id}/events', resource: 'trips', criticality: 'write', requiresActorContext: true, requiresIdempotencyKey: true, emitsAuditEvent: true, allowedRoles: ['operator', 'logisticsManager', 'driver', 'elevatorOperator', 'surveyor'] },
  { method: 'POST', path: '/api/lab/protocols', resource: 'labProtocols', criticality: 'write', requiresActorContext: true, requiresIdempotencyKey: true, emitsAuditEvent: true, allowedRoles: ['operator', 'labSpecialist'] },
  { method: 'POST', path: '/api/disputes', resource: 'disputes', criticality: 'critical', requiresActorContext: true, requiresIdempotencyKey: true, emitsAuditEvent: true, allowedRoles: ['operator', 'seller', 'buyer', 'logisticsManager', 'elevatorOperator', 'labSpecialist'] },
  { method: 'POST', path: '/api/disputes/{id}/decision', resource: 'disputes', criticality: 'critical', requiresActorContext: true, requiresIdempotencyKey: true, emitsAuditEvent: true, allowedRoles: ['arbitrator'] },
  { method: 'GET', path: '/api/audit', resource: 'audit', criticality: 'read', requiresActorContext: true, requiresIdempotencyKey: false, emitsAuditEvent: false, allowedRoles: ['platformAdmin', 'operator', 'bankOfficer', 'complianceOfficer', 'arbitrator', 'supportAgent'] },
  { method: 'GET', path: '/api/external-calls', resource: 'externalCalls', criticality: 'read', requiresActorContext: true, requiresIdempotencyKey: false, emitsAuditEvent: false, allowedRoles: ['platformAdmin', 'operator', 'bankOfficer', 'complianceOfficer'] },
] as const;

export function platformV7ApiEndpoint(method: PlatformV7HttpMethod, path: string): PlatformV7ApiEndpointContract | null {
  return PLATFORM_V7_API_ENDPOINTS.find((endpoint) => endpoint.method === method && endpoint.path === path) ?? null;
}

export function platformV7CriticalApiEndpoints(): readonly PlatformV7ApiEndpointContract[] {
  return PLATFORM_V7_API_ENDPOINTS.filter((endpoint) => endpoint.criticality === 'critical');
}
