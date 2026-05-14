import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const read = (file: string) => readFileSync(path.join(process.cwd(), file), 'utf8');

describe('platform-v7 hidden details pattern', () => {
  it('provides a reusable disclosure component for overloaded screens', () => {
    const component = read('apps/web/components/platform-v7/P7HiddenDetails.tsx');

    expect(component).toContain('export function P7HiddenDetails');
    expect(component).toContain('<details');
    expect(component).toContain('<summary');
    expect(component).toContain('раскрыть');
    expect(component).toContain('detailsBody');
  });

  it('keeps support index compact by hiding long case details', () => {
    const support = read('apps/web/components/platform-v7/SupportIndexPage.tsx');

    expect(support).toContain('P7HiddenDetails');
    expect(support).toContain("title='Детали обращения'");
    expect(support).toContain('последнее сообщение, объект, SLA и влияние на деньги');
    expect(support).toContain('Сначала видны статус, риск и следующий шаг; детали раскрываются отдельно.');
  });

  it('keeps support visible copy out of pilot wording', () => {
    const files = [
      'apps/web/components/platform-v7/SupportIndexPage.tsx',
      'apps/web/lib/platform-v7/support-types.ts',
    ];
    const source = files.map(read).join('\n').toLowerCase();

    expect(source).not.toContain('пилотный');
    expect(source).not.toContain('тестовый режим');
  });
});
