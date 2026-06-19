import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { PLATFORM_V7_EXECUTION_SOURCE } from '@/lib/platform-v7/deal-execution-source-of-truth';
import { canRequestStrictMoneyRelease, strictMoneyReleaseBlockers } from '@/lib/platform-v7/deal-money-release-gate';

describe('platform-v7 strict settlement gate', () => {
  it('keeps DL-9106 blocked while FGIS, quality, documents, logistics and bank are not all ready', () => {
    expect(PLATFORM_V7_EXECUTION_SOURCE.readiness.fgis.status).not.toBe('готово');
    expect(PLATFORM_V7_EXECUTION_SOURCE.readiness.quality.status).not.toBe('готово');
    expect(canRequestStrictMoneyRelease()).toBe(false);
  });

  it('exposes every settlement-blocking contour as a blocker', () => {
    const blockers = strictMoneyReleaseBlockers().join(' ').toLowerCase();

    expect(blockers).toContain('фгис');
    expect(blockers).toContain('лаборатор');
    expect(blockers).toContain('слот');
    expect(blockers).toContain('сдиз');
    // The bank/settlement contour surfaces as the money-reserve blocker.
    expect(blockers).toContain('резерв денег');
    expect(blockers).toContain('суммы');
  });

  it('keeps strict settlement gate tied to FGIS and quality readiness in source code', () => {
    const source = fs.readFileSync(path.join(process.cwd(), 'lib/platform-v7/deal-money-release-gate.ts'), 'utf8');

    expect(source).toContain("readiness.fgis.status === 'готово'");
    expect(source).toContain("readiness.quality.status === 'готово'");
    expect(source).toContain("readiness.bank.status === 'готово'");
    expect(source).toContain('money.releaseCandidateRub > 0');
  });
});
