import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

function read(file: string) {
  return fs.readFileSync(path.join(process.cwd(), file), 'utf8');
}

function stripNormalizer(source: string) {
  return source.replace(/function normalizeDraftMoneyText[\s\S]*?\n}\n\nexport function/, 'export function');
}

const draftV1 = read('apps/web/components/v7r/DealDraftDetailRuntime.tsx');
const draftV2 = read('apps/web/components/v7r/DealDraftDetailRuntimeV2.tsx');
const renderV1 = stripNormalizer(draftV1);
const renderV2 = stripNormalizer(draftV2);
const renderedSources = [renderV1, renderV2].join('\n');

describe('platform-v7 draft display money copy guard', () => {
  it('normalizes legacy draft money events before rendering them', () => {
    for (const source of [draftV1, draftV2]) {
      expect(source).toContain('function normalizeDraftMoneyText');
      expect(source).toContain('normalizeDraftMoneyText(item.nextStep)');
      expect(source).toContain('normalizeDraftMoneyText(event.action)');
    }
  });

  it('keeps rendered draft deal copy framed as bank basis and external confirmation', () => {
    expect(renderV1).toContain('Банковский шаг');
    expect(renderV1).toContain('Основание для банковской проверки подготовлено для банка.');
    expect(renderV1).toContain('Внешнее банковское подтверждение отмечено');
    expect(renderV1).toContain('Подготовить основание банку');

    expect(renderV2).toContain('Банковский шаг');
    expect(renderV2).toContain('Банк может проверить основание');
    expect(renderV2).toContain('Нужно передать основание на банковскую проверку');
    expect(renderV2).toContain('Внешнее банковское подтверждение отмечено.');
  });

  it('does not render old autonomous money-release wording outside the normalizer', () => {
    expect(renderedSources).not.toContain('Выпуск');
    expect(renderedSources).not.toContain('Готово к выпуску');
    expect(renderedSources).not.toContain('Деньги выпущены');
    expect(renderedSources).not.toContain('Банк может выпускать деньги');
    expect(renderedSources).not.toContain('Запросить выпуск денег');
    expect(renderedSources).not.toContain('Запрошен выпуск денег');
    expect(renderedSources).not.toContain('Передать основание банку денег');
    expect(renderedSources).not.toContain('банковскую проверку выплаты');
    expect(renderedSources).not.toMatch(/пилот|демо/i);
    expect(renderedSources).not.toContain('платформа гарантирует оплату');
    expect(renderedSources).not.toContain('деньги автоматически выпускаются');
  });
});
