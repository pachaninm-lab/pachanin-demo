import {
  canSelfRegisterRole,
  requiresRecentFinancialMfa,
  requiresRoleMfa,
} from './auth.service';
import {
  FINANCIAL_MFA_THRESHOLD_KOPECKS,
  Role,
} from '../../common/types/request-user';

describe('persistent auth policy', () => {
  it.each([
    Role.ADMIN,
    Role.SUPPORT_MANAGER,
    Role.EXECUTIVE,
    Role.COMPLIANCE_OFFICER,
    Role.ARBITRATOR,
    Role.GUEST,
    Role.BANK_CALLBACK,
  ])('refuses self-registration as privileged/system role %s', (role) => {
    expect(canSelfRegisterRole(role)).toBe(false);
  });

  it.each([
    Role.FARMER,
    Role.BUYER,
    Role.LOGISTICIAN,
    Role.DRIVER,
    Role.LAB,
    Role.ELEVATOR,
    Role.ACCOUNTING,
  ])('allows self-registration request for operational role %s', (role) => {
    expect(canSelfRegisterRole(role)).toBe(true);
  });

  it.each([
    Role.ADMIN,
    Role.COMPLIANCE_OFFICER,
    Role.ARBITRATOR,
  ])('requires MFA before activating privileged role %s', (role) => {
    expect(requiresRoleMfa(role)).toBe(true);
  });

  it('requires recent MFA at the exact financial threshold', () => {
    expect(requiresRecentFinancialMfa(FINANCIAL_MFA_THRESHOLD_KOPECKS - 1)).toBe(false);
    expect(requiresRecentFinancialMfa(FINANCIAL_MFA_THRESHOLD_KOPECKS)).toBe(true);
    expect(requiresRecentFinancialMfa(FINANCIAL_MFA_THRESHOLD_KOPECKS + 1)).toBe(true);
  });
});
