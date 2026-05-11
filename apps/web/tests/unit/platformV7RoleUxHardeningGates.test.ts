import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { platformV7NavByRole } from '@/lib/platform-v7/shellRoutes';

const root = existsSync(path.join(process.cwd(), 'app/platform-v7'))
  ? process.cwd()
  : path.join(process.cwd(), 'apps/web');

function readSource(rel: string): string {
  const fullPath = path.join(root, rel);
  expect(existsSync(fullPath), `Source file must exist: ${rel}`).toBe(true);
  return readFileSync(fullPath, 'utf8').toLowerCase();
}

// --- Guard 1: No forbidden maturity claims in key role page sources ---

const ROLE_PAGE_SOURCES = [
  'app/platform-v7/seller/page.tsx',
  'app/platform-v7/buyer/page.tsx',
  'app/platform-v7/logistics/page.tsx',
  'app/platform-v7/driver/field/page.tsx',
  'app/platform-v7/elevator/page.tsx',
  'app/platform-v7/bank/page.tsx',
  'app/platform-v7/disputes/page.tsx',
  'app/platform-v7/control-tower/page.tsx',
];

const FORBIDDEN_MATURITY_CLAIMS = [
  'production-ready',
  'fully live',
  'fully integrated',
  'complete product',
  'everything is ready',
  'guaranteed payment',
  'platform releases money itself',
  'live integrations are active',
  'no analogues',
];

describe('platform-v7 role UX hardening: forbidden maturity claims', () => {
  it('has no forbidden maturity claims in key role page sources', () => {
    for (const file of ROLE_PAGE_SOURCES) {
      const content = readSource(file);
      for (const claim of FORBIDDEN_MATURITY_CLAIMS) {
        expect(content, `${file} must not contain "${claim}"`).not.toContain(claim.toLowerCase());
      }
    }
  });
});

// --- Guard 2: No dev-ish lexicon in user-visible role page text ---

const DEV_ISH_TERMS_IN_ROLE_PAGES: Array<{ term: string; files: string[] }> = [
  {
    term: 'денежный guard',
    files: ['app/platform-v7/buyer/page.tsx'],
  },
  {
    term: 'банковском callback',
    files: ['app/platform-v7/bank/page.tsx'],
  },
  {
    term: 'requestreserve',
    files: ROLE_PAGE_SOURCES,
  },
  {
    term: 'simulation-grade',
    files: ROLE_PAGE_SOURCES,
  },
  {
    term: 'action handoff',
    files: ROLE_PAGE_SOURCES,
  },
];

describe('platform-v7 role UX hardening: dev-ish lexicon gate', () => {
  it('has no dev-ish terms in user-visible role page text', () => {
    for (const { term, files } of DEV_ISH_TERMS_IN_ROLE_PAGES) {
      for (const file of files) {
        const content = readSource(file);
        expect(content, `${file} must not contain dev-ish term "${term}"`).not.toContain(term.toLowerCase());
      }
    }
  });
});

// --- Guard 3: Driver field source exposes no bank/money/control/investor/demo entry points ---

const DRIVER_FIELD_FORBIDDEN_HREFS = [
  '/platform-v7/bank',
  '/platform-v7/control-tower',
  '/platform-v7/investor',
  '/platform-v7/roles',
  '/platform-v7/demo',
  '/platform-v7/connectors',
  'moneyreleasecontrols',
  'bankreserve',
];

describe('platform-v7 role UX hardening: driver field isolation', () => {
  it('driver field page source contains no bank/money/control/investor/demo hrefs', () => {
    const content = readSource('app/platform-v7/driver/field/page.tsx');
    for (const forbidden of DRIVER_FIELD_FORBIDDEN_HREFS) {
      expect(content, `driver/field/page.tsx must not reference "${forbidden}"`).not.toContain(
        forbidden.toLowerCase(),
      );
    }
  });
});

// --- Guard 4: Default (field) role navigation has no /demo links ---

const FIELD_ROLES_WITHOUT_DEMO = [
  'seller',
  'buyer',
  'logistics',
  'driver',
  'elevator',
  'lab',
  'surveyor',
  'bank',
  'arbitrator',
  'compliance',
  'operator',
] as const;

describe('platform-v7 role UX hardening: no /demo in field role navigation', () => {
  it('field role navigation contains no /demo links', () => {
    for (const role of FIELD_ROLES_WITHOUT_DEMO) {
      const hrefs = platformV7NavByRole(role).map((item) => item.href);
      for (const href of hrefs) {
        expect(href, `${role} nav must not include a /demo link (found: ${href})`).not.toContain('/demo');
      }
    }
  });
});

// --- Guard 5: Key role pages include a current-status / next-action / blocker surface ---

const ROLE_STATUS_SURFACE_MARKERS = [
  { file: 'app/platform-v7/seller/page.tsx', markers: ['следующий шаг', 'следующее действие'] },
  { file: 'app/platform-v7/buyer/page.tsx', markers: ['следующий шаг', 'следующее действие'] },
  { file: 'app/platform-v7/logistics/page.tsx', markers: ['следующее действие', 'что блокирует'] },
  { file: 'app/platform-v7/driver/field/page.tsx', markers: ['role-route-hint', 'только рейс'] },
  { file: 'app/platform-v7/elevator/page.tsx', markers: ['что сейчас', 'что дальше'] },
  { file: 'app/platform-v7/bank/page.tsx', markers: ['что сейчас', 'что блокирует', 'кто следующий'] },
  { file: 'app/platform-v7/disputes/page.tsx', markers: ['что сейчас', 'sla', 'владельцы'] },
  { file: 'app/platform-v7/control-tower/page.tsx', markers: ['следующее действие', 'блокер'] },
  { file: 'app/platform-v7/lab/page.tsx', markers: ['roleexecutionsummary'] },
  { file: 'app/platform-v7/surveyor/page.tsx', markers: ['roleexecutionsummary'] },
  { file: 'app/platform-v7/compliance/page.tsx', markers: ['roleexecutionsummary'] },
  { file: 'app/platform-v7/arbitrator/page.tsx', markers: ['roleexecutionsummary'] },
];

describe('platform-v7 role UX hardening: key role pages have status surface', () => {
  it('each key role page contains at least one current-status/next-action/blocker marker', () => {
    for (const { file, markers } of ROLE_STATUS_SURFACE_MARKERS) {
      const content = readSource(file);
      const found = markers.some((m) => content.includes(m.toLowerCase()));
      expect(
        found,
        `${file} must contain at least one of: ${markers.join(', ')}`,
      ).toBe(true);
    }
  });
});
