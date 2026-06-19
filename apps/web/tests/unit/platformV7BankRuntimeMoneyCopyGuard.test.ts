import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const source = fs.readFileSync(path.join(process.cwd(), 'components/v7r/BankRuntime.tsx'), 'utf8');

describe('platform-v7 bank runtime money copy guard', () => {
  it('keeps BankRuntime framed as basis/check review, not autonomous payout', () => {
    expect(source).toContain('Банковский контур');
    expect(source).toContain('Проверка основания, документов, статусов и следующих действий по сделке.');
    expect(source).toContain('К проверке');
    expect(source).toContain('Основание после закрытия блокеров.');
    expect(source).toContain('Очередь сделок');
  });

  it('does not render autonomous payment-release or fake-live wording', () => {
    // Visible Russian copy must not claim the platform itself moves money.
    expect(source).not.toContain('выпуск денег');
    expect(source).not.toContain('К выпуску');
    expect(source).not.toContain('Выпустить деньги');
    expect(source).not.toContain('Деньги выпущены');
    expect(source).not.toContain('Платёжный контур');
    expect(source).not.toContain('Демо-режим');
    expect(source).not.toMatch(/пилот|демо/i);
    expect(source).not.toContain('платформа гарантирует оплату');
    expect(source).not.toContain('деньги автоматически выпускаются');
  });
});
