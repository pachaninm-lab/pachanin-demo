import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// Phase 2 / PR-5 — empty/loading/error consistency for role cabinets without a
// dedicated layout.tsx. Narrow + additive: route-level loading.tsx only (error is
// already covered uniformly by the root app/platform-v7/error.tsx). No cabinet
// content/redesign change.

const APP = resolve(__dirname, '../../app/platform-v7');
const LAYOUTLESS_ROLES = ['lab', 'surveyor', 'compliance', 'arbitrator', 'support'] as const;

describe('role cabinets without a dedicated layout get a consistent loading state', () => {
  it('every layout-less role segment has a loading.tsx', () => {
    for (const role of LAYOUTLESS_ROLES) {
      expect(existsSync(resolve(APP, role, 'loading.tsx'))).toBe(true);
    }
  });

  it('each loading.tsx renders the shared neutral cockpit skeleton (consistency, not per-role design)', () => {
    for (const role of LAYOUTLESS_ROLES) {
      const src = readFileSync(resolve(APP, role, 'loading.tsx'), 'utf8');
      expect(src).toContain("from '@/components/platform-v7/RoleCockpitLoading'");
      expect(src).toContain('<RoleCockpitLoading />');
    }
  });

  it('keeps error handling at the existing root boundary (no redundant per-role error.tsx)', () => {
    expect(existsSync(resolve(APP, 'error.tsx'))).toBe(true);
    for (const role of LAYOUTLESS_ROLES) {
      expect(existsSync(resolve(APP, role, 'error.tsx'))).toBe(false);
    }
  });
});

describe('the shared role cockpit loading skeleton', () => {
  const component = readFileSync(
    resolve(__dirname, '../../components/platform-v7/RoleCockpitLoading.tsx'),
    'utf8',
  );

  it('is an accessible status placeholder built from the canonical Skeleton', () => {
    expect(component).toContain("role='status'");
    expect(component).toContain("aria-label='Загрузка кабинета'");
    expect(component).toContain("from '@/components/platform-v7/Skeleton'");
  });

  it('carries no business content or fake-live copy (placeholder only)', () => {
    for (const phrase of ['production-ready', 'fully live', 'bank connected', 'гарантирует оплату']) {
      expect(component.toLowerCase()).not.toContain(phrase.toLowerCase());
    }
  });
});
