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
});
