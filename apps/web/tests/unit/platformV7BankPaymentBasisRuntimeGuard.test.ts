import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const repoRoot = path.resolve(process.cwd(), '../..');
const pagePath = path.join(repoRoot, 'apps/web/app/platform-v7/bank/payment-basis/page.tsx');
const page = fs.readFileSync(pagePath, 'utf8');
const routePolicy = fs.readFileSync(path.join(repoRoot, 'apps/web/lib/platform-v7/design-system-v8-route-policy.ts'), 'utf8');
const governance = JSON.parse(fs.readFileSync(path.join(repoRoot, 'design-governance-v8.json'), 'utf8'));

describe('platform-v7 bank payment basis canonical route', () => {
  it('redirects the legacy route to the canonical release-safety authority', () => {
    expect(page).toContain("redirect(`/platform-v7/bank/release-safety${suffix}`)");
    expect(page).toContain("query.set('dealId', dealId)");
    expect(page).toContain("query.set('shipmentId', shipmentId)");
    expect(page).not.toContain('DL-9106');
    expect(page).not.toContain('actorRole');
  });

  it('removes fixture-backed browser actions and their client panel', () => {
    expect(fs.existsSync(path.join(repoRoot, 'apps/web/components/platform-v7/P7BankPaymentBasisRuntimePanel.tsx'))).toBe(false);
    expect(fs.existsSync(path.join(repoRoot, 'apps/web/lib/platform-v7/bank-payment-basis-runtime-action.ts'))).toBe(false);
    expect(fs.existsSync(path.join(repoRoot, 'apps/web/tests/unit/p7BankPaymentBasisRuntimePanel.test.tsx'))).toBe(false);
    expect(page).not.toContain("'use client'");
    expect(page).not.toContain('useState');
    expect(page).not.toContain('buildPlatformV7RuntimeActionEvent');
  });

  it('keeps the compatibility route inside the governed minimal runtime', () => {
    expect(routePolicy).toContain("'/platform-v7/bank/payment-basis'");
    expect(governance.migratedFiles).toContain('apps/web/app/platform-v7/bank/payment-basis/page.tsx');
  });
});
