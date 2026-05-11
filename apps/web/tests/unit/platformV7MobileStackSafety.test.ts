/**
 * Mobile stack safety tests — 390px width regression detection
 *
 * These tests do NOT change production UI. They detect regressions in mobile-safe
 * CSS properties on platform-v7 operational strips. Run after any component edit
 * that touches grid layout, status pill styling, or text overflow handling.
 *
 * Components covered (present on current main):
 *   - MoneyImpactSummaryStrip
 *   - EvidenceReadinessMiniMatrix
 *   - DocumentReadinessMiniMatrix
 *
 * Properties checked:
 *   - No whiteSpace:'nowrap' on status pills (can cause horizontal overflow on 390px)
 *   - minWidth:0 on grid value cells (prevents grid blowout)
 *   - overflowWrap set on dense text (prevents content bleeding outside container)
 *   - gridTemplateColumns uses auto-fit (not fixed column count)
 */
import React from 'react';
import { render, screen, cleanup } from '@testing-library/react';
import { describe, it, expect, afterEach } from 'vitest';
import { MoneyImpactSummaryStrip } from '../../components/platform-v7/MoneyImpactSummaryStrip';
import { EvidenceReadinessMiniMatrix } from '../../components/platform-v7/EvidenceReadinessMiniMatrix';
import { DocumentReadinessMiniMatrix } from '../../components/platform-v7/DocumentReadinessMiniMatrix';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function style(el: Element): CSSStyleDeclaration {
  return (el as HTMLElement).style;
}

function assertAutoFitGrid(el: Element, label: string) {
  const cols = style(el).gridTemplateColumns;
  expect(cols, `${label}: gridTemplateColumns must use auto-fit (got: "${cols}")`).toContain('auto-fit');
  expect(cols, `${label}: must not use fixed repeat count like repeat(3,...)`).not.toMatch(/repeat\(\s*\d+,/);
}

function assertNoNowrap(el: Element, label: string) {
  expect(
    style(el).whiteSpace,
    `${label}: whiteSpace must not be 'nowrap' — pills overflow on 390px`,
  ).not.toBe('nowrap');
}

function assertMinWidthZero(el: Element, label: string) {
  const mw = style(el).minWidth;
  expect(
    mw === '0px' || mw === '0',
    `${label}: minWidth must be 0 to allow grid shrinkage (got: "${mw}")`,
  ).toBe(true);
}

function assertOverflowWrapSet(el: Element, label: string) {
  const ow = style(el).overflowWrap;
  expect(
    ow !== '' && ow !== 'normal',
    `${label}: overflowWrap must be set to 'anywhere' or 'break-word' (got: "${ow}")`,
  ).toBe(true);
}

// ─── MoneyImpactSummaryStrip ──────────────────────────────────────────────────

describe('MoneyImpactSummaryStrip — mobile safety (390px)', () => {
  const defaultProps = {
    amountContext: 'резерв 9,65 млн ₽ · к выплате 0 ₽',
    pilotState: 'waiting' as const,
    pilotStateLabel: 'пилотный контур · ожидание документов',
    responsible: 'продавец · ФГИС «Зерно»',
    nextStep: 'закрыть СДИЗ и ЭТрН для передачи выплаты на банковскую проверку',
    stopReason: 'СДИЗ и ЭТрН не закрыты — выплата остановлена',
  };

  it('renders without error', () => {
    render(React.createElement(MoneyImpactSummaryStrip, defaultProps));
    expect(screen.getByTestId('platform-v7-money-impact-strip')).toBeDefined();
  });

  it('state pill does not use nowrap whitespace', () => {
    render(React.createElement(MoneyImpactSummaryStrip, defaultProps));
    const pill = screen.getByTestId('platform-v7-money-impact-state');
    assertNoNowrap(pill, 'state pill');
  });

  it('amount value container has overflowWrap to handle long strings', () => {
    render(React.createElement(MoneyImpactSummaryStrip, defaultProps));
    const amount = screen.getByTestId('platform-v7-money-impact-amount');
    assertOverflowWrapSet(amount, 'amount value');
  });

  it('responsible value container has overflowWrap', () => {
    render(React.createElement(MoneyImpactSummaryStrip, defaultProps));
    const responsible = screen.getByTestId('platform-v7-money-impact-responsible');
    assertOverflowWrapSet(responsible, 'responsible value');
  });

  it('slot outer wrapper has minWidth:0 to prevent grid cell blowout', () => {
    render(React.createElement(MoneyImpactSummaryStrip, defaultProps));
    const amount = screen.getByTestId('platform-v7-money-impact-amount');
    const slotWrapper = amount.parentElement!;
    assertMinWidthZero(slotWrapper, 'slot wrapper');
  });

  it('slot grid uses auto-fit — no fixed column count', () => {
    render(React.createElement(MoneyImpactSummaryStrip, defaultProps));
    const amount = screen.getByTestId('platform-v7-money-impact-amount');
    const gridContainer = amount.parentElement?.parentElement!;
    assertAutoFitGrid(gridContainer, 'slot grid');
  });

  it('stop reason container has minWidth:0', () => {
    render(React.createElement(MoneyImpactSummaryStrip, defaultProps));
    const stop = screen.getByTestId('platform-v7-money-impact-stop');
    assertMinWidthZero(stop, 'stop reason container');
  });

  it('stop reason text has overflowWrap set', () => {
    render(React.createElement(MoneyImpactSummaryStrip, defaultProps));
    const stop = screen.getByTestId('platform-v7-money-impact-stop');
    const textEl = stop.lastElementChild as HTMLElement;
    assertOverflowWrapSet(textEl, 'stop reason text');
  });

  it('header row uses flexWrap so badge does not overflow at 390px', () => {
    render(React.createElement(MoneyImpactSummaryStrip, defaultProps));
    const strip = screen.getByTestId('platform-v7-money-impact-strip');
    const header = strip.firstElementChild!;
    expect(style(header).flexWrap, 'header flexWrap must be wrap').toBe('wrap');
  });
});

// ─── EvidenceReadinessMiniMatrix ──────────────────────────────────────────────

describe('EvidenceReadinessMiniMatrix — mobile safety (390px)', () => {
  it('renders without error for disputes context', () => {
    render(React.createElement(EvidenceReadinessMiniMatrix, { context: 'disputes' }));
    expect(screen.getByTestId('platform-v7-evidence-readiness-mini-matrix')).toBeDefined();
  });

  it('summary badge does not use nowrap whitespace', () => {
    render(React.createElement(EvidenceReadinessMiniMatrix, { context: 'disputes' }));
    const badge = screen.getByTestId('platform-v7-evidence-readiness-mini-matrix-summary');
    assertNoNowrap(badge, 'summary badge');
  });

  it('row grid uses auto-fit — no fixed column count', () => {
    render(React.createElement(EvidenceReadinessMiniMatrix, { context: 'bank' }));
    const rows = screen.getAllByTestId('platform-v7-evidence-readiness-mini-matrix-row');
    for (const row of rows) {
      assertAutoFitGrid(row, `evidence row`);
    }
  });

  it('row container has minWidth:0 to prevent grid overflow', () => {
    render(React.createElement(EvidenceReadinessMiniMatrix, { context: 'disputes' }));
    const rows = screen.getAllByTestId('platform-v7-evidence-readiness-mini-matrix-row');
    for (const row of rows) {
      assertMinWidthZero(row, 'evidence row');
    }
  });

  it('item name cell has overflowWrap to handle long document names', () => {
    render(React.createElement(EvidenceReadinessMiniMatrix, { context: 'disputes' }));
    const rows = screen.getAllByTestId('platform-v7-evidence-readiness-mini-matrix-row');
    for (const row of rows) {
      const nameCell = row.firstElementChild!;
      assertOverflowWrapSet(nameCell, 'item name cell');
    }
  });

  it('state pill does not use nowrap whitespace', () => {
    render(React.createElement(EvidenceReadinessMiniMatrix, { context: 'disputes' }));
    const rows = screen.getAllByTestId('platform-v7-evidence-readiness-mini-matrix-row');
    for (const row of rows) {
      const pill = row.children[1];
      assertNoNowrap(pill, 'state pill');
    }
  });

  it('renders for disputes context without error', () => {
    render(React.createElement(EvidenceReadinessMiniMatrix, { context: 'disputes' }));
    expect(screen.getByTestId('platform-v7-evidence-readiness-mini-matrix')).toBeDefined();
  });

  it('renders for bank context without error', () => {
    render(React.createElement(EvidenceReadinessMiniMatrix, { context: 'bank' }));
    expect(screen.getByTestId('platform-v7-evidence-readiness-mini-matrix')).toBeDefined();
  });

  it('renders for elevator context without error', () => {
    render(React.createElement(EvidenceReadinessMiniMatrix, { context: 'elevator' }));
    expect(screen.getByTestId('platform-v7-evidence-readiness-mini-matrix')).toBeDefined();
  });
});

// ─── DocumentReadinessMiniMatrix ──────────────────────────────────────────────

describe('DocumentReadinessMiniMatrix — mobile safety (390px)', () => {
  it('renders without error for seller context', () => {
    render(React.createElement(DocumentReadinessMiniMatrix, { role: 'seller' }));
    expect(screen.getByTestId('platform-v7-readiness-mini-matrix')).toBeDefined();
  });

  it('summary badge does not use nowrap whitespace', () => {
    render(React.createElement(DocumentReadinessMiniMatrix, { role: 'seller' }));
    const badge = screen.getByTestId('platform-v7-readiness-mini-matrix-summary');
    assertNoNowrap(badge, 'document matrix summary badge');
  });

  it('row grid uses auto-fit — no fixed column count', () => {
    render(React.createElement(DocumentReadinessMiniMatrix, { role: 'buyer' }));
    const rows = screen.getAllByTestId('platform-v7-readiness-mini-matrix-row');
    for (const row of rows) {
      assertAutoFitGrid(row, 'document matrix row');
    }
  });

  it('row container has minWidth:0 to allow grid shrink', () => {
    render(React.createElement(DocumentReadinessMiniMatrix, { role: 'bank' }));
    const rows = screen.getAllByTestId('platform-v7-readiness-mini-matrix-row');
    for (const row of rows) {
      assertMinWidthZero(row, 'document row');
    }
  });

  it('item name cell has overflowWrap to handle long names', () => {
    render(React.createElement(DocumentReadinessMiniMatrix, { role: 'seller' }));
    const rows = screen.getAllByTestId('platform-v7-readiness-mini-matrix-row');
    for (const row of rows) {
      const nameCell = row.firstElementChild!;
      assertOverflowWrapSet(nameCell, 'document item name cell');
    }
  });

  it('state pill does not use nowrap whitespace', () => {
    render(React.createElement(DocumentReadinessMiniMatrix, { role: 'buyer' }));
    const rows = screen.getAllByTestId('platform-v7-readiness-mini-matrix-row');
    for (const row of rows) {
      const pill = row.children[1];
      assertNoNowrap(pill, 'state pill');
    }
  });

  it('renders for seller role without error', () => {
    render(React.createElement(DocumentReadinessMiniMatrix, { role: 'seller' }));
    expect(screen.getByTestId('platform-v7-readiness-mini-matrix')).toBeDefined();
  });

  it('renders for buyer role without error', () => {
    render(React.createElement(DocumentReadinessMiniMatrix, { role: 'buyer' }));
    expect(screen.getByTestId('platform-v7-readiness-mini-matrix')).toBeDefined();
  });

  it('renders for bank role without error', () => {
    render(React.createElement(DocumentReadinessMiniMatrix, { role: 'bank' }));
    expect(screen.getByTestId('platform-v7-readiness-mini-matrix')).toBeDefined();
  });
});
