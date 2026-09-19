import type { PlatformV7ApiBoundaryId } from './api-boundary-contracts';
import { getPlatformV7ApiPayloadContract } from './api-payload-contracts';

export type PlatformV7PayloadValidationIssueCode =
  | 'contract_not_found'
  | 'empty_payload'
  | 'missing_required_field'
  | 'missing_money_amount'
  | 'missing_evidence_reference'
  | 'missing_external_reference';

export type PlatformV7PayloadValidationIssue = {
  readonly code: PlatformV7PayloadValidationIssueCode;
  readonly field?: string;
  readonly message: string;
};

export type PlatformV7PayloadValidationResult = {
  readonly ok: boolean;
  readonly boundaryId: PlatformV7ApiBoundaryId;
  readonly issues: readonly PlatformV7PayloadValidationIssue[];
};

const isPlainRecord = (payload: unknown): payload is Record<string, unknown> =>
  typeof payload === 'object' && payload !== null && !Array.isArray(payload);

const hasValue = (payload: Record<string, unknown>, field: string): boolean => {
  if (!(field in payload)) return false;

  const value = payload[field];

  if (value === null || value === undefined) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;

  return true;
};

const hasAnyRequiredFieldContaining = (payload: Record<string, unknown>, fieldPart: string): boolean =>
  Object.keys(payload).some((field) => field.toLowerCase().includes(fieldPart.toLowerCase()) && hasValue(payload, field));

export function validatePlatformV7ApiPayload(
  boundaryId: PlatformV7ApiBoundaryId,
  payload: unknown,
): PlatformV7PayloadValidationResult {
  const contract = getPlatformV7ApiPayloadContract(boundaryId);

  if (!contract) {
    return {
      ok: false,
      boundaryId,
      issues: [
        {
          code: 'contract_not_found',
          message: `Payload contract not found for boundary ${boundaryId}.`,
        },
      ],
    };
  }

  const issues: PlatformV7PayloadValidationIssue[] = [];

  if (!isPlainRecord(payload) || Object.keys(payload).length === 0) {
    if (contract.rejectsEmptyPayload) {
      issues.push({
        code: 'empty_payload',
        message: `Boundary ${boundaryId} rejects empty payloads.`,
      });
    }

    return { ok: issues.length === 0, boundaryId, issues };
  }

  for (const field of contract.requiredFields) {
    if (!hasValue(payload, field.name)) {
      issues.push({
        code: 'missing_required_field',
        field: field.name,
        message: `Required field ${field.name} is missing for boundary ${boundaryId}.`,
      });
    }
  }

  if (contract.requiresMoneyAmount && !hasAnyRequiredFieldContaining(payload, 'amount')) {
    issues.push({
      code: 'missing_money_amount',
      field: 'amountMinor',
      message: `Boundary ${boundaryId} requires a money amount field.`,
    });
  }

  if (contract.requiresEvidenceReference && !hasAnyRequiredFieldContaining(payload, 'evidence') && !hasAnyRequiredFieldContaining(payload, 'fileRef')) {
    issues.push({
      code: 'missing_evidence_reference',
      message: `Boundary ${boundaryId} requires an evidence reference.`,
    });
  }

  if (contract.requiresExternalReference && !hasAnyRequiredFieldContaining(payload, 'external') && !hasAnyRequiredFieldContaining(payload, 'bankReferenceId')) {
    issues.push({
      code: 'missing_external_reference',
      message: `Boundary ${boundaryId} requires an external confirmation reference.`,
    });
  }

  return { ok: issues.length === 0, boundaryId, issues };
}

export function assertPlatformV7ApiPayload(boundaryId: PlatformV7ApiBoundaryId, payload: unknown) {
  const result = validatePlatformV7ApiPayload(boundaryId, payload);

  if (!result.ok) {
    throw new Error(result.issues.map((issue) => issue.message).join(' '));
  }

  return payload;
}
