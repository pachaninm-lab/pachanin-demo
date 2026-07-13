import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const cwd = process.cwd();
const root = [cwd, path.resolve(cwd, '../..')]
  .find((candidate) => fs.existsSync(path.join(candidate, 'design-governance-v8.json')));

if (!root) throw new Error(`Cannot resolve repository root from ${cwd}`);

function read(relativePath: string) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

describe('platform-v7 deal execution chain', () => {
  it('keeps auction Deal basis connected only through a server-issued dealId', () => {
    const dealBasisPage = read('apps/web/app/platform-v7/auction/deal-basis/page.tsx');
    const workspace = read('apps/web/components/transaction-ux/AuctionServerAuthorityWorkspace.tsx');

    expect(dealBasisPage).toContain("stage='deal-basis'");
    expect(dealBasisPage).toContain('lotId');
    expect(workspace).toContain('executionBridge.dealCreated');
    expect(workspace).toContain('executionBridge.dealId');
    expect(workspace).toContain('/execution');
    expect(workspace).toContain('dealCreated=true');
  });

  it('fails closed instead of constructing winner, price, lot and Deal basis in the browser', () => {
    const serverBoundary = read('apps/web/lib/auction-server.ts');
    const workspace = read('apps/web/components/transaction-ux/AuctionServerAuthorityWorkspace.tsx');

    expect(serverBoundary).toContain("serverApiUrl('/lots/my')");
    expect(serverBoundary).toContain('/auctions/lots/${safeLotId}/workspace');
    expect(serverBoundary).toContain('if (dealCreated && !dealId) return null');
    expect(serverBoundary).toContain('auction workspace invalid envelope');
    expect(workspace).toContain('The UI is read-only');
    expect(workspace).toContain('界面仅供读取');

    for (const forbidden of ['AUCTION_DEAL_BRIDGE', 'AUCTION_DEAL_BASIS', 'FGIS_AUCTION_STATE', 'BID-001', 'DL-2607-014']) {
      expect(workspace).not.toContain(forbidden);
    }
  });

  it('keeps award, admission and Deal creation as separate server milestones', () => {
    const workspace = read('apps/web/components/transaction-ux/AuctionServerAuthorityWorkspace.tsx');

    expect(workspace).toContain("award: { ru: 'серверная фиксация победителя'");
    expect(workspace).toContain("'winner admission'");
    expect(workspace).toContain("'deal passport'");
    expect(workspace).toContain('The Deal link appears only when the server returns dealCreated=true');
    expect(workspace).toContain('只有服务器返回 dealCreated=true');
  });

  it('keeps logistics execution connected to deal acceptance', () => {
    const logisticsEngine = read('apps/web/lib/platform-v7/dealLogisticsEngine.ts');

    expect(logisticsEngine).toContain('/platform-v7/deal-acceptance');
    expect(logisticsEngine).toContain('Приёмка сделки');
  });

  it('keeps acceptance connected to document basis, settlement, and dispute routes', () => {
    const acceptanceEngine = read('apps/web/lib/platform-v7/dealAcceptanceEngine.ts');
    const documentBasisEngine = read('apps/web/lib/platform-v7/dealDocumentBasisEngine.ts');

    expect(acceptanceEngine).toContain('/platform-v7/deal-documents-basis');
    expect(acceptanceEngine).toContain('/platform-v7/bank/payment-basis');
    expect(acceptanceEngine).toContain('/platform-v7/disputes');
    expect(documentBasisEngine).toContain('/platform-v7/deal-acceptance');
    expect(documentBasisEngine).toContain('/platform-v7/bank/payment-basis');
    expect(documentBasisEngine).toContain('/platform-v7/disputes');
  });

  it('keeps core evidence identifiers in the acceptance contour', () => {
    const acceptanceEngine = read('apps/web/lib/platform-v7/dealAcceptanceEngine.ts');

    for (const token of ['dealId', 'routeId', 'lotNumber', 'sdizNumber', 'vehiclePlate', 'grossKg', 'tareKg', 'netKg', 'quality', 'evidence']) {
      expect(acceptanceEngine).toContain(token);
    }
  });

  it('keeps core document basis identifiers and required documents', () => {
    const documentBasisEngine = read('apps/web/lib/platform-v7/dealDocumentBasisEngine.ts');

    for (const token of ['dealId', 'routeId', 'lotNumber', 'sdizNumber', 'amountRub', 'documents', 'checks', 'DOC-DEAL', 'DOC-SDIZ', 'DOC-WEIGHT', 'DOC-QUALITY', 'DOC-ACCEPTANCE', 'DOC-UPD']) {
      expect(documentBasisEngine).toContain(token);
    }
  });
});
