import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const source = fs.readFileSync(path.join(process.cwd(), 'components/v7r/BankRuntime.tsx'), 'utf8');

describe('platform-v7 bank runtime copy guard', () => {
  it('keeps BankRuntime framed around bank basis review', () => {
    expect(source).toContain('Банковский контур');
    expect(source).toContain('Проверка основания, документов, статусов и следующих действий по сделке.');
    expect(source).toContain('В резерве');
    expect(source).toContain('Под удержанием');
    expect(source).toContain('К проверке');
    expect(source).toContain('Очередь сделок');
    expect(source).toContain('Следующий шаг');
  });

  it('does not render autonomous payment-release wording', () => {
    expect(source).not.toContain('выпуск денег');
    expect(source).not.toContain('К выпуску');
    expect(source).not.toContain('Выпустить деньги');
    expect(source).not.toContain('ФГИС блокирует выпуск');
    expect(source).not.toContain('Платёжный контур');
    expect(source).not.toContain('Демо-режим');
    expect(source).not.toMatch(/пилот|демо/i);
    expect(source).not.toContain('платформа гарантирует оплату');
    expect(source).not.toContain('деньги автоматически выпускаются');
  });
});
