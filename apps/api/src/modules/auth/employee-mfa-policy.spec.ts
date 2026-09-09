import { Role, ROLES_REQUIRING_MFA } from '../../common/types/request-user';
import { requiresRoleMfa } from './auth.service';

describe('organization employee MFA policy', () => {
  it('requires TOTP enrollment for the server-derived GUEST employee membership', () => {
    expect(ROLES_REQUIRING_MFA).toContain(Role.GUEST);
    expect(requiresRoleMfa(Role.GUEST)).toBe(true);
  });
});
