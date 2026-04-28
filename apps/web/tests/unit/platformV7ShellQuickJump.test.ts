import { describe, expect, it } from 'vitest';
import { PLATFORM_V7_QUICK_JUMP_ITEMS, platformV7QuickJumpGroups, platformV7QuickJumpItems } from '@/lib/platform-v7/shellQuickJump';
import { PLATFORM_V7_DEALS_ROUTE, PLATFORM_V7_DISPUTES_ROUTE, PLATFORM_V7_SHELL_ROUTE_SURFACE } from '@/lib/platform-v7/routes';

describe('platform-v7 shell quick jump registry', () => {
  it('keeps items centralized and grouped', () => {
    expect(platformV7QuickJumpItems()).toBe(PLATFORM_V7_QUICK_JUMP_ITEMS);
    expect(platformV7QuickJumpItems().length).toBeGreaterThanOrEqual(16);
    expect(platformV7QuickJumpGroups()).toEqual(['Навигация', 'Сделки', 'Споры', 'Роли']);
  });

  it('keeps hrefs inside approved route classes', () => {
    const shellRoutes = new Set<string>(PLATFORM_V7_SHELL_ROUTE_SURFACE);

    for (const item of platformV7QuickJumpItems()) {
      const deal = item.href.startsWith(`${PLATFORM_V7_DEALS_ROUTE}/`);
      const dispute = item.href.startsWith(`${PLATFORM_V7_DISPUTES_ROUTE}/`);
      expect(shellRoutes.has(item.href) || deal || dispute).toBe(true);
    }
  });

  it('keeps role actions explicit', () => {
    const actions = platformV7QuickJumpItems().filter((item) => item.action);
    expect(actions.map((item) => item.action).sort()).toEqual(['role:arbitrator', 'role:buyer', 'role:driver']);
    expect(actions.every((item) => item.group === 'Роли')).toBe(true);
  });

  it('keeps critical labels discoverable', () => {
    const labels = new Set(platformV7QuickJumpItems().map((item) => item.label));
    expect(labels).toContain('Центр управления');
    expect(labels).toContain('Сделки');
    expect(labels).toContain('Логистика');
    expect(labels).toContain('Банк');
    expect(labels).toContain('Споры');
  });
});
