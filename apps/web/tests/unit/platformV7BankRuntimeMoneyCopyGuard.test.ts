import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const source = fs.readFileSync(path.join(process.cwd(), 'components/v7r/BankRuntime.tsx'), 'utf8');
const renderSource = source.replace(/function normalizeBankMoneyCopy[\s\S]*?\n}\n\nfunction badge/, 'function badge');

describe('platform-v7 bank runtime money copy guard', () => {
  it('keeps BankRuntime framed as basis review and external bank confirmation', () => {
    expect(renderSource).toContain('Контур банковской проверки');
    expect(renderSource).toContain('внешнее банковское подтверждение выполняет банк');
    expect(renderSource).toContain('К банковскому шагу');
    expect(renderSource).toContain('Очередь банковской проверки основания');
    expect(renderSource).toContain('банковское подтверждение нельзя считать безопасным');
    expect(renderSource).toContain('зелёный сценарий банковской проверки');
  });

  it('normalizes imported bank/transport event copy before rendering', () => {
    expect(source).toContain('function normalizeBankMoneyCopy');
    expect(source).toContain('normalizeBankMoneyCopy(row.nextStep)');
    expect(source).toContain('normalizeBankMoneyCopy(moneyImpactLabel');
    expect(source).toContain('normalizeBankMoneyCopy(transportReleaseStateLabel');
    expect(source).toContain('normalizeBankMoneyCopy(event.note)');
  });

  it('does not render autonomous payment-release wording outside the normalizer', () => {
    expect(renderSource).not.toContain('Выпуск');
    expect(renderSource).not.toContain('ФГИС блокирует выпуск');
    expect(renderSource).not.toContain('Демо-режим');
    expect(renderSource).not.toContain('К выпуску');
    expect(renderSource).not.toContain('Очередь на банковскую проверку выплаты');
    expect(renderSource).not.toContain('финальный выпуск');
    expect(renderSource).not.toContain('зелёный сценарий выпуска');
    expect(renderSource).not.toContain('Платёжный контур');
    expect(renderSource).not.toContain('release');
    expect(renderSource).not.toMatch(/пилот|демо/i);
    expect(renderSource).not.toContain('платформа гарантирует оплату');
    expect(renderSource).not.toContain('деньги автоматически выпускаются');
  });
});
