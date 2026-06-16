import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const source = fs.readFileSync(path.join(process.cwd(), 'apps/web/components/v7r/DealDraftDetailRuntime.tsx'), 'utf8');
const renderSource = source.replace(/function normalizeDraftMoneyText[\s\S]*?\n}\n\nexport function/, 'export function');

describe('platform-v7 draft display money copy guard', () => {
  it('normalizes legacy draft money events before rendering them', () => {
    expect(source).toContain('function normalizeDraftMoneyText');
    expect(source).toContain('normalizeDraftMoneyText(item.nextStep)');
    expect(source).toContain('normalizeDraftMoneyText(event.action)');
  });

  it('keeps rendered draft deal copy framed as bank basis and external confirmation', () => {
    expect(renderSource).toContain('Банковский шаг');
    expect(renderSource).toContain('Основание для банковской проверки подготовлено для банка.');
    expect(renderSource).toContain('Внешнее банковское подтверждение отмечено');
    expect(renderSource).toContain('Подготовить основание банку');
  });

  it('does not render old autonomous money-release wording outside the normalizer', () => {
    expect(renderSource).not.toContain('Выпуск');
    expect(renderSource).not.toContain('Деньги выпущены');
    expect(renderSource).not.toContain('Банк может выпускать деньги');
    expect(renderSource).not.toContain('Запросить выпуск денег');
    expect(renderSource).not.toContain('Запрошен выпуск денег');
    expect(renderSource).not.toMatch(/пилот|демо/i);
    expect(renderSource).not.toContain('платформа гарантирует оплату');
    expect(renderSource).not.toContain('деньги автоматически выпускаются');
  });
});
