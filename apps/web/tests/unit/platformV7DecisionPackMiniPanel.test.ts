/**
 * DecisionPackMiniPanel tests — platform-v7.
 *
 * Tests component rendering, mobile-safe style assertions, page placement,
 * no demo-route links, and no fake legal/live/bank claims.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { DecisionPackMiniPanel } from '../../components/platform-v7/DecisionPackMiniPanel';
import type { DecisionPackContext } from '../../lib/platform-v7/document-money-decision-pack';

afterEach(() => cleanup());

const ALL_CONTEXTS: DecisionPackContext[] = [
  'dl9106_payout_review',
  'dl9102_dispute_hold',
  'seller_document_handoff',
  'buyer_reserve_request',
  'bank_release_review',
];

const PAGE_CONTEXTS: { page: string; context: DecisionPackContext }[] = [
  { page: 'seller', context: 'seller_document_handoff' },
  { page: 'buyer', context: 'buyer_reserve_request' },
  { page: 'bank', context: 'bank_release_review' },
  { page: 'disputes', context: 'dl9102_dispute_hold' },
  { page: 'elevator', context: 'dl9106_payout_review' },
];

// ─── Component rendering (seller_document_handoff) ───────────────────────────

describe('DecisionPackMiniPanel — rendering (seller_document_handoff)', () => {
  it('renders panel wrapper', () => {
    render(DecisionPackMiniPanel({ context: 'seller_document_handoff' }));
    expect(screen.getByTestId('platform-v7-decision-pack-mini-panel')).toBeDefined();
  });

  it('renders disclaimer badge with manual review wording', () => {
    render(DecisionPackMiniPanel({ context: 'seller_document_handoff' }));
    const badge = screen.getByTestId('platform-v7-decision-pack-disclaimer');
    expect(badge.textContent).toContain('manual review');
  });

  it('renders rows container', () => {
    render(DecisionPackMiniPanel({ context: 'seller_document_handoff' }));
    expect(screen.getByTestId('platform-v7-decision-pack-rows')).toBeDefined();
  });

  it('renders 3 rows for seller_document_handoff', () => {
    render(DecisionPackMiniPanel({ context: 'seller_document_handoff' }));
    const rows = screen.getAllByTestId('platform-v7-decision-pack-row');
    expect(rows).toHaveLength(3);
  });

  it('renders document/evidence label in each row', () => {
    render(DecisionPackMiniPanel({ context: 'seller_document_handoff' }));
    const docs = screen.getAllByTestId('platform-v7-decision-pack-document');
    expect(docs.length).toBeGreaterThanOrEqual(1);
    expect(docs[0].textContent).toBeTruthy();
  });

  it('renders state badge in each row', () => {
    render(DecisionPackMiniPanel({ context: 'seller_document_handoff' }));
    const badges = screen.getAllByTestId('platform-v7-decision-pack-state-badge');
    expect(badges.length).toBeGreaterThanOrEqual(1);
  });

  it('renders responsible role in each row', () => {
    render(DecisionPackMiniPanel({ context: 'seller_document_handoff' }));
    const roles = screen.getAllByTestId('platform-v7-decision-pack-responsible');
    expect(roles[0].textContent).toContain('продавец');
  });

  it('renders money impact in each row', () => {
    render(DecisionPackMiniPanel({ context: 'seller_document_handoff' }));
    const impacts = screen.getAllByTestId('platform-v7-decision-pack-money-impact');
    expect(impacts.length).toBeGreaterThanOrEqual(1);
    expect(impacts[0].textContent).toBeTruthy();
  });

  it('renders legal/operational reason in each row', () => {
    render(DecisionPackMiniPanel({ context: 'seller_document_handoff' }));
    const reasons = screen.getAllByTestId('platform-v7-decision-pack-legal-reason');
    expect(reasons[0].textContent!.length).toBeGreaterThan(20);
  });

  it('renders safe next action in each row', () => {
    render(DecisionPackMiniPanel({ context: 'seller_document_handoff' }));
    const nexts = screen.getAllByTestId('platform-v7-decision-pack-safe-next');
    expect(nexts[0].textContent).toBeTruthy();
  });

  it('renders pilot note at bottom', () => {
    render(DecisionPackMiniPanel({ context: 'seller_document_handoff' }));
    const note = screen.getByTestId('platform-v7-decision-pack-pilot-note');
    expect(note.textContent).toContain('контролируемый пилот');
    expect(note.textContent).toContain('требует ручной проверки');
  });
});

describe('DecisionPackMiniPanel — rendering (bank_release_review, 4 rows)', () => {
  it('renders 4 rows for bank_release_review', () => {
    render(DecisionPackMiniPanel({ context: 'bank_release_review' }));
    const rows = screen.getAllByTestId('platform-v7-decision-pack-row');
    expect(rows).toHaveLength(4);
  });

  it('renders at least 2 blockers for bank context (blocked rows have blocker)', () => {
    render(DecisionPackMiniPanel({ context: 'bank_release_review' }));
    const blockers = screen.getAllByTestId('platform-v7-decision-pack-blocker');
    expect(blockers.length).toBeGreaterThanOrEqual(2);
  });
});

describe('DecisionPackMiniPanel — rendering (buyer_reserve_request, no blockers)', () => {
  it('renders 3 rows for buyer', () => {
    render(DecisionPackMiniPanel({ context: 'buyer_reserve_request' }));
    const rows = screen.getAllByTestId('platform-v7-decision-pack-row');
    expect(rows).toHaveLength(3);
  });

  it('renders only 1 blocker for buyer (only waiting row has blocker)', () => {
    render(DecisionPackMiniPanel({ context: 'buyer_reserve_request' }));
    const blockers = screen.queryAllByTestId('platform-v7-decision-pack-blocker');
    expect(blockers.length).toBeLessThanOrEqual(1);
  });
});

// ─── Mobile-safe style assertions ─────────────────────────────────────────────

describe('DecisionPackMiniPanel — mobile-safe styles', () => {
  function style(el: Element) {
    return (el as HTMLElement).style;
  }

  it('rows container uses auto-fit gridTemplateColumns', () => {
    render(DecisionPackMiniPanel({ context: 'seller_document_handoff' }));
    const container = screen.getByTestId('platform-v7-decision-pack-rows');
    const cols = style(container).gridTemplateColumns;
    expect(cols).toContain('auto-fit');
    expect(cols).not.toMatch(/repeat\(\s*\d+,/);
  });

  it('each row has minWidth 0', () => {
    render(DecisionPackMiniPanel({ context: 'seller_document_handoff' }));
    const rows = screen.getAllByTestId('platform-v7-decision-pack-row');
    for (const row of rows) {
      const mw = style(row).minWidth;
      expect(mw === '0px' || mw === '0', `row minWidth should be 0, got "${mw}"`).toBe(true);
    }
  });

  it('document label has overflowWrap set', () => {
    render(DecisionPackMiniPanel({ context: 'seller_document_handoff' }));
    const docs = screen.getAllByTestId('platform-v7-decision-pack-document');
    for (const doc of docs) {
      const ow = style(doc).overflowWrap;
      expect(ow !== '' && ow !== 'normal', `document label overflowWrap should be set, got "${ow}"`).toBe(true);
    }
  });

  it('money impact has overflowWrap set', () => {
    render(DecisionPackMiniPanel({ context: 'seller_document_handoff' }));
    const impacts = screen.getAllByTestId('platform-v7-decision-pack-money-impact');
    for (const el of impacts) {
      const ow = style(el).overflowWrap;
      expect(ow !== '' && ow !== 'normal', `money impact overflowWrap should be set, got "${ow}"`).toBe(true);
    }
  });

  it('legal reason has overflowWrap set', () => {
    render(DecisionPackMiniPanel({ context: 'seller_document_handoff' }));
    const reasons = screen.getAllByTestId('platform-v7-decision-pack-legal-reason');
    for (const el of reasons) {
      const ow = style(el).overflowWrap;
      expect(ow !== '' && ow !== 'normal', `legal reason overflowWrap should be set, got "${ow}"`).toBe(true);
    }
  });

  it('safe next action has overflowWrap set', () => {
    render(DecisionPackMiniPanel({ context: 'seller_document_handoff' }));
    const nexts = screen.getAllByTestId('platform-v7-decision-pack-safe-next');
    for (const el of nexts) {
      const ow = style(el).overflowWrap;
      expect(ow !== '' && ow !== 'normal', `safe next overflowWrap should be set, got "${ow}"`).toBe(true);
    }
  });
});

// ─── Page placement ────────────────────────────────────────────────────────────

describe('DecisionPackMiniPanel — page placement', () => {
  for (const { page, context } of PAGE_CONTEXTS) {
    it(`renders without error for ${page} page (context: ${context})`, () => {
      render(DecisionPackMiniPanel({ context }));
      expect(screen.getByTestId('platform-v7-decision-pack-mini-panel')).toBeDefined();
      cleanup();
    });
  }
});

// ─── No demo-route links ──────────────────────────────────────────────────────

describe('DecisionPackMiniPanel — no demo-route links', () => {
  for (const context of ALL_CONTEXTS) {
    it(`context "${context}" renders no /demo links`, () => {
      render(DecisionPackMiniPanel({ context }));
      const anchors = document.querySelectorAll('a[href]');
      anchors.forEach((a) => {
        expect(
          a.getAttribute('href'),
          `Context "${context}": link must not point to a demo route`,
        ).not.toContain('/demo');
      });
      cleanup();
    });
  }
});

// ─── No fake legal/live/bank claims ───────────────────────────────────────────

describe('DecisionPackMiniPanel — no fake legal/live/bank claims in rendered text', () => {
  const FORBIDDEN = [
    'production-ready',
    'legally approved',
    'legal finality',
    'bank confirmed',
    'money transferred',
    'payout completed',
    'dispute legally resolved',
    'fully live',
    'bypass impossible',
  ];

  it('rendered output contains no forbidden wording (seller context)', () => {
    render(DecisionPackMiniPanel({ context: 'seller_document_handoff' }));
    const panel = screen.getByTestId('platform-v7-decision-pack-mini-panel');
    const text = panel.textContent?.toLowerCase() ?? '';
    for (const word of FORBIDDEN) {
      expect(text, `Panel must not render "${word}"`).not.toContain(word.toLowerCase());
    }
  });

  it('rendered output contains no forbidden wording (bank context)', () => {
    render(DecisionPackMiniPanel({ context: 'bank_release_review' }));
    const panel = screen.getByTestId('platform-v7-decision-pack-mini-panel');
    const text = panel.textContent?.toLowerCase() ?? '';
    for (const word of FORBIDDEN) {
      expect(text, `Panel must not render "${word}"`).not.toContain(word.toLowerCase());
    }
  });

  it('pilot note does not claim the panel is a legal conclusion', () => {
    render(DecisionPackMiniPanel({ context: 'bank_release_review' }));
    const note = screen.getByTestId('platform-v7-decision-pack-pilot-note');
    expect(note.textContent).toContain('не является правовым заключением');
  });
});
