import { BadRequestException } from '@nestjs/common';
import { LedgerV2Service, SYSTEM_ACCOUNTS } from './ledger-v2.service';

/**
 * `verifyDealBalance` вычисляла обе стороны БУКВАЛЬНО одним выражением и
 * возвращала их равенство, то есть `balanced` было тождественно true. Эти
 * тесты фиксируют, что теперь метод проверяет то, что в строках действительно
 * может быть нарушено, и что запись отвергает самоперевод.
 */
type Row = {
  id: string;
  debitAccount: string;
  creditAccount: string;
  amountKopecks: bigint;
};

function serviceWithRows(rows: Row[]): LedgerV2Service {
  const prisma = {
    ledgerEntry: {
      findMany: async () => rows,
      create: async () => {
        throw new Error('create не должен вызываться в этих тестах');
      },
      findUnique: async () => null,
    },
    $queryRaw: async () => [{ credit: 0n, debit: 0n }],
  };
  return new LedgerV2Service(prisma as never);
}

const row = (over: Partial<Row> = {}): Row => ({
  id: 'r1',
  debitAccount: SYSTEM_ACCOUNTS.ESCROW,
  creditAccount: 'org-777',
  amountKopecks: 50_000n,
  ...over,
});

describe('LedgerV2: проверка книги сделки', () => {
  it('на исправных строках нарушений нет', async () => {
    const result = await serviceWithRows([row(), row({ id: 'r2', amountKopecks: 25_000n })])
      .verifyDealBalance('d1');
    expect(result.violations).toEqual([]);
    expect(result.balanced).toBe(true);
    expect(result.totalKopecks).toBe(75_000n);
  });

  it('самоперевод виден как нарушение, а не как сошедшийся баланс', async () => {
    const result = await serviceWithRows([
      row({ id: 'bad', debitAccount: 'org-777', creditAccount: 'org-777' }),
    ]).verifyDealBalance('d1');
    expect(result.balanced).toBe(false);
    expect(result.violations).toEqual(['bad: самоперевод по счёту org-777']);
  });

  it('непозитивная сумма видна как нарушение', async () => {
    const result = await serviceWithRows([row({ id: 'zero', amountKopecks: 0n })])
      .verifyDealBalance('d1');
    expect(result.balanced).toBe(false);
    expect(result.violations).toEqual(['zero: непозитивная сумма 0']);
  });

  it('пустой счёт стороны виден как нарушение', async () => {
    const result = await serviceWithRows([row({ id: 'empty', creditAccount: '' })])
      .verifyDealBalance('d1');
    expect(result.balanced).toBe(false);
    expect(result.violations).toEqual(['empty: пустой счёт одной из сторон']);
  });

  it('прежняя формула объявила бы все эти книги сошедшимися', async () => {
    // Замер прежнего поведения: totalDebit и totalCredit — одна и та же
    // редукция, поэтому их равенство выполняется на любых строках.
    const broken = [
      row({ id: 'bad', debitAccount: 'org-777', creditAccount: 'org-777' }),
      row({ id: 'zero', amountKopecks: 0n }),
      row({ id: 'empty', creditAccount: '' }),
    ];
    const totalDebit = broken.reduce((s, e) => s + BigInt(e.amountKopecks), 0n);
    const totalCredit = broken.reduce((s, e) => s + BigInt(e.amountKopecks), 0n);
    expect(totalDebit === totalCredit).toBe(true);

    const result = await serviceWithRows(broken).verifyDealBalance('d1');
    expect(result.balanced).toBe(false);
    expect(result.violations).toHaveLength(3);
  });
});

describe('LedgerV2: запись отвергает вырожденную проводку', () => {
  const params = {
    dealId: 'd1',
    entryType: 'TRANSFER' as never,
    debitAccount: SYSTEM_ACCOUNTS.ESCROW,
    creditAccount: 'org-777',
    amountKopecks: 1_000n,
    idempotencyKey: 'k1',
  };

  it('самоперевод отвергается до обращения к базе', async () => {
    const service = serviceWithRows([]);
    await expect(service.record({ ...params, creditAccount: SYSTEM_ACCOUNTS.ESCROW }))
      .rejects.toThrow(BadRequestException);
    await expect(service.record({ ...params, creditAccount: SYSTEM_ACCOUNTS.ESCROW }))
      .rejects.toThrow('must differ');
  });

  it('пустой счёт отвергается до обращения к базе', async () => {
    const service = serviceWithRows([]);
    await expect(service.record({ ...params, creditAccount: '' }))
      .rejects.toThrow('are required');
  });

  it('непозитивная сумма по-прежнему отвергается', async () => {
    const service = serviceWithRows([]);
    await expect(service.record({ ...params, amountKopecks: 0n }))
      .rejects.toThrow('Amount must be positive');
  });
});
