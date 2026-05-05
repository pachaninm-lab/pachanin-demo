import { describe, expect, it } from 'vitest';
import {
  PLATFORM_V7_EXTERNAL_COPY_REPLACEMENTS,
  PLATFORM_V7_FORBIDDEN_EXTERNAL_COPY,
  PLATFORM_V7_REQUIRED_EXTERNAL_COPY_PRINCIPLES,
  getPlatformV7ExternalReplacement,
} from '@/lib/platform-v7/external-copy-guardrails';

describe('platform-v7 external copy guardrails', () => {
  it('covers technical, presentation and pilot-like copy that must not leak into the external contour', () => {
    expect(PLATFORM_V7_FORBIDDEN_EXTERNAL_COPY).toContain('Control Tower');
    expect(PLATFORM_V7_FORBIDDEN_EXTERNAL_COPY).toContain('Controlled pilot');
    expect(PLATFORM_V7_FORBIDDEN_EXTERNAL_COPY).toContain('controlled-pilot');
    expect(PLATFORM_V7_FORBIDDEN_EXTERNAL_COPY).toContain('Simulation-grade');
    expect(PLATFORM_V7_FORBIDDEN_EXTERNAL_COPY).toContain('simulation-grade');
    expect(PLATFORM_V7_FORBIDDEN_EXTERNAL_COPY).toContain('Sandbox');
    expect(PLATFORM_V7_FORBIDDEN_EXTERNAL_COPY).toContain('callbacks');
    expect(PLATFORM_V7_FORBIDDEN_EXTERNAL_COPY).toContain('runtime');
    expect(PLATFORM_V7_FORBIDDEN_EXTERNAL_COPY).toContain('production-ready');
    expect(PLATFORM_V7_FORBIDDEN_EXTERNAL_COPY).toContain('live-integrated');
    expect(PLATFORM_V7_FORBIDDEN_EXTERNAL_COPY).toContain('mock');
    expect(PLATFORM_V7_FORBIDDEN_EXTERNAL_COPY).toContain('debug');
    expect(PLATFORM_V7_FORBIDDEN_EXTERNAL_COPY).toContain('Маршрут сделки за 3 минуты');
    expect(PLATFORM_V7_FORBIDDEN_EXTERNAL_COPY).toContain('Ответы за 5 секунд');
    expect(PLATFORM_V7_FORBIDDEN_EXTERNAL_COPY).toContain('выше первого скролла');
    expect(PLATFORM_V7_FORBIDDEN_EXTERNAL_COPY).toContain('маршрут показа');
  });

  it('provides official Russian replacements for forbidden external copy', () => {
    for (const forbiddenCopy of PLATFORM_V7_FORBIDDEN_EXTERNAL_COPY) {
      expect(PLATFORM_V7_EXTERNAL_COPY_REPLACEMENTS[forbiddenCopy]).toBeTruthy();
    }
  });

  it('turns presentation language into working-platform language', () => {
    expect(getPlatformV7ExternalReplacement('Маршрут сделки за 3 минуты')).toBe('Рабочий контур сделки');
    expect(getPlatformV7ExternalReplacement('Ответы за 5 секунд')).toBe('Состояние сделки');
    expect(getPlatformV7ExternalReplacement('маршрут показа')).toBe('рабочий маршрут');
    expect(getPlatformV7ExternalReplacement('сквозной сценарий')).toBe('текущий контур');
    expect(getPlatformV7ExternalReplacement('controlled-pilot')).toBe('контур сделки');
  });

  it('keeps copy principles aligned with the execution platform positioning', () => {
    expect(PLATFORM_V7_REQUIRED_EXTERNAL_COPY_PRINCIPLES).toContain('пользователь видит официальный русский язык');
    expect(PLATFORM_V7_REQUIRED_EXTERNAL_COPY_PRINCIPLES).toContain('роль видит только нужный ей контекст');
    expect(PLATFORM_V7_REQUIRED_EXTERNAL_COPY_PRINCIPLES).toContain('статус зрелости не завышается');
    expect(PLATFORM_V7_REQUIRED_EXTERNAL_COPY_PRINCIPLES).toContain('технические следы скрыты из внешнего контура');
    expect(PLATFORM_V7_REQUIRED_EXTERNAL_COPY_PRINCIPLES).toContain('деньги, документы, груз и блокер названы одинаково на всех экранах');
    expect(PLATFORM_V7_REQUIRED_EXTERNAL_COPY_PRINCIPLES).toContain('интерфейс выглядит как рабочая система, а не презентационный стенд');
  });

  it('returns replacements through a stable helper', () => {
    expect(getPlatformV7ExternalReplacement('Control Tower')).toBe('Центр управления');
    expect(getPlatformV7ExternalReplacement('callbacks')).toBe('ответы банка');
    expect(getPlatformV7ExternalReplacement('production-ready')).toBe('требует подтверждения в промышленной эксплуатации');
    expect(getPlatformV7ExternalReplacement('unknown')).toBeUndefined();
  });
});
