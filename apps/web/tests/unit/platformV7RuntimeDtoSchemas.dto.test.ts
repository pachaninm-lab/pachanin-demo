import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildPlatformV7IdempotencyKey } from '@/lib/platform-v7/idempotency-key-helper';
import {
  validateP7ArbitrationBasisRequestDto,
  validateP7BankBasisSendRequestDto,
  validateP7BankConfirmationRequestDto,
  validateP7DocumentActionRequestDto,
  validateP7HoldRequestDto,
  validateP7MoneyActionRequestDto,
  validateP7RefundRequestDto,
  validateP7ReleaseRequestDto,
  type P7ActorScopeDto,
  type P7AuditMetadataDto,
  type P7BankConfirmationRequestDto,
  type P7IdempotencyMetadataDto,
  type P7ResourceScopeDto,
  type P7ValidationError,
  type P7ValidationResult,
} from '@/lib/platform-v7/runtime/dto-schemas';

const actor: P7ActorScopeDto = {
  actorId: 'user-bank-1',
  actorRole: 'bank_officer',
  organizationId: 'org-bank',
};

const resource: P7ResourceScopeDto = {
  resourceType: 'money',
  resourceId: 'money-deal-1',
  dealId: 'deal-1',
  bankOrganizationId: 'org-bank',
};

const audit: P7AuditMetadataDto = {
  auditId: 'audit-1',
  correlationId: 'corr-1',
  reason: 'Validate request shape before runtime service execution.',
};

function key(entityId: string, amountMinor = 1000): string {
  return buildPlatformV7IdempotencyKey({
    boundaryId: 'confirm_money_released',
    actorId: actor.actorId,
    entityId,
    dealId: resource.dealId,
    amountMinor,
    currency: 'RUB',
    attemptId: 'attempt-1',
  });
}

function idempotency(entityId: string, amountMinor = 1000): P7IdempotencyMetadataDto {
  return {
    idempotencyKey: key(entityId, amountMinor),
    operationId: `operation-${entityId}`,
  };
}

function bankIdempotency(entityId: string, amountMinor = 1000): P7IdempotencyMetadataDto {
  return {
    ...idempotency(entityId, amountMinor),
    bankEventId: `bank-event-${entityId}`,
  };
}

function bankConfirmation(overrides: Partial<P7BankConfirmationRequestDto> = {}): P7BankConfirmationRequestDto {
  return {
    actor,
    resource: { ...resource, resourceType: 'bank', resourceId: 'bank-basis-1' },
    audit,
    idempotency: bankIdempotency('bank-release'),
    bankEventId: 'bank-event-bank-release',
    bankOrganizationId: 'org-bank',
    operationId: 'operation-bank-release',
    amount: 1000,
    currency: 'RUB',
    path: 'release',
    action: 'bank_release_confirmed',
    ...overrides,
  };
}

function expectInvalid<T>(
  result: P7ValidationResult<T>,
): { readonly ok: false; readonly errors: readonly P7ValidationError[] } {
  expect(result.ok).toBe(false);
  if ('errors' in result) {
    return result;
  }

  throw new Error('Expected validation to fail.');
}

describe('platform-v7 runtime DTO schemas', () => {
  it('valid money action DTO passes', () => {
    const result = validateP7MoneyActionRequestDto({
      actor,
      resource,
      audit,
      idempotency: idempotency('money-release'),
      action: 'release_requested',
      amount: 1000,
      currency: 'RUB',
    });

    expect(result).toEqual({
      ok: true,
      value: {
        actor,
        resource,
        audit,
        idempotency: idempotency('money-release'),
        action: 'release_requested',
        amount: 1000,
        currency: 'RUB',
      },
    });
  });

  it('valid document action DTO passes', () => {
    const result = validateP7DocumentActionRequestDto({
      actor: { ...actor, actorRole: 'operator' },
      resource: { ...resource, resourceType: 'document', resourceId: 'doc-1' },
      audit,
      idempotency: idempotency('document-confirm'),
      action: 'document_confirmed',
      documentId: 'acceptance_act',
      documentStatus: 'confirmed',
      documentMetadata: {
        type: 'acceptance_act',
        source: 'elevator',
        signatureStatus: 'signed',
        ownerRole: 'elevator_operator',
      },
    });

    expect(result.ok).toBe(true);
  });

  it('valid bank basis send DTO passes', () => {
    const result = validateP7BankBasisSendRequestDto({
      actor: { ...actor, actorRole: 'operator' },
      resource: { ...resource, resourceType: 'bank', resourceId: 'bank-basis-1' },
      audit,
      idempotency: idempotency('bank-basis-send'),
      basisDocumentIds: ['contract', 'acceptance_act', 'lab_protocol', 'bank_basis'],
    });

    expect(result.ok).toBe(true);
  });

  it('valid bank confirmation DTO passes', () => {
    expect(validateP7BankConfirmationRequestDto(bankConfirmation()).ok).toBe(true);
  });

  it('valid release, refund and hold request DTOs pass', () => {
    expect(validateP7ReleaseRequestDto({
      actor: { ...actor, actorRole: 'seller' },
      resource,
      audit,
      idempotency: idempotency('release-request'),
      amount: 1000,
      currency: 'RUB',
    }).ok).toBe(true);

    expect(validateP7RefundRequestDto({
      actor,
      resource,
      audit,
      idempotency: bankIdempotency('refund-request'),
      amount: 400,
      currency: 'RUB',
      bankEventId: 'bank-event-refund-request',
      bankOrganizationId: 'org-bank',
    }).ok).toBe(true);

    expect(validateP7HoldRequestDto({
      actor,
      resource,
      audit,
      idempotency: bankIdempotency('hold-request'),
      amount: 300,
      currency: 'RUB',
      bankEventId: 'bank-event-hold-request',
      bankOrganizationId: 'org-bank',
    }).ok).toBe(true);
  });

  it('valid arbitration basis DTO passes without balancing split amounts', () => {
    const result = validateP7ArbitrationBasisRequestDto({
      actor: { ...actor, actorRole: 'arbitrator' },
      resource: { ...resource, resourceType: 'dispute', resourceId: 'dispute-1' },
      audit,
      idempotency: idempotency('arbitration-basis'),
      arbitrationDecisionId: 'arb-1',
      basisDocumentIds: ['arbitration_decision', 'bank_basis'],
      uncontestedAmount: 100,
      disputedAmount: 1000,
      releaseAmount: 1,
      refundAmount: 2,
      heldAmount: 3,
      feeAmount: 0,
      penaltyAmount: 0,
      currency: 'RUB',
    });

    expect(result.ok).toBe(true);
  });

  it('invalid idempotency metadata is rejected with accumulated errors', () => {
    const result = validateP7MoneyActionRequestDto({
      actor,
      resource,
      audit,
      idempotency: { idempotencyKey: 'bad-key', operationId: '' },
      action: 'release_requested',
      amount: 1000,
      currency: 'RUB',
    });

    const invalid = expectInvalid(result);

    expect(invalid.errors.some((error) => error.code === 'INVALID_IDEMPOTENCY_KEY')).toBe(true);
    expect(invalid.errors.some((error) => error.field === 'idempotency.operationId')).toBe(true);
    expect(invalid.errors).not.toHaveLength(1);
  });

  it('invalid actorRole is rejected', () => {
    const result = validateP7MoneyActionRequestDto({
      actor: { ...actor, actorRole: 'shadow_admin' },
      resource,
      audit,
      idempotency: idempotency('invalid-role'),
      action: 'release_requested',
      amount: 1000,
      currency: 'RUB',
    });

    const invalid = expectInvalid(result);

    expect(invalid.errors).toContainEqual({
      code: 'INVALID_ROLE',
      field: 'actor.actorRole',
      message: 'actor.actorRole must map to a canonical platform-v7 role.',
    });
  });

  it('invalid amount is rejected', () => {
    const result = validateP7ReleaseRequestDto({
      actor,
      resource,
      audit,
      idempotency: idempotency('bad-amount'),
      amount: 0,
      currency: 'RUB',
    });

    const invalid = expectInvalid(result);

    expect(invalid.errors.some((error) => error.field === 'amount')).toBe(true);
  });

  it('rejects fractional positive amount for release DTO', () => {
    const result = validateP7ReleaseRequestDto({
      actor,
      resource,
      audit,
      idempotency: idempotency('fractional-amount'),
      amount: 1.5,
      currency: 'RUB',
    });

    const invalid = expectInvalid(result);

    expect(invalid.errors).toContainEqual({
      code: 'INVALID_AMOUNT',
      field: 'amount',
      message: 'amount must be a finite positive integer.',
    });
  });

  it('rejects fractional arbitration split amount without enforcing business balance', () => {
    const result = validateP7ArbitrationBasisRequestDto({
      actor: { ...actor, actorRole: 'arbitrator' },
      resource: { ...resource, resourceType: 'dispute', resourceId: 'dispute-1' },
      audit,
      idempotency: idempotency('fractional-arbitration'),
      arbitrationDecisionId: 'arb-1',
      basisDocumentIds: ['arbitration_decision'],
      uncontestedAmount: 100,
      disputedAmount: 1000,
      releaseAmount: 1.5,
      refundAmount: 2,
      heldAmount: 3,
      feeAmount: 0,
      penaltyAmount: 0,
      currency: 'RUB',
    });

    const invalid = expectInvalid(result);

    expect(invalid.errors).toEqual([
      {
        code: 'INVALID_AMOUNT',
        field: 'releaseAmount',
        message: 'releaseAmount must be a finite non-negative integer.',
      },
    ]);
  });

  it('missing bankEventId and bankOrganizationId are rejected for bank confirmation', () => {
    const result = validateP7BankConfirmationRequestDto(bankConfirmation({
      idempotency: {
        idempotencyKey: key('missing-bank-event'),
        operationId: 'operation-missing-bank-event',
        bankEventId: '',
      },
      bankEventId: '',
      bankOrganizationId: '',
    }));

    const invalid = expectInvalid(result);

    expect(invalid.errors.some((error) => error.field === 'idempotency.bankEventId')).toBe(true);
    expect(invalid.errors.some((error) => error.field === 'bankEventId')).toBe(true);
    expect(invalid.errors.some((error) => error.field === 'bankOrganizationId')).toBe(true);
  });

  it('invalid basisDocumentIds are rejected', () => {
    const result = validateP7BankBasisSendRequestDto({
      actor,
      resource: { ...resource, resourceType: 'bank', resourceId: 'bank-basis-1' },
      audit,
      idempotency: idempotency('bad-basis-docs'),
      basisDocumentIds: [],
    });

    const invalid = expectInvalid(result);

    expect(invalid.errors).toContainEqual({
      code: 'INVALID_ARRAY',
      field: 'basisDocumentIds',
      message: 'basisDocumentIds must contain at least one non-empty id.',
    });
  });

  it('does not call domain mutation, readiness, release gate or action-boundary executors', () => {
    const source = readFileSync(join(process.cwd(), 'lib/platform-v7/runtime/dto-schemas.ts'), 'utf8');

    [
      'platformV7ApplyMoneyOperation',
      'platformV7ReleaseGate',
      'isBankBasisReady',
      'platformV7DocumentsBlockingStage',
      'executePlatformV7MoneyAction',
      'executePlatformV7DocumentAction',
      'executePlatformV7BankBasisAction',
      'p7BuildArbitrationBasisPayload',
    ].forEach((forbiddenCall) => {
      expect(source).not.toContain(forbiddenCall);
    });
  });

  it('has no forbidden copy in DTO schemas', () => {
    const source = readFileSync(join(process.cwd(), 'lib/platform-v7/runtime/dto-schemas.ts'), 'utf8');
    const forbiddenCopy = [
      'production-ready',
      'fully live',
      'fully integrated',
      'платформа гарантирует оплату',
      'платформа выпускает деньги',
      'платформа сама выпускает деньги',
      'platform guarantees payment',
      'platform itself releases money',
      'bank confirmed automatically',
    ];

    forbiddenCopy.forEach((copy) => {
      expect(source.toLowerCase()).not.toContain(copy.toLowerCase());
    });
  });

  it('has no runtime implementation markers or module-level persistence state', () => {
    const source = readFileSync(join(process.cwd(), 'lib/platform-v7/runtime/dto-schemas.ts'), 'utf8');

    expect(source).not.toMatch(/\bclass\b/);
    expect(source).not.toMatch(/\bany\b/);
    expect(source).not.toMatch(/errors:\s*string\[\]/);
    expect(source).not.toMatch(/new\s+Map\b/);
    expect(source).not.toMatch(/new\s+Set\b/);
    expect(source).not.toContain("'use server'");
    expect(source).not.toContain('"use server"');
  });
});
