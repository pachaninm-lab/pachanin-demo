import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const repoRoot = path.resolve(process.cwd(), '../..');
const read = (relativePath: string) => fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');

const offers = read('apps/web/app/platform-v7/seller/offers/page.tsx');
const rfq = read('apps/web/app/platform-v7/seller/rfq/page.tsx');
const reputation = read('apps/web/app/platform-v7/seller/reputation/page.tsx');
const routePolicy = read('apps/web/lib/platform-v7/design-system-v8-route-policy.ts');
const governance = JSON.parse(read('design-governance-v8.json'));
const forbiddenPresentation = /style\s*=\s*\{\{|dangerouslySetInnerHTML|#[0-9a-f]{3,8}\b|\brgba?\s*\(|!important/i;

describe('platform-v7 seller market and risk authority', () => {
  it('routes the obsolete seller offers surface to the governed seller RFQ workspace', () => {
    expect(offers).toContain("import { redirect } from 'next/navigation'");
    expect(offers).toContain("redirect('/platform-v7/seller/rfq')");
    expect(offers).not.toContain('PLATFORM_V7_TRADING_SOURCE');
    expect(offers).not.toContain('P7ExecutionActionsPanel');
    expect(offers).not.toContain('OFFER-SELLER-2403');
    expect(offers).not.toContain('Лот ВРЖ-1811');
    expect(offers).not.toMatch(forbiddenPresentation);
  });

  it('uses server-confirmed context and a fail-closed seller RFQ boundary', () => {
    expect(rfq).toContain('OperationalDecisionCockpit');
    expect(rfq).toContain('getAuthProfile');
    expect(rfq).toContain('getDealsCanonical');
    expect(rfq).toContain('profile.available');
    expect(rfq).toContain('profile.orgId');
    expect(rfq).toContain('нет подтверждённых seller RFQ/Offer API');
    expect(rfq).toContain('no confirmed seller RFQ/Offer API');
    expect(rfq).toContain('没有已确认的 seller RFQ/Offer API');
    expect(rfq).toContain('Браузер не создаёт RFQ, Offer или DealDraft');
    expect(rfq).toContain('The browser does not create an RFQ, Offer or DealDraft');
    expect(rfq).toContain('浏览器不会创建 RFQ、Offer 或 DealDraft');
    expect(rfq).not.toContain('GrainWorkflowPage');
    expect(rfq).not.toContain('DD-OFFER-1');
    expect(rfq).not.toContain("'use client'");
    expect(rfq).not.toMatch(forbiddenPresentation);
  });

  it('removes the local buyer rating and exposes an evidence authority only', () => {
    expect(reputation).toContain('OperationalDecisionCockpit');
    expect(reputation).toContain('getAuthProfile');
    expect(reputation).toContain('getDealsCanonical');
    expect(reputation).toContain('нет подтверждённых buyer-risk API');
    expect(reputation).toContain('no confirmed buyer-risk API');
    expect(reputation).toContain('没有已确认的 buyer-risk API');
    expect(reputation).toContain('Браузер не рассчитывает, не хранит и не меняет рейтинг покупателя');
    expect(reputation).toContain('The browser does not calculate, store or change a buyer rating');
    expect(reputation).toContain('浏览器不会计算、存储或更改买方评分');
    expect(reputation).not.toContain('GrainWorkflowPage');
    expect(reputation).not.toContain("'use client'");
    expect(reputation).not.toMatch(forbiddenPresentation);
  });

  it('registers both workspaces in the minimal v8 runtime and governance', () => {
    expect(routePolicy).toContain("'/platform-v7/seller/rfq'");
    expect(routePolicy).toContain("'/platform-v7/seller/reputation'");
    expect(governance.migratedFiles).toContain('apps/web/app/platform-v7/seller/rfq/page.tsx');
    expect(governance.migratedFiles).toContain('apps/web/app/platform-v7/seller/reputation/page.tsx');
  });
});
