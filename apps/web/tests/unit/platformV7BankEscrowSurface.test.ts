import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const repoRoot = path.resolve(process.cwd(), '../..');
const pagePath = path.join(repoRoot, 'apps/web/app/platform-v7/bank/escrow/page.tsx');
const page = fs.readFileSync(pagePath, 'utf8');

describe('platform-v7 bank escrow canonical route', () => {
  it('redirects the compatibility route to the canonical release-safety workspace', () => {
    expect(page).toContain("redirect(`/platform-v7/bank/release-safety${suffix}`)");
    expect(page).toContain("query.set('dealId', dealId)");
    expect(page).toContain("query.set('shipmentId', shipmentId)");
    expect(page).toContain("robots: { index: false, follow: false }");
  });

  it('removes fake escrow rows and browser-owned money state', () => {
    for (const forbidden of [
      "'use client'",
      'ESCROW_ROWS',
      'ESC-301',
      'ESC-302',
      'ESC-303',
      'DL-9102',
      'DL-9108',
      'DL-9111',
      'useState',
      'requestPartialRelease',
      'markReady',
      'setReturnHold',
      'Выплата запрошена',
      'Средства выпущены',
    ]) {
      expect(page).not.toContain(forbidden);
    }
  });

  it('stays a redirect-only alias without a second money authority', () => {
    expect(page).toContain("import { redirect } from 'next/navigation'");
    expect(page).not.toContain('@pc/design-system-v8');
    expect(page).not.toContain('@/components/transaction-ux');
    expect(page).not.toMatch(/style\s*=\s*\{\{/);
  });
});
