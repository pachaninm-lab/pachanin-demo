import {
  createP7BankBasisExecutionService,
  createP7DisputeSettlementService,
  createP7DocumentExecutionService,
  createP7MoneyExecutionService,
  createP7ReleaseWorkflowService,
} from '@/lib/platform-v7/runtime/application-service';
import type { P7ApplicationServiceResult } from '@/lib/platform-v7/runtime/application-service-types';
import {
  validateP7ArbitrationBasisRequestDto,
  validateP7BankBasisSendRequestDto,
  validateP7BankConfirmationRequestDto,
  validateP7DocumentActionRequestDto,
  validateP7ReleaseRequestDto,
  type P7ArbitrationBasisRequestDto,
  type P7BankBasisSendRequestDto,
  type P7BankConfirmationRequestDto,
  type P7DocumentActionRequestDto,
  type P7ReleaseRequestDto,
  type P7RuntimeRequestBaseDto,
  type P7ValidationError,
  type P7ValidationResult,
} from '@/lib/platform-v7/runtime/dto-schemas';
import {
  createP7MockRuntimeStore,
  type P7MockRuntimeStore,
} from '@/lib/platform-v7/runtime/mock-persistence-adapter';

export type P7RuntimeActionErrorCode =
  | 'VALIDATION_ERROR'
  | 'PERMISSION_DENIED'
  | 'DUPLICATE'
  | 'CONFLICT'
  | 'NOT_FOUND'
  | 'PERSISTENCE_ERROR'
  | 'DOMAIN_BLOCKED'
  | 'UNKNOWN_ERROR';

export type P7RuntimeActionStatus =
  | 'success'
  | 'validation_error'
  | 'denied'
  | 'duplicate'
  | 'conflict'
  | 'not_found'
  | 'persistence_error'
  | 'domain_blocked'
  | 'unknown_error';

export type P7Serializable =
  | null
  | string
  | number
  | boolean
  | readonly P7Serializable[]
  | { readonly [key: string]: P7Serializable };

export interface P7RuntimeActionError {
  readonly code: P7RuntimeActionErrorCode;
  readonly message: string;
  readonly details?: P7Serializable;
}

export type P7RuntimeActionResult =
  | {
    readonly ok: true;
    readonly status: 'success' | 'duplicate';
    readonly data: P7Serializable;
    readonly auditPayloads: readonly P7Serializable[];
    readonly duplicate: boolean;
    readonly meta: {
      readonly boundaryStatus?: string;
      readonly boundaryCode?: string;
      readonly boundaryReason?: string;
    };
  }
  | {
    readonly ok: false;
    readonly status: Exclude<P7RuntimeActionStatus, 'success'>;
    readonly error: P7RuntimeActionError;
    readonly validationErrors?: readonly P7ValidationError[];
    readonly auditPayloads: readonly P7Serializable[];
    readonly duplicate: boolean;
    readonly meta: {
      readonly boundaryStatus?: string;
      readonly boundaryCode?: string;
      readonly boundaryReason?: string;
    };
  };

export type P7RuntimeMoneyAction =
  | 'request_release'
  | 'confirm_release'
  | 'confirm_refund'
  | 'confirm_hold'
  | 'start_manual_review';

export type P7RuntimeMoneyActionInput =
  | { readonly action: 'request_release'; readonly dto: P7ReleaseRequestDto }
  | { readonly action: Exclude<P7RuntimeMoneyAction, 'request_release'>; readonly dto: P7BankConfirmationRequestDto };

export type P7RuntimeDocumentAction =
  | 'upload_document'
  | 'confirm_document'
  | 'reject_document'
  | 'send_document'
  | 'mark_manual_review';

export interface P7RuntimeDocumentActionInput {
  readonly action: P7RuntimeDocumentAction;
  readonly dto: P7DocumentActionRequestDto;
}

export type P7RuntimeBankBasisAction =
  | 'send_bank_basis'
  | 'confirm_bank_release'
  | 'reject_bank_release'
  | 'confirm_bank_refund'
  | 'confirm_bank_hold'
  | 'start_bank_manual_review';

export type P7RuntimeBankBasisActionInput =
  | { readonly action: 'send_bank_basis'; readonly dto: P7BankBasisSendRequestDto }
  | { readonly action: Exclude<P7RuntimeBankBasisAction, 'send_bank_basis'>; readonly dto: P7BankConfirmationRequestDto };

export type P7RuntimeReleaseWorkflowAction =
  | 'prepare_release'
  | 'request_release'
  | 'send_basis_to_bank'
  | 'handle_bank_event'
  | 'get_release_status';

export type P7RuntimeReleaseWorkflowActionInput =
  | { readonly action: 'prepare_release' | 'request_release'; readonly dto: P7ReleaseRequestDto }
  | { readonly action: 'send_basis_to_bank'; readonly dto: P7BankBasisSendRequestDto }
  | { readonly action: 'handle_bank_event'; readonly dto: P7BankConfirmationRequestDto }
  | { readonly action: 'get_release_status'; readonly dto: P7RuntimeRequestBaseDto };

export type P7RuntimeDisputeSettlementAction =
  | 'open_dispute'
  | 'attach_evidence'
  | 'prepare_arbitration_basis'
  | 'apply_arbitration_outcome_to_bank_basis'
  | 'get_dispute_money_impact';

export type P7RuntimeDisputeSettlementActionInput =
  | { readonly action: 'open_dispute' | 'attach_evidence' | 'get_dispute_money_impact'; readonly dto: P7RuntimeRequestBaseDto }
  | { readonly action: 'prepare_arbitration_basis'; readonly dto: P7ArbitrationBasisRequestDto }
  | { readonly action: 'apply_arbitration_outcome_to_bank_basis'; readonly dto: P7BankConfirmationRequestDto };

export interface P7RuntimeServerActionDependencies {
  readonly store?: P7MockRuntimeStore;
  readonly createStore?: () => P7MockRuntimeStore;
  readonly now?: () => string;
}

export interface P7RuntimeServerActions {
  readonly money: (input: P7RuntimeMoneyActionInput) => Promise<P7RuntimeActionResult>;
  readonly document: (input: P7RuntimeDocumentActionInput) => Promise<P7RuntimeActionResult>;
  readonly bankBasis: (input: P7RuntimeBankBasisActionInput) => Promise<P7RuntimeActionResult>;
  readonly releaseWorkflow: (input: P7RuntimeReleaseWorkflowActionInput) => Promise<P7RuntimeActionResult>;
  readonly disputeSettlement: (input: P7RuntimeDisputeSettlementActionInput) => Promise<P7RuntimeActionResult>;
}

function toSerializable(value: unknown): P7Serializable {
  return JSON.parse(JSON.stringify(value)) as P7Serializable;
}

function validationResult(errors: readonly P7ValidationError[]): P7RuntimeActionResult {
  return {
    ok: false,
    status: 'validation_error',
    error: {
      code: 'VALIDATION_ERROR',
      message: 'Runtime DTO validation failed.',
      details: toSerializable({ errors }),
    },
    validationErrors: errors,
    auditPayloads: [],
    duplicate: false,
    meta: {},
  };
}

function validationFailed<T>(
  validation: P7ValidationResult<T>,
): validation is Extract<P7ValidationResult<T>, { readonly ok: false }> {
  return validation.ok === false;
}

function validateOrFail<T>(validation: P7ValidationResult<T>): P7RuntimeActionResult | null {
  if (validationFailed(validation)) return validationResult(validation.errors);
  return null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function addRequiredRuntimeStringError(
  errors: P7ValidationError[],
  field: string,
  value: unknown,
): void {
  if (!nonEmptyString(value)) {
    errors.push({
      code: 'REQUIRED',
      field,
      message: `${field} is required.`,
    });
  }
}

function validateP7RuntimeRequestBaseDto(input: P7RuntimeRequestBaseDto): P7ValidationResult<P7RuntimeRequestBaseDto> {
  const candidate = input as unknown;
  if (!isRecord(candidate)) {
    return {
      ok: false,
      errors: [{ code: 'INVALID_OBJECT', field: 'dto', message: 'dto must be an object.' }],
    };
  }

  const errors: P7ValidationError[] = [];
  const actor = candidate.actor;
  const resource = candidate.resource;
  const audit = candidate.audit;
  const idempotency = candidate.idempotency;

  if (!isRecord(actor)) {
    errors.push({ code: 'REQUIRED', field: 'actor', message: 'actor is required.' });
  } else {
    addRequiredRuntimeStringError(errors, 'actor.actorId', actor.actorId);
    addRequiredRuntimeStringError(errors, 'actor.actorRole', actor.actorRole);
    addRequiredRuntimeStringError(errors, 'actor.organizationId', actor.organizationId);
  }

  if (!isRecord(resource)) {
    errors.push({ code: 'REQUIRED', field: 'resource', message: 'resource is required.' });
  } else {
    addRequiredRuntimeStringError(errors, 'resource.resourceType', resource.resourceType);
    addRequiredRuntimeStringError(errors, 'resource.resourceId', resource.resourceId);
    addRequiredRuntimeStringError(errors, 'resource.dealId', resource.dealId);
  }

  if (!isRecord(audit)) {
    errors.push({ code: 'REQUIRED', field: 'audit', message: 'audit is required.' });
  } else {
    addRequiredRuntimeStringError(errors, 'audit.auditId', audit.auditId);
    addRequiredRuntimeStringError(errors, 'audit.correlationId', audit.correlationId);
    addRequiredRuntimeStringError(errors, 'audit.reason', audit.reason);
  }

  if (!isRecord(idempotency)) {
    errors.push({ code: 'REQUIRED', field: 'idempotency', message: 'idempotency is required.' });
  } else {
    addRequiredRuntimeStringError(errors, 'idempotency.idempotencyKey', idempotency.idempotencyKey);
  }

  return errors.length === 0 ? { ok: true, value: input } : { ok: false, errors };
}

function duplicateBeforeCall(store: P7MockRuntimeStore, dto: P7RuntimeRequestBaseDto): boolean {
  return store.snapshot().idempotencyKeys.includes(dto.idempotency.idempotencyKey);
}

function errorCode(status: P7ApplicationServiceResult<unknown>['status'], code: string): P7RuntimeActionErrorCode {
  if (status === 'validation_error') return 'VALIDATION_ERROR';
  if (status === 'denied') return 'PERMISSION_DENIED';
  if (status === 'duplicate') return 'DUPLICATE';
  if (status === 'conflict') return 'CONFLICT';
  if (status === 'not_found') return 'NOT_FOUND';
  if (code === 'persistence_error') return 'PERSISTENCE_ERROR';
  return 'DOMAIN_BLOCKED';
}

function statusFromService(status: P7ApplicationServiceResult<unknown>['status']): Exclude<P7RuntimeActionStatus, 'success'> {
  if (status === 'persisted') return 'domain_blocked';
  if (status === 'validation_error') return 'validation_error';
  if (status === 'denied') return 'denied';
  if (status === 'duplicate') return 'duplicate';
  if (status === 'conflict') return 'conflict';
  if (status === 'not_found') return 'not_found';
  if (status === 'domain_blocked') return 'domain_blocked';
  return 'persistence_error';
}

function fromServiceResult<T>(
  result: P7ApplicationServiceResult<T>,
  duplicateReplay: boolean,
): P7RuntimeActionResult {
  const auditPayloads = result.auditPayloads.map(toSerializable);
  const meta = {
    boundaryStatus: result.boundaryResult?.status,
    boundaryCode: result.boundaryResult?.code,
    boundaryReason: result.boundaryResult?.reason,
  };

  if (result.ok === true) {
    return {
      ok: true,
      status: duplicateReplay ? 'duplicate' : 'success',
      data: toSerializable(result.value),
      auditPayloads,
      duplicate: duplicateReplay,
      meta,
    };
  }

  const failed = result as Extract<P7ApplicationServiceResult<T>, { readonly ok: false }>;

  return {
    ok: false,
    status: statusFromService(failed.status),
    error: {
      code: errorCode(failed.status, failed.code),
      message: failed.reason,
      details: toSerializable({ serviceCode: failed.code }),
    },
    validationErrors: failed.validationErrors,
    auditPayloads,
    duplicate: failed.status === 'duplicate',
    meta,
  };
}

function unknownFailure(error: unknown): P7RuntimeActionResult {
  return {
    ok: false,
    status: 'unknown_error',
    error: {
      code: 'UNKNOWN_ERROR',
      message: error instanceof Error ? error.message : 'Unknown runtime action error.',
    },
    auditPayloads: [],
    duplicate: false,
    meta: {},
  };
}

function resolveStore(deps: P7RuntimeServerActionDependencies): P7MockRuntimeStore {
  if (deps.store) return deps.store;
  if (deps.createStore) return deps.createStore();
  return createP7MockRuntimeStore();
}

async function executeWithService<T>(
  deps: P7RuntimeServerActionDependencies,
  dto: P7RuntimeRequestBaseDto,
  validation: P7ValidationResult<unknown>,
  run: (store: P7MockRuntimeStore) => Promise<P7ApplicationServiceResult<T>>,
): Promise<P7RuntimeActionResult> {
  const invalid = validateOrFail(validation);
  if (invalid) return invalid;

  const store = resolveStore(deps);
  const duplicateReplay = duplicateBeforeCall(store, dto);

  try {
    const result = await run(store);
    return fromServiceResult(result, duplicateReplay);
  } catch (error) {
    return unknownFailure(error);
  }
}

export function createP7RuntimeServerActions(deps: P7RuntimeServerActionDependencies = {}): P7RuntimeServerActions {
  return {
    async money(input) {
      if (input.action === 'request_release') {
        return executeWithService(deps, input.dto, validateP7ReleaseRequestDto(input.dto), async (store) =>
          createP7MoneyExecutionService({ unitOfWork: store, now: deps.now }).requestRelease(input.dto)
        );
      }

      return executeWithService(deps, input.dto, validateP7BankConfirmationRequestDto(input.dto), async (store) => {
        const service = createP7MoneyExecutionService({ unitOfWork: store, now: deps.now });
        if (input.action === 'confirm_refund') return service.confirmRefund(input.dto);
        if (input.action === 'confirm_hold') return service.confirmHold(input.dto);
        if (input.action === 'start_manual_review') return service.startManualReview(input.dto);
        return service.confirmRelease(input.dto);
      });
    },
    async document(input) {
      return executeWithService(deps, input.dto, validateP7DocumentActionRequestDto(input.dto), async (store) => {
        const service = createP7DocumentExecutionService({ unitOfWork: store, now: deps.now });
        if (input.action === 'confirm_document') return service.confirmDocument(input.dto);
        if (input.action === 'reject_document') return service.rejectDocument(input.dto);
        if (input.action === 'send_document') return service.sendDocument(input.dto);
        if (input.action === 'mark_manual_review') return service.markManualReview(input.dto);
        return service.uploadDocument(input.dto);
      });
    },
    async bankBasis(input) {
      if (input.action === 'send_bank_basis') {
        return executeWithService(deps, input.dto, validateP7BankBasisSendRequestDto(input.dto), async (store) =>
          createP7BankBasisExecutionService({ unitOfWork: store, now: deps.now }).sendBankBasis(input.dto)
        );
      }

      return executeWithService(deps, input.dto, validateP7BankConfirmationRequestDto(input.dto), async (store) => {
        const service = createP7BankBasisExecutionService({ unitOfWork: store, now: deps.now });
        if (input.action === 'reject_bank_release') return service.rejectBankRelease(input.dto);
        if (input.action === 'confirm_bank_refund') return service.confirmBankRefund(input.dto);
        if (input.action === 'confirm_bank_hold') return service.confirmBankHold(input.dto);
        if (input.action === 'start_bank_manual_review') return service.startBankManualReview(input.dto);
        return service.confirmBankRelease(input.dto);
      });
    },
    async releaseWorkflow(input) {
      if (input.action === 'send_basis_to_bank') {
        return executeWithService(deps, input.dto, validateP7BankBasisSendRequestDto(input.dto), async (store) =>
          createP7ReleaseWorkflowService({ unitOfWork: store, now: deps.now }).sendBasisToBank(input.dto)
        );
      }
      if (input.action === 'handle_bank_event') {
        return executeWithService(deps, input.dto, validateP7BankConfirmationRequestDto(input.dto), async (store) =>
          createP7ReleaseWorkflowService({ unitOfWork: store, now: deps.now }).handleBankEvent(input.dto)
        );
      }
      if (input.action === 'get_release_status') {
        return executeWithService(deps, input.dto, validateP7RuntimeRequestBaseDto(input.dto), async (store) =>
          createP7ReleaseWorkflowService({ unitOfWork: store, now: deps.now }).getReleaseStatus(input.dto)
        );
      }

      if (input.action === 'request_release') {
        return executeWithService(deps, input.dto, validateP7ReleaseRequestDto(input.dto), async (store) =>
          createP7ReleaseWorkflowService({ unitOfWork: store, now: deps.now }).requestRelease(input.dto)
        );
      }

      return executeWithService(deps, input.dto, validateP7ReleaseRequestDto(input.dto), async (store) =>
        createP7ReleaseWorkflowService({ unitOfWork: store, now: deps.now }).prepareRelease(input.dto)
      );
    },
    async disputeSettlement(input) {
      if (input.action === 'prepare_arbitration_basis') {
        return executeWithService(deps, input.dto, validateP7ArbitrationBasisRequestDto(input.dto), async (store) =>
          createP7DisputeSettlementService({ unitOfWork: store, now: deps.now }).prepareArbitrationBasis(input.dto)
        );
      }
      if (input.action === 'apply_arbitration_outcome_to_bank_basis') {
        return executeWithService(deps, input.dto, validateP7BankConfirmationRequestDto(input.dto), async (store) =>
          createP7DisputeSettlementService({ unitOfWork: store, now: deps.now }).applyArbitrationOutcomeToBankBasis(input.dto)
        );
      }

      return executeWithService(deps, input.dto, validateP7RuntimeRequestBaseDto(input.dto), async (store) => {
        const service = createP7DisputeSettlementService({ unitOfWork: store, now: deps.now });
        if (input.action === 'attach_evidence') return service.attachEvidence(input.dto);
        if (input.action === 'get_dispute_money_impact') return service.getDisputeMoneyImpact(input.dto);
        return service.openDispute(input.dto);
      });
    },
  };
}

export async function executeP7RuntimeMoneyAction(input: P7RuntimeMoneyActionInput): Promise<P7RuntimeActionResult> {
  'use server';
  return createP7RuntimeServerActions().money(input);
}

export async function executeP7RuntimeDocumentAction(input: P7RuntimeDocumentActionInput): Promise<P7RuntimeActionResult> {
  'use server';
  return createP7RuntimeServerActions().document(input);
}

export async function executeP7RuntimeBankBasisAction(input: P7RuntimeBankBasisActionInput): Promise<P7RuntimeActionResult> {
  'use server';
  return createP7RuntimeServerActions().bankBasis(input);
}

export async function executeP7RuntimeReleaseWorkflowAction(input: P7RuntimeReleaseWorkflowActionInput): Promise<P7RuntimeActionResult> {
  'use server';
  return createP7RuntimeServerActions().releaseWorkflow(input);
}

export async function executeP7RuntimeDisputeSettlementAction(input: P7RuntimeDisputeSettlementActionInput): Promise<P7RuntimeActionResult> {
  'use server';
  return createP7RuntimeServerActions().disputeSettlement(input);
}
