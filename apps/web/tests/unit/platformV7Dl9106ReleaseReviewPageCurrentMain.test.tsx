import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const cwd = process.cwd();
const root = [cwd, path.resolve(cwd, '../..')]
  .find((candidate) => fs.existsSync(path.join(candidate, 'design-governance-v8.json')));

if (!root) throw new Error(`Cannot resolve repository root from ${cwd}`);

function read(relativePath: string): string {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

describe('platform-v7 release review authority', () => {
  const page = read('apps/web/app/platform-v7/bank/release-safety/page.tsx');

  it('does not bind payout review to a hard-coded fixture Deal', () => {
    expect(page).not.toContain('DL-9106');
    expect(page).not.toContain('dl9106_payout_review');
    expect(page).not.toContain('DecisionPackMiniPanel');
    expect(page).not.toContain('ReleasePipelineStrip');
    expect(page).not.toContain('canonicalDomainDeals');
  });

  it('starts from the participant-scoped canonical Deal registry', () => {
    expect(page).toContain('<CanonicalDealsList />');
    expect(page).toContain("href='/platform-v7/deals'");
    expect(page).toContain("testId='platform-v7-bank-release-safety-v8'");
  });

  it('keeps the verified bank callback as the only release confirmation', () => {
    expect(page).toContain('verified bank callback');
    expect(page).toContain('Платформа не может вручную присвоить RESERVED или RELEASED');
    expect(page).toContain('平台不能手动设置 RESERVED 或 RELEASED');
    expect(page).toContain('manual review');
  });
});
