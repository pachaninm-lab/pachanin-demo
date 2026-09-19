import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const repoRoot = path.resolve(process.cwd(), '../..');
const read = (relativePath: string) => fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');

const batchRoutes = [
  'apps/web/app/platform-v7/batches/page.tsx',
  'apps/web/app/platform-v7/batches/create/page.tsx',
  'apps/web/app/platform-v7/batches/new/page.tsx',
  'apps/web/app/platform-v7/batches/view/page.tsx',
  'apps/web/app/platform-v7/batches/[batchId]/page.tsx',
];
const auctionRoutes = [
  'apps/web/app/platform-v7/lots/page.tsx',
  'apps/web/app/platform-v7/lots/compare/page.tsx',
];
const importRoutes = [
  'apps/web/app/platform-v7/lots/create/page.tsx',
  'apps/web/app/platform-v7/lot/create/page.tsx',
];
const detail = read('apps/web/app/platform-v7/lot/[id]/page.tsx');

describe('platform-v7 canonical batch and lot aliases', () => {
  it('routes all batch surfaces to the governed FGIS access boundary', () => {
    for (const file of batchRoutes) {
      const source = read(file);
      expect(source).toContain("import { redirect } from 'next/navigation'");
      expect(source).toContain("redirect('/platform-v7/fgis-access')");
      expect(source).not.toContain('GrainExecutionPage');
      expect(source).not.toContain('quick-sale');
      expect(source).not.toContain('batch-detail');
    }
  });

  it('routes lot list and comparison to the canonical auction', () => {
    for (const file of auctionRoutes) {
      const source = read(file);
      expect(source).toContain("redirect('/platform-v7/auction')");
      expect(source).not.toContain('SellerLotsRuntimeV2');
      expect(source).not.toContain('LotsCompareRuntime');
      expect(source).not.toContain('PricePredictorWidget');
      expect(source).not.toContain('dangerouslySetInnerHTML');
    }
  });

  it('routes both lot creation aliases through governed import', () => {
    for (const file of importRoutes) {
      const source = read(file);
      expect(source).toContain("redirect('/platform-v7/auction/import')");
      expect(source).not.toContain('SellerLotCreateRuntimeV2');
      expect(source).not.toContain('dangerouslySetInnerHTML');
    }
  });

  it('preserves the dynamic lot id without restoring a legacy detail runtime', () => {
    expect(detail).toContain('encodeURIComponent(params.id)');
    expect(detail).toContain('/platform-v7/auction?lotId=');
    expect(detail).not.toContain('LotDetailRuntime');
  });
});
