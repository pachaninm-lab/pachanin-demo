import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const webRoot = existsSync(join(process.cwd(), 'app/platform-v7')) ? process.cwd() : join(process.cwd(), 'apps/web');

const read = (relativePath: string) => readFileSync(join(webRoot, relativePath), 'utf8');

const scenarioFiles = [
  'app/platform-v7/demo/page.tsx',
  'app/platform-v7/demo/run/page.tsx',
  'app/platform-v7/demo/execution-flow/page.tsx',
  'app/platform-v7/demo/deals/[id]/page.tsx',
  'components/v7r/DemoDealAutoplay.tsx',
  'components/platform-v7/GrainExecutionPage.tsx',
  'components/platform-v7/GrainExecutionPageFixed.tsx',
  'lib/platform-v7/demo-dashboard.ts',
  'lib/platform-v7/demo-tour.ts',
];

const forbiddenScenarioCopy = [
  'Демо-сценарий',
  'Запустить демо',
  'Демо автопрогон',
  'Пилотный сценарий',
  'controlled pilot',
  'controlled-pilot',
  'тестовый сценарий',
  'тестовом статусе',
  'тестовый контур',
  'Release денег',
  'Webhook',
  'Сумма release',
  'MoneyTree',
  'ETA',
  'к выпуску через банк',
  'самостоятельный выпуск денег',
  'выпуск денег ещё невозможен',
  'банк подтверждает выпуск',
  'Открыть проверку выпуска',
  'без закрытия рейса выпуск денег блокируется',
  'удержание и выпуск',
];

describe('platform-v7 legacy scenario route copy', () => {
  it('keeps compatible scenario routes positioned as execution routes, not demo screens', () => {
    const source = scenarioFiles.map(read).join('\n');

    for (const copy of forbiddenScenarioCopy) {
      expect(source, `scenario route copy must not contain "${copy}"`).not.toContain(copy);
    }
  });
});
