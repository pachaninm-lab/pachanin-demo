import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();

function read(relativePath: string) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

const auctionDealBasis = read('apps/web/app/platform-v7/auction/deal-basis/page.tsx');
const auctionWorkspace = read('apps/web/components/transaction-ux/AuctionPostgresAuthorityWorkspace.tsx');
const logisticsPage = read('apps/web/app/platform-v7/deal-logistics/page.tsx');
const acceptancePage = read('apps/web/app/platform-v7/deal-acceptance/page.tsx');
const documentsPage = read('apps/web/app/platform-v7/deal-documents-basis/page.tsx');
const auctionServer = read('apps/web/lib/auction-server.ts');
const logisticsServer = read('apps/web/lib/logistics-server.ts');
const dealExecutionServer = read('apps/web/lib/deal-execution-server.ts');
const logisticsContract = read('apps/web/lib/platform-v7/dealLogisticsEngine.ts');
const acceptanceContract = read('apps/web/lib/platform-v7/dealAcceptanceEngine.ts');
const documentContract = read('apps/web/lib/platform-v7/dealDocumentBasisEngine.ts');

const forbiddenFixtureTokens = [
  'DL-2607-014',
  'FGIS-LOT-2607-014',
  'SDIZ-2607-5512',
  'A234BC68',
  'DOC-DEAL',
  'DOC-SDIZ',
  'DOC-WEIGHT',
  'DOC-QUALITY',
  'DOC-ACCEPTANCE',
  'DOC-UPD',
];

describe('platform-v7 authoritative Deal execution chain', () => {
  it('moves from auction to a canonical server-issued Deal only through PostgreSQL authority', () => {
    expect(auctionDealBasis).toContain('AuctionPostgresAuthorityWorkspace');
    expect(auctionDealBasis).toContain("stage='deal-basis'");
    expect(auctionWorkspace).toContain("dealCreated=true");
    expect(auctionWorkspace).toContain('dealId');
    expect(auctionWorkspace).toContain('PostgreSQL authority proof');
    expect(auctionServer).toContain("source: 'POSTGRESQL'");
    expect(auctionServer).toContain("scope: 'AUCTION'");
    expect(auctionServer).toContain('serverAuthHeaders()');
    expect(auctionServer).toContain("cache: 'no-store'");
  });

  it('keeps logistics, acceptance and documents bound to authenticated server reads', () => {
    expect(logisticsPage).toContain('getShipmentWorkspace');
    expect(logisticsPage).toContain('dealId=');
    expect(logisticsPage).toContain('shipmentId=');
    expect(logisticsServer).toContain('serverAuthHeaders()');
    expect(logisticsServer).toContain("cache: 'no-store'");

    expect(acceptancePage).toContain('getCanonicalDealExecutionWorkspace');
    expect(acceptancePage).toContain('buildAcceptanceProjection');
    expect(documentsPage).toContain('getCanonicalDealExecutionWorkspace');
    expect(documentsPage).toContain('buildDocumentBasisProjection');
    expect(dealExecutionServer).toContain("serverApiUrl(`/deals/${encodeURIComponent(dealId)}/workspace`)");
    expect(dealExecutionServer).toContain('serverAuthHeaders()');
    expect(dealExecutionServer).toContain("cache: 'no-store'");
  });

  it('requires persisted acceptance and the canonical five-document release package', () => {
    for (const blocker of [
      'ARRIVAL_NOT_PERSISTED',
      'WEIGHT_FACT_INVALID_OR_MISSING',
      'LAB_RESULT_NOT_FINAL',
      'ACCEPTANCE_ACT_NOT_SIGNED',
    ]) {
      expect(dealExecutionServer).toContain(blocker);
    }

    for (const type of ['CONTRACT', 'TTN', 'WEIGHING_ACT', 'LAB_PROTOCOL', 'ACCEPTANCE_ACT']) {
      expect(dealExecutionServer).toContain(`'${type}'`);
    }
    expect(dealExecutionServer).toContain("document.status !== 'SIGNED'");
    expect(dealExecutionServer).toContain('!document.hash');
    expect(dealExecutionServer).toContain('!document.s3Key');
    expect(dealExecutionServer).toContain('!document.isImmutable');
    expect(dealExecutionServer).toContain("document.bankAcceptance !== 'ACCEPTED'");
    expect(documentsPage).toContain("bank: projection.ready ? 'available' : 'blocked'");
  });

  it('keeps all three former engines as type-only compatibility contracts', () => {
    for (const contract of [logisticsContract, acceptanceContract, documentContract]) {
      expect(contract).toContain('Type-only compatibility contract');
      expect(contract).not.toMatch(/export\s+(?:const|let|var|function|class)\b/);
      expect(contract).not.toContain('/platform-v7/');
      for (const token of forbiddenFixtureTokens) expect(contract).not.toContain(token);
    }
  });

  it('contains no runtime import of the former fixture engines', () => {
    const runtimeRoutes = [auctionDealBasis, logisticsPage, acceptancePage, documentsPage];
    for (const route of runtimeRoutes) {
      expect(route).not.toContain("from '@/lib/platform-v7/dealLogisticsEngine'");
      expect(route).not.toContain("from '@/lib/platform-v7/dealAcceptanceEngine'");
      expect(route).not.toContain("from '@/lib/platform-v7/dealDocumentBasisEngine'");
      expect(route).not.toContain('DEAL_LOGISTICS_STATE');
      expect(route).not.toContain('DEAL_ACCEPTANCE_STATE');
      expect(route).not.toContain('DEAL_DOCUMENT_BASIS_STATE');
    }
  });

  it('keeps the physical execution UI read-only and fail-closed', () => {
    for (const route of [logisticsPage, acceptancePage, documentsPage]) {
      expect(route).toContain('renderUnavailable');
      expect(route).not.toMatch(/method\s*:\s*['"](?:POST|PUT|PATCH|DELETE)['"]/);
    }
    expect(auctionWorkspace).toContain('The UI is read-only');
    expect(documentsPage).toContain('не выпускает деньги');
  });
});
