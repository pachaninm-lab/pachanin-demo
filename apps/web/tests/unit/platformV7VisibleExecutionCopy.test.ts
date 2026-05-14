import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const read = (file: string) => readFileSync(path.join(process.cwd(), file), 'utf8');

const visibleExecutionFiles = [
  'apps/web/app/platform-v7/deals/page.tsx',
  'apps/web/app/platform-v7/deals/[id]/clean/page.tsx',
  'apps/web/lib/platform-v7/deal360-source-of-truth.ts',
  'apps/web/lib/platform-v7/deal-execution-source-of-truth.ts',
];

describe('platform-v7 visible execution copy', () => {
  it('keeps visible deal screens out of demo and simulation language', () => {
    const source = visibleExecutionFiles.map(read).join('\n').toLowerCase();
    const forbidden = ['пилот', 'пилотный', 'тестовый режим', 'trip-sim', 'deal 360', 'симуляция'];

    for (const word of forbidden) expect(source).not.toContain(word);
  });

  it('keeps visible deal screens focused on execution, money, documents and bank confirmation', () => {
    const source = visibleExecutionFiles.map(read).join('\n').toLowerCase();

    expect(source).toContain('контур исполнения');
    expect(source).toContain('резерв');
    expect(source).toContain('документы');
    expect(source).toContain('подтверждения');
    expect(source).toContain('банк');
  });
});
