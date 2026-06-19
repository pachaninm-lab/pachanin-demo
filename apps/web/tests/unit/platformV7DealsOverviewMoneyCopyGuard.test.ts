import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

function read(file: string) {
  return fs.readFileSync(path.join(process.cwd(), file), 'utf8');
}

describe('platform-v7 deals overview money copy guard', () => {
  it('keeps deals overview framed around bank basis and external confirmation', () => {
    const source = read('components/v7r/DealsOverviewRuntime.tsx');

    expect(source).toContain('Ожидают банк');
    expect(source).toContain('внешнего банковского подтверждения');
    expect(source).toContain('Передать основание');
    expect(source).toContain('Дождаться банковского подтверждения');
    expect(source).toContain('bankStepRequested');
  });

  it('keeps live deal runtime copy away from autonomous money movement claims', () => {
    const source = read('stores/useLiveDealRuntimeStore.ts');

    expect(source).toContain('довести контур до банковского шага');
    expect(source).toContain('Получено банковское подтверждение');
    expect(source).toContain('Передать основание на банковскую проверку');
    expect(source).toContain('Получено внешнее банковское подтверждение');
  });

  it('does not reintroduce release/payment claims or pilot/demo language in the overview path', () => {
    const combined = [
      read('components/v7r/DealsOverviewRuntime.tsx'),
      read('stores/useLiveDealRuntimeStore.ts'),
    ].join('\n');

    expect(combined).not.toContain('Ожидают выпуск');
    expect(combined).not.toContain('Запросить выпуск');
    expect(combined).not.toContain('деньги уже у выпуска');
    expect(combined).not.toContain('Деньги выпущены');
    expect(combined).not.toContain('Запрошен выпуск денег');
    expect(combined).not.toContain('Запросить выпуск денег');
    expect(combined).not.toContain('выпуск денег');
    expect(combined).not.toMatch(/пилот|демо/i);
    expect(combined).not.toContain('платформа гарантирует оплату');
    expect(combined).not.toContain('деньги автоматически выпускаются');
  });
});
