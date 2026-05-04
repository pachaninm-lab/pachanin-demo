import { describe, expect, it } from 'vitest';
import {
  PLATFORM_V7_EXTERNAL_COPY_REPLACEMENTS,
  PLATFORM_V7_FORBIDDEN_EXTERNAL_COPY,
  PLATFORM_V7_REQUIRED_EXTERNAL_COPY_PRINCIPLES,
  getPlatformV7ExternalReplacement,
} from '@/lib/platform-v7/external-copy-guardrails';

describe('platform-v7 external copy guardrails', () => {
  it('covers technical and English copy that must not leak into the external contour', () => {
    expect(PLATFORM_V7_FORBIDDEN_EXTERNAL_COPY).toContain('Control Tower');
    expect(PLATFORM_V7_FORBIDDEN_EXTERNAL_COPY).toContain('Controlled pilot');
    expect(PLATFORM_V7_FORBIDDEN_EXTERNAL_COPY).toContain('Simulation-grade');
    expect(PLATFORM_V7_FORBIDDEN_EXTERNAL_COPY).toContain('callbacks');
    expect(PLATFORM_V7_FORBIDDEN_EXTERNAL_COPY).toContain('runtime');
    expect(PLATFORM_V7_FORBIDDEN_EXTERNAL_COPY).toContain('production-ready');
    expect(PLATFORM_V7_FORBIDDEN_EXTERNAL_COPY).toContain('live-integrated');
    expect(PLATFORM_V7_FORBIDDEN_EXTERNAL_COPY).toContain('mock');
    expect(PLATFORM_V7_FORBIDDEN_EXTERNAL_COPY).toContain('debug');
  });

  it('provides official Russian replacements for forbidden external copy', () => {
    for (const forbiddenCopy of PLATFORM_V7_FORBIDDEN_EXTERNAL_COPY) {
      expect(PLATFORM_V7_EXTERNAL_COPY_REPLACEMENTS[forbiddenCopy]).toBeTruthy();
      expect(PLATFORM_V7_EXTERNAL_COPY_REPLACEMENTS[forbiddenCopy].length).toBeGreaterThan(4);
    }
  });

  it('keeps copy principles aligned with the execution platform positioning', () => {
    expect(PLATFORM_V7_REQUIRED_EXTERNAL_COPY_PRINCIPLES).toContain('пользователь видит официальный русский язык');
    expect(PLATFORM_V7_REQUIRED_EXTERNAL_COPY_PRINCIPLES).toContain('роль видит только нужный ей контекст');
    expect(PLATFORM_V7_REQUIRED_EXTERNAL_COPY_PRINCIPLES).toContain('статус зрелости не завышается');
    expect(PLATFORM_V7_REQUIRED_EXTERNAL_COPY_PRINCIPLES).toContain('технические следы скрыты из внешнего контура');
    expect(PLATFORM_V7_REQUIRED_EXTERNAL_COPY_PRINCIPLES).toContain('деньги, документы, груз и блокер названы одинаково на всех экранах');
  });

  it('returns replacements through a stable helper', () => {
    expect(getPlatformV7ExternalReplacement('Control Tower')).toBe('Центр управления');
    expect(getPlatformV7ExternalReplacement('callbacks')).toBe('ответы банка');
    expect(getPlatformV7ExternalReplacement('production-ready')).toBe('требует подтверждения в промышленной эксплуатации');
    expect(getPlatformV7ExternalReplacement('unknown')).toBeUndefined();
  });
});
