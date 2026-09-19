import { describe, expect, it } from 'vitest';
import {
  calculateLabQualityImpact,
  selectDealExecutionCase,
  type DealExecutionLabProtocol,
} from '@/lib/platform-v7/deal-execution-source-of-truth';

const BASE_PROTOCOL: DealExecutionLabProtocol = {
  crop: 'Пшеница',
  class: '4 класс',
  moisture: 13.8,
  nature: 742,
  protein: 12.1,
  gluten: 20.5,
  idk: 92,
  fallingNumber: 210,
  weedImpurity: 1.4,
  grainImpurity: 3.2,
  infestation: 'не обнаружена',
  protocolNumber: 'LAB-DL-9106-001',
  method: 'ГОСТ 13586 / ручной протокол пилота',
  laboratory: 'Лаборатория пилота',
  signer: 'Иванова А.А.',
  kepStatus: 'КЭП лаборатории · ручная проверка',
  measuredAt: '2026-05-21T13:20:00+03:00',
};

describe('lab-quality-impact', () => {
  it('keeps structured lab protocol fields and creates no hold when quality matches terms', () => {
    const executionCase = selectDealExecutionCase('DL-9106');
    if (!executionCase) throw new Error('DL-9106 source of truth missing');

    const impact = calculateLabQualityImpact(executionCase, BASE_PROTOCOL);

    expect(impact.protocol).toEqual(expect.objectContaining({
      crop: 'Пшеница',
      class: '4 класс',
      moisture: 13.8,
      nature: 742,
      protein: 12.1,
      gluten: 20.5,
      idk: 92,
      fallingNumber: 210,
      protocolNumber: 'LAB-DL-9106-001',
      kepStatus: 'КЭП лаборатории · ручная проверка',
    }));
    expect(impact.qualityDelta).toEqual([]);
    expect(impact.priceAdjustment).toBe(0);
    expect(impact.holdAmount).toBe(0);
    expect(impact.disputeTrigger).toBe(false);
  });

  it('turns lower quality into price adjustment, hold and dispute trigger', () => {
    const executionCase = selectDealExecutionCase('DL-9106');
    if (!executionCase) throw new Error('DL-9106 source of truth missing');

    const impact = calculateLabQualityImpact(executionCase, {
      ...BASE_PROTOCOL,
      class: '5 класс',
      moisture: 15.2,
      nature: 724,
      protein: 10.9,
      gluten: 16.7,
      idk: 108,
      fallingNumber: 166,
      weedImpurity: 2.6,
      grainImpurity: 5.8,
    });

    expect(impact.qualityDelta).toEqual(expect.arrayContaining([
      'класс 5 класс ниже условий 4 класс',
      'влажность выше на 1.2 п.п.',
      'натура ниже на 6 г/л',
    ]));
    expect(impact.priceAdjustmentPerTon).toBeGreaterThan(0);
    expect(impact.priceAdjustment).toBe(impact.priceAdjustmentPerTon * executionCase.commodity.volumeDeclaredTons);
    expect(impact.holdAmount).toBe(impact.priceAdjustment);
    expect(impact.disputeTrigger).toBe(true);
    expect(impact.bankStatus).toBe('качество не закрыто / есть корректировка');
    expect(impact.nextRoleTask).toContain('банк видит удержание по качеству');
  });
});
