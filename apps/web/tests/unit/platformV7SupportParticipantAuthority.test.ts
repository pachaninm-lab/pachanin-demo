import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const repoRoot = path.resolve(process.cwd(), '../..');
const read = (relativePath: string) => fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');

const authority = read('apps/web/components/transaction-ux/SupportParticipantAuthority.tsx');
const index = read('apps/web/app/platform-v7/support/page.tsx');
const create = read('apps/web/app/platform-v7/support/new/page.tsx');
const detail = read('apps/web/app/platform-v7/support/[caseId]/page.tsx');
const operator = read('apps/web/app/platform-v7/support/operator/page.tsx');
const detailAlias = read('apps/web/app/platform-v7/support/detail/page.tsx');
const grainAlias = read('apps/web/app/platform-v7/support/grain/page.tsx');
const routePolicy = read('apps/web/lib/platform-v7/design-system-v8-route-policy.ts');
const governance = JSON.parse(read('design-governance-v8.json'));
const forbiddenPresentation = /style\s*=\s*\{\{|dangerouslySetInnerHTML|#[0-9a-f]{3,8}\b|\brgba?\s*\(|!important/i;

describe('platform-v7 participant support authority', () => {
  it('uses one server component for participant list, create, detail and operator boundaries', () => {
    for (const page of [index, create, detail, operator]) {
      expect(page).toContain('SupportParticipantAuthority');
      expect(page).not.toContain('support-client-store');
      expect(page).not.toContain('SupportIndexPage');
      expect(page).not.toContain('SupportNewCaseScopedClient');
      expect(page).not.toContain('SupportCaseRouteClient');
      expect(page).not.toContain('SupportOperatorQueueClient');
      expect(page).not.toContain('usePlatformV7RStore');
      expect(page).not.toContain("searchParams.get('role')");
      expect(page).not.toMatch(forbiddenPresentation);
    }
  });

  it('keeps PostgreSQL staff authority explicit and participant commands fail closed', () => {
    expect(authority).toContain('getAuthProfile');
    expect(authority).toContain('getDealsCanonical');
    expect(authority).toContain('profile.available');
    expect(authority).toContain('profile.orgId');
    expect(authority).toContain('support.cases');
    expect(authority).toContain('support.case_events');
    expect(authority).toContain('X-Staff-Access-Session');
    expect(authority).toContain('participant-facing support API');
    expect(authority).toContain('participant-facing support API is not connected');
    expect(authority).toContain('participant-facing support API 尚未连接');
    expect(authority).toContain('Браузер не создаёт, не хранит и не переводит обращения');
    expect(authority).toContain('The browser does not create, store or transition support cases');
    expect(authority).toContain('浏览器不会创建、存储或转换支持工单');
    expect(authority).not.toContain("'use client'");
    expect(authority).not.toContain('localStorage');
    expect(authority).not.toContain('SUPPORT_CASES');
    expect(authority).not.toContain('moneyAtRiskRub');
    expect(authority).not.toMatch(forbiddenPresentation);
  });

  it('canonicalizes duplicate detail and grain routes', () => {
    expect(detailAlias).toContain("import { redirect } from 'next/navigation'");
    expect(detailAlias).toContain("`/platform-v7/support/${encodeURIComponent(id)}`");
    expect(detailAlias).not.toContain('SupportCaseDetailPage');
    expect(grainAlias).toContain("redirect('/platform-v7/support')");
    expect(grainAlias).not.toContain('SUP-9106');
    expect(grainAlias).not.toContain('18 файлов');
    expect(grainAlias).not.toMatch(forbiddenPresentation);
  });

  it('registers the complete support route family in minimal v8 runtime and governance', () => {
    expect(routePolicy).toContain("'/platform-v7/support'");
    for (const file of [
      'apps/web/app/platform-v7/support/page.tsx',
      'apps/web/app/platform-v7/support/new/page.tsx',
      'apps/web/app/platform-v7/support/detail/page.tsx',
      'apps/web/app/platform-v7/support/[caseId]/page.tsx',
      'apps/web/app/platform-v7/support/grain/page.tsx',
      'apps/web/app/platform-v7/support/operator/page.tsx',
    ]) expect(governance.migratedFiles).toContain(file);
  });
});
