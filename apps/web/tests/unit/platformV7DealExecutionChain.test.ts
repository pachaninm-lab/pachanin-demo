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
  it('keeps auction transition tied to a server-issued canonical Deal', () => {
    const page = read('apps/web/app/platform-v7/auction/deal-basis/page.tsx');
    const copy = read('apps/web/lib/platform-v7/auctionAuthorityCopy.ts');

    expect(page).toContain("getAuctionAuthorityRouteCopy('deal-basis'");
    expect(copy).toContain('winner lock → canonical Deal');
    expect(copy).toContain('/deals/{dealId}/execution');
    expect(copy).toContain('только по server-issued Deal ID');
    expect(copy).toContain('idempotent');
    expect(copy).toContain('audit/outbox');
  });

  it('removes the local winner, price, lot and Deal bridge from the authority path', () => {
    const pages = [
      'apps/web/app/platform-v7/auction/page.tsx',
      'apps/web/app/platform-v7/auction/import/page.tsx',
      'apps/web/app/platform-v7/auction/admission/page.tsx',
      'apps/web/app/platform-v7/auction/bids/page.tsx',
      'apps/web/app/platform-v7/auction/deal-basis/page.tsx',
    ].map(read).join('\n');

    for (const token of ['AUCTION_DEAL_BRIDGE', 'AUCTION_DEAL_BASIS', 'FGIS_AUCTION_STATE', 'guardAuctionDealBasisReady', 'auctionDealAmountRub']) {
      expect(pages).not.toContain(token);
    }
    for (const token of ['FGIS-LOT-2607-014', 'BID-001', 'DL-2607-014', 'isWinner: true']) {
      expect(pages).not.toContain(token);
    }
  });

  it('keeps logistics closed until the canonical Deal exists', () => {
    const copy = read('apps/web/lib/platform-v7/auctionAuthorityCopy.ts');

    expect(copy).toContain('логистика, документы и деньги не запускаются');
    expect(copy).toContain('Without the receipt, logistics and money remain closed');
    expect(copy).not.toContain("href: '/platform-v7/deal-logistics'");
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
