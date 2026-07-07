import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();

function read(relativePath: string) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

describe('platform-v7 deal execution chain', () => {
  it('keeps auction deal basis connected to logistics execution', () => {
    const dealBasisPage = read('apps/web/app/platform-v7/auction/deal-basis/page.tsx');

    expect(dealBasisPage).toContain('/platform-v7/deal-logistics');
    expect(dealBasisPage).toContain('Сформировать рейс');
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
