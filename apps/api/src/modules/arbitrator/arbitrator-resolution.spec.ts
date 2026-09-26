import 'reflect-metadata';
import { BadRequestException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { ArbitratorService } from './arbitrator.service';
import { ResolveDisputeDto } from './dto/resolve-dispute.dto';
import { ArbitratorNoteDto } from './dto/arbitrator-note.dto';
import { RequestUser, Role } from '../../common/types/request-user';

const HOLD_KOPECKS = 1_000_000;
const user = { id: 'arb-1', role: Role.ARBITRATOR, organizationId: 'org-x' } as unknown as RequestUser;

type LedgerCall = { fn: 'refundFromDispute' | 'release'; amount: bigint };

function build() {
  const ledgerCalls: LedgerCall[] = [];
  const updates: Array<Record<string, unknown>> = [];
  const dispute = {
    id: 'd-1',
    status: 'IN_REVIEW',
    arbitratorId: 'arb-1',
    dealId: 'deal-1',
    initiatorOrgId: 'org-buyer',
    respondentOrgId: 'org-seller',
    moneyHold: { amountKopecks: HOLD_KOPECKS },
  };
  const prisma = {
    dispute: {
      findUnique: async () => dispute,
      update: async (args: { data: Record<string, unknown> }) => {
        updates.push(args.data);
        return { ...dispute, status: 'RESOLVED' };
      },
    },
  };
  const ledger = {
    // refundFromDispute(dealId, disputeId, orgId, amount)
    refundFromDispute: async (_d: string, _i: string, _o: string, amount: bigint) => {
      ledgerCalls.push({ fn: 'refundFromDispute', amount });
    },
    // release(dealId, orgId, amount, fee, reference)
    release: async (_d: string, _o: string, amount: bigint) => {
      ledgerCalls.push({ fn: 'release', amount });
    },
  };
  const service = new ArbitratorService(
    prisma as never,
    {} as never,
    { log: async () => undefined } as never,
    ledger as never,
  );
  return { service, ledgerCalls, updates };
}

function dtoErrors(body: unknown): string[] {
  const instance = plainToInstance(ResolveDisputeDto, body);
  return validateSync(instance).flatMap((error) => Object.values(error.constraints ?? {}));
}

async function refuses(body: unknown): Promise<{ message: string; moved: LedgerCall[] }> {
  const { service, ledgerCalls } = build();
  try {
    await service.resolve('d-1', body as never, user);
  } catch (error) {
    if (!(error instanceof BadRequestException)) throw error;
    const response = error.getResponse() as { message?: string } | string;
    return {
      message: typeof response === 'string' ? response : String(response.message ?? ''),
      moved: ledgerCalls,
    };
  }
  throw new Error(`Ожидался отказ, но resolve прошёл: ${JSON.stringify(body)}`);
}

describe('Раздел удержания в споре: замеренные дефекты', () => {
  // Каждый вход ниже замерен на живом сервисе ДО исправления. В комментарии —
  // что он делал с удержанием в 1 000 000 копеек.

  it('доля 200 возвращала покупателю 2 000 000 — вдвое больше удержания', async () => {
    const { message, moved } = await refuses({ outcome: 'SPLIT', splitPct: 200, reason: 'x' });
    expect(message).toContain('от 0 до 100');
    expect(moved).toEqual([]);
    expect(dtoErrors({ outcome: 'SPLIT', splitPct: 200, reason: 'x' })).not.toHaveLength(0);
  });

  it('доля -50 выплачивала продавцу 1 499 999 — полтора удержания', async () => {
    const { moved } = await refuses({ outcome: 'SPLIT', splitPct: -50, reason: 'x' });
    expect(moved).toEqual([]);
    expect(dtoErrors({ outcome: 'SPLIT', splitPct: -50, reason: 'x' })).not.toHaveLength(0);
  });

  it('доля NaN давала RangeError из BigInt, то есть 500 на пользовательском вводе', async () => {
    const { moved } = await refuses({ outcome: 'SPLIT', splitPct: Number.NaN, reason: 'x' });
    expect(moved).toEqual([]);
    expect(dtoErrors({ outcome: 'SPLIT', splitPct: Number.NaN, reason: 'x' })).not.toHaveLength(0);
  });

  it('доля Infinity давала тот же RangeError', async () => {
    const { moved } = await refuses({ outcome: 'SPLIT', splitPct: Number.POSITIVE_INFINITY, reason: 'x' });
    expect(moved).toEqual([]);
  });

  it('доля 1e30 возвращала 10^34 копеек', async () => {
    const { moved } = await refuses({ outcome: 'SPLIT', splitPct: 1e30, reason: 'x' });
    expect(moved).toEqual([]);
  });

  it('строка "50" проходила расчёт молча — @Type(() => Number) здесь нет намеренно', async () => {
    const { moved } = await refuses({ outcome: 'SPLIT', splitPct: '50', reason: 'x' });
    expect(moved).toEqual([]);
    expect(dtoErrors({ outcome: 'SPLIT', splitPct: '50', reason: 'x' })).not.toHaveLength(0);
  });

  it('дробная доля усекалась молча, а не отклонялась', async () => {
    const { moved } = await refuses({ outcome: 'SPLIT', splitPct: 33.7, reason: 'x' });
    expect(moved).toEqual([]);
  });

  it('SPLIT без доли помечал спор RESOLVED, не двигая денег — удержание оставалось запертым', async () => {
    const { message, moved } = await refuses({ outcome: 'SPLIT', reason: 'x' });
    expect(message).toContain('Раздел требует');
    expect(moved).toEqual([]);
  });

  it('произвольный исход записывался в БД и оставлял удержание запертым', async () => {
    const { moved } = await refuses({ outcome: 'ПОБЕДИЛ_КТО_ТО', reason: 'x' });
    expect(moved).toEqual([]);
    expect(dtoErrors({ outcome: 'ПОБЕДИЛ_КТО_ТО', reason: 'x' })).not.toHaveLength(0);
  });

  it('отсутствующий исход делал то же самое', async () => {
    const { moved } = await refuses({ reason: 'x' });
    expect(moved).toEqual([]);
  });

  it('основание-объект превращалось в аудите в «[object Object]»', async () => {
    const { message } = await refuses({ outcome: 'BUYER_WINS', reason: { $ne: null } });
    expect(message).toContain('непустой строкой');
  });

  it('доля вне раздела писалась в БД и противоречила самой выплате', async () => {
    const { message, moved } = await refuses({ outcome: 'BUYER_WINS', splitPct: 40, reason: 'x' });
    expect(message).toContain('только при исходе SPLIT');
    expect(moved).toEqual([]);
  });
});

describe('Раздел удержания в споре: обратная сторона', () => {
  it('нормальный раздел 50/50 делит удержание ровно и записывает долю', async () => {
    const { service, ledgerCalls, updates } = build();
    await service.resolve('d-1', { outcome: 'SPLIT', splitPct: 50, reason: 'по существу' } as never, user);
    expect(ledgerCalls).toEqual([
      { fn: 'refundFromDispute', amount: 500_000n },
      { fn: 'release', amount: 500_000n },
    ]);
    expect(updates[0]).toMatchObject({ outcome: 'SPLIT', outcomeSplitPct: 50 });
  });

  it('границы 0 и 100 — законные доли, а не ошибки', async () => {
    const zero = build();
    await zero.service.resolve('d-1', { outcome: 'SPLIT', splitPct: 0, reason: 'x' } as never, user);
    expect(zero.ledgerCalls).toEqual([{ fn: 'release', amount: 1_000_000n }]);

    const full = build();
    await full.service.resolve('d-1', { outcome: 'SPLIT', splitPct: 100, reason: 'x' } as never, user);
    expect(full.ledgerCalls).toEqual([{ fn: 'refundFromDispute', amount: 1_000_000n }]);
  });

  it('три остальных исхода проходят и двигают удержание целиком либо не двигают вовсе', async () => {
    const buyer = build();
    await buyer.service.resolve('d-1', { outcome: 'BUYER_WINS', reason: 'x' } as never, user);
    expect(buyer.ledgerCalls).toEqual([{ fn: 'refundFromDispute', amount: 1_000_000n }]);

    const seller = build();
    await seller.service.resolve('d-1', { outcome: 'SELLER_WINS', reason: 'x' } as never, user);
    expect(seller.ledgerCalls).toEqual([{ fn: 'release', amount: 1_000_000n }]);

    const cancelled = build();
    await cancelled.service.resolve('d-1', { outcome: 'CANCELLED', reason: 'x' } as never, user);
    expect(cancelled.ledgerCalls).toEqual([]);
    expect(cancelled.updates[0]).toMatchObject({ outcome: 'CANCELLED', outcomeSplitPct: null });
  });

  it('доля больше не пишется в БД при исходах, где её нет', async () => {
    const { service, updates } = build();
    await service.resolve('d-1', { outcome: 'SELLER_WINS', reason: 'x' } as never, user);
    expect(updates[0]).toMatchObject({ outcomeSplitPct: null });
  });
});

describe('Заметка арбитра', () => {
  it('нестроковая и пустая заметка отклоняются границей', () => {
    const bad = [{ note: { $ne: null } }, { note: 123 }, { note: '' }, {}];
    for (const body of bad) {
      const errors = validateSync(plainToInstance(ArbitratorNoteDto, body));
      expect(errors.length).toBeGreaterThan(0);
    }
  });

  it('настоящая заметка проходит', () => {
    expect(validateSync(plainToInstance(ArbitratorNoteDto, { note: 'Осмотр партии подтверждён' }))).toHaveLength(0);
  });
});
