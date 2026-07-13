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

describe('BankReleaseSafetyPage', () => {
  const page = read('apps/web/app/platform-v7/bank/release-safety/page.tsx');

  it('presents payout readiness as a verification flow, not a payment mechanism', () => {
    expect(page).toContain('Проверка выплаты не является кнопкой выпуска денег');
    expect(page).toContain('Payout readiness is not a release button');
    expect(page).toContain('付款就绪检查不是放款按钮');
    expect(page).toContain('MoneyObligationCockpit');
  });

  it('keeps the bank request gated by Deal evidence and server state', () => {
    expect(page).toContain('Backend проверяет резерв, сумму, удержания, спор, документы');
    expect(page).toContain('ФГИС/СДИЗ');
    expect(page).toContain('полный evidence pack');
    expect(page).toContain('<CanonicalDealsList />');
  });

  it('distinguishes a request from bank-confirmed money movement', () => {
    expect(page).toContain('release request → callback → reconciliation → audit');
    expect(page).toContain('создаёт outbox-запись, но не меняет деньги на RELEASED');
    expect(page).toContain('verified bank callback');
    expect(page).toContain('manual review');
  });

  it('does not expose fixture money or manual confirmation controls', () => {
    expect(page).not.toContain('canonicalDomainDeals');
    expect(page).not.toContain('evaluateReleaseGuard');
    expect(page).not.toContain('DL-9106');
    expect(page).not.toContain('confirmWorksheet');
    expect(page).not.toContain('releasePayment');
  });
});
