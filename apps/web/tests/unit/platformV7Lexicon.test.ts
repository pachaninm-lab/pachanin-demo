import { describe, expect, it } from 'vitest';
import {
  PLATFORM_V7_LEXICON,
  platformV7ActionLabel,
  platformV7BreadcrumbLabel,
  platformV7EnvLabel,
  platformV7NavLabel,
} from '@/lib/platform-v7/lexicon';

function collectLabelValues(value: unknown): string[] {
  if (typeof value === 'string') return [value];
  if (!value || typeof value !== 'object') return [];
  return Object.values(value as Record<string, unknown>).flatMap(collectLabelValues);
}

describe('platform-v7 lexicon', () => {
  it('uses one Russian label for the control tower', () => {
    expect(platformV7NavLabel('controlTower')).toBe('Центр управления');
  });

  it('keeps environment labels centralized and user-facing', () => {
    expect(PLATFORM_V7_LEXICON.env.pilot).toBe('Пилотный режим');
    expect(PLATFORM_V7_LEXICON.env.pilotContour).toBe('Пилотный контур');
    expect(PLATFORM_V7_LEXICON.env.sandbox).toBe('Тестовый режим');
    expect(platformV7EnvLabel('demo')).toBe('Данные тестового сценария');
    expect(platformV7EnvLabel('callbacks')).toBe('Ответы банка');
    expect(platformV7EnvLabel('evidence')).toBe('Доказательный контур');
    expect(platformV7EnvLabel('rules')).toBe('Правила сделки');
  });

  it('keeps common action labels centralized and concrete', () => {
    expect(platformV7ActionLabel('openDeal')).toBe('Открыть сделку');
    expect(platformV7ActionLabel('openBank')).toBe('Открыть банковскую проверку');
    expect(platformV7ActionLabel('openCommandPalette')).toBe('Открыть поиск и команды');
    expect(platformV7ActionLabel('requestReserve')).toBe('Запросить резерв');
    expect(platformV7ActionLabel('releaseFunds')).toBe('Подтвердить выпуск денег');
    expect(platformV7ActionLabel('requestRelease')).toBe('Запросить проверку выпуска');
  });

  it('keeps breadcrumb labels centralized', () => {
    expect(platformV7BreadcrumbLabel('platformV7')).toBe('Прозрачная Цена');
    expect(platformV7BreadcrumbLabel('controlTower')).toBe('Центр управления');
    expect(platformV7BreadcrumbLabel('notifications')).toBe('Уведомления');
  });

  it('keeps public lexicon values free from English UI labels', () => {
    const labels = collectLabelValues(PLATFORM_V7_LEXICON);
    expect(labels.length).toBeGreaterThan(20);
    expect(labels.every((label) => !/[A-Za-z]{3,}/.test(label))).toBe(true);
  });
});
