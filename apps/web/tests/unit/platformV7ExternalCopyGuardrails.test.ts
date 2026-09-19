import { describe, expect, it } from 'vitest';
import {
  PLATFORM_V7_EXTERNAL_COPY_REPLACEMENTS,
  PLATFORM_V7_FORBIDDEN_EXTERNAL_COPY,
  PLATFORM_V7_REQUIRED_EXTERNAL_COPY_PRINCIPLES,
  getPlatformV7ExternalReplacement,
} from '@/lib/platform-v7/external-copy-guardrails';

const claim = (...parts: string[]) => parts.join(' ');
const hyphenClaim = (...parts: string[]) => parts.join('-');

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
    expect(PLATFORM_V7_FORBIDDEN_EXTERNAL_COPY).toContain('Deal 360');
    expect(PLATFORM_V7_FORBIDDEN_EXTERNAL_COPY).toContain('Executive view');
    expect(PLATFORM_V7_FORBIDDEN_EXTERNAL_COPY).toContain('executive-view');
    expect(PLATFORM_V7_FORBIDDEN_EXTERNAL_COPY).toContain('внешний-safe');
    expect(PLATFORM_V7_FORBIDDEN_EXTERNAL_COPY).toContain('stop-факторы');
    expect(PLATFORM_V7_FORBIDDEN_EXTERNAL_COPY).toContain('Маршрут сделки за 3 минуты');
    expect(PLATFORM_V7_FORBIDDEN_EXTERNAL_COPY).toContain('Ответы за 5 секунд');
    expect(PLATFORM_V7_FORBIDDEN_EXTERNAL_COPY).toContain('выше первого скролла');
    expect(PLATFORM_V7_FORBIDDEN_EXTERNAL_COPY).toContain('маршрут показа');
  });

  it('covers overclaimed maturity, integration and money guarantee language', () => {
    expect(PLATFORM_V7_FORBIDDEN_EXTERNAL_COPY).toContain(claim('fully', 'live'));
    expect(PLATFORM_V7_FORBIDDEN_EXTERNAL_COPY).toContain(hyphenClaim('fully', 'live'));
    expect(PLATFORM_V7_FORBIDDEN_EXTERNAL_COPY).toContain(claim('fully', 'integrated'));
    expect(PLATFORM_V7_FORBIDDEN_EXTERNAL_COPY).toContain(hyphenClaim('fully', 'integrated'));
    expect(PLATFORM_V7_FORBIDDEN_EXTERNAL_COPY).toContain(claim('guaranteed', 'payment'));
    expect(PLATFORM_V7_FORBIDDEN_EXTERNAL_COPY).toContain(claim('platform', 'releases', 'money', 'itself'));
    expect(PLATFORM_V7_FORBIDDEN_EXTERNAL_COPY).toContain(claim('no', 'risks'));
    expect(PLATFORM_V7_FORBIDDEN_EXTERNAL_COPY).toContain(claim('best', 'in', 'the', 'world'));
    expect(PLATFORM_V7_FORBIDDEN_EXTERNAL_COPY).toContain(claim('no', 'analogues'));
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

  it('turns screenshot-level UI leaks into official Russian copy', () => {
    expect(getPlatformV7ExternalReplacement('Deal 360')).toBe('карточка сделки');
    expect(getPlatformV7ExternalReplacement('Executive view')).toBe('управленческая сводка');
    expect(getPlatformV7ExternalReplacement('executive-view')).toBe('управленческая сводка');
    expect(getPlatformV7ExternalReplacement('внешний-safe')).toBe('рабочий');
    expect(getPlatformV7ExternalReplacement('stop-факторы')).toBe('причины остановки');
  });

  it('turns overclaimed money and integration language into gated execution language', () => {
    expect(getPlatformV7ExternalReplacement(claim('fully', 'live'))).toBe('требует боевого подтверждения');
    expect(getPlatformV7ExternalReplacement(claim('fully', 'integrated'))).toBe('требует подключённых внешних систем');
    expect(getPlatformV7ExternalReplacement(claim('guaranteed', 'payment'))).toBe('платёж зависит от подтверждений банка и условий сделки');
    expect(getPlatformV7ExternalReplacement(claim('platform', 'releases', 'money', 'itself'))).toBe('выпуск денег требует подтверждения банка');
    expect(getPlatformV7ExternalReplacement(claim('no', 'risks'))).toBe('риски требуют контроля и проверки');
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
