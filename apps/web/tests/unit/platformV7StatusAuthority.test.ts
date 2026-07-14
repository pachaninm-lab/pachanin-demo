import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const repoRoot = path.resolve(process.cwd(), '../..');
const read = (relativePath: string) => fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');

const statusPage = read('apps/web/app/platform-v7/status/page.tsx');
const routePolicy = read('apps/web/lib/platform-v7/design-system-v8-route-policy.ts');
const governance = JSON.parse(read('design-governance-v8.json'));
const forbiddenPresentation = /style\s*=\s*\{\{|dangerouslySetInnerHTML|#[0-9a-f]{3,8}\b|\brgba?\s*\(|!important/i;

describe('platform-v7 system status authority', () => {
  it('renders through the governed v8 cockpit without local presentation overrides', () => {
    expect(statusPage).toContain('OperationalDecisionCockpit');
    expect(statusPage).toContain('OperationalQueueLink');
    expect(statusPage).toContain('InlineNotice');
    expect(statusPage).toContain('StatusChip');
    expect(statusPage).not.toMatch(forbiddenPresentation);
  });

  it('uses a server-confirmed internal signal and never invents external uptime', () => {
    expect(statusPage).toContain('getOutboxStatus');
    expect(statusPage).toContain('outbox.isApiAvailable');
    expect(statusPage).toContain('outbox.totalPending');
    expect(statusPage).toContain('outbox.manualReview.length');
    expect(statusPage).toContain('externalRequired');

    for (const forbidden of [
      'const SERVICES',
      'const MODULES',
      "uptime: 'Проверка'",
      "status: 'degraded'",
      "status: 'test_mode'",
      'Controlled-pilot / pre-integration',
      'Server-side RBAC остаётся отдельным этапом',
      "value='0'",
      "value='2'",
    ]) {
      expect(statusPage).not.toContain(forbidden);
    }
  });

  it('keeps external integration boundaries explicit in RU, EN and ZH', () => {
    expect(statusPage).toContain('production-доступ');
    expect(statusPage).toContain('production access');
    expect(statusPage).toContain('生产访问');
    expect(statusPage).toContain('не измеряет uptime внешних систем');
    expect(statusPage).toContain('does not measure external-system uptime');
    expect(statusPage).toContain('不测量外部系统在线率');
  });

  it('runs on the minimal Design System v8 runtime and is registered in governance', () => {
    expect(routePolicy).toContain("'/platform-v7/status'");
    expect(governance.migratedFiles).toContain('apps/web/app/platform-v7/status/page.tsx');
  });
});
