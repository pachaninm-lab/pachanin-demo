import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const cwd = process.cwd();
const repoRoot = [cwd, path.resolve(cwd, '../..')]
  .find((candidate) => fs.existsSync(path.join(candidate, 'design-governance-v8.json')));

if (!repoRoot) throw new Error(`Cannot resolve repository root from ${cwd}`);

const read = (relativePath: string) => fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
const forbiddenPresentation = /style\s*=\s*\{\{|dangerouslySetInnerHTML|#[0-9a-f]{3,8}\b|\brgba?\s*\(|!important|var\(--pc-/i;
const mutationPath = /fetch\s*\(|method\s*:\s*['"](?:POST|PUT|PATCH|DELETE)['"]|confirmAcceptance\s*\(|signDocument\s*\(|releaseFunds\s*\(/i;

const logisticsPath = 'apps/web/app/platform-v7/deal-logistics/page.tsx';
const acceptancePath = 'apps/web/app/platform-v7/deal-acceptance/page.tsx';
const documentsPath = 'apps/web/app/platform-v7/deal-documents-basis/page.tsx';
const logisticsServerPath = 'apps/web/lib/logistics-server.ts';
const logistics = read(logisticsPath);
const acceptance = read(acceptancePath);
const documents = read(documentsPath);
const logisticsServer = read(logisticsServerPath);
const cockpit = read('apps/web/components/transaction-ux/PhysicalExecutionCockpit.tsx');
const cockpitCss = read('apps/web/components/transaction-ux/PhysicalExecutionCockpit.module.css');
const copy = read('apps/web/components/transaction-ux/physicalExecutionCopy.ts');
const governance = JSON.parse(read('design-governance-v8.json')) as { migratedFiles: string[] };
const workflow = read('.github/workflows/design-system-v8.yml');

const routeSources = [logistics, acceptance, documents];

describe('Design System v8 physical Deal execution chain', () => {
  it('uses one governed cockpit without route-local presentation authority', () => {
    expect(cockpit).toContain("data-physical-execution-cockpit='v8'");
    for (const source of routeSources) {
      expect(source).toContain('PhysicalExecutionCockpit');
      expect(source).not.toMatch(forbiddenPresentation);
      expect(source).not.toMatch(mutationPath);
    }
    expect(cockpitCss).not.toMatch(forbiddenPresentation);
  });

  it('uses tenant-scoped server logistics and rejects process-memory fixtures', () => {
    expect(logistics).toContain('getShipments');
    expect(logistics).toContain('getShipmentWorkspace');
    expect(logistics).toContain('workspace.checkpoints');
    expect(logistics).toContain('workspace.gpsTrack');
    expect(logistics).not.toContain('DEAL_LOGISTICS_STATE');
    expect(logisticsServer).toContain("serverApiUrl('/logistics/shipments')");
    expect(logisticsServer).toContain('serverAuthHeaders()');
    expect(logisticsServer).toContain("cache: 'no-store'");
    expect(logisticsServer).toContain('shipment.tenantId');
    expect(logisticsServer).toContain('item.tenantId !== shipment.tenantId');
    expect(logisticsServer).not.toContain('STATIC_FALLBACK');
    expect(logisticsServer).not.toContain('SHIP-001');
    expect(logisticsServer).not.toContain('DEAL-001');
  });

  it('preserves the remaining Deal-linked acceptance sources until their authority migration', () => {
    expect(acceptance).toContain('DEAL_ACCEPTANCE_STATE');
    expect(acceptance).toContain('state.routeId');
    expect(acceptance).toContain('state.evidence');
    expect(documents).toContain('DEAL_ACCEPTANCE_STATE');
    expect(documents).toContain('state.dealId');
  });

  it('fails closed before carrier admission, signed acceptance and complete documents', () => {
    expect(logistics).toContain('state.pinVerified');
    expect(logistics).toContain('state.blockers.length === 0');
    expect(logistics).toContain("acceptance: carrierReady ? 'available' : 'blocked'");
    expect(logistics).toContain('if (!workspace)');
    expect(logistics).toContain('renderUnavailable(locale)');
    expect(acceptance).toContain('const acceptanceReady = isAcceptanceSigned() && !qualityBlocked && !evidenceBlocked');
    expect(acceptance).toContain("documents: acceptanceReady ? 'available' : 'blocked'");
    expect(acceptance).toContain('const blocked = (documentsRoute && !acceptanceReady) || bankRoute');
    expect(documents).toContain("const documentsReady = packageItems.every((item) => item.status === 'ready')");
    expect(documents).toContain("bank: documentsReady ? 'available' : 'blocked'");
    expect(documents).toContain('blocked: !documentsReady');
  });

  it('keeps physical facts, documents and bank authority separated', () => {
    expect(copy).toContain('интерфейс не подписывает документы и не двигает деньги');
    expect(copy).toContain('the interface cannot sign documents or move money');
    expect(copy).toContain('界面不能签署文件或移动资金');
    expect(logistics).toContain('Интерфейс не создаёт и не изменяет рейс');
    expect(logistics).toContain('The interface cannot create or mutate the shipment');
    expect(logistics).toContain('界面不能创建或修改运输任务');
    expect(documents).toContain("href='/platform-v7/bank/release-safety'");
    expect(documents).not.toContain("href='/platform-v7/bank/payment-basis'");
  });

  it('provides RU EN ZH copy and accessible mobile behavior', () => {
    expect(copy).toContain('Рейс создаётся только из проверяемого основания');
    expect(copy).toContain('A trip starts only from a verifiable basis');
    expect(copy).toContain('运输任务只能从可验证依据创建');
    expect(copy).toContain('Приёмка превращает физический факт в доказательства');
    expect(copy).toContain('Acceptance turns physical facts into evidence');
    expect(copy).toContain('验收把实物事实转化为证据');
    expect(logistics).toContain('Серверное состояние рейса недоступно');
    expect(logistics).toContain('Server shipment state is unavailable');
    expect(logistics).toContain('服务器运输状态不可用');
    expect(cockpitCss).toContain('min-height: var(--ds-control-height)');
    expect(cockpitCss).toContain(':focus-visible');
    expect(cockpitCss).toContain('@media (max-width: 640px)');
    expect(cockpitCss).toContain('@media (prefers-reduced-motion: reduce)');
    expect(cockpitCss).toContain('@media (forced-colors: active)');
  });

  it('registers and runs all three routes in exact v8 governance', () => {
    expect(governance.migratedFiles).toEqual(expect.arrayContaining([
      logisticsPath,
      acceptancePath,
      documentsPath,
    ]));
    expect(workflow).toContain(logisticsPath);
    expect(workflow).toContain(acceptancePath);
    expect(workflow).toContain(documentsPath);
    expect(workflow).toContain('tests/unit/designSystemV8PhysicalExecutionChain.test.ts');
  });
});
