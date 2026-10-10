import { AppendOnlyLedger, LEDGER_ACCOUNTS } from './double-entry-ledger';

/**
 * Прежний инвариант начинался с `total === debitTotal`, где обе величины
 * вычислялись одним и тем же выражением. Эти тесты закрывают то, что он
 * пропускал, и фиксируют, что оставшаяся проверка действительно может упасть.
 */
describe('AppendOnlyLedger: инвариант двойной записи', () => {
  const entry = (overrides: Record<string, unknown> = {}) => ({
    id: 'e1',
    dealId: 'd1',
    actorId: 'a1',
    entryType: 'TRANSFER' as const,
    debitAccount: 'BUYER_ESCROW' as never,
    creditAccount: 'PLATFORM_RESERVE' as never,
    amountKopecks: 50_000,
    currencyCode: 'RUB' as const,
    ...overrides,
  });

  it('счёт вне известного набора отвергается на входе', () => {
    const ledger = new AppendOnlyLedger();
    expect(() => ledger.append(entry({ creditAccount: 'TYPO_ACCOUNT' as never })))
      .toThrow('creditAccount is not a known ledger account: TYPO_ACCOUNT');
    expect(() => ledger.append(entry({ debitAccount: 'TYPO_ACCOUNT' as never })))
      .toThrow('debitAccount is not a known ledger account: TYPO_ACCOUNT');
    expect(ledger.length).toBe(0);
  });

  it('раньше такая проводка принималась и портила балансы молча', () => {
    // Замерено на прежнем коде: книга с одной проводкой
    // BUYER_ESCROW → TYPO_ACCOUNT на 50 000 копеек показывала
    // BUYER_ESCROW −50 000 при нулях по остальным счетам, потому что
    // getBalances() не перечисляет неизвестный счёт. Теперь до балансов дело
    // не доходит.
    const ledger = new AppendOnlyLedger();
    expect(() => ledger.append(entry({ creditAccount: 'TYPO_ACCOUNT' as never }))).toThrow();
    expect(ledger.getBalances().every((b) => b.balanceKopecks === 0)).toBe(true);
    expect(ledger.verifyDoubleEntryInvariant()).toBe(true);
  });

  it('инвариант держится на нормальной книге', () => {
    const ledger = new AppendOnlyLedger();
    ledger.reserve({ id: 'e1', dealId: 'd1', amountKopecks: 200_000, actorId: 'a1' });
    ledger.release({ id: 'e2', dealId: 'd1', amountKopecks: 200_000, actorId: 'a1', commissionKopecks: 5_000 });
    expect(ledger.verifyDoubleEntryInvariant()).toBe(true);
    expect(ledger.getBalances().reduce((s, b) => s + b.balanceKopecks, 0)).toBe(0);
  });

  it('инвариант падает, если getBalances перечисляет не все счета', () => {
    // Это и есть та единственная величина, которая может разойтись. Проверяем
    // её напрямую: сторож обязан уметь вернуть false, иначе он декоративен.
    const ledger = new AppendOnlyLedger();
    ledger.reserve({ id: 'e1', dealId: 'd1', amountKopecks: 200_000, actorId: 'a1' });
    const crippled = ledger as unknown as { getBalances(): Array<{ balanceKopecks: number }> };
    const original = crippled.getBalances.bind(crippled);
    crippled.getBalances = () => original().slice(0, 1);
    expect(ledger.verifyDoubleEntryInvariant()).toBe(false);
    crippled.getBalances = original;
    expect(ledger.verifyDoubleEntryInvariant()).toBe(true);
  });

  it('список счетов — один источник правды для типа и для балансов', () => {
    const ledger = new AppendOnlyLedger();
    expect(ledger.getBalances().map((b) => b.account)).toEqual([...LEDGER_ACCOUNTS]);
  });
});
