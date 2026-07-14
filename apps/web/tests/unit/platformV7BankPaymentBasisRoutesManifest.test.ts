import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { PLATFORM_V7_ROUTES_MANIFEST, CRITICAL_ROUTES, MANIFEST_ROLES } from '@/lib/platform-v7/routes-manifest';
import type { RouteEntry } from '@/lib/platform-v7/routes-manifest';

const SHELL_FILES = [
  'lib/platform-v7/routes-manifest.ts',
  'lib/platform-v7/support-contour-smoke.ts',
];

describe('bank basis canonical route and routes manifest', () => {
  for (const file of SHELL_FILES) {
    it(`${file} exists and has no direct network calls`, () => {
      expect(existsSync(file)).toBe(true);
      const src = readFileSync(file, 'utf8');
      expect(src).not.toMatch(/\bfetch\s*\(/);
      expect(src).not.toMatch(/axios\s*\./);
      expect(src).not.toMatch(/http\s*\./);
    });
  }

  it('does not retain the deleted fixture-backed payment basis action', () => {
    expect(existsSync('lib/platform-v7/bank-payment-basis-runtime-action.ts')).toBe(false);
    expect(existsSync('components/platform-v7/P7BankPaymentBasisRuntimePanel.tsx')).toBe(false);
  });

  it('keeps routes manifest structured and unique', () => {
    expect(PLATFORM_V7_ROUTES_MANIFEST.length).toBeGreaterThan(5);
    for (const entry of PLATFORM_V7_ROUTES_MANIFEST) {
      expect(entry.path).toMatch(/^\/platform-v7\//);
      expect(entry.label.length).toBeGreaterThan(0);
      expect(entry.roles.length).toBeGreaterThan(0);
      expect(typeof entry.critical).toBe('boolean');
    }
    const paths = PLATFORM_V7_ROUTES_MANIFEST.map((entry: RouteEntry) => entry.path);
    expect(new Set(paths).size).toBe(paths.length);
  });

  it('keeps critical routes and manifest roles derived from the manifest', () => {
    const criticalFromManifest = PLATFORM_V7_ROUTES_MANIFEST.filter((entry: RouteEntry) => entry.critical).map((entry: RouteEntry) => entry.path);
    expect(CRITICAL_ROUTES).toEqual(criticalFromManifest);
    expect(CRITICAL_ROUTES).toContain('/platform-v7/control-tower');
    expect(CRITICAL_ROUTES).toContain('/platform-v7/driver');
    expect(MANIFEST_ROLES.length).toBeGreaterThan(5);
    expect(new Set(MANIFEST_ROLES).size).toBe(MANIFEST_ROLES.length);
  });
});
