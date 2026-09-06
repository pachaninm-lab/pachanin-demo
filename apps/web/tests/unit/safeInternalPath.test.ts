import { describe, expect, it } from 'vitest';

import { safeInternalPath } from '../../lib/safe-internal-path';

/**
 * Замерено на конструкторе URL относительно настоящего адреса приложения:
 * '//evil.com', '////evil.com' и '/\evil.com' разрешаются в https://evil.com,
 * и все три проходят проверку `startsWith('/')`, которая стояла здесь раньше.
 */
describe('safeInternalPath', () => {
  it('пропускает обычные внутренние пути', () => {
    expect(safeInternalPath('/lots')).toBe('/lots');
    expect(safeInternalPath('/platform-v7/deals')).toBe('/platform-v7/deals');
    expect(safeInternalPath('/canon/market')).toBe('/canon/market');
  });

  it('сохраняет строку запроса и якорь', () => {
    expect(safeInternalPath('/platform-v7/deals?id=7')).toBe('/platform-v7/deals?id=7');
    expect(safeInternalPath('/lots#top')).toBe('/lots#top');
  });

  it.each([
    ['протокол-относительный', '//evil.com'],
    ['протокол-относительный с путём', '//evil.com/x'],
    ['множественный слэш', '////evil.com'],
    ['обратный слэш', '/\\evil.com'],
    ['смешанный слэш', '/\\/evil.com'],
  ])('отвергает увод наружу: %s', (_label, value) => {
    expect(safeInternalPath(value)).toBe('/');
  });

  it('отвергает абсолютный адрес', () => {
    expect(safeInternalPath('https://evil.com')).toBe('/');
    expect(safeInternalPath('http://evil.com')).toBe('/');
    expect(safeInternalPath('javascript:alert(1)')).toBe('/');
    expect(safeInternalPath('data:text/html,x')).toBe('/');
  });

  it('отвергает пустое и не-строку', () => {
    expect(safeInternalPath(undefined)).toBe('/');
    expect(safeInternalPath(null)).toBe('/');
    expect(safeInternalPath('')).toBe('/');
    expect(safeInternalPath([])).toBe('/');
  });

  it('берёт первое значение, когда параметр повторён', () => {
    // Повтор параметра — обычный способ обойти проверку, которая смотрит
    // на последнее значение, тогда как фреймворк берёт первое.
    expect(safeInternalPath(['/lots', '//evil.com'])).toBe('/lots');
    expect(safeInternalPath(['//evil.com', '/lots'])).toBe('/');
  });

  it('уважает переданный fallback', () => {
    expect(safeInternalPath('//evil.com', '/platform-v7')).toBe('/platform-v7');
    expect(safeInternalPath(undefined, '/canon/market')).toBe('/canon/market');
  });

  it('прежняя проверка действительно пропускала — иначе чинить было бы нечего', () => {
    const weak = (value: string) => (value.startsWith('/') ? value : '/');
    const base = 'https://xn----8sbjf4befbjgs9b.xn--p1ai/api/auth/demo';
    for (const attack of ['//evil.com', '////evil.com', '/\\evil.com']) {
      expect(weak(attack)).toBe(attack);
      expect(new URL(weak(attack), base).host).toBe('evil.com');
      // И то же значение через новую проверку никуда не уводит.
      expect(new URL(safeInternalPath(attack), base).host).toBe('xn----8sbjf4befbjgs9b.xn--p1ai');
    }
  });
});
