import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const repoRoot = path.resolve(process.cwd(), '../..');
const read = (relativePath: string) => fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');

const statusPage = read('apps/web/app/platform-v7/status/page.tsx');
const healthPage = read('apps/web/app/platform-v7/health/page.tsx');
const routePolicy = read('apps/web/lib/platform-v7/design-system-v8-route-policy.ts');
const governance = JSON.parse(read('design-governance-v8.json'));
const scopePolicy = read('scripts/check-design-system-v8-pr-scope.mjs');
const forbiddenPresentation = /style\s*=\s*\{\{|dangerouslySetInnerHTML|#[0-9a-f]{3,8}\b|\brgba?\s*\(|!important/i;

describe('platform-v7 system status authority', () => {
  it('renders status through the governed v8 cockpit without local presentation overrides', () => {
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

  it('migrates execution health without browser fixtures or fake telemetry', () => {
    expect(healthPage).toContain('OperationalDecisionCockpit');
    expect(healthPage).toContain('OperationalQueueLink');
    expect(healthPage).toContain('getPlatformV7HealthCockpitState');
    expect(healthPage).toContain('state.sourceMeta.source');
    expect(healthPage).toContain('controlled-pilot-runtime');
    expect(healthPage).toContain('This is not production telemetry');
    expect(healthPage).toContain('这不是生产遥测');
    expect(healthPage).toContain('Это не production telemetry');
    expect(healthPage).not.toContain("'use client'");
    expect(healthPage).not.toContain('PremiumStatCard');
    expect(healthPage).not.toContain('CockpitHero');
    expect(healthPage).not.toMatch(forbiddenPresentation);
  });

  it('keeps health read-only and routes actions to canonical workspaces', () => {
    expect(healthPage).toContain("href='/platform-v7/operator-cockpit/queues'");
    expect(healthPage).toContain("href='/platform-v7/deals'");
    expect(healthPage).toContain("href='/platform-v7/connectors'");
    expect(healthPage).toContain("href='/platform-v7/money'");
    expect(healthPage).not.toContain('fetch(');
    expect(healthPage).not.toContain('axios');
    expect(healthPage).not.toContain('onClick');
    expect(healthPage).not.toContain('useState');
  });

  it('runs both routes on the minimal Design System v8 runtime and registers governance', () => {
    expect(routePolicy).toContain("'/platform-v7/status'");
    expect(routePolicy).toContain("'/platform-v7/health'");
    expect(governance.migratedFiles).toContain('apps/web/app/platform-v7/status/page.tsx');
    expect(governance.migratedFiles).toContain('apps/web/app/platform-v7/health/page.tsx');
    expect(scopePolicy).toContain("'apps/web/app/platform-v7/health/page.tsx'");
  });
});
