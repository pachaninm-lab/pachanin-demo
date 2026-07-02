import { AuthService } from './auth.service';
import { Role } from '../../common/types/request-user';

describe('AuthService security', () => {
  describe('register() role allowlist (C1 — privilege escalation)', () => {
    it.each([Role.ADMIN, Role.SUPPORT_MANAGER, Role.EXECUTIVE, Role.COMPLIANCE_OFFICER, Role.ARBITRATOR, Role.GUEST])(
      'refuses self-registration as privileged role %s',
      async (role) => {
        const svc = new AuthService();
        await expect(
          svc.register({ email: `esc-${role}@x.ru`, fullName: 'E', role, password: 'Str0ng-Passw0rd!' }),
        ).rejects.toThrow(/cannot be self-registered/i);
      },
    );

    it('allows self-registration as an operational role (FARMER)', async () => {
      const svc = new AuthService();
      const res = await svc.register({ email: 'farmer-new@x.ru', fullName: 'F', role: Role.FARMER, password: 'Str0ng-Passw0rd!' });
      expect(res.user.role).toBe(Role.FARMER);
    });
  });

  describe('login() lockout (M2 — brute force)', () => {
    it('locks the account after repeated failures, even for the correct password', async () => {
      const svc = new AuthService();
      const email = 'lock-me@x.ru';
      await svc.register({ email, fullName: 'L', role: Role.BUYER, password: 'Correct-Horse-9!' });

      for (let i = 0; i < 5; i += 1) {
        await expect(svc.login({ email, password: 'wrong-password' } as any)).rejects.toThrow(/Invalid credentials/);
      }
      // Now locked — even the correct password is refused with a lockout message.
      await expect(svc.login({ email, password: 'Correct-Horse-9!' } as any)).rejects.toThrow(/temporarily locked/i);
    });
  });
});
