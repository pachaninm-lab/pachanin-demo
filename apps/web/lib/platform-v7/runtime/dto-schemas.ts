import type {
  P7BankAuditAction,
  P7BankConfirmationPath,
} from '../bank-basis';
import type {
  PlatformV7DocumentSource,
  PlatformV7DocumentStatus,
  PlatformV7DocumentSignatureStatus,
} from '../document-matrix';
import { validatePlatformV7IdempotencyKey } from '../idempotency-key-helper';
import type { PlatformV7MoneyOperationType } from '../money-tree';
import { toPlatformV7CanonicalRole } from '../role-canonical';
import type { PlatformV7CanonicalRole } from '../role-canonical';
import type { PlatformV7DocumentAction } from '../action-boundary';
import type { PlatformV7ResourceType } from '../access-control';

export interface P7ValidationError {
  readonly code: string;
  readonly field: string;
  readonly message: string;
}

export type P7ValidationResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly errors: readonly P7ValidationError[] };

export interface P7ActorScopeDto {
  readonly actorId: string;
  readonly actorRole: string;
  readonly organizationId: string;
}

export interface P7ResourceScopeDto {
  readonly resourceType: PlatformV7ResourceType | string;
  readonly resourceId: string;
  readonly dealId: string;
  readonly ownerOrganizationId?: string;
  readonly buyerOrganizationId?: string;
  readonly sellerOrganizationId?: string;
  readonly bankOrganizationId?: string;
  readonly assignedOrganizationId?: string;
}

export interface P7AuditMetadataDto {
  readonly auditId: string;
  readonly correlationId: string;
  readonly reason: string;
}

export interface P7IdempotencyMetadataDto {
  readonly idempotencyKey: string;
  readonly operationId?: string;
  readonly bankEventId?: string;
}

export interface P7RuntimeRequestBaseDto {
  readonly actor: P7ActorScopeDto;
  readonly resource: P7ResourceScopeDto;
  readonly audit: P7AuditMetadataDto;
  readonly idempotency: P7IdempotencyMetadataDto;
}

export interface P7MoneyActionRequestDto extends P7RuntimeRequestBaseDto {
  readonly action: PlatformV7MoneyOperationType;
  readonly amount: number;
  readonly currency: 'RUB';
}

export interface P7DocumentMetadataDto {
  readonly type?: string;
  readonly source?: PlatformV7DocumentSource;
  readonly signatureStatus?: PlatformV7DocumentSignatureStatus;
  readonly ownerRole?: string;
}

export interface P7DocumentActionRequestDto extends P7RuntimeRequestBaseDto {
  readonly action: PlatformV7DocumentAction;
  readonly documentId: string;
  readonly documentStatus: PlatformV7DocumentStatus;
  readonly documentMetadata?: P7DocumentMetadataDto;
}

export interface P7BankBasisSendRequestDto extends P7RuntimeRequestBaseDto {
  readonly basisDocumentIds: readonly string[];
}

export type P7BankConfirmationActionDto = Extract<
  P7BankAuditAction,
  | 'bank_release_confirmed'
  | 'bank_release_rejected'
  | 'bank_refund_confirmed'
  | 'bank_hold_confirmed'
  | 'bank_manual_review_started'
>;

export interface P7BankConfirmationRequestDto extends P7RuntimeRequestBaseDto {
  readonly bankEventId: string;
  readonly bankOrganizationId: string;
  readonly operationId: string;
  readonly amount: number;
  readonly currency: 'RUB';
  readonly path: P7BankConfirmationPath;
  readonly action: P7BankConfirmationActionDto;
}

export interface P7ReleaseRequestDto extends P7RuntimeRequestBaseDto {
  readonly amount: number;
  readonly currency: 'RUB';
}

export interface P7RefundRequestDto extends P7RuntimeRequestBaseDto {
  readonly amount: number;
  readonly currency: 'RUB';
  readonly bankEventId: string;
  readonly bankOrganizationId: string;
}

export interface P7HoldRequestDto extends P7RuntimeRequestBaseDto {
  readonly amount: number;
  readonly currency: 'RUB';
  readonly bankEventId: string;
  readonly bankOrganizationId: string;
}

export interface P7ArbitrationBasisRequestDto extends P7RuntimeRequestBaseDto {
  readonly arbitrationDecisionId: string;
  readonly basisDocumentIds: readonly string[];
  readonly uncontestedAmount: number;
  readonly disputedAmount: number;
  readonly releaseAmount: number;
  readonly refundAmount: number;
  readonly heldAmount: number;
  readonly feeAmount: number;
  readonly penaltyAmount: number;
  readonly currency: 'RUB';
}

const MONEY_ACTIONS = [
  'reserve_requested',
  'reserve_confirmed',
  'reserve_failed',
  'hold_created',
  'hold_released',
  'release_requested',
  'release_confirmed',
  'release_failed',
  'refund_requested',
  'refund_confirmed',
  'manual_review_started',
  'manual_review_resolved',
  'reconciliation_failed',
] as const satisfies readonly PlatformV7MoneyOperationType[];

const DOCUMENT_ACTIONS = [
  'document_uploaded',
  'document_signed',
  'document_sent',
  'document_confirmed',
  'document_rejected',
  'document_expired',
  'document_manual_review_started',
  'document_manual_review_resolved',
] as const satisfies readonly PlatformV7DocumentAction[];

const DOCUMENT_STATUSES = [
  'missing',
  'draft',
  'uploaded',
  'signed',
  'sent',
  'confirmed',
  'rejected',
  'expired',
  'manual_review',
  'conditional',
] as const satisfies readonly PlatformV7DocumentStatus[];

const BANK_CONFIRMATION_PATHS = [
  'release',
  'refund',
  'hold',
  'reject',
  'manual_review',
] as const satisfies readonly P7BankConfirmationPath[];

const BANK_CONFIRMATION_ACTIONS = [
  'bank_release_confirmed',
  'bank_release_rejected',
  'bank_refund_confirmed',
  'bank_hold_confirmed',
  'bank_manual_review_started',
] as const satisfies readonly P7BankConfirmationActionDto[];

function nonEmpty(value: string): boolean {
  return value.trim().length > 0;
}

function addRequiredStringError(errors: P7ValidationError[], field: string, value: string): void {
  if (!nonEmpty(value)) {
    errors.push({
      code: 'REQUIRED',
      field,
      message: `${field} is required.`,
    });
  }
}

function addPositiveAmountError(errors: P7ValidationError[], field: string, value: number): void {
  if (!Number.isFinite(value) || value <= 0) {
    errors.push({
      code: 'INVALID_AMOUNT',
      field,
      message: `${field} must be a finite positive amount.`,
    });
  }
}

function addNonNegativeAmountError(errors: P7ValidationError[], field: string, value: number): void {
  if (!Number.isFinite(value) || value < 0) {
    errors.push({
      code: 'INVALID_AMOUNT',
      field,
      message: `${field} must be a finite amount greater than or equal to zero.`,
    });
  }
}

function addCurrencyError(errors: P7ValidationError[], field: string, value: string): void {
  if (!nonEmpty(value)) {
    errors.push({
      code: 'REQUIRED',
      field,
      message: `${field} is required.`,
    });
    return;
  }

  if (value !== 'RUB') {
    errors.push({
      code: 'INVALID_CURRENCY',
      field,
      message: `${field} must be RUB.`,
    });
  }
}

function addNonEmptyArrayError(errors: P7ValidationError[], field: string, value: readonly string[]): void {
  if (value.length === 0 || value.some((item) => !nonEmpty(item))) {
    errors.push({
      code: 'INVALID_ARRAY',
      field,
      message: `${field} must contain at least one non-empty id.`,
    });
  }
}

function includesValue<T extends string>(values: readonly T[], value: string): value is T {
  return values.includes(value as T);
}

function validateActor(errors: P7ValidationError[], actor: P7ActorScopeDto): void {
  addRequiredStringError(errors, 'actor.actorId', actor.actorId);
  addRequiredStringError(errors, 'actor.actorRole', actor.actorRole);
  addRequiredStringError(errors, 'actor.organizationId', actor.organizationId);

  if (nonEmpty(actor.actorRole) && toPlatformV7CanonicalRole(actor.actorRole) === null) {
    errors.push({
      code: 'INVALID_ROLE',
      field: 'actor.actorRole',
      message: 'actor.actorRole must map to a canonical platform-v7 role.',
    });
  }
}

function validateResource(errors: P7ValidationError[], resource: P7ResourceScopeDto): void {
  addRequiredStringError(errors, 'resource.resourceType', resource.resourceType);
  addRequiredStringError(errors, 'resource.resourceId', resource.resourceId);
  addRequiredStringError(errors, 'resource.dealId', resource.dealId);
}

function validateAudit(errors: P7ValidationError[], audit: P7AuditMetadataDto): void {
  addRequiredStringError(errors, 'audit.auditId', audit.auditId);
  addRequiredStringError(errors, 'audit.correlationId', audit.correlationId);
  addRequiredStringError(errors, 'audit.reason', audit.reason);
}

function validateIdempotency(
  errors: P7ValidationError[],
  metadata: P7IdempotencyMetadataDto,
  requirements: {
    readonly operationId: boolean;
    readonly bankEventId: boolean;
  },
): void {
  addRequiredStringError(errors, 'idempotency.idempotencyKey', metadata.idempotencyKey);

  if (nonEmpty(metadata.idempotencyKey)) {
    const validation = validatePlatformV7IdempotencyKey(metadata.idempotencyKey);
    if (!validation.ok) {
      validation.issues.forEach((issue) => {
        errors.push({
          code: 'INVALID_IDEMPOTENCY_KEY',
          field: 'idempotency.idempotencyKey',
          message: issue,
        });
      });
    }
  }

  if (requirements.operationId) {
    addRequiredStringError(errors, 'idempotency.operationId', metadata.operationId ?? '');
  }

  if (requirements.bankEventId) {
    addRequiredStringError(errors, 'idempotency.bankEventId', metadata.bankEventId ?? '');
  }
}

function validateBase(
  input: P7RuntimeRequestBaseDto,
  requirements: {
    readonly operationId: boolean;
    readonly bankEventId: boolean;
  },
): P7ValidationError[] {
  const errors: P7ValidationError[] = [];

  validateActor(errors, input.actor);
  validateResource(errors, input.resource);
  validateAudit(errors, input.audit);
  validateIdempotency(errors, input.idempotency, requirements);

  return errors;
}

function result<T>(input: T, errors: readonly P7ValidationError[]): P7ValidationResult<T> {
  return errors.length === 0
    ? { ok: true, value: input }
    : { ok: false, errors };
}

export function toP7CanonicalActorRole(actor: P7ActorScopeDto): PlatformV7CanonicalRole | null {
  return toPlatformV7CanonicalRole(actor.actorRole);
}

export function validateP7MoneyActionRequestDto(input: P7MoneyActionRequestDto): P7ValidationResult<P7MoneyActionRequestDto> {
  const errors = validateBase(input, { operationId: true, bankEventId: false });

  if (!includesValue(MONEY_ACTIONS, input.action)) {
    errors.push({
      code: 'INVALID_ACTION',
      field: 'action',
      message: 'action must be a supported money action.',
    });
  }

  addPositiveAmountError(errors, 'amount', input.amount);
  addCurrencyError(errors, 'currency', input.currency);

  return result(input, errors);
}

export function validateP7DocumentActionRequestDto(input: P7DocumentActionRequestDto): P7ValidationResult<P7DocumentActionRequestDto> {
  const errors = validateBase(input, { operationId: true, bankEventId: false });

  if (!includesValue(DOCUMENT_ACTIONS, input.action)) {
    errors.push({
      code: 'INVALID_ACTION',
      field: 'action',
      message: 'action must be a supported document action.',
    });
  }

  if (!includesValue(DOCUMENT_STATUSES, input.documentStatus)) {
    errors.push({
      code: 'INVALID_STATUS',
      field: 'documentStatus',
      message: 'documentStatus must be a supported document status.',
    });
  }

  addRequiredStringError(errors, 'documentId', input.documentId);

  if (input.documentMetadata?.ownerRole && toPlatformV7CanonicalRole(input.documentMetadata.ownerRole) === null) {
    errors.push({
      code: 'INVALID_ROLE',
      field: 'documentMetadata.ownerRole',
      message: 'documentMetadata.ownerRole must map to a canonical platform-v7 role.',
    });
  }

  return result(input, errors);
}

export function validateP7BankBasisSendRequestDto(input: P7BankBasisSendRequestDto): P7ValidationResult<P7BankBasisSendRequestDto> {
  const errors = validateBase(input, { operationId: true, bankEventId: false });

  addNonEmptyArrayError(errors, 'basisDocumentIds', input.basisDocumentIds);

  return result(input, errors);
}

export function validateP7BankConfirmationRequestDto(input: P7BankConfirmationRequestDto): P7ValidationResult<P7BankConfirmationRequestDto> {
  const errors = validateBase(input, { operationId: true, bankEventId: true });

  addRequiredStringError(errors, 'bankEventId', input.bankEventId);
  addRequiredStringError(errors, 'bankOrganizationId', input.bankOrganizationId);
  addRequiredStringError(errors, 'operationId', input.operationId);
  addPositiveAmountError(errors, 'amount', input.amount);
  addCurrencyError(errors, 'currency', input.currency);

  if (!includesValue(BANK_CONFIRMATION_PATHS, input.path)) {
    errors.push({
      code: 'INVALID_PATH',
      field: 'path',
      message: 'path must be a supported bank confirmation path.',
    });
  }

  if (!includesValue(BANK_CONFIRMATION_ACTIONS, input.action)) {
    errors.push({
      code: 'INVALID_ACTION',
      field: 'action',
      message: 'action must be a supported bank confirmation action.',
    });
  }

  return result(input, errors);
}

export function validateP7ReleaseRequestDto(input: P7ReleaseRequestDto): P7ValidationResult<P7ReleaseRequestDto> {
  const errors = validateBase(input, { operationId: true, bankEventId: false });

  addPositiveAmountError(errors, 'amount', input.amount);
  addCurrencyError(errors, 'currency', input.currency);

  return result(input, errors);
}

export function validateP7RefundRequestDto(input: P7RefundRequestDto): P7ValidationResult<P7RefundRequestDto> {
  const errors = validateBase(input, { operationId: true, bankEventId: true });

  addRequiredStringError(errors, 'bankEventId', input.bankEventId);
  addRequiredStringError(errors, 'bankOrganizationId', input.bankOrganizationId);
  addPositiveAmountError(errors, 'amount', input.amount);
  addCurrencyError(errors, 'currency', input.currency);

  return result(input, errors);
}

export function validateP7HoldRequestDto(input: P7HoldRequestDto): P7ValidationResult<P7HoldRequestDto> {
  const errors = validateBase(input, { operationId: true, bankEventId: true });

  addRequiredStringError(errors, 'bankEventId', input.bankEventId);
  addRequiredStringError(errors, 'bankOrganizationId', input.bankOrganizationId);
  addPositiveAmountError(errors, 'amount', input.amount);
  addCurrencyError(errors, 'currency', input.currency);

  return result(input, errors);
}

export function validateP7ArbitrationBasisRequestDto(input: P7ArbitrationBasisRequestDto): P7ValidationResult<P7ArbitrationBasisRequestDto> {
  const errors = validateBase(input, { operationId: true, bankEventId: false });

  addRequiredStringError(errors, 'arbitrationDecisionId', input.arbitrationDecisionId);
  addNonEmptyArrayError(errors, 'basisDocumentIds', input.basisDocumentIds);
  addNonNegativeAmountError(errors, 'uncontestedAmount', input.uncontestedAmount);
  addNonNegativeAmountError(errors, 'disputedAmount', input.disputedAmount);
  addNonNegativeAmountError(errors, 'releaseAmount', input.releaseAmount);
  addNonNegativeAmountError(errors, 'refundAmount', input.refundAmount);
  addNonNegativeAmountError(errors, 'heldAmount', input.heldAmount);
  addNonNegativeAmountError(errors, 'feeAmount', input.feeAmount);
  addNonNegativeAmountError(errors, 'penaltyAmount', input.penaltyAmount);
  addCurrencyError(errors, 'currency', input.currency);

  return result(input, errors);
}
