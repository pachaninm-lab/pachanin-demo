import 'reflect-metadata';
import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { ArbitratorService } from './arbitrator.service';
import { ResolveDisputeDto } from './dto/arbitrator.dto';
import {
  DISPUTE_OUTCOMES,
  SPLIT_PCT_MAX,
  SPLIT_PCT_MIN,
  isDisputeOutcome,
  isUsableSplitPct,
  splitHold,
} from './arbitrator.contract';
import { RequestUser, Role } from '../../common/types/request-user';

const HOLD = 100_000; // 1000 ₽ в копейках

/**
 * Замерено на настоящем `resolve()` ДО правки, при холде 100 000 копеек:
 *
 *   splitPct 50      → выплачено 100 000        норма
 *   splitPct 500     → выплачено 500 000        пятикратно холду
 *   splitPct -100    → выплачено 199 999        двукратно, всё продавцу
 *   splitPct 10 000  → выплачено 10 000 000     стократно
 *   splitPct NaN     → RangeError на BigInt     500 на вводе арбитра
 *   splitPct 50.7    → выплачено 100 000        доля молча усечена до 50
 *   splitPct нет     → выплачено 0, статус RESOLVED — холд заперт навсегда,
 *                      потому что повторное разрешение запрещено
 */

function build() {
  const paid: { who: string; amount: bigint }[] = [];
  const dispute = {
    id: 'D-1', status: 'OPEN', arbitratorId: 'arb-1', dealId: 'DEAL-1',
    initiatorOrgId: 'ORG-BUYER', respondentOrgId: 'ORG-SELLER',
    moneyHold: { amountKopecks: HOLD },
  };
  const prisma = {
    dispute: {
      findUnique: async () => dispute,
      update: async ({ data }: { data: Record<string, unknown> }) => ({ ...dispute, ...data }),
    },
  };
  const ledger = {
    refundFromDispute: async (_d: string, _i: string, _o: string, amount: bigint) => {
      paid.push({ who: 'buyer', amount });
    },
    release: async (_d: string, _o: string, amount: bigint) => {
      paid.push({ who: 'seller', amount });
    },
  };
  const svc = new ArbitratorService(
    prisma as never, {} as never, { log: async () => undefined } as never, ledger as never,
  );
  return { svc, paid };
}

const user = { id: 'arb-1', role: Role.ARBITRATOR, tenantId: 't1' } as unknown as RequestUser;
const pipe = new ValidationPipe({ whitelist: true, forbidNonWhitelisted: false, transform: true });
const meta = { type: 'body' as const, metatype: ResolveDisputeDto };

describe('ResolveDisputeDto — граница', () => {
  it('пропускает настоящее решение', async () => {
    await expect(
      pipe.transform({ outcome: 'SPLIT', splitPct: 50, reason: 'пополам' }, meta),
    ).resolves.toMatchObject({ outcome: 'SPLIT', splitPct: 50 });
  });

  it.each([
    ['выше ста', 500],
    ['минус', -100],
    ['стократно', 10_000],
    ['NaN', Number.NaN],
    ['Infinity', Number.POSITIVE_INFINITY],
    ['дробь', 50.7],
    ['строка', '50'],
  ])('отвергает долю: %s', async (_l, splitPct) => {
    await expect(
      pipe.transform({ outcome: 'SPLIT', splitPct, reason: 'r' }, meta),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('принимает ровно границы диапазона', async () => {
    for (const splitPct of [SPLIT_PCT_MIN, SPLIT_PCT_MAX]) {
      await expect(
        pipe.transform({ outcome: 'SPLIT', splitPct, reason: 'r' }, meta),
      ).resolves.toMatchObject({ splitPct });
    }
  });

  it('отвергает неизвестный исход и пустую причину', async () => {
    await expect(pipe.transform({ outcome: 'НЕЧТО', reason: 'r' }, meta)).rejects.toBeInstanceOf(BadRequestException);
    await expect(pipe.transform({ outcome: 'CANCELLED', reason: '' }, meta)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('принимает каждый настоящий исход', async () => {
    for (const outcome of DISPUTE_OUTCOMES) {
      const body: Record<string, unknown> = { outcome, reason: 'r' };
      if (outcome === 'SPLIT') body.splitPct = 40;
      await expect(pipe.transform(body, meta)).resolves.toMatchObject({ outcome });
    }
  });
});

describe('ArbitratorService.resolve — отказ без границы', () => {
  it.each([
    ['выше ста', 500],
    ['минус', -100],
    ['стократно', 10_000],
    ['NaN', Number.NaN],
    ['Infinity', Number.POSITIVE_INFINITY],
    ['дробь', 50.7],
    ['доли нет вовсе', undefined],
  ])('SPLIT отвергается в обход границы: %s', async (_l, splitPct) => {
    const { svc, paid } = build();
    await expect(
      svc.resolve('D-1', { outcome: 'SPLIT' as never, splitPct: splitPct as number, reason: 'r' }, user),
    ).rejects.toBeInstanceOf(BadRequestException);
    // Ничего не выплачено и спор НЕ помечен разрешённым.
    expect(paid).toHaveLength(0);
  });

  it('настоящий SPLIT выплачивает ровно холд, не больше и не меньше', async () => {
    const { svc, paid } = build();
    await svc.resolve('D-1', { outcome: 'SPLIT' as never, splitPct: 50, reason: 'r' }, user);
    const total = paid.reduce((n, p) => n + p.amount, 0n);
    expect(total).toBe(BigInt(HOLD));
  });

  it('остальные исходы по-прежнему работают без доли', async () => {
    for (const outcome of ['BUYER_WINS', 'SELLER_WINS'] as const) {
      const { svc, paid } = build();
      await svc.resolve('D-1', { outcome: outcome as never, reason: 'r' }, user);
      expect(paid.reduce((n, p) => n + p.amount, 0n)).toBe(BigInt(HOLD));
    }
  });
});

describe('splitHold — сумма долей тождественно равна холду', () => {
  it('на всём диапазоне 0..100 и на разных холдах', () => {
    for (const hold of [0n, 1n, 3n, 99n, 100n, 100_000n, 999_999_999n]) {
      for (let pct = SPLIT_PCT_MIN; pct <= SPLIT_PCT_MAX; pct += 1) {
        const { buyerShare, sellerShare } = splitHold(hold, pct);
        expect(buyerShare + sellerShare).toBe(hold);
        expect(buyerShare).toBeGreaterThanOrEqual(0n);
        expect(sellerShare).toBeGreaterThanOrEqual(0n);
      }
    }
  });

  it('отказывает сама, а не полагается на вызывающего', () => {
    for (const bad of [500, -1, 101, Number.NaN, Number.POSITIVE_INFINITY, 50.7, '50']) {
      expect(() => splitHold(100n, bad as number)).toThrow(RangeError);
    }
    expect(() => splitHold(-1n, 50)).toThrow(RangeError);
  });

  it('округление половины вверх сохранено', () => {
    // 3 копейки пополам: покупателю 2, продавцу 1 — сумма сходится.
    expect(splitHold(3n, 50)).toEqual({ buyerShare: 2n, sellerShare: 1n });
  });
});

describe('arbitrator.contract — сторожа', () => {
  it('isUsableSplitPct отвергает нецелое, вне диапазона и нечисла', () => {
    for (const bad of [null, undefined, '50', Number.NaN, Number.POSITIVE_INFINITY, -1, 101, 50.7, {}, []]) {
      expect(isUsableSplitPct(bad)).toBe(false);
    }
    for (const good of [0, 1, 50, 99, 100]) expect(isUsableSplitPct(good)).toBe(true);
  });

  it('isDisputeOutcome не пропускает члена прототипа', () => {
    for (const bad of ['toString', 'constructor', '__proto__', 'valueOf', 'hasOwnProperty']) {
      expect(isDisputeOutcome(bad)).toBe(false);
    }
    for (const good of DISPUTE_OUTCOMES) expect(isDisputeOutcome(good)).toBe(true);
  });

  it('список исходов заморожен', () => {
    expect(Object.isFrozen(DISPUTE_OUTCOMES)).toBe(true);
  });
});
