import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const repoRoot = path.resolve(process.cwd(), '../..');
const read = (relativePath: string) => fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');

const aliases = [
  ['apps/web/app/platform-v7/buyer/deals/page.tsx', '/platform-v7/deals'],
  ['apps/web/app/platform-v7/buyer/lots/page.tsx', '/platform-v7/auction'],
  ['apps/web/app/platform-v7/buyer/matches/page.tsx', '/platform-v7/buyer/rfq'],
  ['apps/web/app/platform-v7/buyer/offers/page.tsx', '/platform-v7/auction/bids'],
  ['apps/web/app/platform-v7/buyer-lot/page.tsx', '/platform-v7/auction'],
] as const;

describe('platform-v7 buyer secondary aliases', () => {
  it.each(aliases)('routes %s to the canonical authority %s', (file, target) => {
    const source = read(file);
    expect(source).toContain("import { redirect } from 'next/navigation'");
    expect(source).toContain(`redirect('${target}')`);
    expect(source).not.toContain('GrainWorkflowPage');
    expect(source).not.toContain('PLATFORM_V7_TRADING_SOURCE');
    expect(source).not.toContain('P7ExecutionActionsPanel');
    expect(source).not.toContain('DL-9106');
    expect(source).not.toContain('88%');
    expect(source).not.toContain('DD-OFFER-1');
    expect(source).not.toContain('style=');
  });

  it('keeps reputation outside the alias batch because scoring still needs server authority', () => {
    const reputation = read('apps/web/app/platform-v7/buyer/reputation/page.tsx');
    expect(reputation).not.toContain("redirect('/platform-v7/trust')");
  });
});
