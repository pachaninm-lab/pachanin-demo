import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const source = fs.readFileSync(path.join(process.cwd(), 'app/platform-v7/bank/release-safety/page.tsx'), 'utf8');

describe('platform-v7 bank release-safety guard', () => {
  it('keeps bank release-safety wired to the domain release guard', () => {
    expect(source).toContain('evaluateReleaseGuard');
    expect(source).toContain('ReleaseGuardBlocker');
    expect(source).toContain('check.canRequestRelease');
    expect(source).toContain('check.canExecuteRelease');
    expect(source).toContain('check.blockers');
  });

  it('keeps the full settlement blocker matrix visible on the page', () => {
    const required = [
      'NO_RESERVED_MONEY',
      'NO_RELEASE_AMOUNT',
      'HOLD_AMOUNT_ACTIVE',
      'OPEN_DISPUTE',
      'DOCUMENTS_NOT_READY',
      'FGIS_NOT_READY',
      'TRANSPORT_NOT_READY',
      'ACCEPTANCE_NOT_CONFIRMED',
      'QUALITY_NOT_APPROVED',
      'MANUAL_BLOCKER',
      'DEAL_NOT_READY',
    ];

    for (const term of required) {
      expect(source, `${term} must stay mapped`).toContain(term);
    }
  });

  it('does not frame the page as an autonomous payment mechanism', () => {
    expect(source).toContain('Это контрольный экран, а не платёжный механизм');
    expect(source).toContain('Можно подготовить запрос в банк, но это ещё не движение денег');
    expect(source).toContain('Запрос к банку допустим только после закрытия условий');
    expect(source).not.toContain('платформа гарантирует оплату');
    expect(source).not.toContain('деньги автоматически выпускаются');
    expect(source).not.toContain('банк подключён');
  });
});
