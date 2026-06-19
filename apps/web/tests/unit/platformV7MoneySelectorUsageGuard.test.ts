import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

function read(file: string) {
  return fs.readFileSync(path.join(process.cwd(), file), 'utf8');
}

describe('platform-v7 money selector usage guard', () => {
  it('keeps DomainMoneySummary tied to the strict release guard', () => {
    const source = read('components/v7r/DomainMoneySummary.tsx');

    expect(source).toContain('evaluateReleaseGuard');
    expect(source).toContain('canExecuteRelease');
    expect(source).toContain('selectCanonicalDeals');
    expect(source).toContain('строгую матрицу');
    expect(source).not.toContain("deal.status === 'release_requested'");
    expect(source).not.toContain("deal.status === 'docs_complete'");
    expect(source).not.toContain('близки к выпуску денег');
  });

  it('keeps selectReadyToReleaseTotal stricter than status-only readiness', () => {
    const source = read('lib/domain/selectors.ts');
    const selectorStart = source.indexOf('export function selectReadyToReleaseTotal');
    const selectorEnd = source.indexOf('export function selectDomainTotals');
    const selector = source.slice(selectorStart, selectorEnd);

    expect(selector).toContain('evaluateReleaseGuard');
    expect(selector).toContain('canExecuteRelease');
    expect(selector).not.toContain("deal.status === 'release_requested'");
    expect(selector).not.toContain("deal.status === 'docs_complete'");
  });
});
