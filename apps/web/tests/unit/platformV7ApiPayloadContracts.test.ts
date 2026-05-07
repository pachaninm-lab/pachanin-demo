import { describe, expect, it } from 'vitest';
import {
  getPlatformV7ApiPayloadContract,
  getPlatformV7ApiPayloadReadinessSummary,
  getPlatformV7PayloadContractsRequiringEvidence,
  getPlatformV7PayloadContractsRequiringExternalReference,
  getPlatformV7PayloadContractsRequiringMoneyAmount,
  getPlatformV7RequiredPayloadFieldNames,
  PLATFORM_V7_API_PAYLOAD_CONTRACTS,
} from '@/lib/platform-v7/api-payload-contracts';

describe('platform-v7 api payload contracts', () => {
  it('keeps payload layer explicitly contract-only', () => {
    expect(getPlatformV7ApiPayloadReadinessSummary()).toMatchObject({
      total: 20,
      rejectingEmptyPayload: 20,
      mode: 'contract_only_requires_validation_runtime',
    });
  });

  it('rejects empty payloads for every contracted write endpoint', () => {
    expect(PLATFORM_V7_API_PAYLOAD_CONTRACTS.every((contract) => contract.rejectsEmptyPayload)).toBe(true);
    expect(PLATFORM_V7_API_PAYLOAD_CONTRACTS.every((contract) => contract.requiredFields.length > 0)).toBe(true);
  });

  it('requires money amounts for money-sensitive payloads', () => {
    const moneyContracts = getPlatformV7PayloadContractsRequiringMoneyAmount();

    expect(moneyContracts.map((contract) => contract.boundaryId)).toEqual([
      'request_money_reserve',
      'confirm_money_reserved',
      'mark_money_ready_to_release',
      'confirm_money_released',
      'open_dispute',
    ]);
    expect(moneyContracts.every((contract) => getPlatformV7RequiredPayloadFieldNames(contract.boundaryId).some((field) => field.includes('amount')))).toBe(true);
  });

  it('requires bank references for bank confirmation payloads', () => {
    expect(getPlatformV7RequiredPayloadFieldNames('confirm_money_reserved')).toContain('bankReferenceId');
    expect(getPlatformV7RequiredPayloadFieldNames('confirm_money_released')).toContain('bankReferenceId');
    expect(getPlatformV7PayloadContractsRequiringExternalReference().map((contract) => contract.boundaryId)).toEqual([
      'confirm_money_reserved',
      'confirm_money_released',
      'accept_document',
    ]);
  });

  it('requires evidence for document, trip, incident and dispute payloads', () => {
    const evidenceBoundaries = getPlatformV7PayloadContractsRequiringEvidence().map((contract) => contract.boundaryId);

    expect(evidenceBoundaries).toEqual([
      'mark_money_ready_to_release',
      'upload_document',
      'accept_document',
      'mark_trip_arrived',
      'accept_trip',
      'open_incident',
      'open_dispute',
      'resolve_dispute',
    ]);
  });

  it('keeps disputes from opening without reason, claim amount and evidence refs', () => {
    expect(getPlatformV7RequiredPayloadFieldNames('open_dispute')).toEqual([
      'dealId',
      'reason',
      'claimAmountMinor',
      'evidenceRefs',
    ]);
  });

  it('keeps uploaded documents unconfirmed by payload contract wording', () => {
    expect(getPlatformV7ApiPayloadContract('upload_document')).toMatchObject({
      requiresEvidenceReference: true,
      requiresExternalReference: false,
    });
    expect(getPlatformV7ApiPayloadContract('upload_document')?.summary).toContain('not an accepted');
  });
});
