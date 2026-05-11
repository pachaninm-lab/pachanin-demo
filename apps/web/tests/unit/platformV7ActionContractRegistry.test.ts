/**
 * Action contract registry tests — platform-v7.
 *
 * Guards the controlled-pilot contract layer for correctness and safe wording.
 * Does not test runtime behaviour — only the static registry data.
 */
import { describe, it, expect } from 'vitest';
import {
  ACTION_CONTRACT_REGISTRY,
  REGISTRY_ACTION_IDS,
  FORBIDDEN_CONTRACT_WORDING,
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
const VALID_MONEY_IMPACTS = [
  'none',
  'blocks_release',
  'affects_hold',
  'informs_reserve',
  'requires_bank_review',
] as const;

// ─── Registry completeness ─────────────────────────────────────────────────────

describe('action contract registry — completeness', () => {
  it('has exactly 7 contracts (one per required action)', () => {
    expect(ACTION_CONTRACT_REGISTRY).toHaveLength(7);
  });

  for (const id of REQUIRED_ACTION_IDS) {
    it(`includes required action: ${id}`, () => {
      const found = getContractById(id);
      expect(
        found,
        `Required action "${id}" must be in ACTION_CONTRACT_REGISTRY`,
      ).toBeDefined();
    });
  }

  it('REGISTRY_ACTION_IDS contains all required ids', () => {
    for (const id of REQUIRED_ACTION_IDS) {
      expect(REGISTRY_ACTION_IDS).toContain(id);
    }
  });
});

// ─── Unique action ids ─────────────────────────────────────────────────────────

describe('action contract registry — unique action ids', () => {
  it('has no duplicate action ids', () => {
    const ids = ACTION_CONTRACT_REGISTRY.map((c) => c.actionId);
    const unique = new Set(ids);
    expect(
      unique.size,
      `Registry has duplicate action ids: ${ids.filter((id, i) => ids.indexOf(id) !== i).join(', ')}`,
    ).toBe(ids.length);
  });

  it('getContractById returns the matching contract', () => {
    const contract = getContractById('seller_send_sdiz_etn');
    expect(contract).toBeDefined();
    expect(contract!.actionId).toBe('seller_send_sdiz_etn');
  });

  it('getContractById returns undefined for unknown id', () => {
    expect(getContractById('nonexistent_action')).toBeUndefined();
    expect(getContractById('')).toBeUndefined();
  });
});

// ─── Field value validation ───────────────────────────────────────────────────

describe('action contract registry — field values', () => {
  it('every contract has all required fields with truthy values', () => {
    for (const contract of ACTION_CONTRACT_REGISTRY) {
      expect(contract.actionId, `actionId missing`).toBeTruthy();
      expect(contract.label, `label missing for ${contract.actionId}`).toBeTruthy();
      expect(contract.actorRole, `actorRole missing for ${contract.actionId}`).toBeTruthy();
      expect(contract.targetEntity, `targetEntity missing for ${contract.actionId}`).toBeTruthy();
      expect(contract.moneyImpactLabel, `moneyImpactLabel missing for ${contract.actionId}`).toBeTruthy();
      expect(contract.documentImpact, `documentImpact missing for ${contract.actionId}`).toBeTruthy();
      expect(contract.idempotencyLabel, `idempotencyLabel missing for ${contract.actionId}`).toBeTruthy();
      expect(contract.externalBoundary, `externalBoundary missing for ${contract.actionId}`).toBeTruthy();
      expect(contract.auditDraftLabel, `auditDraftLabel missing for ${contract.actionId}`).toBeTruthy();
      expect(contract.safeFallback, `safeFallback missing for ${contract.actionId}`).toBeTruthy();
      expect(contract.pilotNote, `pilotNote missing for ${contract.actionId}`).toBeTruthy();
    }
  });

  it('every contract has a valid idempotency class', () => {
    for (const contract of ACTION_CONTRACT_REGISTRY) {
      expect(
        (VALID_IDEMPOTENCY_CLASSES as readonly string[]).includes(contract.idempotencyClass),
        `Contract "${contract.actionId}" has invalid idempotencyClass: "${contract.idempotencyClass}"`,
      ).toBe(true);
    }
  });

  it('every contract has a valid money impact', () => {
    for (const contract of ACTION_CONTRACT_REGISTRY) {
      expect(
        (VALID_MONEY_IMPACTS as readonly string[]).includes(contract.moneyImpact),
        `Contract "${contract.actionId}" has invalid moneyImpact: "${contract.moneyImpact}"`,
      ).toBe(true);
    }
  });

  it('every contract has at least one required evidence item', () => {
    for (const contract of ACTION_CONTRACT_REGISTRY) {
      expect(
        contract.requiredEvidence.length,
        `Contract "${contract.actionId}" must have at least one required evidence item`,
      ).toBeGreaterThanOrEqual(1);
    }
  });

  it('every contract has at least one allowed and one blocked state', () => {
    for (const contract of ACTION_CONTRACT_REGISTRY) {
      expect(
        contract.allowedCurrentStates.length,
        `Contract "${contract.actionId}" must have at least one allowed state`,
      ).toBeGreaterThanOrEqual(1);
      expect(
        contract.blockedCurrentStates.length,
        `Contract "${contract.actionId}" must have at least one blocked state`,
      ).toBeGreaterThanOrEqual(1);
    }
  });

  it('allowed and blocked states do not overlap', () => {
    for (const contract of ACTION_CONTRACT_REGISTRY) {
      const allowed = new Set(contract.allowedCurrentStates);
      for (const blocked of contract.blockedCurrentStates) {
        expect(
          allowed.has(blocked),
          `Contract "${contract.actionId}": state "${blocked}" appears in both allowed and blocked lists`,
        ).toBe(false);
      }
    }
  });
});

// ─── Audit draft label guard ───────────────────────────────────────────────────

describe('action contract registry — audit draft labels', () => {
  it('every auditDraftLabel starts with аудит-предпросмотр', () => {
    for (const contract of ACTION_CONTRACT_REGISTRY) {
      expect(
        contract.auditDraftLabel,
        `Contract "${contract.actionId}": auditDraftLabel must start with "аудит-предпросмотр"`,
      ).toMatch(/^аудит-предпросмотр/);
    }
  });

  it('every pilotNote contains контролируемый пилот', () => {
    for (const contract of ACTION_CONTRACT_REGISTRY) {
      expect(
        contract.pilotNote.toLowerCase(),
        `Contract "${contract.actionId}": pilotNote must contain "контролируемый пилот"`,
      ).toContain('контролируемый пилот');
    }
  });

  it('every pilotNote contains требует ручной проверки', () => {
    for (const contract of ACTION_CONTRACT_REGISTRY) {
      expect(
        contract.pilotNote.toLowerCase(),
        `Contract "${contract.actionId}": pilotNote must contain "требует ручной проверки"`,
      ).toContain('требует ручной проверки');
    }
  });
});

// ─── No production / live claims ───────────────────────────────────────────────

describe('action contract registry — no forbidden wording', () => {
  it('FORBIDDEN_CONTRACT_WORDING export is non-empty', () => {
    expect(FORBIDDEN_CONTRACT_WORDING.length).toBeGreaterThan(0);
  });

  it('no contract field contains forbidden production/live wording', () => {
    for (const contract of ACTION_CONTRACT_REGISTRY) {
      const allText = [
        contract.label,
        contract.moneyImpactLabel,
        contract.documentImpact,
        contract.idempotencyLabel,
        contract.externalBoundary,
        contract.auditDraftLabel,
        contract.safeFallback,
        contract.pilotNote,
      ]
        .join(' ')
        .toLowerCase();

      for (const word of FORBIDDEN_CONTRACT_WORDING) {
        expect(
          allText,
          `Contract "${contract.actionId}": metadata must not contain "${word}"`,
        ).not.toContain(word.toLowerCase());
      }
    }
  });

  it('no money impact label claims money is transferred or released automatically', () => {
    const autoMoneyPhrases = [
      'деньги переведены',
      'выплата выполнена',
      'платформа переводит деньги',
      'платформа гарантирует',
    ];
    for (const contract of ACTION_CONTRACT_REGISTRY) {
      for (const phrase of autoMoneyPhrases) {
        expect(
          contract.moneyImpactLabel.toLowerCase(),
          `Contract "${contract.actionId}": moneyImpactLabel must not claim automatic money movement`,
        ).not.toContain(phrase.toLowerCase());
      }
    }
  });
});

// ─── No fake persistence claims ───────────────────────────────────────────────

describe('action contract registry — no fake persistence', () => {
  it('no contract claims append-only persistence is active', () => {
    for (const contract of ACTION_CONTRACT_REGISTRY) {
      const allText = Object.values(contract).flat().join(' ').toLowerCase();
      expect(
        allText,
        `Contract "${contract.actionId}": must not claim active persistence`,
      ).not.toContain('append-only persistence is active');
    }
  });

  it('no safe fallback claims live execution without external confirmation', () => {
    const dangerousPhrases = [
      'automatically execute',
      'immediately release',
      'no confirmation needed',
    ];
    for (const contract of ACTION_CONTRACT_REGISTRY) {
      for (const phrase of dangerousPhrases) {
        expect(
          contract.safeFallback.toLowerCase(),
          `Contract "${contract.actionId}": safeFallback must not claim automatic execution`,
        ).not.toContain(phrase.toLowerCase());
      }
    }
  });
});
