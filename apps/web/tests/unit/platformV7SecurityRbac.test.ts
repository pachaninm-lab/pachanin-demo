import { describe, expect, it } from 'vitest';
import {
  PLATFORM_V7_SECURITY_RULES,
  canPlatformV7RoleRead,
  canPlatformV7RoleSeeMoneyAmount,
  canPlatformV7RoleWrite,
  getPlatformV7DriverIsolationSummary,
  getPlatformV7InvestorBoundarySummary,
} from '@/lib/platform-v7/security-rbac';
import { PLATFORM_V7_CANONICAL_ROLES } from '@/lib/platform-v7/role-canonical';

const SHORT_ALIASES = ['bank', 'logistics', 'elevator', 'lab', 'executive', 'compliance'];

describe('platform-v7 security RBAC contracts', () => {
  it('keeps driver isolated from money and investor surfaces', () => {
    expect(getPlatformV7DriverIsolationSummary()).toEqual({
      canReadOwnTrip: true,
      canWriteOwnTrip: true,
      canReadMoney: false,
      canSeeMoneyAmount: false,
      canReadInvestorSummary: false,
    });
  });

  it('keeps investor read-only and away from operational details', () => {
    expect(getPlatformV7InvestorBoundarySummary()).toEqual({
      canReadSummary: true,
      canWriteSummary: false,
      canReadDocuments: false,
      canReadTrips: false,
    });
  });

  it('keeps executive_viewer read-only on aggregates and away from operational resources', () => {
    expect(canPlatformV7RoleRead('executive_viewer', 'aggregate_report')).toBe(true);
    expect(canPlatformV7RoleWrite('executive_viewer', 'aggregate_report')).toBe(false);
    expect(canPlatformV7RoleRead('executive_viewer', 'deal')).toBe(false);
    expect(canPlatformV7RoleRead('executive_viewer', 'money')).toBe(false);
    expect(canPlatformV7RoleRead('executive_viewer', 'support_case')).toBe(false);
  });

  it('keeps bank_officer money authority explicit and document authority read-only', () => {
    expect(canPlatformV7RoleRead('bank_officer', 'money')).toBe(true);
    expect(canPlatformV7RoleWrite('bank_officer', 'money')).toBe(true);
    expect(canPlatformV7RoleSeeMoneyAmount('bank_officer', 'money')).toBe(true);
    expect(canPlatformV7RoleRead('bank_officer', 'document')).toBe(true);
    expect(canPlatformV7RoleWrite('bank_officer', 'document')).toBe(false);
    expect(canPlatformV7RoleRead('bank_officer', 'trip')).toBe(false);
    expect(canPlatformV7RoleRead('bank_officer', 'driver_field')).toBe(false);
  });

  it('keeps support_agent and arbitrator away from money movement', () => {
    expect(canPlatformV7RoleRead('support_agent', 'support_case')).toBe(true);
    expect(canPlatformV7RoleWrite('support_agent', 'support_case')).toBe(true);
    expect(canPlatformV7RoleRead('support_agent', 'money')).toBe(false);
    expect(canPlatformV7RoleWrite('support_agent', 'money')).toBe(false);
    expect(canPlatformV7RoleRead('arbitrator', 'money')).toBe(false);
    expect(canPlatformV7RoleWrite('arbitrator', 'money')).toBe(false);
  });

  it('keeps seller and buyer money visible but not directly writable', () => {
    expect(canPlatformV7RoleRead('seller', 'money')).toBe(true);
    expect(canPlatformV7RoleWrite('seller', 'money')).toBe(false);
    expect(canPlatformV7RoleSeeMoneyAmount('seller', 'money')).toBe(true);
    expect(canPlatformV7RoleRead('buyer', 'money')).toBe(true);
    expect(canPlatformV7RoleWrite('buyer', 'money')).toBe(false);
    expect(canPlatformV7RoleSeeMoneyAmount('buyer', 'money')).toBe(true);
  });

  it('keeps every declared rule explicit about read, write and money visibility', () => {
    expect(PLATFORM_V7_SECURITY_RULES.length).toBeGreaterThan(20);
    for (const rule of PLATFORM_V7_SECURITY_RULES) {
      expect(typeof rule.canRead).toBe('boolean');
      expect(typeof rule.canWrite).toBe('boolean');
      expect(typeof rule.canSeeMoneyAmount).toBe('boolean');
      expect(rule.summary.length).toBeGreaterThan(20);
    }
  });

  it('uses only canonical role names — no short aliases in rules', () => {
    for (const rule of PLATFORM_V7_SECURITY_RULES) {
      expect(SHORT_ALIASES).not.toContain(rule.role);
      expect(PLATFORM_V7_CANONICAL_ROLES).toContain(rule.role);
    }
  });
});
