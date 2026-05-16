import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const webRoot = existsSync(join(process.cwd(), 'app/platform-v7')) ? process.cwd() : join(process.cwd(), 'apps/web');

const read = (relativePath: string) => readFileSync(join(webRoot, relativePath), 'utf8');

const visibleSurfaceFiles = [
  'app/platform-v7/notifications/page.tsx',
  'app/platform-v7/reports/page.tsx',
  'app/platform-v7/companies/page.tsx',
  'app/platform-v7/companies/[inn]/page.tsx',
  'app/platform-v7/status/page.tsx',
  'app/platform-v7/investor/page.tsx',
  'components/v7r/DealsOverviewRuntime.tsx',
  'components/platform-v7/SupportCaseView.tsx',
  'components/platform-v7/SupportIndexPage.tsx',
  'components/platform-v7/SupportNewCaseClient.tsx',
  'components/platform-v7/SupportNewCaseScopedClient.tsx',
  'components/platform-v7/SupportOperatorQueueClient.tsx',
  'components/platform-v7/RoleExecutionSummary.tsx',
  'components/platform-v7/SystemRouteSummary.tsx',
  'lib/platform-v7/investor-dashboard.ts',
  'lib/platform-v7/investor-metrics.ts',
  'lib/platform-v7/investor-roadmap.ts',
  'lib/platform-v7/investor-story.ts',
  'lib/platform-v7/support-helpers.ts',
];

const forbiddenVisibleSurfaceCopy = [
  'SLA',
  'ETA',
  'Демо',
  'демо',
  'Пилот',
  'пилот',
  'тестовый сценарий',
  'тестовый контур',
  'Пилотный режим',
  'Тестовая среда',
  'controlled pilot',
  'controlled-pilot',
  'marketplace',
  'витрина',
  'выпуск денег',
  'самостоятельный выпуск',
  'Webhook',
  'Сумма release',
  'к выпуску через банк',
  'GMV',
];

describe('platform-v7 execution surface copy guard', () => {
  it('keeps visible execution surfaces out of old demo, SLA and release wording', () => {
    const source = visibleSurfaceFiles.map(read).join('\n');

    for (const copy of forbiddenVisibleSurfaceCopy) {
      expect(source, `visible execution surface copy must not contain "${copy}"`).not.toContain(copy);
    }
  });
});
