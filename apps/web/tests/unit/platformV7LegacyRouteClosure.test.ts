import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const repoRoot = path.resolve(process.cwd(), '../..');
const read = (relativePath: string) => fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');

const auctionDetail = read('apps/web/app/platform-v7/auctions/[id]/page.tsx');
const dealDraft = read('apps/web/app/platform-v7/deal-drafts/[draftId]/page.tsx');
const auction = read('apps/web/app/platform-v7/auction/page.tsx');
const dealBasis = read('apps/web/app/platform-v7/auction/deal-basis/page.tsx');
const scope = read('scripts/check-design-system-v8-pr-scope.mjs');

const forbiddenPresentation = /style\s*=\s*\{\{|dangerouslySetInnerHTML|#[0-9a-f]{3,8}\b|\brgba?\s*\(|!important/i;

describe('platform-v7 final legacy route closure', () => {
  it('routes auction detail to the PostgreSQL auction authority and preserves the identifier', () => {
    expect(auctionDetail).toContain("import { redirect } from 'next/navigation'");
    expect(auctionDetail).toContain("redirect(`/platform-v7/auction?lotId=${encodeURIComponent(params.id)}`)");
    expect(auctionDetail).not.toContain('AuctionDetailPage');
    expect(auctionDetail).not.toMatch(forbiddenPresentation);
    expect(auction).toContain('AuctionPostgresAuthorityWorkspace');
    expect(auction).toContain("stage='overview'");
  });

  it('removes browser-owned deal drafts and routes to the canonical deal-basis stage', () => {
    expect(dealDraft).toContain("redirect('/platform-v7/auction/deal-basis')");
    expect(dealDraft).not.toContain('DealDraftDetailRuntimeV2');
    expect(dealDraft).not.toContain("'use client'");
    expect(dealDraft).not.toMatch(forbiddenPresentation);
    expect(dealBasis).toContain('AuctionPostgresAuthorityWorkspace');
    expect(dealBasis).toContain("stage='deal-basis'");
  });

  it('keeps the complete remaining route inventory inside an exact closure scope', () => {
    for (const file of [
      'apps/web/app/platform-v7/auctions/[id]/page.tsx',
      'apps/web/app/platform-v7/deal-drafts/[draftId]/page.tsx',
      'apps/web/tests/unit/platformV7LegacyRouteClosure.test.ts',
    ]) {
      expect(scope).toContain(`'${file}'`);
    }
  });
});
