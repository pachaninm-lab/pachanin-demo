import { describe, it, expect } from 'vitest';
import { existsSync } from 'node:fs';

const SHELL_FILES = [
  'lib/platform-v7/bank-payment-basis-runtime-action.ts',
  'lib/platform-v7/routes-manifest.ts',
  'lib/platform-v7/support-contour-smoke.ts',
];

describe('PR 20.0 — Bank Payment Basis, Routes Manifest & Support Contour — source guard', () => {
  for (const file of SHELL_FILES) {
    it(`${file} exists`, () => {
      expect(existsSync(file)).toBe(true);
    });
    it(`${file} has no live network calls`, async () => {
      const { readFileSync } = await import('node:fs');
      const src = readFileSync(file, 'utf8');
      expect(src).not.toMatch(/\bfetch\s*\(/);
      expect(src).not.toMatch(/axios\s*\./);
      expect(src).not.toMatch(/http\s*\./);
    });
  }
});

// ──────────────────────────────────────────────
// bank-payment-basis-runtime-action
// ──────────────────────────────────────────────
import {
  buildPlatformV7BankPaymentBasisRuntimeAction,
} from '@/lib/platform-v7/bank-payment-basis-runtime-action';
import type { PlatformV7BankPaymentBasisRuntimeInput } from '@/lib/platform-v7/bank-payment-basis-runtime-action';

describe('buildPlatformV7BankPaymentBasisRuntimeAction', () => {
  const makeInput = (overrides: Partial<PlatformV7BankPaymentBasisRuntimeInput> = {}): PlatformV7BankPaymentBasisRuntimeInput => ({
    actorRole: 'operator',
    dealId: 'DL-9106',
    ...overrides,
  });

  it('returns status "created" for operator role', () => {
    const result = buildPlatformV7BankPaymentBasisRuntimeAction(makeInput());
    expect(result.status).toBe('created');
  });

  it('created result has correct dealId', () => {
    const result = buildPlatformV7BankPaymentBasisRuntimeAction(makeInput({ dealId: '  DL-9106  ' }));
    expect(result.status).toBe('created');
    expect(result.dealId).toBe('DL-9106');
  });

  it('created result has correct uiStatusLabel', () => {
    const result = buildPlatformV7BankPaymentBasisRuntimeAction(makeInput());
    expect(result.status).toBe('created');
    expect(result.uiStatusLabel).toContain('основание');
  });

  it('created result has safety note mentioning no money release', () => {
    const result = buildPlatformV7BankPaymentBasisRuntimeAction(makeInput());
    expect(result.status).toBe('created');
    expect(result.uiSafetyNote).toBeTruthy();
    expect(result.uiSafetyNote.length).toBeGreaterThan(20);
  });

  it('created result has event with status "created"', () => {
    const result = buildPlatformV7BankPaymentBasisRuntimeAction(makeInput());
    expect(result.status).toBe('created');
    expect(result.event.status).toBe('created');
  });

  it('created result event has correct actionId', () => {
    const result = buildPlatformV7BankPaymentBasisRuntimeAction(makeInput());
    expect(result.status).toBe('created');
    expect(result.event.actionId).toBe('request_bank_payment_basis_review');
  });

  it('returns status "blocked" for non-operator role (bank)', () => {
    const result = buildPlatformV7BankPaymentBasisRuntimeAction(makeInput({ actorRole: 'bank' }));
    expect(result.status).toBe('blocked');
  });

  it('returns status "blocked" for non-operator role (seller)', () => {
    const result = buildPlatformV7BankPaymentBasisRuntimeAction(makeInput({ actorRole: 'seller' }));
    expect(result.status).toBe('blocked');
  });

  it('returns status "blocked" for non-operator role (driver)', () => {
    const result = buildPlatformV7BankPaymentBasisRuntimeAction(makeInput({ actorRole: 'driver' }));
    expect(result.status).toBe('blocked');
  });

  it('blocked result has uiStatusLabel "основание не передано"', () => {
    const result = buildPlatformV7BankPaymentBasisRuntimeAction(makeInput({ actorRole: 'bank' }));
    expect(result.status).toBe('blocked');
    expect(result.uiStatusLabel).toBe('основание не передано');
  });

  it('blocked result has uiSafetyNote from disabledReason', () => {
    const result = buildPlatformV7BankPaymentBasisRuntimeAction(makeInput({ actorRole: 'buyer' }));
    expect(result.status).toBe('blocked');
    expect(result.uiSafetyNote).toBeTruthy();
    expect(result.event.status).toBe('blocked');
  });

  it('created result includes reason in event logEntry when reason provided', () => {
    const result = buildPlatformV7BankPaymentBasisRuntimeAction(makeInput({ reason: 'квитанция подтверждена' }));
    expect(result.status).toBe('created');
    if (result.event.status === 'created') {
      expect(result.event.logEntry).toBeDefined();
    }
  });

  it('created result has dealId returned unchanged when already trimmed', () => {
    const result = buildPlatformV7BankPaymentBasisRuntimeAction(makeInput({ dealId: 'DL-9999' }));
    expect(result.dealId).toBe('DL-9999');
  });
});

// ──────────────────────────────────────────────
// routes-manifest
// ──────────────────────────────────────────────
import {
  PLATFORM_V7_ROUTES_MANIFEST,
  CRITICAL_ROUTES,
  MANIFEST_ROLES,
} from '@/lib/platform-v7/routes-manifest';
import type { RouteEntry } from '@/lib/platform-v7/routes-manifest';

describe('PLATFORM_V7_ROUTES_MANIFEST', () => {
  it('is a non-empty array', () => {
    expect(Array.isArray(PLATFORM_V7_ROUTES_MANIFEST)).toBe(true);
    expect(PLATFORM_V7_ROUTES_MANIFEST.length).toBeGreaterThan(5);
  });

  it('each entry has path, label, roles, critical fields', () => {
    for (const entry of PLATFORM_V7_ROUTES_MANIFEST) {
      expect(typeof entry.path).toBe('string');
      expect(typeof entry.label).toBe('string');
      expect(Array.isArray(entry.roles)).toBe(true);
      expect(typeof entry.critical).toBe('boolean');
    }
  });

  it('all paths start with /platform-v7/', () => {
    for (const entry of PLATFORM_V7_ROUTES_MANIFEST) {
      expect(entry.path).toMatch(/^\/platform-v7\//);
    }
  });

  it('all entries have non-empty label', () => {
    for (const entry of PLATFORM_V7_ROUTES_MANIFEST) {
      expect(entry.label.length).toBeGreaterThan(0);
    }
  });

  it('all entries have at least one role', () => {
    for (const entry of PLATFORM_V7_ROUTES_MANIFEST) {
      expect(entry.roles.length).toBeGreaterThan(0);
    }
  });

  it('no duplicate paths in manifest', () => {
    const paths = PLATFORM_V7_ROUTES_MANIFEST.map((e: RouteEntry) => e.path);
    const unique = new Set(paths);
    expect(unique.size).toBe(paths.length);
  });

  it('contains control-tower route for operator', () => {
    const ct = PLATFORM_V7_ROUTES_MANIFEST.find((e: RouteEntry) => e.path === '/platform-v7/control-tower');
    expect(ct).toBeDefined();
    expect(ct?.roles).toContain('operator');
  });

  it('contains driver route', () => {
    const dr = PLATFORM_V7_ROUTES_MANIFEST.find((e: RouteEntry) => e.path === '/platform-v7/driver');
    expect(dr).toBeDefined();
    expect(dr?.roles).toContain('driver');
  });

  it('contains bank release-safety route', () => {
    const rs = PLATFORM_V7_ROUTES_MANIFEST.find((e: RouteEntry) => e.path === '/platform-v7/bank/release-safety');
    expect(rs).toBeDefined();
    expect(rs?.critical).toBe(true);
  });
});

describe('CRITICAL_ROUTES', () => {
  it('is a non-empty array of strings', () => {
    expect(Array.isArray(CRITICAL_ROUTES)).toBe(true);
    expect(CRITICAL_ROUTES.length).toBeGreaterThan(0);
  });

  it('contains only paths marked critical=true in manifest', () => {
    const criticalFromManifest = PLATFORM_V7_ROUTES_MANIFEST
      .filter((e: RouteEntry) => e.critical)
      .map((e: RouteEntry) => e.path);
    expect(CRITICAL_ROUTES).toEqual(criticalFromManifest);
  });

  it('contains /platform-v7/control-tower', () => {
    expect(CRITICAL_ROUTES).toContain('/platform-v7/control-tower');
  });

  it('contains /platform-v7/driver', () => {
    expect(CRITICAL_ROUTES).toContain('/platform-v7/driver');
  });

  it('does not contain non-critical paths', () => {
    const nonCritical = PLATFORM_V7_ROUTES_MANIFEST
      .filter((e: RouteEntry) => !e.critical)
      .map((e: RouteEntry) => e.path);
    for (const path of nonCritical) {
      expect(CRITICAL_ROUTES).not.toContain(path);
    }
  });
});

describe('MANIFEST_ROLES', () => {
  it('is a non-empty array', () => {
    expect(Array.isArray(MANIFEST_ROLES)).toBe(true);
    expect(MANIFEST_ROLES.length).toBeGreaterThan(5);
  });

  it('contains core roles: operator, buyer, seller, bank, driver', () => {
    expect(MANIFEST_ROLES).toContain('operator');
    expect(MANIFEST_ROLES).toContain('buyer');
    expect(MANIFEST_ROLES).toContain('seller');
    expect(MANIFEST_ROLES).toContain('bank');
    expect(MANIFEST_ROLES).toContain('driver');
  });

  it('contains compliance, arbitrator, logistics, executive', () => {
    expect(MANIFEST_ROLES).toContain('compliance');
    expect(MANIFEST_ROLES).toContain('arbitrator');
    expect(MANIFEST_ROLES).toContain('logistics');
    expect(MANIFEST_ROLES).toContain('executive');
  });

  it('has no duplicate roles', () => {
    const unique = new Set(MANIFEST_ROLES);
    expect(unique.size).toBe(MANIFEST_ROLES.length);
  });
});

// ──────────────────────────────────────────────
// support-contour-smoke
// ──────────────────────────────────────────────
import { PLATFORM_V7_SUPPORT_CONTOUR_SMOKE } from '@/lib/platform-v7/support-contour-smoke';

describe('PLATFORM_V7_SUPPORT_CONTOUR_SMOKE', () => {
  it('is true', () => {
    expect(PLATFORM_V7_SUPPORT_CONTOUR_SMOKE).toBe(true);
  });
});
