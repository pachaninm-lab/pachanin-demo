/**
 * @file application-service-types.ts
 * @stage controlled-pilot / pre-integration
 *
 * Typed input/output contracts for the P7 Application Service Layer.
 *
 * These types sit between the DTO validation layer (dto-schemas.ts) and the
 * action-boundary layer (action-boundary.ts).  No persistence implementation
 * lives here — adapters are injected by callers.
 */

import type {
  PlatformV7ActionBoundaryAuditPayload,
  PlatformV7ActionBoundaryResult,
} from '../action-boundary';
import type { P7BankAuditPayload } from '../bank-basis';
import type { PlatformV7MoneyTree } from '../money-tree';
import type { PlatformV7DocumentRequirement } from '../document-matrix';
import type { P7ValidationError } from './dto-schemas';

// ---------------------------------------------------------------------------
// Generic service result — discriminated union, no `any`, no thrown strings
// ---------------------------------------------------------------------------

export type P7ServiceStatus =
  | 'ok'
  | 'validation_error'
  | 'denied'
  | 'duplicate'
  | 'conflict'
  | 'not_found'
  | 'domain_blocked'
  | 'persisted';

export interface P7ServiceValidationError {
  readonly status: 'validation_error';
  readonly ok: false;
  readonly errors: readonly P7ValidationError[];
  readonly correlationId: string;
}

export interface P7ServiceDeniedResult<TBefore = unknown> {
  readonly status: 'denied';
  readonly ok: false;
  readonly code: string;
  readonly reason: string;
  readonly beforeState: TBefore;
  readonly afterState: TBefore;
  readonly auditPayload: PlatformV7ActionBoundaryAuditPayload<TBefore>;
  readonly correlationId: string;
}

export interface P7ServiceDuplicateResult<TBefore = unknown> {
  readonly status: 'duplicate';
  readonly ok: false;
  readonly code: string;
  readonly reason: string;
  readonly beforeState: TBefore;
  readonly afterState: TBefore;
  readonly auditPayload: PlatformV7ActionBoundaryAuditPayload<TBefore>;
  readonly correlationId: string;
}

export interface P7ServiceConflictResult {
  readonly status: 'conflict';
  readonly ok: false;
  readonly code: string;
  readonly reason: string;
  readonly currentVersion?: string;
  readonly correlationId: string;
}

export interface P7ServiceNotFoundResult {
  readonly status: 'not_found';
  readonly ok: false;
  readonly code: string;
  readonly reason: string;
  readonly correlationId: string;
}

export interface P7ServiceDomainBlockedResult<TBefore = unknown> {
  readonly status: 'domain_blocked';
  readonly ok: false;
  readonly code: string;
  readonly reason: string;
  readonly beforeState: TBefore;
  readonly afterState: TBefore;
  readonly correlationId: string;
}

export interface P7ServiceOkResult<TBefore = unknown, TAfter = TBefore> {
  readonly status: 'ok';
  readonly ok: true;
  readonly code: string;
  readonly reason: string;
  readonly beforeState: TBefore;
  readonly afterState: TAfter;
  readonly auditPayload: PlatformV7ActionBoundaryAuditPayload<TBefore>;
  readonly correlationId: string;
}

// ---------------------------------------------------------------------------
// Concrete result unions per service domain
// ---------------------------------------------------------------------------

export type P7ServiceMoneyResult =
  | P7ServiceOkResult<PlatformV7MoneyTree>
  | P7ServiceDeniedResult<PlatformV7MoneyTree>
  | P7ServiceDuplicateResult<PlatformV7MoneyTree>
  | P7ServiceConflictResult
  | P7ServiceNotFoundResult
  | P7ServiceDomainBlockedResult<PlatformV7MoneyTree>
  | P7ServiceValidationError;

export type P7ServiceDocumentResult =
  | P7ServiceOkResult<PlatformV7DocumentRequirement>
  | P7ServiceDeniedResult<PlatformV7DocumentRequirement>
  | P7ServiceDuplicateResult<PlatformV7DocumentRequirement>
  | P7ServiceConflictResult
  | P7ServiceNotFoundResult
  | P7ServiceDomainBlockedResult<PlatformV7DocumentRequirement>
  | P7ServiceValidationError;

export type P7ServiceBankBasisResult =
  | P7ServiceOkResult<PlatformV7MoneyTree>
  | P7ServiceDeniedResult<PlatformV7MoneyTree>
  | P7ServiceDuplicateResult<PlatformV7MoneyTree>
  | P7ServiceConflictResult
  | P7ServiceNotFoundResult
  | P7ServiceDomainBlockedResult<PlatformV7MoneyTree>
  | P7ServiceValidationError;

export type P7ServiceBankConfirmResult = P7ServiceBankBasisResult;

export type P7ServiceReleaseWorkflowResult = P7ServiceBankBasisResult;

export type P7ServiceDisputeSettlementResult =
  | P7ServiceOkResult<PlatformV7MoneyTree>
  | P7ServiceDeniedResult<PlatformV7MoneyTree>
  | P7ServiceDuplicateResult<PlatformV7MoneyTree>
  | P7ServiceConflictResult
  | P7ServiceNotFoundResult
  | P7ServiceDomainBlockedResult<PlatformV7MoneyTree>
  | P7ServiceValidationError;

// ---------------------------------------------------------------------------
// Dependencies — injected by caller; no DB client, no global state
// ---------------------------------------------------------------------------

export type { P7RuntimeUnitOfWork } from './persistence-ports';

export interface P7ApplicationServiceDependencies {
  /**
   * All persistence access goes through this unit of work.
   * Injected by the caller (server action / test / future API handler).
   * Never instantiated inside the service.
   */
  readonly unitOfWork: import('./persistence-ports').P7RuntimeUnitOfWork;
  /**
   * Optional ISO timestamp override for deterministic test scenarios.
   * When omitted the service uses `new Date().toISOString()`.
   */
  readonly clock?: () => string;
  /**
   * Optional correlation-id generator.  When omitted the service generates
   * a simple random string.  Tests can inject a deterministic value.
   */
  readonly generateCorrelationId?: () => string;
}

// ---------------------------------------------------------------------------
// Internal helpers (not exported — implementation detail)
// ---------------------------------------------------------------------------

// Re-export boundary result for use in application-service.ts internals
export type {
  PlatformV7ActionBoundaryResult,
  PlatformV7ActionBoundaryAuditPayload,
} from '../action-boundary';

export type { P7BankAuditPayload } from '../bank-basis';
