import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const repoRoot = path.resolve(process.cwd(), '../..');
const read = (relativePath: string) => fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');

const operator = read('apps/web/app/platform-v7/operator/page.tsx');
const disputesServer = read('apps/web/lib/disputes-server.ts');
const logistics = read('apps/web/app/platform-v7/logistics/page.tsx');
const compliance = read('apps/web/app/platform-v7/compliance/page.tsx');
const arbitrator = read('apps/web/app/platform-v7/arbitrator/page.tsx');
const executive = read('apps/web/app/platform-v7/executive/page.tsx');
const cockpit = read('apps/web/components/transaction-ux/OperationalDecisionCockpit.tsx');
const cockpitCss = read('apps/web/components/transaction-ux/OperationalDecisionCockpit.module.css');
const governance = JSON.parse(read('design-governance-v8.json'));
const forbiddenPresentation = /style\s*=\s*\{\{|dangerouslySetInnerHTML|#[0-9a-f]{3,8}\b|\brgba?\s*\(|!important/i;

const roleSources = [operator, logistics, compliance, arbitrator, executive];
const operatorAliases = {
  admin: read('apps/web/app/platform-v7/admin/page.tsx'),
  antiBypass: read('apps/web/app/platform-v7/control-tower/anti-bypass/page.tsx'),
  bypassRisk: read('apps/web/app/platform-v7/control-tower/bypass-risk/page.tsx'),
  reconciliation: read('apps/web/app/platform-v7/control-tower/canonical-reconciliation/page.tsx'),
  hotlist: read('apps/web/app/platform-v7/control-tower/hotlist/page.tsx'),
};

describe('Design System v8 operational and oversight roles', () => {
  it('uses one governed decision cockpit without local presentation logic', () => {
    expect(cockpit).toContain("data-operational-decision-cockpit='v8'");
    expect(cockpit).toContain('Главная операционная задача');
    for (const source of roleSources) {
      expect(source).toContain('OperationalDecisionCockpit');
      expect(source).not.toMatch(forbiddenPresentation);
    }
    expect(cockpitCss).not.toMatch(forbiddenPresentation);
  });

  it('builds the operator workspace from authenticated server queues only', () => {
    expect(operator).toContain('getDealsCanonical');
    expect(operator).toContain('getDisputes');
    expect(operator).toContain('getShipments');
    expect(operator).toContain('getOutboxStatus');
    expect(operator).toContain('sourceUnavailable');
    expect(operator).toContain('openDisputes.map');
    expect(operator).toContain('outbox.manualReview.map');
    expect(operator).toContain('blockedShipments.map');
    expect(operator).toContain('OperationalQueueLink');
    expect(operator).toContain('InlineNotice');
    expect(operator).toContain('StatusChip');
    expect(operator).toContain("startsWith('en')");
    expect(operator).toContain("startsWith('zh')");

    for (const forbidden of [
      'DL-9106',
      'OperatorExecutionQueue',
      'OperatorKpiDashboard',
      'OperatorInboxPanel',
      'IntegrationStatusWidget',
      'RecentlyViewedWidget',
      'PushNotificationBanner',
      'LiveApiStatusBar',
      'canonicalDomainDeals',
      'selectRuntimeDeals',
    ]) {
      expect(operator).not.toContain(forbidden);
    }
  });

  it('keeps duplicate operator routes redirect-only and fixture-free', () => {
    for (const source of Object.values(operatorAliases)) {
      expect(source).toContain("import { redirect } from 'next/navigation'");
      expect(source).toContain('redirect(');
      expect(source).not.toContain("'use client'");
      expect(source).not.toMatch(forbiddenPresentation);
    }
    expect(operatorAliases.admin).toContain("redirect('/platform-v7/control-tower')");
    expect(operatorAliases.antiBypass).toContain("redirect('/platform-v7/control-tower')");
    expect(operatorAliases.bypassRisk).toContain("redirect('/platform-v7/control-tower')");
    expect(operatorAliases.hotlist).toContain("redirect('/platform-v7/control-tower')");
    expect(operatorAliases.reconciliation).toContain("redirect('/platform-v7/reports')");

    const combined = Object.values(operatorAliases).join('\n');
    for (const forbidden of ['BYP-1', 'BYP-2', 'BUYER-1', 'SELLER-1', 'LOT-2403', 'getTransportHotlist', 'CanonicalKpiReconciliation']) {
      expect(combined).not.toContain(forbidden);
    }
  });

  it('keeps the dispute reader fail-closed instead of substituting local cases', () => {
    expect(disputesServer).toContain("serverApiUrl('/disputes')");
    expect(disputesServer).toContain("cache: 'no-store'");
    expect(disputesServer).toContain('serverAuthHeaders()');
    expect(disputesServer).toContain('return []');
    expect(disputesServer).toContain('return null');
    expect(disputesServer).toContain('parseDispute');
    expect(disputesServer).not.toContain('STATIC_FALLBACK');
    expect(disputesServer).not.toContain('DISPUTE-001');
    expect(disputesServer).not.toContain('DEAL-001');
    expect(disputesServer).not.toContain('operator@demo.ru');
  });

  it('preserves logistics execution tools', () => {
    expect(logistics).toContain('GpsGeofencePanel');
    expect(logistics).toContain('IoTWeighingPanel');
    expect(logistics).toContain('EtranRzdPanel');
    expect(logistics).toContain('RailwayLogisticsPanel');
    expect(logistics).toContain('WeatherWidget');
  });

  it('preserves compliance, arbitration and executive boundaries', () => {
    expect(compliance).toContain('KycQueuePanel');
    expect(compliance).toContain('FraudDetectorPanel');
    expect(compliance).toContain('OpaAbacPanel');
    expect(compliance).toContain('не выпускает деньги');
    expect(arbitrator).toContain('ArbitratorDisputeRoom');
    expect(arbitrator).toContain('не подтверждает движение денег');
    expect(executive).toContain('только просмотр');
    expect(executive).toContain('read-only обзор');
    expect(executive).not.toContain('primaryAction:');
  });

  it('enforces mobile controls and accessible display modes', () => {
    expect(cockpitCss).toContain('min-height: var(--ds-control-height)');
    expect(cockpitCss).toContain(':focus-visible');
    expect(cockpitCss).toContain('@media (max-width: 640px)');
    expect(cockpitCss).toContain('@media (prefers-reduced-motion: reduce)');
    expect(cockpitCss).toContain('@media (forced-colors: active)');
  });

  it('registers all five roles in v8 governance', () => {
    expect(governance.migratedFiles).toEqual(expect.arrayContaining([
      'apps/web/app/platform-v7/operator/page.tsx',
      'apps/web/app/platform-v7/logistics/page.tsx',
      'apps/web/app/platform-v7/compliance/page.tsx',
      'apps/web/app/platform-v7/arbitrator/page.tsx',
      'apps/web/app/platform-v7/executive/page.tsx',
    ]));
    expect(governance.governedRoots).toContain('apps/web/lib/disputes-server.ts');
  });
});
