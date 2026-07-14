import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const repoRoot = path.resolve(process.cwd(), '../..');
const absolute = (relativePath: string) => path.join(repoRoot, relativePath);
const read = (relativePath: string) => fs.readFileSync(absolute(relativePath), 'utf8');

const auctionDetail = read('apps/web/app/platform-v7/auctions/[id]/page.tsx');
const dealDraft = read('apps/web/app/platform-v7/deal-drafts/[draftId]/page.tsx');
const disputeDetail = read('apps/web/app/platform-v7/disputes/[id]/page.tsx');
const disputeHold = read('apps/web/app/platform-v7/disputes/[id]/hold/page.tsx');
const elevatorTerminal = read('apps/web/app/platform-v7/elevator/terminal/page.tsx');
const elevatorOperation = read('apps/web/app/platform-v7/elevator/terminal/[operationId]/page.tsx');
const surveyorAct = read('apps/web/app/platform-v7/surveyor/acts/[id]/page.tsx');
const readiness = read('apps/web/app/platform-v7/readiness/page.tsx');
const pilotRunbook = read('apps/web/app/platform-v7/pilot-runbook/page.tsx');
const support = read('apps/web/app/platform-v7/support/page.tsx');
const supportCase = read('apps/web/app/platform-v7/support/[caseId]/page.tsx');
const supportDetail = read('apps/web/app/platform-v7/support/detail/page.tsx');
const supportGrain = read('apps/web/app/platform-v7/support/grain/page.tsx');
const supportNew = read('apps/web/app/platform-v7/support/new/page.tsx');
const supportOperator = read('apps/web/app/platform-v7/support/operator/page.tsx');
const notifications = read('apps/web/app/platform-v7/notifications/page.tsx');
const auction = read('apps/web/app/platform-v7/auction/page.tsx');
const dealBasis = read('apps/web/app/platform-v7/auction/deal-basis/page.tsx');
const disputes = read('apps/web/app/platform-v7/disputes/page.tsx');
const elevator = read('apps/web/app/platform-v7/elevator/page.tsx');
const surveyor = read('apps/web/app/platform-v7/surveyor/page.tsx');
const policy = read('apps/web/lib/platform-v7/design-system-v8-route-policy.ts');
const governance = JSON.parse(read('design-governance-v8.json')) as {
  version: number;
  migratedFiles: string[];
};
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

  it('removes the browser role catch-all so unknown routes resolve through the framework 404 boundary', () => {
    expect(fs.existsSync(absolute('apps/web/app/platform-v7/[...slug]/page.tsx'))).toBe(false);
  });

  it('routes fixture readiness and runbook surfaces to canonical operational authorities', () => {
    expect(readiness).toContain("redirect('/platform-v7/control-tower')");
    expect(readiness).not.toContain('PLATFORM_V7_EXECUTION_SOURCE');
    expect(readiness).not.toContain('selectAllDeals');
    expect(readiness).not.toMatch(forbiddenPresentation);
    expect(pilotRunbook).toContain("redirect('/platform-v7/deals')");
    expect(pilotRunbook).not.toContain('DL-9106');
    expect(pilotRunbook).not.toContain('selectDealExecutionCase');
    expect(pilotRunbook).not.toMatch(forbiddenPresentation);
  });

  it('routes participant support to the real inquiry intake and operator support to authenticated staff', () => {
    expect(support).toContain("redirect('/platform-v7/contact?source=support')");
    expect(supportNew).toContain("redirect('/platform-v7/contact?source=support-new')");
    expect(supportGrain).toContain("redirect('/platform-v7/contact?source=support-grain')");
    expect(supportCase).toContain('legacyCaseId=${encodeURIComponent(caseId)}');
    expect(supportDetail).toContain('legacyCaseId=${encodeURIComponent(legacyCaseId)}');
    expect(supportOperator).toContain("redirect('/platform-v7/staff?workspace=support')");

    for (const source of [support, supportCase, supportDetail, supportGrain, supportNew, supportOperator]) {
      expect(source).not.toContain('SupportIndexPage');
      expect(source).not.toContain('SupportCaseRouteClient');
      expect(source).not.toContain('SupportCaseDetailPage');
      expect(source).not.toContain('SupportNewCaseScopedClient');
      expect(source).not.toContain('SupportOperatorQueueClient');
      expect(source).not.toMatch(forbiddenPresentation);
    }
    expect(supportNew).not.toContain('requesterRole');
    expect(supportNew).not.toContain('params.role');
    expect(supportGrain).not.toContain('SUP-9106');
  });

  it('keeps real server notification reads and writes while migrating the surface to Design System v8', () => {
    expect(notifications).toContain("from '@pc/design-system-v8'");
    expect(notifications).toContain('<Surface');
    expect(notifications).toContain("fetch('/api/proxy/notifications'");
    expect(notifications).toContain('/api/proxy/notifications/${encodeURIComponent(id)}/read');
    expect(notifications).toContain("fetch('/api/proxy/notifications/read-all'");
    expect(notifications).not.toMatch(forbiddenPresentation);
    expect(policy).toContain("'/platform-v7/notifications'");
    expect(governance.version).toBe(38);
    expect(governance.migratedFiles).toContain('apps/web/app/platform-v7/notifications/page.tsx');
  });

  it('keeps the complete zero-legacy closure inside the exact approved scope', () => {
    for (const file of [
      'apps/web/app/platform-v7/[...slug]/page.tsx',
      'apps/web/app/platform-v7/notifications/page.tsx',
      'apps/web/app/platform-v7/pilot-runbook/page.tsx',
      'apps/web/app/platform-v7/readiness/page.tsx',
      'apps/web/app/platform-v7/support/[caseId]/page.tsx',
      'apps/web/app/platform-v7/support/detail/page.tsx',
      'apps/web/app/platform-v7/support/grain/page.tsx',
      'apps/web/app/platform-v7/support/new/page.tsx',
      'apps/web/app/platform-v7/support/operator/page.tsx',
      'apps/web/app/platform-v7/support/page.tsx',
      'apps/web/lib/platform-v7/design-system-v8-route-policy.ts',
      'apps/web/tests/unit/platformV7LegacyRouteClosure.test.ts',
      'design-governance-v8.json',
    ]) {
      expect(scope).toContain(`'${file}'`);
    }
  });
});
