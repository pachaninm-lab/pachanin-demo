import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  PLATFORM_V7_BANK_ROUTE,
  PLATFORM_V7_BANK_CLEAN_ROUTE,
} from '@/lib/platform-v7/routes';
import {
  PLATFORM_V7_ROLE_ROUTES,
  platformV7RoleRoute,
  platformV7NavByRole,
} from '@/lib/platform-v7/shellRoutes';
import {
  canRoleAccessCabinet,
  cabinetAccessDecision,
} from '@/lib/platform-v7/cabinet-access-policy';
import type { PlatformRole } from '@/stores/usePlatformV7RStore';

// Phase 2 / PR-3 — dual bank entry resolved.
// Canonical bank cabinet = /platform-v7/bank ("Кабинет банка").
// /platform-v7/bank/clean = legacy "clean room" alias that redirects to canonical.

const cleanPage = fs.readFileSync(
  path.join(process.cwd(), 'apps/web/app/platform-v7/bank/clean/page.tsx'),
  'utf8',
);

const PARTICIPANT_NON_BANK: PlatformRole[] = [
  'buyer',
  'seller',
  'logistics',
  'driver',
  'surveyor',
  'elevator',
  'lab',
  'arbitrator',
  'compliance',
];

describe('canonical bank route', () => {
  it('uses /platform-v7/bank as the single canonical bank cabinet', () => {
    expect(PLATFORM_V7_BANK_ROUTE).toBe('/platform-v7/bank');
    expect(PLATFORM_V7_BANK_CLEAN_ROUTE).toBe('/platform-v7/bank/clean');
    expect(PLATFORM_V7_BANK_ROUTE).not.toBe(PLATFORM_V7_BANK_CLEAN_ROUTE);
  });

  it('resolves the bank role home to the canonical route', () => {
    expect(PLATFORM_V7_ROLE_ROUTES.bank).toBe(PLATFORM_V7_BANK_ROUTE);
    expect(platformV7RoleRoute('bank')).toBe(PLATFORM_V7_BANK_ROUTE);
  });

  it('points the bank bottom-nav home item at the canonical route, not the alias', () => {
    const hrefs = platformV7NavByRole('bank').map((item) => item.href);
    expect(hrefs).toContain(PLATFORM_V7_BANK_ROUTE);
    expect(hrefs.some((href) => href.startsWith(`${PLATFORM_V7_BANK_CLEAN_ROUTE}`))).toBe(false);
  });
});

describe('bank/clean is an explicit redirect alias, not a second cabinet', () => {
  it('redirects to the canonical bank route', () => {
    expect(cleanPage).toContain("from 'next/navigation'");
    expect(cleanPage).toContain('redirect(PLATFORM_V7_BANK_ROUTE)');
  });

  it('renders no second bank cockpit (no money/cockpit imports)', () => {
    expect(cleanPage).not.toContain('MoneyGateRing');
    expect(cleanPage).not.toContain('getPlatformV7BankCockpitState');
    expect(cleanPage).not.toContain('<table');
  });

  it('keeps no fake-live / bank-connected / production-ready copy', () => {
    const forbidden = [
      'production-ready',
      'bank connected',
      'банк подключён',
      'live payment',
      'платформа гарантирует оплату',
    ];
    const lower = cleanPage.toLowerCase();
    for (const phrase of forbidden) {
      expect(lower).not.toContain(phrase.toLowerCase());
    }
  });
});

describe('bank access is unchanged; the alias stays reachable for the bank role', () => {
  it('lets the bank role open both canonical and alias paths', () => {
    expect(canRoleAccessCabinet('bank', PLATFORM_V7_BANK_ROUTE)).toBe(true);
    expect(canRoleAccessCabinet('bank', PLATFORM_V7_BANK_CLEAN_ROUTE)).toBe(true);
  });

  it('still bounces non-bank participants away from the bank cabinet to their own home', () => {
    for (const role of PARTICIPANT_NON_BANK) {
      expect(canRoleAccessCabinet(role, PLATFORM_V7_BANK_ROUTE)).toBe(false);
      const decision = cabinetAccessDecision(role, PLATFORM_V7_BANK_ROUTE);
      expect(decision.allowed).toBe(false);
      expect(decision.redirectTo).toBe(PLATFORM_V7_ROLE_ROUTES[role]);
    }
  });

  it('does not expose a bank link in any non-oversight participant bottom nav', () => {
    for (const role of PARTICIPANT_NON_BANK) {
      const hrefs = platformV7NavByRole(role).map((item) => item.href);
      for (const href of hrefs) {
        expect(href.startsWith('/platform-v7/bank')).toBe(false);
      }
    }
  });
});
