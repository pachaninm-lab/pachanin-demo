/**
 * Dark-mode surface audit — platform-v7 operational screens.
 *
 * Purpose: document the surface color strategy used by each component and page
 * so regressions are detectable in tests. This is NOT a claim that dark mode is
 * fully implemented — it is an audit fixture.
 *
 * Strategies:
 *   css-var    — surfaces use CSS variables from P7_THEME_CSS / p7Theme tokens.
 *                These respond to OS-level color scheme when the host sets the
 *                corresponding CSS custom properties. Needs runtime visual QA.
 *   hardcoded  — surfaces use hard-coded hex values (#fff, #F8FAFB, #0F1419…).
 *                These will not adapt to dark OS mode without refactoring.
 *                Status: dark-mode audit identified — needs runtime visual QA.
 *   mixed      — some elements use CSS vars, others use hard-coded values.
 *                Partial dark-mode risk. Needs runtime visual QA.
 *
 * None of the entries in this file claim that dark mode is "fully solved",
 * "production-ready", or "live". Every hardcoded entry requires runtime QA.
 */

export type DarkModeSurfaceStrategy = 'css-var' | 'hardcoded' | 'mixed';

export interface DarkModeSurfaceEntry {
  readonly component: string;
  readonly route?: string;
  readonly surfaceStrategy: DarkModeSurfaceStrategy;
  readonly cssVarUsed?: string;
  readonly hardcodedSample?: string;
  readonly auditNote: string;
  readonly needsVisualQA: boolean;
  readonly darkModeClaim: 'none';
}

export const DARK_MODE_SURFACE_AUDIT: readonly DarkModeSurfaceEntry[] = [
  // ── Components using CSS variables (P7_THEME_CSS / tokens) ─────────────────
  {
    component: 'P7Card',
    surfaceStrategy: 'css-var',
    cssVarUsed: 'var(--p7-color-surface)',
    auditNote:
      'uses P7_THEME_CSS.surface.card = var(--p7-color-surface) — responds to CSS variable theming. ' +
      'Dark mode needs runtime visual QA to confirm host sets the variable.',
    needsVisualQA: true,
    darkModeClaim: 'none',
  },
  {
    component: 'P7Section',
    surfaceStrategy: 'css-var',
    cssVarUsed: 'var(--p7-color-surface)',
    auditNote:
      'uses P7_THEME_CSS for surface, border and text — responds to CSS variable theming. ' +
      'Needs runtime visual QA.',
    needsVisualQA: true,
    darkModeClaim: 'none',
  },

  // ── Operational strips — hard-coded surfaces ────────────────────────────────
  {
    component: 'MoneyImpactSummaryStrip',
    surfaceStrategy: 'hardcoded',
    hardcodedSample: '#fff',
    auditNote:
      'uses hard-coded #fff background and #E4E6EA border — dark-mode audit identified. ' +
      'Will not adapt to dark OS mode without adopting P7_THEME_CSS variables. ' +
      'Status: needs runtime visual QA.',
    needsVisualQA: true,
    darkModeClaim: 'none',
  },
  {
    component: 'EvidenceReadinessMiniMatrix',
    surfaceStrategy: 'hardcoded',
    hardcodedSample: '#fff',
    auditNote:
      'uses hard-coded #fff, #F8FAFB and #EEF1F4 surfaces — dark-mode audit identified. ' +
      'Status: needs runtime visual QA.',
    needsVisualQA: true,
    darkModeClaim: 'none',
  },
  {
    component: 'DocumentReadinessMiniMatrix',
    surfaceStrategy: 'hardcoded',
    hardcodedSample: '#fff',
    auditNote:
      'uses hard-coded #fff and #F8FAFB surfaces — dark-mode audit identified. ' +
      'Status: needs runtime visual QA.',
    needsVisualQA: true,
    darkModeClaim: 'none',
  },
  {
    component: 'ConditionReasonStrip',
    surfaceStrategy: 'hardcoded',
    hardcodedSample: '#fff',
    auditNote:
      'uses hard-coded card surfaces — dark-mode audit identified. ' +
      'Status: needs runtime visual QA.',
    needsVisualQA: true,
    darkModeClaim: 'none',
  },
  {
    component: 'MoneyImpactSummaryStrip',
    route: '/platform-v7/bank',
    surfaceStrategy: 'hardcoded',
    hardcodedSample: '#fff',
    auditNote: 'placed on bank page — inherits hardcoded surface. Needs runtime visual QA.',
    needsVisualQA: true,
    darkModeClaim: 'none',
  },

  // ── Pages — surface strategy per page ──────────────────────────────────────
  {
    component: 'seller/page',
    route: '/platform-v7/seller',
    surfaceStrategy: 'hardcoded',
    hardcodedSample: '#fff',
    auditNote:
      'page uses hard-coded #fff card surfaces and #F8FAFB muted surfaces. ' +
      'Does not use P7_THEME_CSS. Dark-mode audit identified — needs runtime visual QA.',
    needsVisualQA: true,
    darkModeClaim: 'none',
  },
  {
    component: 'buyer/page',
    route: '/platform-v7/buyer',
    surfaceStrategy: 'hardcoded',
    hardcodedSample: '#fff',
    auditNote:
      'page uses hard-coded #fff card surfaces. ' +
      'Dark-mode audit identified — needs runtime visual QA.',
    needsVisualQA: true,
    darkModeClaim: 'none',
  },
  {
    component: 'bank/page',
    route: '/platform-v7/bank',
    surfaceStrategy: 'mixed',
    hardcodedSample: '#fff',
    auditNote:
      'page uses hard-coded #fff cards alongside dark header (#0F172A) and operational strips. ' +
      'Mix of strategies — dark-mode audit identified. Needs runtime visual QA.',
    needsVisualQA: true,
    darkModeClaim: 'none',
  },
  {
    component: 'disputes/page',
    route: '/platform-v7/disputes',
    surfaceStrategy: 'mixed',
    hardcodedSample: '#fff',
    auditNote:
      'page uses hard-coded #fff cards alongside dark header (rgba(15,23,42,...)). ' +
      'Mix of strategies — dark-mode audit identified. Needs runtime visual QA.',
    needsVisualQA: true,
    darkModeClaim: 'none',
  },
  {
    component: 'control-tower/page',
    route: '/platform-v7/control-tower',
    surfaceStrategy: 'css-var',
    cssVarUsed: 'P7Page / P7Section shell',
    auditNote:
      'control-tower uses P7Page + P7Section (CSS variables) for the outer shell. ' +
      'Inner queue items use hard-coded #fff. Mixed risk — needs runtime visual QA.',
    needsVisualQA: true,
    darkModeClaim: 'none',
  },
  {
    component: 'driver/field page',
    route: '/platform-v7/driver/field',
    surfaceStrategy: 'hardcoded',
    hardcodedSample: '#0F172A',
    auditNote:
      'intentional dark palette (#0F172A shell) but hard-coded — not using CSS variables. ' +
      'Will appear always-dark regardless of OS color scheme. ' +
      'Dark-mode audit identified — design intent unclear, needs runtime visual QA.',
    needsVisualQA: true,
    darkModeClaim: 'none',
  },
];

export const AUDIT_PAGES = [
  '/platform-v7/seller',
  '/platform-v7/buyer',
  '/platform-v7/bank',
  '/platform-v7/disputes',
  '/platform-v7/control-tower',
  '/platform-v7/driver/field',
] as const;

export type AuditPage = typeof AUDIT_PAGES[number];

export function getEntriesForRoute(route: AuditPage): readonly DarkModeSurfaceEntry[] {
  return DARK_MODE_SURFACE_AUDIT.filter((e) => e.route === route);
}

export function getCssVarComponents(): readonly DarkModeSurfaceEntry[] {
  return DARK_MODE_SURFACE_AUDIT.filter((e) => e.surfaceStrategy === 'css-var');
}

export function getHardcodedComponents(): readonly DarkModeSurfaceEntry[] {
  return DARK_MODE_SURFACE_AUDIT.filter((e) => e.surfaceStrategy === 'hardcoded');
}
