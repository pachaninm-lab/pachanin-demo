import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const repoRoot = path.resolve(process.cwd(), '../..');
const read = (relativePath: string) => fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');

const auction = read('apps/web/app/platform-v7/auctions/[id]/page.tsx');
const draft = read('apps/web/app/platform-v7/deal-drafts/[draftId]/page.tsx');
const dispute = read('apps/web/app/platform-v7/disputes/[id]/page.tsx');
const disputeHold = read('apps/web/app/platform-v7/disputes/[id]/hold/page.tsx');
const elevatorTerminal = read('apps/web/app/platform-v7/elevator/terminal/page.tsx');
const elevatorOperation = read('apps/web/app/platform-v7/elevator/terminal/[operationId]/page.tsx');
const surveyorAct = read('apps/web/app/platform-v7/surveyor/acts/[id]/page.tsx');
const auctionAuthority = read('apps/web/app/platform-v7/auction/page.tsx');
const dealBasisAuthority = read('apps/web/app/platform-v7/auction/deal-basis/page.tsx');
const disputesAuthority = read('apps/web/app/platform-v7/disputes/page.tsx');
const elevatorAuthority = read('apps/web/app/platform-v7/elevator/page.tsx');
const surveyorAuthority = read('apps/web/app/platform-v7/surveyor/page.tsx');
const migrationScope = JSON.parse(read('scripts/design-system-v8-route-migration-scope.json')) as string[];

const forbiddenPresentation = /style\s*=\s*\{\{|dangerouslySetInnerHTML|#[0-9a-f]{3,8}\b|\brgba?\s*\(|!important/i;

describe('platform-v7 dynamic execution compatibility authority', () => {
  it('preserves legacy auction and draft identifiers without treating them as canonical lot authority', () => {
    expect(auction).toContain('encodeURIComponent(params.id)');
    expect(auction).toContain('/platform-v7/auction?legacyAuctionId=');
    expect(draft).toContain('encodeURIComponent(params.draftId)');
    expect(draft).toContain('/platform-v7/auction/deal-basis?legacyDraftId=');
    for (const legacyPage of [auction, draft]) {
      expect(legacyPage).toContain("import { redirect } from 'next/navigation'");
      expect(legacyPage).not.toContain("'use client'");
      expect(legacyPage).not.toContain('PLATFORM_V7_TRADING_SOURCE');
      expect(legacyPage).not.toMatch(forbiddenPresentation);
    }
    expect(auctionAuthority).toContain('AuctionPostgresAuthorityWorkspace');
    expect(dealBasisAuthority).toContain('AuctionPostgresAuthorityWorkspace');
  });

  it('routes dispute details and hold intent to the canonical dispute workspace without local money commands', () => {
    expect(dispute).toContain('encodeURIComponent(params.id)');
    expect(dispute).toContain('/platform-v7/disputes?disputeId=');
    expect(disputeHold).toContain('encodeURIComponent(params.id)');
    expect(disputeHold).toContain('&view=hold');
    for (const legacyPage of [dispute, disputeHold]) {
      expect(legacyPage).not.toContain('P7DisputeHoldActionForm');
      expect(legacyPage).not.toContain('P7ExecutionActionsPanel');
      expect(legacyPage).not.toContain('useState');
      expect(legacyPage).not.toContain('amountMinor');
      expect(legacyPage).not.toMatch(forbiddenPresentation);
    }
    expect(disputesAuthority).toContain('OperationalDecisionCockpit');
  });

  it('routes elevator operations to the canonical elevator cockpit without generic runtime mutation', () => {
    expect(elevatorTerminal).toContain("redirect('/platform-v7/elevator')");
    expect(elevatorOperation).toContain('encodeURIComponent(params.operationId)');
    expect(elevatorOperation).toContain('/platform-v7/elevator?operationId=');
    for (const legacyPage of [elevatorTerminal, elevatorOperation]) {
      expect(legacyPage).not.toContain('ElevatorTerminalRuntime');
      expect(legacyPage).not.toContain('useState');
      expect(legacyPage).not.toMatch(forbiddenPresentation);
    }
    expect(elevatorAuthority).toContain('OperationalDecisionCockpit');
  });

  it('preserves surveyor act context without local signing or readiness authority', () => {
    expect(surveyorAct).toContain('encodeURIComponent(params.id)');
    expect(surveyorAct).toContain('/platform-v7/surveyor?actId=');
    expect(surveyorAct).not.toContain('GrainWorkflowPage');
    expect(surveyorAct).not.toContain('подписание акта');
    expect(surveyorAct).not.toContain('Подписать акт');
    expect(surveyorAct).not.toMatch(forbiddenPresentation);
    expect(surveyorAuthority).toContain('OperationalDecisionCockpit');
  });

  it('keeps the exact dynamic cluster inside the migration manifest', () => {
    for (const file of [
      'apps/web/app/platform-v7/auctions/[id]/page.tsx',
      'apps/web/app/platform-v7/deal-drafts/[draftId]/page.tsx',
      'apps/web/app/platform-v7/disputes/[id]/page.tsx',
      'apps/web/app/platform-v7/disputes/[id]/hold/page.tsx',
      'apps/web/app/platform-v7/elevator/terminal/page.tsx',
      'apps/web/app/platform-v7/elevator/terminal/[operationId]/page.tsx',
      'apps/web/app/platform-v7/surveyor/acts/[id]/page.tsx',
      'apps/web/tests/unit/platformV7DynamicExecutionCompatibility.test.ts',
    ]) {
      expect(migrationScope).toContain(file);
    }
  });
});
