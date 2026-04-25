import { describe, expect, it } from 'vitest';
import {
  platformV7DemoDashboardIsReady,
  platformV7DemoDashboardModel,
} from '@/lib/platform-v7/demo-dashboard';

describe('platform-v7 demo dashboard model', () => {
  it('builds demo dashboard model from tour foundations', () => {
    const model = platformV7DemoDashboardModel();

    expect(model.steps).toHaveLength(5);
    expect(model.title).toBe('Демо-сценарий исполнения сделки');
    expect(model.initialView.activeStepId).toBe('lot-readiness');
    expect(model.controls).toEqual(['Старт', 'Пауза', 'Назад', 'Вперёд', 'Перейти к шагу']);
  });

  it('keeps demo dashboard within acceptance window and honest readiness', () => {
    expect(platformV7DemoDashboardIsReady()).toBe(true);
  });
});
