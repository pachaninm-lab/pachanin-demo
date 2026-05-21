import { describe, expect, it } from 'vitest';
import {
  PLATFORM_V7_ACTION_MESSAGE_TO_RUNTIME_CONTRACT,
  PLATFORM_V7_RUNTIME_ACTION_CONTRACTS,
  platformV7RuntimeActionContract,
  platformV7RuntimeActionForMessage,
  platformV7RuntimeActionRequiresExternalConfirmation,
} from '@/lib/platform-v7/runtime-action-contract';

const forbiddenSuccessStates = ['confirmed', 'released', 'paid', 'completed', 'live', 'external_confirmed'];

describe('platform-v7 runtime action contract safety', () => {
  it('keeps runtime action ids unique and resolvable', () => {
    const ids = PLATFORM_V7_RUNTIME_ACTION_CONTRACTS.map((contract) => contract.id);

    expect(new Set(ids).size).toBe(ids.length);

    for (const id of ids) {
      expect(platformV7RuntimeActionContract(id)).toEqual(expect.objectContaining({ id }));
    }
  });

  it('keeps every runtime action explicitly non-confirming externally', () => {
    for (const contract of PLATFORM_V7_RUNTIME_ACTION_CONTRACTS) {
      expect(contract.doesNotConfirmExternally).toBe(true);
      expect(contract.copySafetyNote.toLowerCase()).not.toContain('production-ready');
      expect(contract.copySafetyNote.toLowerCase()).not.toContain('fully live');
      expect(contract.copySafetyNote.toLowerCase()).not.toContain('fully integrated');
    }
  });

  it('keeps external-system actions in pending or manual-review states only', () => {
    const externalContracts = PLATFORM_V7_RUNTIME_ACTION_CONTRACTS.filter((contract) => contract.externalSystem !== 'none');

    expect(externalContracts.length).toBeGreaterThan(0);

    for (const contract of externalContracts) {
      expect(contract.requiresExternalConfirmation).toBe(true);
      expect(platformV7RuntimeActionRequiresExternalConfirmation(contract.id)).toBe(true);
      expect(['pending_external_confirmation', 'pending_bank_review', 'manual_review_required']).toContain(contract.resultingState);

      for (const forbiddenState of forbiddenSuccessStates) {
        expect(contract.resultingState).not.toContain(forbiddenState);
      }
    }
  });

  it('keeps bank runtime actions as review requests, not payment release confirmations', () => {
    const bankContracts = PLATFORM_V7_RUNTIME_ACTION_CONTRACTS.filter((contract) => contract.externalSystem === 'bank');

    expect(bankContracts.length).toBeGreaterThan(0);

    for (const contract of bankContracts) {
      expect(contract.requiresExternalConfirmation).toBe(true);
      expect(contract.resultingState).toBe('pending_bank_review');
      expect(contract.copySafetyNote).not.toContain('подтверждает выплату');
      expect(contract.copySafetyNote).not.toContain('выпускает деньги');
      expect(contract.copySafetyNote).toMatch(/не|Не/);
    }
  });

  it('maps legacy user actions only to safe runtime contracts', () => {
    for (const [messageId, runtimeActionId] of Object.entries(PLATFORM_V7_ACTION_MESSAGE_TO_RUNTIME_CONTRACT)) {
      const contract = platformV7RuntimeActionForMessage(messageId as keyof typeof PLATFORM_V7_ACTION_MESSAGE_TO_RUNTIME_CONTRACT);

      expect(contract).toEqual(expect.objectContaining({ id: runtimeActionId }));
      expect(contract?.doesNotConfirmExternally).toBe(true);
    }
  });
});
