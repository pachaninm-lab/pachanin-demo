import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const source = fs.readFileSync(path.join(process.cwd(), 'apps/web/components/platform-v7/P7DealWorkspaceTabs.tsx'), 'utf8');

describe('platform-v7 deal money tab gate', () => {
  it('keeps the money tab behind the full deal matrix, not just blockers and hold amount', () => {
    expect(source).toContain('function domainDealMoneyBlockers');
    expect(source).toContain('documents-not-ready');
    expect(source).toContain('fgis-not-ready');
    expect(source).toContain('transport-not-ready');
    expect(source).toContain('acceptance-not-confirmed');
    expect(source).toContain('quality-not-approved');
    expect(source).toContain('open-dispute');
    expect(source).toContain('const releaseBlocked = blockerLabels.length > 0');
    expect(source).not.toContain('const releaseBlocked = deal.blockers.length > 0 || deal.holdAmount > 0');
  });

  it('does not call a bank-check request a money movement', () => {
    expect(source).toContain('Можно подготовить запрос банковской проверки');
    expect(source).toContain('это ещё не движение денег');
    expect(source).toContain('внешнего банковского подтверждения');
  });
});
