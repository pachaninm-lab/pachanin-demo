import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const cwd = process.cwd();
const root = [cwd, path.resolve(cwd, '../..')]
  .find((candidate) => fs.existsSync(path.join(candidate, 'design-governance-v8.json')));

if (!root) throw new Error(`Cannot resolve repository root from ${cwd}`);

function read(relativePath: string) { return fs.readFileSync(path.join(root, relativePath), 'utf8'); }

describe('platform-v7 FGIS access flow', () => {
  it('keeps the protected organization start flow without collecting an FGIS password', () => {
    const page = read('apps/web/app/platform-v7/fgis-access/page.tsx');

    expect(page).toContain('/api/platform-v7/gov-id/start?flow=fgis');
    expect(page).toContain('Подтвердить организацию для ФГИС');
    expect(page).toContain('Пользователь не вводит пароль ФГИС');
    expect(page).toContain('The user does not enter an FGIS password');
    expect(page).toContain('用户不会在平台中输入监管系统密码');
  });

  it('does not present a local organization, lot, SDIZ or mass as an external fact', () => {
    const page = read('apps/web/app/platform-v7/fgis-access/page.tsx');

    for (const token of ['FARMER_FGIS_ACCESS_STATE', 'FGIS-LOT-2607-014', 'SDIZ-2607-5512', '6829000000', '520000', 'dealSeed']) {
      expect(page).not.toContain(token);
    }
    expect(page).toContain('adapter response');
    expect(page).toContain('source fingerprint');
  });

  it('keeps the access, import, admission and auction chain linked', () => {
    const page = read('apps/web/app/platform-v7/fgis-access/page.tsx');
    const copy = read('apps/web/lib/platform-v7/auctionAuthorityCopy.ts');

    for (const href of ['/platform-v7/fgis-access', '/platform-v7/auction/import', '/platform-v7/auction/admission', '/platform-v7/auction']) {
      expect(`${page}\n${copy}`).toContain(href);
    }
  });

  it('keeps every auction route on the governed authority template', () => {
    const routes = [
      ['apps/web/app/platform-v7/auction/page.tsx', "getAuctionAuthorityRouteCopy('overview'"],
      ['apps/web/app/platform-v7/auction/import/page.tsx', "getAuctionAuthorityRouteCopy('import'"],
      ['apps/web/app/platform-v7/auction/admission/page.tsx', "getAuctionAuthorityRouteCopy('admission'"],
      ['apps/web/app/platform-v7/auction/bids/page.tsx', "getAuctionAuthorityRouteCopy('bids'"],
      ['apps/web/app/platform-v7/auction/deal-basis/page.tsx', "getAuctionAuthorityRouteCopy('deal-basis'"],
    ] as const;

    for (const [pathName, token] of routes) {
      const source = read(pathName);
      expect(source).toContain('AuctionAuthorityRoute');
      expect(source).toContain(token);
      expect(source).toContain('getLocale');
    }
  });

  it('keeps winner selection and canonical Deal creation server-owned', () => {
    const copy = read('apps/web/lib/platform-v7/auctionAuthorityCopy.ts');

    expect(copy).toContain('Победитель фиксируется атомарно');
    expect(copy).toContain('winner lock → canonical Deal');
    expect(copy).toContain('idempotent');
    expect(copy).toContain('/deals/{dealId}/execution');
    expect(copy).toContain('UI не принимает ставки');
  });
});
