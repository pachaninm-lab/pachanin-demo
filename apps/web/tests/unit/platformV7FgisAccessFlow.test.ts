import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
function read(relativePath: string) { return fs.readFileSync(path.join(root, relativePath), 'utf8'); }

describe('platform-v7 FGIS access flow', () => {
  it('keeps FGIS page connected to organisation check and deal import flow', () => {
    const page = read('apps/web/app/platform-v7/fgis-access/page.tsx');
    expect(page).toContain('/api/platform-v7/gov-id/start?flow=fgis');
    expect(page).toContain('Подтвердить организацию для ФГИС');
    expect(page).toContain('право на импорт партии');
    expect(page).toContain('platformV7RouteIcon');
  });

  it('keeps FGIS page connected to route icon registry', () => {
    const page = read('apps/web/app/platform-v7/fgis-access/page.tsx');
    expect(page).toContain("platformV7RouteIcon('fgis')");
    expect(page).toContain("platformV7RouteIcon('auction')");
    expect(page).toContain("platformV7RouteIcon('compliance')");
  });

  it('keeps FGIS access state connected to auction import and admission', () => {
    const engine = read('apps/web/lib/platform-v7/farmerFgisAccessEngine.ts');
    expect(engine).toContain('/platform-v7/auction/import');
    expect(engine).toContain('/platform-v7/auction/admission');
    expect(engine).toContain('/platform-v7/auction');
    expect(engine).toContain('ownerInn');
    expect(engine).toContain('lotNumber');
    expect(engine).toContain('sdizNumber');
  });

  it('keeps import, admission, bids, and deal basis linked as one auction chain', () => {
    const importPage = read('apps/web/app/platform-v7/auction/import/page.tsx');
    const admissionPage = read('apps/web/app/platform-v7/auction/admission/page.tsx');
    const bidsPage = read('apps/web/app/platform-v7/auction/bids/page.tsx');
    const dealBasisPage = read('apps/web/app/platform-v7/auction/deal-basis/page.tsx');

    expect(importPage).toContain('/platform-v7/fgis-access');
    expect(importPage).toContain('/platform-v7/auction/admission');
    expect(admissionPage).toContain('/platform-v7/auction/import');
    expect(admissionPage).toContain('/platform-v7/auction/bids');
    expect(bidsPage).toContain('/platform-v7/auction/admission');
    expect(bidsPage).toContain('/platform-v7/auction/deal-basis');
    expect(dealBasisPage).toContain('/platform-v7/deal-logistics');
  });

  it('keeps auction chain UX semantics and route icons visible', () => {
    const importPage = read('apps/web/app/platform-v7/auction/import/page.tsx');
    const admissionPage = read('apps/web/app/platform-v7/auction/admission/page.tsx');
    const bidsPage = read('apps/web/app/platform-v7/auction/bids/page.tsx');

    expect(importPage).toContain('ФГИС → импорт');
    expect(admissionPage).toContain('Импорт → допуск');
    expect(bidsPage).toContain('Допуск → ставки');
    expect(importPage).toContain('platformV7RouteIcon');
    expect(admissionPage).toContain('platformV7RouteIcon');
    expect(bidsPage).toContain('platformV7RouteIcon');
    expect(bidsPage).toContain('winner');
  });
});
