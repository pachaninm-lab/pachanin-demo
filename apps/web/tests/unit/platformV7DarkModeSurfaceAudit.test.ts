/**
 * Dark-mode surface audit tests — platform-v7 operational screens.
 *
 * What these tests do:
 *   1. Validate the audit data itself (completeness, honesty, no false claims)
 *   2. Verify that components claiming 'css-var' strategy actually render CSS variables
 *   3. Verify that components claiming 'hardcoded' strategy actually have hard-coded values
 *
 * What these tests do NOT do:
 *   - Claim dark mode is solved or production-ready
 *   - Change any component styling
 *   - Add a global dark-mode theme system
 *
 * All entries in the audit require runtime visual QA — tests detect regressions
 * in the DOCUMENTED state only.
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import {
  DARK_MODE_SURFACE_AUDIT,
  AUDIT_PAGES,
  getCssVarComponents,
  getHardcodedComponents,
  getEntriesForRoute,
} from '../../lib/platform-v7/dark-mode-surface-audit';
import { P7Card } from '../../components/platform-v7/P7Card';
import { MoneyImpactSummaryStrip } from '../../components/platform-v7/MoneyImpactSummaryStrip';
import { EvidenceReadinessMiniMatrix } from '../../components/platform-v7/EvidenceReadinessMiniMatrix';
import { DocumentReadinessMiniMatrix } from '../../components/platform-v7/DocumentReadinessMiniMatrix';

const FORBIDDEN_DARK_MODE_CLAIMS = [
  'fully solved',
  'dark mode complete',
  'fully implemented',
  'production-ready dark',
  'live dark mode',
  'dark mode done',
];

// ─── Audit data integrity ─────────────────────────────────────────────────────

describe('dark-mode surface audit data', () => {
  it('has entries for every required audit page', () => {
    for (const page of AUDIT_PAGES) {
      const entries = getEntriesForRoute(page);
      expect(
        entries.length,
        `page ${page} must have at least one audit entry`,
      ).toBeGreaterThanOrEqual(1);
    }
  });

  it('every entry has all required fields', () => {
    for (const entry of DARK_MODE_SURFACE_AUDIT) {
      expect(entry.component).toBeTruthy();
      expect(entry.surfaceStrategy).toMatch(/^(css-var|hardcoded|mixed)$/);
      expect(entry.auditNote).toBeTruthy();
      expect(typeof entry.needsVisualQA).toBe('boolean');
      expect(entry.darkModeClaim).toBe('none');
    }
  });

  it('every entry auditNote references visual QA or audit', () => {
    for (const entry of DARK_MODE_SURFACE_AUDIT) {
      const note = entry.auditNote.toLowerCase();
      const hasQaOrAudit =
        note.includes('visual qa') ||
        note.includes('аудит') ||
        note.includes('audit') ||
        note.includes('needs runtime') ||
        note.includes('identified');
      expect(
        hasQaOrAudit,
        `entry "${entry.component}": auditNote must reference audit or visual QA — got: "${entry.auditNote}"`,
      ).toBe(true);
    }
  });

  it('no entry makes false dark-mode claims', () => {
    for (const entry of DARK_MODE_SURFACE_AUDIT) {
      const text = entry.auditNote.toLowerCase();
      for (const claim of FORBIDDEN_DARK_MODE_CLAIMS) {
        expect(
          text,
          `entry "${entry.component}": auditNote must not claim "${claim}"`,
        ).not.toContain(claim.toLowerCase());
      }
    }
  });

  it('darkModeClaim is always "none" — no entry claims dark mode is complete', () => {
    for (const entry of DARK_MODE_SURFACE_AUDIT) {
      expect(entry.darkModeClaim).toBe('none');
    }
  });

  it('every hardcoded entry has needsVisualQA set to true', () => {
    const hardcoded = getHardcodedComponents();
    for (const entry of hardcoded) {
      expect(
        entry.needsVisualQA,
        `hardcoded entry "${entry.component}" must have needsVisualQA: true`,
      ).toBe(true);
    }
  });

  it('every hardcoded entry provides a hardcodedSample', () => {
    const hardcoded = getHardcodedComponents();
    for (const entry of hardcoded) {
      expect(
        entry.hardcodedSample,
        `hardcoded entry "${entry.component}" must provide a hardcodedSample color value`,
      ).toBeTruthy();
    }
  });

  it('covers the 3 main operational strip components', () => {
    const components = DARK_MODE_SURFACE_AUDIT.map((e) => e.component);
    expect(components).toContain('MoneyImpactSummaryStrip');
    expect(components).toContain('EvidenceReadinessMiniMatrix');
    expect(components).toContain('DocumentReadinessMiniMatrix');
  });

  it('getCssVarComponents returns at least P7Card and P7Section', () => {
    const cssVarComponents = getCssVarComponents().map((e) => e.component);
    expect(cssVarComponents).toContain('P7Card');
    expect(cssVarComponents).toContain('P7Section');
  });

  it('driver/field page is documented', () => {
    const entry = getEntriesForRoute('/platform-v7/driver/field');
    expect(entry.length).toBeGreaterThanOrEqual(1);
    expect(entry[0].component).toContain('driver');
  });

  it('control-tower page is documented', () => {
    const entry = getEntriesForRoute('/platform-v7/control-tower');
    expect(entry.length).toBeGreaterThanOrEqual(1);
  });
});

// ─── CSS-variable components: verify they actually render CSS vars ────────────

describe('P7Card dark-mode guard — css-var strategy verified', () => {
  it('renders surface using CSS variable (not hard-coded #fff)', () => {
    render(
      React.createElement(P7Card, { testId: 'audit-p7card' },
        React.createElement('span', null, 'content'),
      ),
    );
    const card = screen.getByTestId('audit-p7card');
    const bg = (card as HTMLElement).style.background;
    expect(
      bg,
      'P7Card background must use CSS variable var(--p7-color-surface)',
    ).toContain('var(--p7-color-surface)');
  });

  it('renders border color using CSS variable (not hard-coded #E4E6EA)', () => {
    render(
      React.createElement(P7Card, { testId: 'audit-p7card-border' },
        React.createElement('span', null, 'content'),
      ),
    );
    const card = screen.getByTestId('audit-p7card-border');
    const el = card as HTMLElement;
    const borderColor = el.style.borderColor || el.style.border;
    expect(
      borderColor,
      'P7Card border color must reference CSS variable (not hard-coded hex)',
    ).toContain('var(--p7-color-border)');
  });
});

// ─── Hardcoded components: verify they use hard-coded values (audit state) ────

describe('MoneyImpactSummaryStrip dark-mode audit — hardcoded surfaces documented', () => {
  const props = {
    amountContext: 'резерв 9,65 млн ₽',
    pilotState: 'waiting' as const,
    pilotStateLabel: 'пилотный контур',
    responsible: 'продавец',
    nextStep: 'закрыть СДИЗ',
  };

  it('renders a white (#fff) background — audit: hardcoded, needs visual QA in dark mode', () => {
    render(React.createElement(MoneyImpactSummaryStrip, props));
    const strip = screen.getByTestId('platform-v7-money-impact-strip');
    const bg = (strip as HTMLElement).style.background;
    expect(
      bg,
      'MoneyImpactSummaryStrip uses hardcoded #fff — dark-mode audit identified, needs runtime visual QA',
    ).toBe('#fff');
  });

  it('does not use CSS variable for surface (audit baseline — regression detects if fixed without audit update)', () => {
    render(React.createElement(MoneyImpactSummaryStrip, props));
    const strip = screen.getByTestId('platform-v7-money-impact-strip');
    const bg = (strip as HTMLElement).style.background;
    expect(bg).not.toContain('var(--p7-color');
  });
});

describe('EvidenceReadinessMiniMatrix dark-mode audit — hardcoded surfaces documented', () => {
  it('renders a white (#fff) background — audit: hardcoded, needs visual QA', () => {
    render(React.createElement(EvidenceReadinessMiniMatrix, { context: 'disputes' }));
    const matrix = screen.getByTestId('platform-v7-evidence-readiness-mini-matrix');
    const bg = (matrix as HTMLElement).style.background;
    expect(
      bg,
      'EvidenceReadinessMiniMatrix uses hardcoded #fff — dark-mode audit identified, needs runtime visual QA',
    ).toBe('#fff');
  });
});

describe('DocumentReadinessMiniMatrix dark-mode audit — hardcoded surfaces documented', () => {
  it('renders a white (#fff) background — audit: hardcoded, needs visual QA', () => {
    render(React.createElement(DocumentReadinessMiniMatrix, { role: 'seller' }));
    const matrix = screen.getByTestId('platform-v7-readiness-mini-matrix');
    const bg = (matrix as HTMLElement).style.background;
    expect(
      bg,
      'DocumentReadinessMiniMatrix uses hardcoded #fff — dark-mode audit identified, needs runtime visual QA',
    ).toBe('#fff');
  });
});
