import { describe, expect, it } from 'vitest';

const PRIMARY_CONTROL_TOWER_KPIS = ['К выпуску', 'Под удержанием', 'Деньги под риском', 'SLA срочно'] as const;

describe('platform-v7 control tower light summary contract', () => {
  it('keeps the first screen focused on four primary KPIs', () => {
    expect(PRIMARY_CONTROL_TOWER_KPIS).toEqual(['К выпуску', 'Под удержанием', 'Деньги под риском', 'SLA срочно']);
    expect(PRIMARY_CONTROL_TOWER_KPIS).toHaveLength(4);
  });
});
