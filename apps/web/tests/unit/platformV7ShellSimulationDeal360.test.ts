import { describe, it, expect } from 'vitest';
import { existsSync } from 'node:fs';

const SHELL_FILES = [
  'lib/platform-v7/simulated-external-actions.ts',
  'lib/platform-v7/shell-role-policy.ts',
  'lib/platform-v7/deal360-source-of-truth.ts',
];

describe('PR 19.0 — Shell, Simulation & Deal360 — source guard', () => {
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
// simulated-external-actions
// ──────────────────────────────────────────────
import {
  simulatePlatformV7ExternalAction,
  getPlatformV7SimulationBanner,
} from '@/lib/platform-v7/simulated-external-actions';
import type { SimulatedExternalActionInput, PlatformV7ExternalSystem } from '@/lib/platform-v7/simulated-external-actions';

describe('simulatePlatformV7ExternalAction', () => {
  const makeInput = (overrides: Partial<SimulatedExternalActionInput> = {}): SimulatedExternalActionInput => ({
    system: 'bank',
    action: 'reserve_confirmed',
    dealId: 'DL-9106',
    ...overrides,
  });

  it('returns result with system, action, dealId, status, userMessage, nextStep, auditEvent', () => {
    const result = simulatePlatformV7ExternalAction(makeInput());
    expect(result.system).toBe('bank');
    expect(result.action).toBe('reserve_confirmed');
    expect(result.dealId).toBe('DL-9106');
    expect(['queued', 'received', 'manual_review', 'failed']).toContain(result.status);
    expect(result.userMessage).toBeTruthy();
    expect(result.nextStep).toBeTruthy();
    expect(result.auditEvent).toBeDefined();
  });

  it('auditEvent has correct shape', () => {
    const result = simulatePlatformV7ExternalAction(makeInput());
    expect(result.auditEvent.eventType).toBe('SIMULATED_EXTERNAL_ACTION');
    expect(result.auditEvent.actor).toBe('platform-v7-simulator');
    expect(result.auditEvent.dealId).toBe('DL-9106');
    expect(result.auditEvent.system).toBe('bank');
  });

  it('id is a slug derived from system-dealId-action', () => {
    const result = simulatePlatformV7ExternalAction(makeInput());
    expect(result.id).toMatch(/^sim-bank-DL-9106/);
  });

  it('returns "received" status when action or reason contains "confirm"', () => {
    const result = simulatePlatformV7ExternalAction(makeInput({ action: 'confirm_payment' }));
    expect(result.status).toBe('received');
  });

  it('returns "received" status when reason contains "готов"', () => {
    const result = simulatePlatformV7ExternalAction(makeInput({ reason: 'документы готовы к отправке' }));
    expect(result.status).toBe('received');
  });

  it('returns "failed" status when action contains "error"', () => {
    const result = simulatePlatformV7ExternalAction(makeInput({ action: 'validation_error' }));
    expect(result.status).toBe('failed');
  });

  it('returns "failed" status when reason contains "ошибка"', () => {
    const result = simulatePlatformV7ExternalAction(makeInput({ reason: 'ошибка соединения' }));
    expect(result.status).toBe('failed');
  });

  it('returns "manual_review" when action contains "manual"', () => {
    const result = simulatePlatformV7ExternalAction(makeInput({ action: 'manual_check' }));
    expect(result.status).toBe('manual_review');
  });

  it('returns "manual_review" when reason contains "ручн"', () => {
    const result = simulatePlatformV7ExternalAction(makeInput({ reason: 'требует ручного подтверждения' }));
    expect(result.status).toBe('manual_review');
  });

  it('returns "queued" as default when no keywords match', () => {
    const result = simulatePlatformV7ExternalAction(makeInput({ action: 'status_check', reason: undefined }));
    expect(result.status).toBe('queued');
  });

  it('uses reason in auditEvent', () => {
    const result = simulatePlatformV7ExternalAction(makeInput({ reason: 'test reason' }));
    expect(result.auditEvent.reason).toBe('test reason');
  });

  it('uses default reason when none provided', () => {
    const result = simulatePlatformV7ExternalAction(makeInput({ reason: undefined }));
    expect(result.auditEvent.reason).toBeTruthy();
  });

  it('works for all 6 systems', () => {
    const systems: PlatformV7ExternalSystem[] = ['bank', 'fgis', 'edo', 'etrn', 'gps', 'lab'];
    for (const system of systems) {
      const result = simulatePlatformV7ExternalAction(makeInput({ system }));
      expect(result.system).toBe(system);
      expect(result.nextStep).toBeTruthy();
    }
  });
});

describe('getPlatformV7SimulationBanner', () => {
  const systems: PlatformV7ExternalSystem[] = ['bank', 'fgis', 'edo', 'etrn', 'gps', 'lab'];

  for (const system of systems) {
    it(`returns non-empty banner for system "${system}"`, () => {
      const banner = getPlatformV7SimulationBanner(system);
      expect(banner).toBeTruthy();
      expect(banner.length).toBeGreaterThan(10);
    });
  }

  it('banner mentions simulation context', () => {
    const banner = getPlatformV7SimulationBanner('bank');
    expect(banner.toLowerCase()).toMatch(/тестов|симул|pilot/i);
  });
});

// ──────────────────────────────────────────────
// shell-role-policy
// ──────────────────────────────────────────────
import {
  inferPlatformRoleFromPath,
  getShellPolicy,
  getHeaderSelectableRoles,
  canShowRoleSwitcher,
  canShowGlobalSearch,
  canShowGlobalStatuses,
  canShowDrawer,
  canShowPortalRoleSwitcher,
  FIELD_SHELL_ROLES,
  ROLE_SCOPED_SHELL_ROLES,
} from '@/lib/platform-v7/shell-role-policy';

describe('inferPlatformRoleFromPath', () => {
  it('returns operator for /platform-v7/control-tower path', () => {
    expect(inferPlatformRoleFromPath('/platform-v7/control-tower/dashboard', 'seller')).toBe('operator');
  });

  it('returns executive for /platform-v7/executive path', () => {
    expect(inferPlatformRoleFromPath('/platform-v7/executive/summary', 'seller')).toBe('executive');
  });

  it('returns buyer for /platform-v7/buyer path', () => {
    expect(inferPlatformRoleFromPath('/platform-v7/buyer/deals', 'seller')).toBe('buyer');
  });

  it('returns buyer for /platform-v7/procurement path', () => {
    expect(inferPlatformRoleFromPath('/platform-v7/procurement/lots', 'seller')).toBe('buyer');
  });

  it('returns seller for /platform-v7/seller path', () => {
    expect(inferPlatformRoleFromPath('/platform-v7/seller/lots', 'buyer')).toBe('seller');
  });

  it('returns logistics for /platform-v7/logistics path', () => {
    expect(inferPlatformRoleFromPath('/platform-v7/logistics/trips', 'seller')).toBe('logistics');
  });

  it('returns driver for /platform-v7/driver path', () => {
    expect(inferPlatformRoleFromPath('/platform-v7/driver/trip', 'seller')).toBe('driver');
  });

  it('returns elevator for /platform-v7/elevator path', () => {
    expect(inferPlatformRoleFromPath('/platform-v7/elevator/lots', 'seller')).toBe('elevator');
  });

  it('returns lab for /platform-v7/lab path', () => {
    expect(inferPlatformRoleFromPath('/platform-v7/lab/protocols', 'seller')).toBe('lab');
  });

  it('returns bank for /platform-v7/bank path', () => {
    expect(inferPlatformRoleFromPath('/platform-v7/bank/deals', 'seller')).toBe('bank');
  });

  it('returns arbitrator for /platform-v7/disputes path', () => {
    expect(inferPlatformRoleFromPath('/platform-v7/disputes/open', 'seller')).toBe('arbitrator');
  });

  it('returns compliance for /platform-v7/compliance path', () => {
    expect(inferPlatformRoleFromPath('/platform-v7/compliance/audit', 'seller')).toBe('compliance');
  });

  it('returns fallback for unknown path', () => {
    expect(inferPlatformRoleFromPath('/some/unknown/path', 'seller')).toBe('seller');
    expect(inferPlatformRoleFromPath('/some/unknown/path', 'bank')).toBe('bank');
  });
});

describe('getShellPolicy', () => {
  it('returns "field" for field shell roles', () => {
    for (const role of FIELD_SHELL_ROLES) {
      expect(getShellPolicy(role, '/some/path')).toBe('field');
    }
  });

  it('returns "role-scoped" for role-scoped shell roles', () => {
    for (const role of ROLE_SCOPED_SHELL_ROLES) {
      expect(getShellPolicy(role, '/some/path')).toBe('role-scoped');
    }
  });

  it('returns "operator" for operator/executive roles', () => {
    expect(getShellPolicy('operator', '/some/path')).toBe('operator');
    expect(getShellPolicy('executive', '/some/path')).toBe('operator');
  });

  it('returns "field" for field paths regardless of role', () => {
    expect(getShellPolicy('operator', '/platform-v7/driver/trip')).toBe('field');
  });

  it('returns "role-scoped" for role-scoped paths', () => {
    expect(getShellPolicy('operator', '/platform-v7/buyer/deals')).toBe('role-scoped');
  });
});

describe('canShowRoleSwitcher', () => {
  it('returns true for operator on a non-field path', () => {
    expect(canShowRoleSwitcher('operator', '/platform-v7/control-tower')).toBe(true);
  });

  it('returns false for driver (field shell)', () => {
    expect(canShowRoleSwitcher('driver', '/platform-v7/driver')).toBe(false);
  });

  it('returns false for role-scoped roles', () => {
    expect(canShowRoleSwitcher('buyer', '/platform-v7/buyer')).toBe(false);
  });
});

describe('canShowGlobalSearch / canShowGlobalStatuses / canShowDrawer', () => {
  it('operator on control-tower path: all global features visible', () => {
    const path = '/platform-v7/control-tower';
    expect(canShowGlobalSearch('operator', path)).toBe(true);
    expect(canShowGlobalStatuses('operator', path)).toBe(true);
    expect(canShowDrawer('operator', path)).toBe(true);
  });

  it('driver on driver path: all global features hidden', () => {
    const path = '/platform-v7/driver/trip';
    expect(canShowGlobalSearch('driver', path)).toBe(false);
    expect(canShowGlobalStatuses('driver', path)).toBe(false);
    expect(canShowDrawer('driver', path)).toBe(false);
  });
});

describe('getHeaderSelectableRoles', () => {
  it('returns empty array for field path', () => {
    expect(getHeaderSelectableRoles('operator', '/platform-v7/driver')).toHaveLength(0);
  });

  it('returns operator roles list for operator on non-field path', () => {
    const roles = getHeaderSelectableRoles('operator', '/platform-v7/control-tower');
    expect(roles.length).toBeGreaterThan(1);
  });
});

describe('canShowPortalRoleSwitcher', () => {
  it('returns false for field paths', () => {
    expect(canShowPortalRoleSwitcher('operator', '/platform-v7/driver')).toBe(false);
  });

  it('returns true for operator on non-field, non-role-scoped path', () => {
    expect(canShowPortalRoleSwitcher('operator', '/platform-v7/control-tower')).toBe(true);
  });
});

// ──────────────────────────────────────────────
// deal360-source-of-truth
// ──────────────────────────────────────────────
import {
  getDeal360Scenario,
  DEAL360_SCENARIOS,
} from '@/lib/platform-v7/deal360-source-of-truth';

describe('getDeal360Scenario', () => {
  it('returns scenario for DL-9106 (base scenario)', () => {
    const scenario = getDeal360Scenario('DL-9106');
    expect(scenario.dealId).toBe('DL-9106');
    expect(scenario.lotId).toBe('LOT-2403');
    expect(scenario.releaseAllowed).toBe(false);
  });

  it('DL-9106 scenario has money, documents, chain, providerGates', () => {
    const scenario = getDeal360Scenario('DL-9106');
    expect(scenario.money.length).toBeGreaterThan(0);
    expect(scenario.documents.length).toBeGreaterThan(0);
    expect(scenario.chain.length).toBeGreaterThan(0);
    expect(scenario.providerGates.length).toBeGreaterThan(0);
  });

  it('DL-9106 cockpit has all required status fields', () => {
    const { cockpit } = getDeal360Scenario('DL-9106');
    expect(cockpit.currentStage).toBeTruthy();
    expect(cockpit.nextActor).toBeTruthy();
    expect(cockpit.moneyStatus).toBeDefined();
    expect(cockpit.docStatus).toBeDefined();
    expect(cockpit.tripStatus).toBeDefined();
    expect(cockpit.qualityStatus).toBeDefined();
    expect(cockpit.disputeStatus).toBeDefined();
    expect(cockpit.cannotHappenReason).toBeTruthy();
  });

  it('returns scenario for DL-9102 (dispute scenario)', () => {
    const scenario = getDeal360Scenario('DL-9102');
    expect(scenario.dealId).toBe('DL-9102');
    expect(scenario.cockpit.disputeStatus.state).toBe('stop');
  });

  it('returns fallback scenario for unknown dealId', () => {
    const scenario = getDeal360Scenario('UNKNOWN-123');
    expect(scenario.dealId).toBe('UNKNOWN-123');
    expect(scenario.nextAction).toBeTruthy();
  });

  it('DL-9106 has blocking documents', () => {
    const scenario = getDeal360Scenario('DL-9106');
    const blocking = scenario.documents.filter((d) => d.blocksMoney);
    expect(blocking.length).toBeGreaterThan(0);
  });

  it('DL-9106 chain includes lot, deal, payment stop steps', () => {
    const scenario = getDeal360Scenario('DL-9106');
    const titles = scenario.chain.map((c) => c.title);
    expect(titles).toContain('Лот');
    expect(titles).toContain('Сделка');
    expect(titles).toContain('Выплата');
  });

  it('DL-9106 money array has "К выплате сейчас" = "0 ₽"', () => {
    const scenario = getDeal360Scenario('DL-9106');
    const toRelease = scenario.money.find((m) => m.title.includes('выплате сейчас'));
    expect(toRelease).toBeDefined();
    expect(toRelease?.value).toContain('0');
  });

  it('DL-9102 money shows disputed hold amount', () => {
    const scenario = getDeal360Scenario('DL-9102');
    const hold = scenario.money.find((m) => m.title.includes('Удержание'));
    expect(hold).toBeDefined();
    expect(hold?.state).toBe('stop');
  });

  it('DL-9102 dispute status is stop state', () => {
    expect(getDeal360Scenario('DL-9102').cockpit.disputeStatus.state).toBe('stop');
  });

  it('DL-9106 dispute status is ok state', () => {
    expect(getDeal360Scenario('DL-9106').cockpit.disputeStatus.state).toBe('ok');
  });
});

describe('DEAL360_SCENARIOS', () => {
  it('contains DL-9106 and DL-9102', () => {
    expect(Object.keys(DEAL360_SCENARIOS)).toContain('DL-9106');
    expect(Object.keys(DEAL360_SCENARIOS)).toContain('DL-9102');
    expect(Object.keys(DEAL360_SCENARIOS)).toHaveLength(2);
  });
});
