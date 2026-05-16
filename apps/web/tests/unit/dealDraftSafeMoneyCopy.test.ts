import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const read = (file: string) => readFileSync(path.join(process.cwd(), file), 'utf8');

describe('platform-v7 deal draft safe money copy', () => {
  it('does not imply that the platform releases money itself', () => {
    const source = read('apps/web/components/v7r/DealDraftDetailRuntime.tsx');

    const forbiddenCopy = [
      'Выпустить деньги',
      'Деньги выпущены',
      'платформа выпускает деньги',
      'платформа переводит деньги',
      'мы выпускаем деньги',
      'platform releases money',
      'release funds',
    ];

    for (const copy of forbiddenCopy) expect(source).not.toContain(copy);
    expect(source).toContain('Подготовить основание банку');
    expect(source).toContain('Отметить подтверждение банка');
    expect(source).toContain('Банковское подтверждение выпуска отмечено в текущем сценарии.');
  });

  it('keeps technical draft/runtime/blocker labels out of the user-facing screen', () => {
    const source = read('apps/web/components/v7r/DealDraftDetailRuntime.tsx');

    const forbiddenTechnicalCopy = [
      'Draft-сделка',
      'persistent runtime',
      'Blocker matrix',
      'Risk flags',
      'blockers cleared',
      'Удалить draft',
    ];

    for (const copy of forbiddenTechnicalCopy) expect(source).not.toContain(copy);
    expect(source).toContain('Черновик сделки');
    expect(source).toContain('Матрица причин остановки');
    expect(source).toContain('причин остановки нет');
  });
});
