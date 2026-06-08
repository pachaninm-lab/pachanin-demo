import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  PLATFORM_V7_LIGHT_TOKENS,
  PLATFORM_V7_DARK_TOKENS,
  getPlatformV7ThemeTokens,
  getPlatformV7ToneTokens,
} from '@/lib/platform-v7/design/tokens';
import type { PlatformV7Tone } from '@/lib/platform-v7/design/tokens';

import {
  relativeLuminance,
  contrastRatio,
  meetsWcagAaText,
  meetsWcagAaLargeTextOrUi,
} from '@/lib/platform-v7/design/contrast';

import {
  GRAIN_EXECUTION_COCKPIT_THEME,
  GRAIN_EXECUTION_ROLE_ORDER,
  GRAIN_EXECUTION_ROLE_LABELS,
  GRAIN_EXECUTION_STATUS_TONES,
  GRAIN_EXECUTION_CARD_GRAMMAR,
} from '@/lib/platform-v7/design/execution-cockpit';

import {
  PLATFORM_V7_DARK_QA_VIEWPORTS,
  PLATFORM_V7_DARK_QA_P0_ROUTES,
  PLATFORM_V7_DARK_QA_ACCEPTANCE,
} from '@/lib/platform-v7/design/dark-qa';

import {
  PRIMARY_ROLE_EXECUTION_COCKPITS,
  OPERATIONAL_ROLE_EXECUTION_COCKPITS,
  ALL_ROLE_EXECUTION_COCKPITS,
} from '@/lib/platform-v7/role-execution-cockpit';

describe('design/tokens — theme token structure', () => {
  it('light tokens have all required color keys', () => {
    const required = ['background', 'surface', 'text', 'brand', 'success', 'warning', 'danger', 'money'];
    for (const key of required) {
      expect(PLATFORM_V7_LIGHT_TOKENS.color, `color.${key}`).toHaveProperty(key);
    }
  });

  it('dark tokens have all required color keys', () => {
    const required = ['background', 'surface', 'text', 'brand', 'success', 'warning', 'danger', 'money'];
    for (const key of required) {
      expect(PLATFORM_V7_DARK_TOKENS.color, `color.${key}`).toHaveProperty(key);
    }
  });

  it('getPlatformV7ThemeTokens returns light tokens for light theme', () => {
    const tokens = getPlatformV7ThemeTokens('light');
    expect(tokens.color.background).toBe(PLATFORM_V7_LIGHT_TOKENS.color.background);
  });

  it('getPlatformV7ThemeTokens returns dark tokens for dark theme', () => {
    const tokens = getPlatformV7ThemeTokens('dark');
    expect(tokens.color.background).toBe(PLATFORM_V7_DARK_TOKENS.color.background);
  });

  it('getPlatformV7ThemeTokens defaults to light when no argument', () => {
    const tokens = getPlatformV7ThemeTokens();
    expect(tokens.color.background).toBe(PLATFORM_V7_LIGHT_TOKENS.color.background);
  });

  it('light and dark backgrounds are different', () => {
    expect(PLATFORM_V7_LIGHT_TOKENS.color.background).not.toBe(PLATFORM_V7_DARK_TOKENS.color.background);
  });

  it('spacing tokens are consistent across light and dark', () => {
    expect(PLATFORM_V7_LIGHT_TOKENS.spacing).toEqual(PLATFORM_V7_DARK_TOKENS.spacing);
  });

  it('typography tokens are consistent across light and dark', () => {
    expect(PLATFORM_V7_LIGHT_TOKENS.typography).toEqual(PLATFORM_V7_DARK_TOKENS.typography);
  });

  it('zIndex tokens are consistent across light and dark', () => {
    expect(PLATFORM_V7_LIGHT_TOKENS.zIndex).toEqual(PLATFORM_V7_DARK_TOKENS.zIndex);
  });

  it('getPlatformV7ToneTokens returns fg, bg, border for each tone', () => {
    const tones: PlatformV7Tone[] = ['success', 'warning', 'danger', 'info', 'money', 'evidence', 'bank', 'logistics', 'document', 'dispute', 'neutral', 'integration'];
    for (const tone of tones) {
      const result = getPlatformV7ToneTokens(tone, 'light');
      expect(result, tone).toHaveProperty('fg');
      expect(result, tone).toHaveProperty('bg');
      expect(result, tone).toHaveProperty('border');
    }
  });

  it('getPlatformV7ToneTokens dark mode returns different colors from light for danger', () => {
    const light = getPlatformV7ToneTokens('danger', 'light');
    const dark = getPlatformV7ToneTokens('danger', 'dark');
    expect(light.fg).not.toBe(dark.fg);
  });
});

describe('design/contrast — WCAG contrast calculations', () => {
  it('black on white has contrast ratio ~21', () => {
    const ratio = contrastRatio('#000000', '#FFFFFF');
    expect(ratio).toBeGreaterThanOrEqual(21);
  });

  it('white on white has contrast ratio 1', () => {
    const ratio = contrastRatio('#FFFFFF', '#FFFFFF');
    expect(ratio).toBe(1);
  });

  it('relativeLuminance of white is ~1', () => {
    const lum = relativeLuminance('#FFFFFF');
    expect(lum).toBeCloseTo(1, 2);
  });

  it('relativeLuminance of black is 0', () => {
    const lum = relativeLuminance('#000000');
    expect(lum).toBe(0);
  });

  it('meetsWcagAaText: black on white passes', () => {
    expect(meetsWcagAaText('#000000', '#FFFFFF')).toBe(true);
  });

  it('meetsWcagAaText: white on white fails', () => {
    expect(meetsWcagAaText('#FFFFFF', '#FFFFFF')).toBe(false);
  });

  it('meetsWcagAaLargeTextOrUi: light grey passes 3:1 on white background', () => {
    expect(meetsWcagAaLargeTextOrUi('#767676', '#FFFFFF')).toBe(true);
  });

  it('light token text meets WCAG AA on background', () => {
    const passes = meetsWcagAaText(
      PLATFORM_V7_LIGHT_TOKENS.color.text,
      PLATFORM_V7_LIGHT_TOKENS.color.background,
    );
    expect(passes).toBe(true);
  });

  it('dark token text meets WCAG AA on dark background', () => {
    const passes = meetsWcagAaText(
      PLATFORM_V7_DARK_TOKENS.color.text,
      PLATFORM_V7_DARK_TOKENS.color.background,
    );
    expect(passes).toBe(true);
  });
});

describe('design/execution-cockpit — roles and constants', () => {
  it('defaultTheme is light', () => {
    expect(GRAIN_EXECUTION_COCKPIT_THEME.defaultTheme).toBe('light');
  });

  it('explicitThemes includes both light and dark', () => {
    expect(GRAIN_EXECUTION_COCKPIT_THEME.explicitThemes).toContain('light');
    expect(GRAIN_EXECUTION_COCKPIT_THEME.explicitThemes).toContain('dark');
  });

  it('ROLE_ORDER contains all 12 roles', () => {
    expect(GRAIN_EXECUTION_ROLE_ORDER).toHaveLength(12);
  });

  it('ROLE_ORDER starts with seller and buyer', () => {
    expect(GRAIN_EXECUTION_ROLE_ORDER[0]).toBe('seller');
    expect(GRAIN_EXECUTION_ROLE_ORDER[1]).toBe('buyer');
  });

  it('ROLE_LABELS has a label for every role in ROLE_ORDER', () => {
    for (const role of GRAIN_EXECUTION_ROLE_ORDER) {
      expect(GRAIN_EXECUTION_ROLE_LABELS, role).toHaveProperty(role);
      expect(typeof GRAIN_EXECUTION_ROLE_LABELS[role]).toBe('string');
    }
  });

  it('STATUS_TONES has label and meaning for each tone', () => {
    const tones = ['success', 'warning', 'danger', 'info', 'money', 'neutral'] as const;
    for (const tone of tones) {
      expect(GRAIN_EXECUTION_STATUS_TONES[tone]).toHaveProperty('label');
      expect(GRAIN_EXECUTION_STATUS_TONES[tone]).toHaveProperty('meaning');
    }
  });

  it('CARD_GRAMMAR contains required fields', () => {
    expect(GRAIN_EXECUTION_CARD_GRAMMAR).toContain('title');
    expect(GRAIN_EXECUTION_CARD_GRAMMAR).toContain('status');
    expect(GRAIN_EXECUTION_CARD_GRAMMAR).toContain('action');
  });
});

describe('design/dark-qa — QA constants', () => {
  it('has at least 10 viewports', () => {
    expect(PLATFORM_V7_DARK_QA_VIEWPORTS.length).toBeGreaterThanOrEqual(10);
  });

  it('viewports include mobile and desktop sizes', () => {
    const widths = PLATFORM_V7_DARK_QA_VIEWPORTS.map((v) => v.width);
    expect(widths.some((w) => w <= 430)).toBe(true);
    expect(widths.some((w) => w >= 1280)).toBe(true);
  });

  it('P0_ROUTES includes root platform-v7 route', () => {
    expect(PLATFORM_V7_DARK_QA_P0_ROUTES).toContain('/platform-v7');
  });

  it('acceptance criteria require dark mode and no fake-payout CTA', () => {
    expect(PLATFORM_V7_DARK_QA_ACCEPTANCE.darkModeRequired).toBe(true);
    expect(PLATFORM_V7_DARK_QA_ACCEPTANCE.noFakePayoutCta).toBe(true);
  });

  it('acceptance criteria require WCAG AA text contrast', () => {
    expect(PLATFORM_V7_DARK_QA_ACCEPTANCE.minTextContrastAa).toBe(true);
  });

  it('minimum mobile critical action size is 44px', () => {
    expect(PLATFORM_V7_DARK_QA_ACCEPTANCE.minMobileCriticalActionPx).toBe(44);
  });
});

describe('role-execution-cockpit — cockpit models', () => {
  it('PRIMARY_ROLE_EXECUTION_COCKPITS contains seller, buyer, operator, bank, compliance', () => {
    const primaryRoles = ['seller', 'buyer', 'operator', 'bank', 'compliance'] as const;
    for (const role of primaryRoles) {
      expect(PRIMARY_ROLE_EXECUTION_COCKPITS, role).toHaveProperty(role);
    }
  });

  it('OPERATIONAL_ROLE_EXECUTION_COCKPITS contains logistics, driver, elevator, lab, surveyor, arbitrator, executive', () => {
    const opRoles = ['logistics', 'driver', 'elevator', 'lab', 'surveyor', 'arbitrator', 'executive'] as const;
    for (const role of opRoles) {
      expect(OPERATIONAL_ROLE_EXECUTION_COCKPITS, role).toHaveProperty(role);
    }
  });

  it('ALL_ROLE_EXECUTION_COCKPITS covers all 12 roles', () => {
    const allRoles = [...Object.keys(PRIMARY_ROLE_EXECUTION_COCKPITS), ...Object.keys(OPERATIONAL_ROLE_EXECUTION_COCKPITS)];
    expect(allRoles).toHaveLength(12);
    for (const role of allRoles) {
      expect(ALL_ROLE_EXECUTION_COCKPITS, role).toHaveProperty(role);
    }
  });

  it('every cockpit has eyebrow, title, subtitle, statuses, kpis, operations', () => {
    for (const [role, cockpit] of Object.entries(ALL_ROLE_EXECUTION_COCKPITS)) {
      expect(cockpit, `${role}.eyebrow`).toHaveProperty('eyebrow');
      expect(cockpit, `${role}.title`).toHaveProperty('title');
      expect(cockpit, `${role}.subtitle`).toHaveProperty('subtitle');
      expect(cockpit, `${role}.statuses`).toHaveProperty('statuses');
      expect(cockpit, `${role}.kpis`).toHaveProperty('kpis');
      expect(cockpit, `${role}.operations`).toHaveProperty('operations');
    }
  });

  it('every cockpit has at least one operation', () => {
    for (const [role, cockpit] of Object.entries(ALL_ROLE_EXECUTION_COCKPITS)) {
      expect(cockpit.operations.length, role).toBeGreaterThan(0);
    }
  });

  it('every operation has action with label', () => {
    for (const [role, cockpit] of Object.entries(ALL_ROLE_EXECUTION_COCKPITS)) {
      for (const op of cockpit.operations) {
        expect(op.action.label, `${role} operation action label`).toBeTruthy();
      }
    }
  });

  it('seller cockpit role is seller', () => {
    expect(ALL_ROLE_EXECUTION_COCKPITS.seller.role).toBe('seller');
  });

  it('bank cockpit has money-related KPI', () => {
    const moneyKpi = ALL_ROLE_EXECUTION_COCKPITS.bank.kpis.find((k) => k.tone === 'money');
    expect(moneyKpi).toBeDefined();
  });

  it('driver cockpit operations count is exactly 1 (minimal surface)', () => {
    expect(ALL_ROLE_EXECUTION_COCKPITS.driver.operations).toHaveLength(1);
  });
});

describe('source guard: design/theme files are pre-integration with no live calls', () => {
  const designFiles = [
    'lib/platform-v7/design/tokens.ts',
    'lib/platform-v7/design/contrast.ts',
    'lib/platform-v7/design/dark-qa.ts',
    'lib/platform-v7/design/execution-cockpit.ts',
    'lib/platform-v7/role-execution-cockpit.ts',
  ] as const;

  const forbiddenPatterns = [
    'fetch(',
    'XMLHttpRequest',
    'WebSocket',
    'EventSource',
    'axios.',
    'http.request',
    'https.request',
    'openai',
    'anthropic',
  ] as const;

  it('all design/theme source files are present', () => {
    for (const file of designFiles) {
      expect(existsSync(join(process.cwd(), file)), file).toBe(true);
    }
  });

  it('contains no live network calls or external API references', () => {
    for (const file of designFiles) {
      const source = readFileSync(join(process.cwd(), file), 'utf8');
      for (const pattern of forbiddenPatterns) {
        expect(source, `${file} must not contain "${pattern}"`).not.toContain(pattern);
      }
    }
  });
});
