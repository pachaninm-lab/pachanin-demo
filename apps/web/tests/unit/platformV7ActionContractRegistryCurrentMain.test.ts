import { describe, expect, it } from 'vitest';
import {
  ACTION_CONTRACT_REGISTRY,
  REGISTRY_ACTION_IDS,
  getContractById,
} from '../../lib/platform-v7/action-contract-registry';

const REQUIRED_ACTION_IDS = [
  'seller_send_sdiz_etn',
  'buyer_request_reserve_confirmation',
  'bank_review_release_conditions',
  'operator_resolve_dispute',
  'elevator_confirm_acceptance',
  'lab_attach_quality_protocol',
  'logistics_close_trip_docs',
] as const;

const VALID_IDEMPOTENCY_CLASSES = ['safe_to_retry', 'requires_confirmation', 'one_shot'] as const;
const VALID_MONEY_IMPACTS = ['none', 'blocks_release', 'affects_hold', 'informs_reserve', 'requires_bank_review'] as const;

const FORBIDDEN = [
  /production-ready/i,
  /fully live/i,
  /fully integrated/i,
  /live callback/i,
  /real persistence/i,
  /append-only persistence is active/i,
  /bank confirmed/i,
  /money transferred/i,
  /payout completed/i,
  /platform releases money by itself/i,
  /platform guarantees payment/i,
  /bypass impossible/i,
  /no risks/i,
  /деньги переведены/i,
  /выплата выполнена/i,
  /платформа выпускает деньги/i,
  /платформа гарантирует оплату/i,
  /нет рисков/i,
];

function assertNoForbidden(text: string, label: string) {
  for (const pattern of FORBIDDEN) {
    expect(text, `${label} contains forbidden wording: ${pattern}`).not.toMatch(pattern);
  }
  expect(text).not.toContain('/platform-v7/demo/');
}

describe('platform-v7 action contract registry', () => {
  it('contains exactly the required controlled-pilot actions', () => {
    expect(ACTION_CONTRACT_REGISTRY).toHaveLength(REQUIRED_ACTION_IDS.length);
    expect([...REGISTRY_ACTION_IDS].sort()).toEqual([...REQUIRED_ACTION_IDS].sort());
  });

  it('has unique action ids', () => {
    const ids = ACTION_CONTRACT_REGISTRY.map((contract) => contract.actionId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('resolves known ids and returns undefined for unknown ids', () => {
    for (const actionId of REQUIRED_ACTION_IDS) {
      expect(getContractById(actionId)?.actionId).toBe(actionId);
    }
    expect(getContractById('unknown_action')).toBeUndefined();
  });

  it('every contract has required fields', () => {
    for (const contract of ACTION_CONTRACT_REGISTRY) {
      expect(contract.actionId).toBeTruthy();
      expect(contract.label).toBeTruthy();
      expect(contract.actorRole).toBeTruthy();
      expect(contract.targetEntity).toBeTruthy();
      expect(contract.requiredEvidence.length).toBeGreaterThan(0);
      expect(contract.moneyImpactLabel).toBeTruthy();
      expect(contract.documentImpact).toBeTruthy();
      expect(contract.idempotencyLabel).toBeTruthy();
      expect(contract.allowedCurrentStates.length).toBeGreaterThan(0);
      expect(contract.blockedCurrentStates.length).toBeGreaterThan(0);
      expect(contract.externalBoundary).toBeTruthy();
      expect(contract.auditDraftLabel).toBeTruthy();
      expect(contract.safeFallback).toBeTruthy();
      expect(contract.pilotNote).toBeTruthy();
    }
  });

  it('uses valid idempotency classes and money impact values', () => {
    for (const contract of ACTION_CONTRACT_REGISTRY) {
      expect(VALID_IDEMPOTENCY_CLASSES).toContain(contract.idempotencyClass);
      expect(VALID_MONEY_IMPACTS).toContain(contract.moneyImpact);
    }
  });

  it('does not overlap allowed and blocked states', () => {
    for (const contract of ACTION_CONTRACT_REGISTRY) {
      const allowed = new Set(contract.allowedCurrentStates);
      for (const blockedState of contract.blockedCurrentStates) {
        expect(allowed.has(blockedState), `${contract.actionId} overlaps on ${blockedState}`).toBe(false);
      }
    }
  });

  it('every audit draft is clearly a preview', () => {
    for (const contract of ACTION_CONTRACT_REGISTRY) {
      expect(contract.auditDraftLabel).toMatch(/^аудит-предпросмотр/);
    }
  });

  it('every pilot note states controlled pilot and manual review', () => {
    for (const contract of ACTION_CONTRACT_REGISTRY) {
      expect(contract.pilotNote.toLowerCase()).toContain('контролируемый пилот');
      expect(contract.pilotNote.toLowerCase()).toContain('требует ручной проверки');
    }
  });

  it('every money impact has a non-empty operational explanation', () => {
    for (const contract of ACTION_CONTRACT_REGISTRY) {
      expect(contract.moneyImpactLabel.length).toBeGreaterThan(20);
      expect(contract.moneyImpactLabel.toLowerCase()).not.toContain('переведены');
      expect(contract.moneyImpactLabel.toLowerCase()).not.toContain('выполнена');
    }
  });

  it('every blocked action has a safe fallback', () => {
    for (const contract of ACTION_CONTRACT_REGISTRY) {
      expect(contract.blockedCurrentStates.length).toBeGreaterThan(0);
      expect(contract.safeFallback.length).toBeGreaterThan(20);
    }
  });

  it('registry avoids unsafe copy and fake execution claims', () => {
    assertNoForbidden(JSON.stringify(ACTION_CONTRACT_REGISTRY), 'ACTION_CONTRACT_REGISTRY');
  });
});
