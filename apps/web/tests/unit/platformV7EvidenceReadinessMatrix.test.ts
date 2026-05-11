import { describe, expect, it } from 'vitest';
import {
  canContextProceed,
  EVIDENCE_READINESS_CONTEXT_LABEL,
  EVIDENCE_READINESS_ROWS,
  EVIDENCE_READINESS_STATE_LABEL,
  getContextBlockerCount,
  getContextBlockers,
} from '@/lib/platform-v7/evidence-readiness-matrix';

describe('platform-v7 evidence readiness mini matrix', () => {
  it('exports all four state labels', () => {
    expect(EVIDENCE_READINESS_STATE_LABEL.ready).toBe('Готов к проверке');
    expect(EVIDENCE_READINESS_STATE_LABEL.partial).toBe('Частично готов');
    expect(EVIDENCE_READINESS_STATE_LABEL.blocked).toBe('Заблокирован');
    expect(EVIDENCE_READINESS_STATE_LABEL.pending).toBe('Ожидает подтверждения');
  });

  it('exports context labels for all three contexts', () => {
    expect(EVIDENCE_READINESS_CONTEXT_LABEL.disputes).toBe('споры');
    expect(EVIDENCE_READINESS_CONTEXT_LABEL.bank).toBe('банк');
    expect(EVIDENCE_READINESS_CONTEXT_LABEL.elevator).toBe('элеватор');
  });

  it('every row has required non-empty fields', () => {
    for (const context of ['disputes', 'bank', 'elevator'] as const) {
      for (const row of EVIDENCE_READINESS_ROWS[context]) {
        expect(row.item.length).toBeGreaterThan(0);
        expect(row.pilotState).toMatch(/^(ready|partial|blocked|pending)$/);
        expect(row.responsible.length).toBeGreaterThan(0);
        expect(row.nextStep.length).toBeGreaterThan(0);
      }
    }
  });

  it('blocked and partial rows carry a stopReason', () => {
    for (const context of ['disputes', 'bank', 'elevator'] as const) {
      for (const row of EVIDENCE_READINESS_ROWS[context]) {
        if (row.pilotState === 'blocked' || row.pilotState === 'partial') {
          expect(row.stopReason, `${context}/${row.item} missing stopReason`).toBeTruthy();
        }
      }
    }
  });

  it('ready rows do not carry a stopReason', () => {
    for (const context of ['disputes', 'bank', 'elevator'] as const) {
      for (const row of EVIDENCE_READINESS_ROWS[context]) {
        if (row.pilotState === 'ready') {
          expect(row.stopReason).toBeUndefined();
        }
      }
    }
  });

  it('no context can fully proceed because each has non-ready rows', () => {
    expect(canContextProceed('disputes')).toBe(false);
    expect(canContextProceed('bank')).toBe(false);
    expect(canContextProceed('elevator')).toBe(false);
  });

  it('disputes has 3 non-ready rows (1 partial + 2 blocked)', () => {
    expect(getContextBlockerCount('disputes')).toBe(3);
    const blockers = getContextBlockers('disputes');
    expect(blockers.filter((r) => r.pilotState === 'partial')).toHaveLength(1);
    expect(blockers.filter((r) => r.pilotState === 'blocked')).toHaveLength(2);
  });

  it('bank has 4 non-ready rows (1 partial + 3 blocked) and 1 ready row', () => {
    expect(getContextBlockerCount('bank')).toBe(4);
    const blockers = getContextBlockers('bank');
    expect(blockers.filter((r) => r.pilotState === 'blocked')).toHaveLength(3);
    expect(blockers.filter((r) => r.pilotState === 'partial')).toHaveLength(1);
    const readyRows = EVIDENCE_READINESS_ROWS.bank.filter((r) => r.pilotState === 'ready');
    expect(readyRows).toHaveLength(1);
    expect(readyRows[0].item).toContain('Резерв сделки');
  });

  it('elevator has 3 non-ready rows (partial + blocked + pending)', () => {
    expect(getContextBlockerCount('elevator')).toBe(3);
    const states = getContextBlockers('elevator').map((r) => r.pilotState);
    expect(states).toContain('partial');
    expect(states).toContain('blocked');
    expect(states).toContain('pending');
  });

  it('each context has exactly one ready row', () => {
    for (const context of ['disputes', 'bank', 'elevator'] as const) {
      const readyRows = EVIDENCE_READINESS_ROWS[context].filter((r) => r.pilotState === 'ready');
      expect(readyRows, `${context} should have exactly 1 ready row`).toHaveLength(1);
    }
  });
});
