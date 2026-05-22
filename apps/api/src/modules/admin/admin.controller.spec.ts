import { AdminController } from './admin.controller';
import { AuthService } from '../auth/auth.service';
import { Role } from '../../common/types/request-user';
import { NotFoundException } from '@nestjs/common';

function makeAuthService(): jest.Mocked<AuthService> {
  return {
    listUsers: jest.fn().mockReturnValue([
      { id: 'user-admin-001', email: 'admin@demo.ru', role: Role.ADMIN, orgId: 'org-demo-001', fullName: 'Demo Admin' },
      { id: 'user-farmer-001', email: 'farmer@demo.ru', role: Role.FARMER, orgId: 'org-farmer-001', fullName: 'Demo Farmer' },
    ]),
    updateUserRole: jest.fn().mockImplementation((id, role) => ({ id, role })),
    updateUserOrg: jest.fn().mockImplementation((id, orgId) => ({ id, orgId })),
  } as any;
}

describe('AdminController', () => {
  let ctrl: AdminController;
  let auth: jest.Mocked<AuthService>;

  beforeEach(() => {
    auth = makeAuthService();
    ctrl = new AdminController(auth);
  });

  describe('listUsers()', () => {
    it('returns all users', () => {
      const result = ctrl.listUsers();
      expect(result).toHaveLength(2);
      expect(result[0].email).toBe('admin@demo.ru');
    });

    it('does not expose password hashes', () => {
      const result = ctrl.listUsers();
      for (const u of result) {
        expect((u as any).passwordHash).toBeUndefined();
      }
    });
  });

  describe('updateRole()', () => {
    it('delegates to AuthService', () => {
      ctrl.updateRole('user-farmer-001', { role: Role.LOGISTICIAN });
      expect(auth.updateUserRole).toHaveBeenCalledWith('user-farmer-001', Role.LOGISTICIAN);
    });

    it('throws NotFoundException when user not found', () => {
      auth.updateUserRole.mockImplementation(() => { throw new Error('not found'); });
      expect(() => ctrl.updateRole('bad-id', { role: Role.ADMIN })).toThrow(NotFoundException);
    });
  });

  describe('updateOrg()', () => {
    it('delegates to AuthService', () => {
      ctrl.updateOrg('user-farmer-001', { orgId: 'org-new' });
      expect(auth.updateUserOrg).toHaveBeenCalledWith('user-farmer-001', 'org-new');
    });
  });

  describe('systemStatus()', () => {
    it('returns uptime and memory', () => {
      const status = ctrl.systemStatus();
      expect(status.uptime).toBeGreaterThanOrEqual(0);
      expect(status.memoryMb).toBeGreaterThan(0);
      expect(status.timestamp).toBeDefined();
      expect(status.nodeVersion).toMatch(/^v\d+/);
    });
  });
});
