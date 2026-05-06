import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('platform-v7 UI text normalizer', () => {
  const layout = readFileSync(join(process.cwd(), 'app/platform-v7/layout.tsx'), 'utf8');
  const normalizer = readFileSync(join(process.cwd(), 'components/v7r/ShellCopyNormalizer.tsx'), 'utf8');

  it('is mounted for every platform-v7 route', () => {
    expect(layout).toContain('ShellCopyNormalizer');
    expect(layout).toContain('<ShellCopyNormalizer />');
  });

  it('normalizes visible text and accessible labels', () => {
    expect(normalizer).toContain('normalizeNodeText');
    expect(normalizer).toContain('normalizeAttributes');
    expect(normalizer).toContain('aria-label');
    expect(normalizer).toContain('title');
  });

  it('keeps replacement language tied to execution, money, documents and responsibility', () => {
    expect(normalizer).toContain('Центр управления');
    expect(normalizer).toContain('Проверочный сценарий');
    expect(normalizer).toContain('Помощник сделки');
    expect(normalizer).toContain('выпуск денег');
    expect(normalizer).toContain('удержание денег');
    expect(normalizer).toContain('ответственный');
    expect(normalizer).toContain('причина остановки');
  });
});
