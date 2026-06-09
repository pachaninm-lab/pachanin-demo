import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const read = (file: string) => readFileSync(path.join(process.cwd(), file), 'utf8');

const visibleExecutionFiles = [
  'app/platform-v7/deals/page.tsx',
  'app/platform-v7/deals/[id]/clean/page.tsx',
  'app/platform-v7/bank/page.tsx',
  'lib/platform-v7/deal360-source-of-truth.ts',
  'lib/platform-v7/deal-execution-source-of-truth.ts',
];

const visibleSummaryFiles = [
  'components/platform-v7/RoleExecutionSummary.tsx',
  'components/platform-v7/SystemRouteSummary.tsx',
  'components/platform-v7/AuditSurfaceSummary.tsx',
  'components/platform-v7/ActionFeedbackPreviewStrip.tsx',
  'lib/platform-v7/action-feedback-preview.ts',
  'components/platform-v7/JournalPreview.tsx',
  'lib/platform-v7/journal-preview.ts',
  'app/platform-v7/driver/field/page.tsx',
  'app/platform-v7/driver/page.tsx',
];

describe('platform-v7 visible execution copy', () => {
  it('keeps visible deal screens out of demo and simulation language', () => {
    const source = visibleExecutionFiles.map(read).join('\n').toLowerCase();
    const forbidden = ['пилот', 'пилотный', 'тестовый режим', 'trip-sim', 'deal 360', 'симуляция'];

    for (const word of forbidden) expect(source).not.toContain(word);
  });

  it('keeps visible summary and action surfaces out of service-mode language', () => {
    const source = visibleSummaryFiles.map(read).join('\n').toLowerCase();
    const forbidden = [
      'пилотный контур',
      'пилотного контура',
      'пилотном контуре',
      'пилотная готовность',
      'пилотный доступ',
      'пилотный сценарий',
      'тестовый сценарий',
      'тестовым сценарием',
      'controlled-pilot',
      'simulation-grade',
      'trip-sim',
      'demo должно',
      'ui журнал',
      'domain audit',
      'guard-правилом',
    ];

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

  it('keeps overloaded bank details hidden behind disclosure sections', () => {
    const bank = read('app/platform-v7/bank/page.tsx');

    expect(bank).toContain('function DisclosureSection');
    expect(bank).toContain('<details style={detailsCard}>');
    expect(bank).toContain('Документы и основания');
    expect(bank).toContain('Внешние контуры');
    expect(bank).toContain('Рекомендации и доказательства');
    expect(bank).toContain('Передача между ролями и журнал');
    expect(bank).toContain('Длинные детали скрыты ниже');
  });

  it('routes the legacy driver page directly to the field shell', () => {
    const driver = read('app/platform-v7/driver/page.tsx');

    expect(driver).toContain("redirect('/platform-v7/driver/field')");
    expect(driver).not.toContain('TRIP-SIM');
    expect(driver).not.toContain('darkCard');
  });
});
