import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const repoRoot = path.resolve(process.cwd(), '../..');
const read = (relativePath: string) => fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');

const auctionDetail = read('apps/web/app/platform-v7/auctions/[id]/page.tsx');
const dealDraft = read('apps/web/app/platform-v7/deal-drafts/[draftId]/page.tsx');
const disputeDetail = read('apps/web/app/platform-v7/disputes/[id]/page.tsx');
const disputeHold = read('apps/web/app/platform-v7/disputes/[id]/hold/page.tsx');
const elevatorTerminal = read('apps/web/app/platform-v7/elevator/terminal/page.tsx');
const elevatorOperation = read('apps/web/app/platform-v7/elevator/terminal/[operationId]/page.tsx');
const surveyorAct = read('apps/web/app/platform-v7/surveyor/acts/[id]/page.tsx');
const auction = read('apps/web/app/platform-v7/auction/page.tsx');
const dealBasis = read('apps/web/app/platform-v7/auction/deal-basis/page.tsx');
const disputes = read('apps/web/app/platform-v7/disputes/page.tsx');
const elevator = read('apps/web/app/platform-v7/elevator/page.tsx');
const surveyor = read('apps/web/app/platform-v7/surveyor/page.tsx');
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

  it('routes dispute detail and hold intents to the server dispute authority', () => {
    expect(disputeDetail).toContain("redirect(`/platform-v7/disputes?disputeId=${encodeURIComponent(params.id)}`)");
    expect(disputeHold).toContain("redirect(`/platform-v7/disputes?disputeId=${encodeURIComponent(params.id)}&view=hold`)");
    expect(disputeDetail).not.toContain('DisputeDetailRuntime');
    expect(disputeHold).not.toContain('recommendedHold');
    expect(disputeDetail).not.toMatch(forbiddenPresentation);
    expect(disputeHold).not.toMatch(forbiddenPresentation);
    expect(disputes).toContain("from '@/lib/disputes-server'");
    expect(disputes).toContain('getDisputes');
  });

  it('routes terminal compatibility URLs to the canonical elevator workspace', () => {
    expect(elevatorTerminal).toContain("redirect('/platform-v7/elevator')");
    expect(elevatorOperation).toContain("redirect(`/platform-v7/elevator?operationId=${encodeURIComponent(params.operationId)}`)");
    expect(elevatorTerminal).not.toContain('GrainExecutionPage');
    expect(elevatorOperation).not.toContain('GrainExecutionPage');
    expect(elevatorTerminal).not.toMatch(forbiddenPresentation);
    expect(elevatorOperation).not.toMatch(forbiddenPresentation);
    expect(elevator).toContain("from '@/lib/logistics-server'");
    expect(elevator).toContain('getShipments');
  });

  it('removes browser-owned surveyor act editing and preserves the act identifier', () => {
    expect(surveyorAct).toContain("redirect(`/platform-v7/surveyor?actId=${encodeURIComponent(params.id)}`)");
    expect(surveyorAct).not.toContain("'use client'");
    expect(surveyorAct).not.toContain('DEFAULT_FORM');
    expect(surveyorAct).not.toContain('signAct');
    expect(surveyorAct).not.toMatch(forbiddenPresentation);
    expect(surveyor).toContain("from '@pc/design-system-v8'");
    expect(surveyor).toContain('FieldTaskTemplate');
  });

  it('keeps the complete remaining route inventory inside an exact closure scope', () => {
    for (const file of [
      'apps/web/app/platform-v7/auctions/[id]/page.tsx',
      'apps/web/app/platform-v7/deal-drafts/[draftId]/page.tsx',
      'apps/web/app/platform-v7/disputes/[id]/page.tsx',
      'apps/web/app/platform-v7/disputes/[id]/hold/page.tsx',
      'apps/web/app/platform-v7/elevator/terminal/page.tsx',
      'apps/web/app/platform-v7/elevator/terminal/[operationId]/page.tsx',
      'apps/web/app/platform-v7/surveyor/acts/[id]/page.tsx',
      'apps/web/tests/unit/platformV7LegacyRouteClosure.test.ts',
    ]) {
      expect(scope).toContain(`'${file}'`);
    }
  });
});
