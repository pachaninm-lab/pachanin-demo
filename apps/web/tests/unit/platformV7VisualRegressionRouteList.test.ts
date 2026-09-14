/**
 * Visual regression route list tests — platform-v7.
 *
 * These tests enforce the integrity of the critical route list used for visual
 * and smoke regression testing. They do not run the visual tests themselves —
 * they guard the list metadata.
 *
 * Properties verified:
 *   - No duplicate paths
 *   - No /demo route leakage
 *   - No /landing route leakage
 *   - No forbidden production/live wording in route metadata
 *   - Required routes (from issue spec) are all present
 *   - Every route has required fields with valid values
 *   - Critical routes all have hasStackedStrips: true (they're the dense ones)
 *   - pilotNote references пилотный контур on every entry
 */
import { describe, it, expect } from 'vitest';
import {
  VISUAL_REGRESSION_ROUTES,
  CRITICAL_ROUTES,
  STACKED_STRIP_ROUTES,
  FORBIDDEN_ROUTE_PATTERNS,
  getRouteByPath,
} from '../../lib/platform-v7/visual-regression-routes';

const FORBIDDEN_WORDING = [
  'production-ready',
  'fully live',
  'live callback',
  'деньги переведены',
  'bypass impossible',
  'fully protected',
  'боевой',
  'live-выплата',
];

const REQUIRED_PATHS = [
  '/platform-v7',
  '/platform-v7/seller',
  '/platform-v7/buyer',
  '/platform-v7/bank',
  '/platform-v7/disputes',
  '/platform-v7/control-tower',
  '/platform-v7/operator',
  '/platform-v7/elevator',
  '/platform-v7/driver/field',
] as const;

// ─── Route list integrity ─────────────────────────────────────────────────────

describe('visual regression route list — integrity', () => {
  it('has no duplicate paths', () => {
    const paths = VISUAL_REGRESSION_ROUTES.map((r) => r.path);
    const unique = new Set(paths);
    expect(
      unique.size,
      `Route list has duplicates: ${paths.filter((p, i) => paths.indexOf(p) !== i).join(', ')}`,
    ).toBe(paths.length);
  });

  it('has no /demo route leakage', () => {
    for (const route of VISUAL_REGRESSION_ROUTES) {
      expect(
        route.path,
        `Route "${route.path}" must not be a demo route`,
      ).not.toContain('/demo');
    }
  });

  it('has no /landing route leakage', () => {
    for (const route of VISUAL_REGRESSION_ROUTES) {
      expect(
        route.path,
        `Route "${route.path}" must not be a landing route`,
      ).not.toContain('/landing');
    }
  });

  it('all paths start with /platform-v7', () => {
    for (const route of VISUAL_REGRESSION_ROUTES) {
      expect(
        route.path,
        `Route path must start with /platform-v7`,
      ).toMatch(/^\/platform-v7/);
    }
  });

  it('no path ends with a trailing slash', () => {
    for (const route of VISUAL_REGRESSION_ROUTES) {
      expect(
        route.path.endsWith('/'),
        `Route "${route.path}" must not end with trailing slash`,
      ).toBe(false);
    }
  });

  it('no forbidden production/live wording in route metadata', () => {
    for (const route of VISUAL_REGRESSION_ROUTES) {
      const allText = [route.label, route.pilotNote].join(' ').toLowerCase();
      for (const word of FORBIDDEN_WORDING) {
        expect(
          allText,
          `Route "${route.path}": metadata must not contain "${word}"`,
        ).not.toContain(word.toLowerCase());
      }
    }
  });

  it('every pilotNote references пилотный контур', () => {
    for (const route of VISUAL_REGRESSION_ROUTES) {
      expect(
        route.pilotNote.toLowerCase(),
        `Route "${route.path}": pilotNote must contain "пилотный контур"`,
      ).toContain('пилотный контур');
    }
  });
});

// ─── Required routes present ──────────────────────────────────────────────────

describe('visual regression route list — required routes', () => {
  for (const path of REQUIRED_PATHS) {
    it(`includes required route: ${path}`, () => {
      const found = getRouteByPath(path);
      expect(
        found,
        `Required route "${path}" must be in VISUAL_REGRESSION_ROUTES`,
      ).toBeDefined();
    });
  }

  it('has exactly 9 routes (issue spec: 9 required paths)', () => {
    expect(VISUAL_REGRESSION_ROUTES).toHaveLength(9);
  });
});

// ─── Field value validation ───────────────────────────────────────────────────

describe('visual regression route list — field values', () => {
  it('every route has all required fields', () => {
    for (const route of VISUAL_REGRESSION_ROUTES) {
      expect(route.path).toBeTruthy();
      expect(route.label).toBeTruthy();
      expect(route.priority).toMatch(/^(critical|high|standard)$/);
      expect(typeof route.hasStackedStrips).toBe('boolean');
      expect(route.pilotNote).toBeTruthy();
    }
  });

  it('critical routes all have hasStackedStrips true', () => {
    for (const route of CRITICAL_ROUTES) {
      expect(
        route.hasStackedStrips,
        `Critical route "${route.path}" must have hasStackedStrips: true`,
      ).toBe(true);
    }
  });

  it('stacked strip routes have at least 6 entries', () => {
    expect(STACKED_STRIP_ROUTES.length).toBeGreaterThanOrEqual(6);
  });

  it('CRITICAL_ROUTES contains exactly the 6 specified paths', () => {
    const criticalPaths = CRITICAL_ROUTES.map((r) => r.path).sort();
    const expectedCritical = [
      '/platform-v7',
      '/platform-v7/seller',
      '/platform-v7/buyer',
      '/platform-v7/bank',
      '/platform-v7/disputes',
      '/platform-v7/control-tower',
    ].sort();
    expect(criticalPaths).toStrictEqual(expectedCritical);
  });
});

// ─── Forbidden pattern guard ──────────────────────────────────────────────────

describe('visual regression route list — forbidden pattern constants', () => {
  it('FORBIDDEN_ROUTE_PATTERNS covers /platform-v7/demo', () => {
    expect(FORBIDDEN_ROUTE_PATTERNS).toContain('/platform-v7/demo');
  });

  it('FORBIDDEN_ROUTE_PATTERNS covers /landing', () => {
    expect(FORBIDDEN_ROUTE_PATTERNS).toContain('/landing');
  });

  it('no route in list matches any forbidden pattern', () => {
    for (const route of VISUAL_REGRESSION_ROUTES) {
      for (const pattern of FORBIDDEN_ROUTE_PATTERNS) {
        expect(
          route.path.startsWith(pattern),
          `Route "${route.path}" matches forbidden pattern "${pattern}"`,
        ).toBe(false);
      }
    }
  });

  it('getRouteByPath returns undefined for demo paths', () => {
    expect(getRouteByPath('/platform-v7/demo')).toBeUndefined();
    expect(getRouteByPath('/platform-v7/demo/grain-execution')).toBeUndefined();
  });

  it('getRouteByPath returns undefined for landing paths', () => {
    expect(getRouteByPath('/landing')).toBeUndefined();
    expect(getRouteByPath('/platform-v7/landing')).toBeUndefined();
  });
});
