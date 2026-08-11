import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const repoRoot = path.resolve(process.cwd(), '../..');
const read = (relativePath: string) => fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');

const statusPage = read('apps/web/app/platform-v7/status/page.tsx');
const maturitySource = read('apps/web/lib/platform-v7/public-operational-maturity.ts');
const publicStatusAuthority = `${statusPage}\n${maturitySource}`;
const healthPage = read('apps/web/app/platform-v7/health/page.tsx');
const routePolicy = read('apps/web/lib/platform-v7/design-system-v8-route-policy.ts');
const governance = JSON.parse(read('design-governance-v8.json'));
const scopePolicy = read('scripts/check-design-system-v8-pr-scope.mjs');
const forbiddenPresentation = /style\s*=\s*\{\{|dangerouslySetInnerHTML|#[0-9a-f]{3,8}\b|\brgba?\s*\(|!important/i;

describe('platform-v7 system status authority', () => {
  it('renders the accepted public status surface without local presentation overrides', () => {
    expect(statusPage).toContain('data-testid="platform-v7-status-authority"');
    expect(statusPage).toContain('PublicSiteHeader');
    expect(statusPage).toContain('StatusChip');
    expect(statusPage).toContain('getPublicOperationalMaturity');
    expect(statusPage).not.toMatch(forbiddenPresentation);
  });

  it('keeps the public contour bounded and never invents external uptime', () => {
    expect(publicStatusAuthority).toContain('Нет заявления о полной промышленной аттестации');
    expect(publicStatusAuthority).toContain('No claim of full industrial attestation');
    expect(publicStatusAuthority).toContain('不声明已完成完整工业认证');
    expect(publicStatusAuthority).toContain('только после подтверждённого обмена');
    expect(publicStatusAuthority).toContain('only after confirmed data exchange');
    expect(publicStatusAuthority).toContain('仅在确认数据交换后');

    for (const forbidden of [
      'const SERVICES',
      'const MODULES',
      "uptime: 'Проверка'",
      "status: 'degraded'",
      "status: 'test_mode'",
      '99.9%',
      '100% uptime',
      'fully industrially attested',
    ]) {
      expect(publicStatusAuthority).not.toContain(forbidden);
    }
  });

  it('keeps RU, EN and ZH maturity copy on the canonical trust boundary', () => {
    expect(maturitySource).toContain("cardLabel: 'Эксплуатационная зрелость'");
    expect(maturitySource).toContain("cardLabel: 'Operational maturity'");
    expect(maturitySource).toContain("cardLabel: '运行成熟度'");
    expect(maturitySource).toContain("ctaHref: '/platform-v7/trust'");
    expect(statusPage).toContain('<a href={maturity.ctaHref}>{maturity.cta}</a>');
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
    expect(healthPage).toContain("'/platform-v7/money'");
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
