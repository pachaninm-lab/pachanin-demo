import React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { EvidenceReadinessMiniMatrix } from '@/components/platform-v7/EvidenceReadinessMiniMatrix';
import DisputesPage from '@/app/platform-v7/disputes/page';
import BankPage from '@/app/platform-v7/bank/page';
import ElevatorPage from '@/app/platform-v7/elevator/page';
import {
  canContextProceed,
  EVIDENCE_READINESS_CONTEXT_LABEL,
  EVIDENCE_READINESS_ROWS,
  EVIDENCE_READINESS_STATE_LABEL,
  getContextBlockerCount,
  getContextBlockers,
} from '@/lib/platform-v7/evidence-readiness-matrix';

const FORBIDDEN = [
  /production-ready/i,
  /fully live/i,
  /fully integrated/i,
  /live callback/i,
  /платформа гарантирует оплату/i,
  /платформа выпускает деньги/i,
  /деньги переведены/i,
  /выплата выполнена/i,
  /деньги отправлены/i,
  /автоматический выпуск/i,
  /боевой ответ/i,
];

function expectNoUnsafeCopy(html: string) {
  for (const pattern of FORBIDDEN) {
    expect(html).not.toMatch(pattern);
  }
  expect(html).not.toContain('/platform-v7/demo/');
}

describe('platform-v7 evidence readiness data', () => {
  it('exports all four state labels', () => {
    expect(EVIDENCE_READINESS_STATE_LABEL.ready).toBe('Готов к проверке');
    expect(EVIDENCE_READINESS_STATE_LABEL.partial).toBe('Частично готов');
    expect(EVIDENCE_READINESS_STATE_LABEL.blocked).toBe('Требует действия');
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

  it('disputes has 3 non-ready rows', () => {
    expect(getContextBlockerCount('disputes')).toBe(3);
    const blockers = getContextBlockers('disputes');
    expect(blockers.filter((r) => r.pilotState === 'partial')).toHaveLength(1);
    expect(blockers.filter((r) => r.pilotState === 'blocked')).toHaveLength(2);
  });

  it('bank has 4 non-ready rows and 1 ready row', () => {
    expect(getContextBlockerCount('bank')).toBe(4);
    const blockers = getContextBlockers('bank');
    expect(blockers.filter((r) => r.pilotState === 'blocked')).toHaveLength(3);
    expect(blockers.filter((r) => r.pilotState === 'partial')).toHaveLength(1);
    const readyRows = EVIDENCE_READINESS_ROWS.bank.filter((r) => r.pilotState === 'ready');
    expect(readyRows).toHaveLength(1);
    expect(readyRows[0].item).toContain('Резерв сделки');
  });

  it('elevator has 3 non-ready rows', () => {
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

  it('data avoids unsafe wording', () => {
    const data = JSON.stringify(EVIDENCE_READINESS_ROWS);
    expectNoUnsafeCopy(data);
  });
});

describe('EvidenceReadinessMiniMatrix component', () => {
  it('renders disputes matrix rows and stop reasons', () => {
    const { container } = render(React.createElement(EvidenceReadinessMiniMatrix, { context: 'disputes' }));
    expect(screen.getByTestId('platform-v7-evidence-readiness-mini-matrix')).toBeInTheDocument();
    expect(screen.getAllByTestId('platform-v7-evidence-readiness-mini-matrix-row')).toHaveLength(4);
    expect(screen.getAllByTestId('platform-v7-evidence-readiness-mini-matrix-stop-reason')).toHaveLength(3);
    expectNoUnsafeCopy(container.innerHTML);
  });

  it('renders bank matrix rows and summary', () => {
    const { container } = render(React.createElement(EvidenceReadinessMiniMatrix, { context: 'bank' }));
    expect(screen.getByTestId('platform-v7-evidence-readiness-mini-matrix-summary')).toHaveTextContent('4 не готово');
    expect(screen.getAllByTestId('platform-v7-evidence-readiness-mini-matrix-row')).toHaveLength(5);
    expectNoUnsafeCopy(container.innerHTML);
  });

  it('renders elevator matrix rows and context label', () => {
    const { container } = render(React.createElement(EvidenceReadinessMiniMatrix, { context: 'elevator' }));
    expect(container.innerHTML).toContain('Готовность доказательств — элеватор');
    expect(screen.getAllByTestId('platform-v7-evidence-readiness-mini-matrix-row')).toHaveLength(4);
    expectNoUnsafeCopy(container.innerHTML);
  });
});

describe('EvidenceReadinessMiniMatrix page placement', () => {
  it('disputes page renders evidence readiness matrix without demo links', () => {
    const { container } = render(React.createElement(DisputesPage));
    expect(screen.getByTestId('platform-v7-evidence-readiness-mini-matrix')).toBeInTheDocument();
    expectNoUnsafeCopy(container.innerHTML);
  });

  it('bank page renders evidence readiness matrix without demo links', () => {
    const { container } = render(React.createElement(BankPage));
    expect(screen.getByTestId('platform-v7-evidence-readiness-mini-matrix')).toBeInTheDocument();
    expectNoUnsafeCopy(container.innerHTML);
  });

  it('elevator page renders evidence readiness matrix without demo links', () => {
    const { container } = render(React.createElement(ElevatorPage));
    expect(screen.getByTestId('platform-v7-evidence-readiness-mini-matrix')).toBeInTheDocument();
    expectNoUnsafeCopy(container.innerHTML);
  });
});
