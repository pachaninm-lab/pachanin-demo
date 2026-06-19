import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const source = fs.readFileSync(path.join(process.cwd(), 'components/v7r/DealDetailRuntime.tsx'), 'utf8');

describe('platform-v7 deal detail money copy guard', () => {
  it('keeps deal detail money copy framed as bank review and external confirmation', () => {
    expect(source).toContain('К банковскому шагу');
    expect(source).toContain('Банк / проверка');
    expect(source).toContain('Банковская проверка заблокирована');
    expect(source).toContain('Дождаться внешнего банковского подтверждения');
    expect(source).toContain('Передать основание банку');
    expect(source).toContain('Почему банковский шаг заблокирован');
    expect(source).toContain('Банковское подтверждение');
  });

  it('does not reintroduce pilot/demo language or autonomous payment claims on deal detail money blocks', () => {
    expect(source).not.toContain('К выпуску');
    expect(source).not.toContain('Можно выпускать');
    expect(source).not.toContain('Почему выпуск заблокирован');
    expect(source).not.toContain('Передать основание банку денег');
    expect(source).not.toContain('Ожидает release');
    expect(source).not.toContain('release-кейсами');
    expect(source).not.toMatch(/пилот|демо/i);
    expect(source).not.toContain('платформа гарантирует оплату');
    expect(source).not.toContain('деньги автоматически выпускаются');
  });
});
