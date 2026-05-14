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

  it('keeps disputes page compact by hiding evidence, decision and handoff details', () => {
    const disputes = read('apps/web/app/platform-v7/disputes/page.tsx');

    expect(disputes).toContain('P7HiddenDetails');
    expect(disputes).toContain("title='Проверка доказательного пакета'");
    expect(disputes).toContain("title='Решение и рекомендации'");
    expect(disputes).toContain("title='Правила закрытия спора'");
    expect(disputes).toContain("title='Передача между ролями'");
    expect(disputes).toContain('Здесь сверху видны только причина, сумма влияния, SLA, ответственный и следующий шаг.');
  });

  it('keeps documents page focused by hiding secondary document details only', () => {
    const documents = read('apps/web/app/platform-v7/documents/page.tsx');

    expect(documents).toContain('P7HiddenDetails');
    expect(documents).toContain("title='Именные контуры документов'");
    expect(documents).toContain("title='Связанные сделки'");
    expect(documents).toContain('Матрица документов сделки');
    expect(documents).toContain('DL-9106 · документы, источники и влияние на деньги');
    expect(documents).toContain('требует внешнего подтверждения');
  });

  it('keeps operator queue compact by hiding blocker execution details', () => {
    const operatorQueue = read('apps/web/components/platform-v7/OperatorExecutionQueue.tsx');

    expect(operatorQueue).toContain('P7HiddenDetails');
    expect(operatorQueue).toContain("title='Детали блокера'");
    expect(operatorQueue).toContain('причина, требуемое действие, безопасный шаг и почему нельзя исполнить сейчас');
    expect(operatorQueue).toContain('Каждый элемент показывает ответственного и деньги под риском. Причина блокировки, требуемое действие и безопасный следующий шаг раскрываются отдельно.');
  });

  it('keeps support disputes documents and operator queue visible copy out of pilot wording', () => {
    const files = [
      'apps/web/components/platform-v7/SupportIndexPage.tsx',
      'apps/web/lib/platform-v7/support-types.ts',
      'apps/web/app/platform-v7/disputes/page.tsx',
      'apps/web/app/platform-v7/documents/page.tsx',
      'apps/web/components/platform-v7/OperatorExecutionQueue.tsx',
    ];
    const source = files.map(read).join('\n').toLowerCase();

    expect(source).not.toContain('пилотный');
    expect(source).not.toContain('тестовый режим');
    expect(source).not.toContain('controlled-pilot');
  });
});
