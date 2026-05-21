import { platformV7AccessDecision, type PlatformV7AccessRequest } from './access-control';
import { platformV7ApiEndpoint, type PlatformV7HttpMethod } from './api-contracts';
import { platformV7ReleaseGate, type PlatformV7ReleaseGateInput } from './money-tree';

export type P7UsecaseId =
  | 'create_lot'
  | 'create_rfq'
  | 'accept_offer'
  | 'create_deal'
  | 'request_money_reserve'
  | 'request_money_release'
  | 'create_trip'
  | 'record_trip_event'
  | 'submit_lab_protocol'
  | 'open_dispute'
  | 'issue_dispute_decision';

export interface P7UsecaseRequest {
  readonly usecaseId: P7UsecaseId;
  readonly method: PlatformV7HttpMethod;
  readonly path: string;
  readonly access: PlatformV7AccessRequest;
  readonly idempotencyKey?: string;
  readonly correlationId: string;
  readonly auditId: string;
  readonly releaseGate?: PlatformV7ReleaseGateInput;
}

export interface P7UsecaseDecision {
  readonly allowed: boolean;
  readonly usecaseId: P7UsecaseId;
  readonly reason: string;
  readonly auditCode: string;
}

export function p7EvaluateUsecase(request: P7UsecaseRequest): P7UsecaseDecision {
  const endpoint = platformV7ApiEndpoint(request.method, request.path);
  if (!endpoint) return { allowed: false, usecaseId: request.usecaseId, reason: 'Endpoint contract is not registered.', auditCode: 'ENDPOINT_NOT_REGISTERED' };
  if (endpoint.requiresIdempotencyKey && !request.idempotencyKey) return { allowed: false, usecaseId: request.usecaseId, reason: 'Idempotency key is required.', auditCode: 'IDEMPOTENCY_REQUIRED' };
  if (!request.correlationId || !request.auditId) return { allowed: false, usecaseId: request.usecaseId, reason: 'Trace ids are required.', auditCode: 'TRACE_REQUIRED' };

  const access = platformV7AccessDecision(request.access);
  if (!access.allowed) return { allowed: false, usecaseId: request.usecaseId, reason: access.reason, auditCode: access.auditCode };

  if (request.usecaseId === 'request_money_release') {
    if (!request.releaseGate) return { allowed: false, usecaseId: request.usecaseId, reason: 'Release gate is required.', auditCode: 'RELEASE_GATE_REQUIRED' };
    const gate = platformV7ReleaseGate(request.releaseGate);
    if (!gate.allowed) return { allowed: false, usecaseId: request.usecaseId, reason: gate.reason, auditCode: 'RELEASE_GATE_BLOCKED' };
  }

  return { allowed: true, usecaseId: request.usecaseId, reason: 'Usecase allowed.', auditCode: 'USECASE_ALLOWED' };
}
