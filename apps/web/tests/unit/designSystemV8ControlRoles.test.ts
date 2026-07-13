import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const repoRoot = path.resolve(process.cwd(), '../..');
const read = (relativePath: string) => fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');

const operator = read('apps/web/app/platform-v7/control-tower/page.tsx');
const logistics = read('apps/web/app/platform-v7/logistics/page.tsx');
const compliance = read('apps/web/app/platform-v7/compliance/page.tsx');
const arbitrator = read('apps/web/app/platform-v7/arbitrator/page.tsx');
const executive = read('apps/web/app/platform-v7/executive/page.tsx');
const cockpit = read('apps/web/components/transaction-ux/ControlRoleCockpit.tsx');
const cockpitCss = read('apps/web/components/transaction-ux/ControlRoleCockpit.module.css');
const governance = JSON.parse(read('design-governance-v8.json'));
const forbiddenPresentation = /style\s*=\s*\{\{|dangerouslySetInnerHTML|#[0-9a-f]{3,8}\b|\brgba?\s*\(|!important/i;

describe('Design System v8 control-role reference slice', () => {
  it('uses one governed template with three control-role modes', () => {
    expect(cockpit).toContain("kind: 'dispatch' | 'decision' | 'executive'");
    for (const source of [operator, logistics, compliance, arbitrator, executive]) {
      expect(source).toContain("from '@pc/design-system-v8'");
      expect(source).toContain('ControlRoleCockpit');
      expect(source).toContain('ControlBoundary');
      expect(source).not.toMatch(forbiddenPresentation);
    }
    expect(cockpitCss).not.toMatch(forbiddenPresentation);
  });

  it('migrates logistics to a Dispatch Board without losing transport tools', () => {
    expect(logistics).toContain("kind='dispatch'");
    expect(logistics).toContain('EtranRzdPanel');
    expect(logistics).toContain('IoTWeighingPanel');
    expect(logistics).toContain('GpsGeofencePanel');
    expect(logistics).toContain('RailwayLogisticsPanel');
    expect(logistics).toContain('RoleExecutionHandoff');
  });

  it('keeps operator authority coordinated rather than substituted', () => {
    expect(operator).toContain("kind='decision'");
    expect(operator).toContain('UnifiedDealControlTower');
    expect(operator).toContain('ControlTowerOpsHub');
    expect(operator).toContain('не подменяя полномочия роли');
    expect(operator).toContain('Банк, лаборатория, элеватор, подписант и арбитр сохраняют собственные полномочия');
  });

  it('removes engineering observability from the compliance priority surface', () => {
    expect(compliance).toContain("kind='decision'");
    expect(compliance).toContain('KycPanel');
    expect(compliance).toContain('BankCompliancePilotPanel');
    expect(compliance).toContain('DocumentReadinessMiniMatrix');
    expect(compliance).not.toContain('OpaPolicyPanel');
    expect(compliance).not.toContain('ExternalTaskOutboxPanel');
    expect(compliance).not.toContain('ApiIntegrationPanel');
    expect(compliance).toContain('находятся в Staff Control Plane');
  });

  it('keeps arbitrator human authority and evidence tools', () => {
    expect(arbitrator).toContain('DisputeWorkspace');
    expect(arbitrator).toContain('EvidenceGrid');
    expect(arbitrator).toContain('AIExplainabilityPanel');
    expect(arbitrator).toContain('ИИ может структурировать факты');
    expect(arbitrator).toContain('но не определяет виновность, сумму и движение денег');
  });

  it('keeps executive conclusions tied to confirmed data and exceptions', () => {
    expect(executive).toContain("kind='executive'");
    expect(executive).toContain('FederalKpiCockpit');
    expect(executive).toContain('ScenarioModel');
    expect(executive).toContain('EconomicsPanel');
    expect(executive).toContain('не выдаёт архитектурную готовность за production proof');
  });

  it('enforces mobile, focus, reduced-motion and forced-colors contracts', () => {
    expect(cockpitCss).toContain('min-height: var(--ds-control-height)');
    expect(cockpitCss).toContain(':focus-visible');
    expect(cockpitCss).toContain('@media (max-width: 640px)');
    expect(cockpitCss).toContain('@media (prefers-reduced-motion: reduce)');
    expect(cockpitCss).toContain('@media (forced-colors: active)');
  });

  it('registers all five control routes in v8 governance', () => {
    expect(governance.migratedFiles).toEqual(expect.arrayContaining([
      'apps/web/app/platform-v7/control-tower/page.tsx',
      'apps/web/app/platform-v7/logistics/page.tsx',
      'apps/web/app/platform-v7/compliance/page.tsx',
      'apps/web/app/platform-v7/arbitrator/page.tsx',
      'apps/web/app/platform-v7/executive/page.tsx',
    ]));
  });
});
