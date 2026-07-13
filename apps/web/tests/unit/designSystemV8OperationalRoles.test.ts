import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const repoRoot = path.resolve(process.cwd(), '../..');
const read = (relativePath: string) => fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');

const operator = read('apps/web/app/platform-v7/operator/page.tsx');
const logistics = read('apps/web/app/platform-v7/logistics/page.tsx');
const compliance = read('apps/web/app/platform-v7/compliance/page.tsx');
const arbitrator = read('apps/web/app/platform-v7/arbitrator/page.tsx');
const executive = read('apps/web/app/platform-v7/executive/page.tsx');
const cockpit = read('apps/web/components/transaction-ux/OperationalDecisionCockpit.tsx');
const cockpitCss = read('apps/web/components/transaction-ux/OperationalDecisionCockpit.module.css');
const governance = JSON.parse(read('design-governance-v8.json'));
const forbiddenPresentation = /style\s*=\s*\{\{|dangerouslySetInnerHTML|#[0-9a-f]{3,8}\b|\brgba?\s*\(|!important/i;

const roleSources = [operator, logistics, compliance, arbitrator, executive];

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

  it('preserves operator and logistics execution tools', () => {
    expect(operator).toContain('OperatorExecutionQueue');
    expect(operator).toContain('OperatorKpiDashboard');
    expect(operator).toContain('OperatorInboxPanel');
    expect(operator).toContain('IntegrationStatusWidget');
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
  });
});
