import fs from 'node:fs';
import path from 'node:path';
import {
  requiresRecentFinancialMfa,
  requiresRoleMfa,
} from './auth.service';
import {
  FINANCIAL_MFA_THRESHOLD_KOPECKS,
  Role,
} from '../../common/types/request-user';

const authSource = fs.readFileSync(path.join(process.cwd(), 'src/modules/auth/auth.service.ts'), 'utf8');

describe('persistent auth policy', () => {
  it('contains no direct registration or synthetic identity authority', () => {
    expect(authSource).not.toContain('async register(');
    expect(authSource).not.toContain('registerSyntheticSeedUser');
    expect(authSource).not.toContain('SEED_CANONICAL_TEST_DEAL');
    expect(authSource).not.toContain('seedCompatibilityUsers');
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
