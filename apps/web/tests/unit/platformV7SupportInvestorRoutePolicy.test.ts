import { describe, expect, it } from 'vitest';
import {
  canRoleAccessCabinet,
  cabinetAccessDecision,
  isPlatformV7InternalRoute,
  isPlatformV7NonCoreRoute,
} from '@/lib/platform-v7/cabinet-access-policy';
import {
  PLATFORM_V7_ROLE_ROUTES,
  PLATFORM_V7_ROLE_NAVIGATION,
} from '@/lib/platform-v7/shellRoutes';
import type { PlatformRole } from '@/stores/usePlatformV7RStore';

// Phase 2 / PR-2 — support/investor routing decision.
//
// Decision (routing/access policy only, no cabinet rewrite):
//  - `support`  = internal support contour, oversight-only (operator/executive).
//                 NOT a participant cabinet and NOT a PlatformRole.
//  - `investor` = non-core read-only aggregate route, oversight-only. NOT an
//                 execution role and NOT a PlatformRole; never a deal cabinet.
// Participants are explicitly bounced; no participant-visible route-switch exists.

const OVERSIGHT_ROLES: PlatformRole[] = ['operator', 'executive'];
const PARTICIPANT_ROLES: PlatformRole[] = [
  'buyer',
  'seller',
  'logistics',
  'driver',
  'surveyor',
  'elevator',
  'lab',
  'bank',
  'arbitrator',
  'compliance',
];

const SUPPORT_PATHS = ['/platform-v7/support', '/platform-v7/support/new', '/platform-v7/support/operator'];
const INVESTOR_PATHS = ['/platform-v7/investor', '/platform-v7/investor/deals'];

describe('support is an internal oversight-only contour (not a participant cabinet)', () => {
  it('classifies the support routes as internal', () => {
    for (const path of SUPPORT_PATHS) {
      expect(isPlatformV7InternalRoute(path)).toBe(true);
      expect(isPlatformV7NonCoreRoute(path)).toBe(false);
    }
  });

  it('lets oversight roles open the support contour', () => {
    for (const role of OVERSIGHT_ROLES) {
      for (const path of SUPPORT_PATHS) {
        expect(canRoleAccessCabinet(role, path)).toBe(true);
      }
    }
  });

  it('denies every participant role and bounces them to their own home', () => {
    for (const role of PARTICIPANT_ROLES) {
      for (const path of SUPPORT_PATHS) {
        expect(canRoleAccessCabinet(role, path)).toBe(false);
      }
      const decision = cabinetAccessDecision(role, '/platform-v7/support');
      expect(decision.allowed).toBe(false);
      expect(decision.redirectTo).toBe(PLATFORM_V7_ROLE_ROUTES[role]);
    }
  });
});

describe('investor is a non-core oversight-only route (not an execution role)', () => {
  it('classifies the investor routes as non-core', () => {
    for (const path of INVESTOR_PATHS) {
      expect(isPlatformV7NonCoreRoute(path)).toBe(true);
      expect(isPlatformV7InternalRoute(path)).toBe(false);
    }
  });

  it('lets oversight roles open the investor aggregate', () => {
    for (const role of OVERSIGHT_ROLES) {
      for (const path of INVESTOR_PATHS) {
        expect(canRoleAccessCabinet(role, path)).toBe(true);
      }
    }
  });

  it('denies every participant role and bounces them to their own home', () => {
    for (const role of PARTICIPANT_ROLES) {
      for (const path of INVESTOR_PATHS) {
        expect(canRoleAccessCabinet(role, path)).toBe(false);
      }
      const decision = cabinetAccessDecision(role, '/platform-v7/investor');
      expect(decision.allowed).toBe(false);
      expect(decision.redirectTo).toBe(PLATFORM_V7_ROLE_ROUTES[role]);
    }
  });
});

describe('support/investor are not platform-v7 roles', () => {
  it('neither is a selectable PlatformRole cabinet', () => {
    const roleKeys = Object.keys(PLATFORM_V7_ROLE_ROUTES);
    expect(roleKeys).not.toContain('support');
    expect(roleKeys).not.toContain('investor');
    // The canonical execution-role surface stays exactly the 12 known roles.
    expect(roleKeys).toHaveLength(12);
  });
});

describe('no participant-visible route-switch into support/investor', () => {
  it('no role navigation (bottom/drawer/command) links to support or investor', () => {
    for (const role of Object.keys(PLATFORM_V7_ROLE_NAVIGATION) as PlatformRole[]) {
      const entry = PLATFORM_V7_ROLE_NAVIGATION[role];
      const hrefs = [...entry.bottom, ...entry.drawer, ...entry.command].map((item) => item.href);
      for (const href of hrefs) {
        expect(href).not.toContain('/platform-v7/support');
        expect(href).not.toContain('/platform-v7/investor');
      }
    }
  });
});

describe('the shell route policy is not broken by the decision', () => {
  it('every role still resolves its own home and can open it', () => {
    for (const role of Object.keys(PLATFORM_V7_ROLE_NAVIGATION) as PlatformRole[]) {
      const home = PLATFORM_V7_ROLE_ROUTES[role];
      expect(home).toMatch(/^\/platform-v7/);
      expect(canRoleAccessCabinet(role, home)).toBe(true);
    }
  });

  it('shared and own-cabinet access is unaffected for participants', () => {
    expect(canRoleAccessCabinet('seller', '/platform-v7/seller')).toBe(true);
    expect(canRoleAccessCabinet('buyer', '/platform-v7/ai')).toBe(true);
    expect(canRoleAccessCabinet('bank', '/platform-v7/bank/clean')).toBe(true);
  });
});
