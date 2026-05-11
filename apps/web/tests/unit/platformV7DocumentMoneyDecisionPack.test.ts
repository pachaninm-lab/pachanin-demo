/**
 * DocumentMoneyDecisionPack tests — platform-v7.
 *
 * Guards the pre-runtime decision pack data layer for correctness,
 * unique row ids, money impact traceability, and safe wording.
 */
import { describe, it, expect } from 'vitest';
import {
  DECISION_PACK_DATA,
  DECISION_PACK_CONTEXTS,
  DECISION_PACK_CONTEXT_LABEL,
  FORBIDDEN_DECISION_WORDING,
  getDecisionPackRows,
  getDecisionPackRowById,
  getBlockedRows,
  type DecisionPackContext,
} from '../../lib/platform-v7/document-money-decision-pack';

const VALID_PILOT_STATES = ['blocked', 'partial', 'waiting', 'allowed', 'manual_review'] as const;
const VALID_MONEY_IMPACTS = [
  'blocks_release',
  'affects_hold',
  'informs_reserve',
  'requires_bank_review',
  'none',
] as const;

// ─── Completeness ──────────────────────────────────────────────────────────────

describe('document money decision pack — completeness', () => {
  it('covers exactly 5 contexts', () => {
    expect(DECISION_PACK_CONTEXTS).toHaveLength(5);
    const expected: DecisionPackContext[] = [
      'dl9106_payout_review',
      'dl9102_dispute_hold',
      'seller_document_handoff',
      'buyer_reserve_request',
      'bank_release_review',
    ];
    for (const ctx of expected) {
      expect(DECISION_PACK_CONTEXTS).toContain(ctx);
    }
  });

  it('every context has at least 3 rows', () => {
    for (const context of DECISION_PACK_CONTEXTS) {
      expect(
        getDecisionPackRows(context).length,
        `Context "${context}" must have at least 3 rows`,
      ).toBeGreaterThanOrEqual(3);
    }
  });

  it('dl9106_payout_review has 4 rows', () => {
    expect(getDecisionPackRows('dl9106_payout_review')).toHaveLength(4);
  });

  it('bank_release_review has 4 rows', () => {
    expect(getDecisionPackRows('bank_release_review')).toHaveLength(4);
  });

  it('DECISION_PACK_CONTEXT_LABEL covers all contexts', () => {
    for (const context of DECISION_PACK_CONTEXTS) {
      expect(DECISION_PACK_CONTEXT_LABEL[context], `Label missing for "${context}"`).toBeTruthy();
    }
  });

  it('DECISION_PACK_DATA covers all contexts', () => {
    for (const context of DECISION_PACK_CONTEXTS) {
      expect(DECISION_PACK_DATA[context], `Data missing for "${context}"`).toBeDefined();
    }
  });
});

// ─── Unique row ids ────────────────────────────────────────────────────────────

describe('document money decision pack — unique row ids', () => {
  it('row ids are globally unique across all contexts', () => {
    const allIds: string[] = [];
    for (const context of DECISION_PACK_CONTEXTS) {
      for (const row of getDecisionPackRows(context)) {
        allIds.push(row.rowId);
      }
    }
    const unique = new Set(allIds);
    expect(
      unique.size,
      `Duplicate row ids: ${allIds.filter((id, i) => allIds.indexOf(id) !== i).join(', ')}`,
    ).toBe(allIds.length);
  });

  it('getDecisionPackRowById returns the correct row', () => {
    const row = getDecisionPackRowById('dl9106_payout_review', 'dl9106-sdiz');
    expect(row).toBeDefined();
    expect(row!.rowId).toBe('dl9106-sdiz');
  });

  it('getDecisionPackRowById returns undefined for unknown row id', () => {
    expect(getDecisionPackRowById('dl9106_payout_review', 'nonexistent')).toBeUndefined();
  });
});

// ─── Field validation ─────────────────────────────────────────────────────────

describe('document money decision pack — field validation', () => {
  it('every row has all required fields with truthy values', () => {
    for (const context of DECISION_PACK_CONTEXTS) {
      for (const row of getDecisionPackRows(context)) {
        expect(row.rowId, `rowId missing in ${context}`).toBeTruthy();
        expect(row.requiredDocumentEvidence, `requiredDocumentEvidence missing for ${row.rowId}`).toBeTruthy();
        expect(row.responsibleRole, `responsibleRole missing for ${row.rowId}`).toBeTruthy();
        expect(row.currentPilotStateLabel, `currentPilotStateLabel missing for ${row.rowId}`).toBeTruthy();
        expect(row.moneyImpactLabel, `moneyImpactLabel missing for ${row.rowId}`).toBeTruthy();
        expect(row.legalOperationalReason, `legalOperationalReason missing for ${row.rowId}`).toBeTruthy();
        expect(row.safeNextAction, `safeNextAction missing for ${row.rowId}`).toBeTruthy();
        expect(row.pilotNote, `pilotNote missing for ${row.rowId}`).toBeTruthy();
      }
    }
  });

  it('every row has a valid pilot state', () => {
    for (const context of DECISION_PACK_CONTEXTS) {
      for (const row of getDecisionPackRows(context)) {
        expect(
          (VALID_PILOT_STATES as readonly string[]).includes(row.currentPilotState),
          `Row "${row.rowId}" has invalid pilotState: "${row.currentPilotState}"`,
        ).toBe(true);
      }
    }
  });

  it('every row has a valid money impact', () => {
    for (const context of DECISION_PACK_CONTEXTS) {
      for (const row of getDecisionPackRows(context)) {
        expect(
          (VALID_MONEY_IMPACTS as readonly string[]).includes(row.moneyImpact),
          `Row "${row.rowId}" has invalid moneyImpact: "${row.moneyImpact}"`,
        ).toBe(true);
      }
    }
  });
});

// ─── Every money impact has a reason ──────────────────────────────────────────

describe('document money decision pack — money impact traceability', () => {
  it('every row with non-none money impact has a non-empty legalOperationalReason', () => {
    for (const context of DECISION_PACK_CONTEXTS) {
      for (const row of getDecisionPackRows(context)) {
        if (row.moneyImpact !== 'none') {
          expect(
            row.legalOperationalReason.length,
            `Row "${row.rowId}": non-none moneyImpact must have a legalOperationalReason`,
          ).toBeGreaterThan(20);
        }
      }
    }
  });

  it('every row with blocks_release has a legalOperationalReason mentioning документ/операционн', () => {
    for (const context of DECISION_PACK_CONTEXTS) {
      for (const row of getDecisionPackRows(context)) {
        if (row.moneyImpact === 'blocks_release') {
          expect(
            row.legalOperationalReason.toLowerCase(),
            `Row "${row.rowId}": blocks_release must explain the operational/document basis`,
          ).toMatch(/операционн|документ|доказательств/);
        }
      }
    }
  });

  it('every row with moneyImpactLabel does not claim automatic money movement', () => {
    const automoneyClaims = ['деньги переведены', 'выплата выполнена', 'платформа переводит', 'платформа гарантирует'];
    for (const context of DECISION_PACK_CONTEXTS) {
      for (const row of getDecisionPackRows(context)) {
        for (const claim of automoneyClaims) {
          expect(
            row.moneyImpactLabel.toLowerCase(),
            `Row "${row.rowId}": moneyImpactLabel must not claim automatic money movement`,
          ).not.toContain(claim);
        }
      }
    }
  });
});

// ─── Every blocker has responsible role and safe next action ─────────────────

describe('document money decision pack — blocker integrity', () => {
  it('every blocked row has a non-null blocker', () => {
    for (const context of DECISION_PACK_CONTEXTS) {
      for (const row of getDecisionPackRows(context)) {
        if (row.currentPilotState === 'blocked') {
          expect(
            row.blocker,
            `Blocked row "${row.rowId}" must have a non-null blocker`,
          ).not.toBeNull();
          expect(
            (row.blocker as string).length,
            `Blocked row "${row.rowId}" blocker must be non-empty`,
          ).toBeGreaterThan(5);
        }
      }
    }
  });

  it('every row with a blocker has a responsibleRole and safeNextAction', () => {
    for (const context of DECISION_PACK_CONTEXTS) {
      for (const row of getDecisionPackRows(context)) {
        if (row.blocker !== null) {
          expect(row.responsibleRole, `Row "${row.rowId}": blocker must have responsibleRole`).toBeTruthy();
          expect(row.safeNextAction, `Row "${row.rowId}": blocker must have safeNextAction`).toBeTruthy();
        }
      }
    }
  });

  it('getBlockedRows returns only blocked rows', () => {
    for (const context of DECISION_PACK_CONTEXTS) {
      const blocked = getBlockedRows(context);
      for (const row of blocked) {
        expect(row.currentPilotState).toBe('blocked');
      }
    }
  });

  it('dl9106_payout_review has 2 blocked rows (СДИЗ and ЭТрН)', () => {
    const blocked = getBlockedRows('dl9106_payout_review');
    expect(blocked).toHaveLength(2);
  });

  it('buyer_reserve_request has 0 blocked rows (both are allowed/waiting)', () => {
    const blocked = getBlockedRows('buyer_reserve_request');
    expect(blocked).toHaveLength(0);
  });

  it('null blocker rows have safeNextAction that guides forward', () => {
    for (const context of DECISION_PACK_CONTEXTS) {
      for (const row of getDecisionPackRows(context)) {
        if (row.blocker === null) {
          expect(row.safeNextAction.length, `Row "${row.rowId}": null blocker must still have safeNextAction`).toBeGreaterThan(10);
        }
      }
    }
  });
});

// ─── No unsafe wording ────────────────────────────────────────────────────────

describe('document money decision pack — no forbidden wording', () => {
  it('FORBIDDEN_DECISION_WORDING export is non-empty', () => {
    expect(FORBIDDEN_DECISION_WORDING.length).toBeGreaterThan(0);
  });

  it('no row contains forbidden wording', () => {
    for (const context of DECISION_PACK_CONTEXTS) {
      for (const row of getDecisionPackRows(context)) {
        const allText = [
          row.requiredDocumentEvidence,
          row.currentPilotStateLabel,
          row.moneyImpactLabel,
          row.legalOperationalReason,
          row.blocker ?? '',
          row.safeNextAction,
          row.pilotNote,
        ]
          .join(' ')
          .toLowerCase();
        for (const word of FORBIDDEN_DECISION_WORDING) {
          expect(
            allText,
            `Row "${row.rowId}": must not contain "${word}"`,
          ).not.toContain(word.toLowerCase());
        }
      }
    }
  });

  it('every pilotNote contains контролируемый пилот', () => {
    for (const context of DECISION_PACK_CONTEXTS) {
      for (const row of getDecisionPackRows(context)) {
        expect(row.pilotNote.toLowerCase()).toContain('контролируемый пилот');
      }
    }
  });

  it('every pilotNote contains требует ручной проверки', () => {
    for (const context of DECISION_PACK_CONTEXTS) {
      for (const row of getDecisionPackRows(context)) {
        expect(row.pilotNote.toLowerCase()).toContain('требует ручной проверки');
      }
    }
  });

  it('no legalOperationalReason claims legal finality', () => {
    for (const context of DECISION_PACK_CONTEXTS) {
      for (const row of getDecisionPackRows(context)) {
        expect(row.legalOperationalReason.toLowerCase()).not.toContain('legal finality');
        expect(row.legalOperationalReason.toLowerCase()).not.toContain('legally approved');
        expect(row.legalOperationalReason.toLowerCase()).not.toContain('dispute legally resolved');
      }
    }
  });
});
