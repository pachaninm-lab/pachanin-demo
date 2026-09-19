import { describe, expect, it } from 'vitest';
import { platformV7QuickJumpItems } from '@/lib/platform-v7/shellQuickJump';

describe('platform-v7 quick jump role actions', () => {
  it('keeps role actions only inside the role group', () => {
    for (const item of platformV7QuickJumpItems()) {
      if (item.action) {
        expect(item.group).toBe('Роли');
        expect(item.action.startsWith('role:')).toBe(true);
      } else {
        expect(item.group).not.toBe('Роли');
      }
    }
  });

  it('keeps role action labels explicit', () => {
    const roleActions = platformV7QuickJumpItems().filter((item) => item.action);

    for (const item of roleActions) {
      expect(item.label.toLowerCase()).toContain('переключить роль');
      expect(item.href.startsWith('/platform-v7')).toBe(true);
      expect(item.href.includes('/platform-v4')).toBe(false);
      expect(item.href.includes('/platform-v9')).toBe(false);
    }
  });
});
