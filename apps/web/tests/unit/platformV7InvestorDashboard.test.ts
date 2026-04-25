import { describe, expect, it } from 'vitest';
import {
  platformV7InvestorDashboardIsHonest,
  platformV7InvestorDashboardModel,
} from '@/lib/platform-v7/investor-dashboard';

describe('platform-v7 investor dashboard model', () => {
  it('builds investor dashboard from E04 foundations', () => {
    const model = platformV7InvestorDashboardModel();

    expect(model.metrics).toHaveLength(6);
    expect(model.story).toHaveLength(3);
    expect(model.roadmap).toHaveLength(5);
    expect(model.primaryCta).toBe('Показать инвестору');
    expect(model.secondaryCta).toBe('Открыть демо-сценарий');
  });

  it('keeps investor dashboard honest about readiness', () => {
    expect(platformV7InvestorDashboardIsHonest()).toBe(true);
  });
});
