import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const source = fs.readFileSync(path.join(process.cwd(), 'apps/web/app/platform-v7/control-tower/page.tsx'), 'utf8');
const selectorsSource = fs.readFileSync(path.join(process.cwd(), 'apps/web/lib/domain/selectors.ts'), 'utf8');

describe('platform-v7 control tower money guard', () => {
  it('keeps control tower money queue tied to the domain release guard', () => {
    expect(source).toContain('evaluateReleaseGuard');
    expect(source).toContain('primaryMoneyStopReason');
    expect(source).toContain('releaseCheck.blockers');
    expect(source).toContain('releaseStopped');
    expect(source).toContain('/platform-v7/bank/release-safety');
  });

  it('does not use the old ready-to-release selector in control tower KPI logic', () => {
    expect(source).not.toContain('selectReadyToReleaseTotal');
    expect(source).not.toContain("status === 'docs_complete'");
    expect(source).not.toContain("status === 'release_requested'");
  });

  it('keeps the old selector visibly isolated from control tower runtime', () => {
    expect(selectorsSource).toContain('selectReadyToReleaseTotal');
    expect(selectorsSource).toContain("deal.status === 'release_requested' || deal.status === 'docs_complete'");
    expect(source).not.toContain('selectReadyToReleaseTotal');
  });

  it('frames operator money status as blocked/review, not autonomous movement', () => {
    expect(source).toContain('Деньги остановлены');
    expect(source).toContain('Остановлено блокерами');
    expect(source).toContain('Проверить деньги');
    expect(source).toContain('банковскую проверку');
    expect(source).not.toContain('платформа гарантирует оплату');
    expect(source).not.toContain('деньги автоматически выпускаются');
  });
});
