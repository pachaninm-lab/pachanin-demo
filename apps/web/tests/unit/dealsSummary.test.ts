import { describe, it, expect } from 'vitest';
import {
  summarizeDeals,
  formatRubFromKopecks,
  dealsSummaryLine,
  focusDeal,
  dealStatusStage,
} from '@/lib/platform-v7/deals-summary';

describe('deals-summary live aggregates', () => {
  it('пустой/некорректный вход даёт нули', () => {
    for (const input of [undefined, null, {}, 'x', []]) {
      const s = summarizeDeals(input);
      expect(s).toEqual({
        count: 0,
        active: 0,
        closed: 0,
        reservedKopecks: 0,
        releasedKopecks: 0,
        totalKopecks: 0,
        inTransit: 0,
      });
    }
  });

  it('считает резерв/выплату из последнего платежа и bigint-строк', () => {
    const deals = [
      { status: 'RESERVED', totalKopecks: '964800000', payments: [{ status: 'RESERVED', amountKopecks: '964800000' }], shipments: [{ status: 'IN_TRANSIT' }] },
      { status: 'CLOSED', totalKopecks: '500000000', payments: [{ status: 'RELEASED', amountKopecks: '500000000' }], shipments: [{ status: 'DELIVERED' }] },
      { status: 'DRAFT', totalKopecks: 0, payments: [], shipments: [] },
    ];
    const s = summarizeDeals(deals);
    expect(s.count).toBe(3);
    expect(s.closed).toBe(1);
    expect(s.active).toBe(2);
    expect(s.reservedKopecks).toBe(964_800_000);
    expect(s.releasedKopecks).toBe(500_000_000);
    expect(s.totalKopecks).toBe(1_464_800_000);
    expect(s.inTransit).toBe(1);
  });

  it('формат рублей компактный', () => {
    expect(formatRubFromKopecks(964_800_000)).toBe('9.65 млн ₽');
    expect(formatRubFromKopecks(62_400_000)).toBe('624 тыс. ₽');
    expect(formatRubFromKopecks(0)).toBe('0 ₽');
  });

  it('focusDeal берёт свежую незакрытую сделку и её этап', () => {
    expect(focusDeal([])).toBeNull();
    expect(focusDeal(undefined)).toBeNull();
    const f = focusDeal([
      { id: 'd1', status: 'RESERVED', culture: 'WHEAT', totalKopecks: '964800000', payments: [{ status: 'RESERVED', amountKopecks: '964800000' }] },
      { id: 'd0', status: 'CLOSED', totalKopecks: '1', payments: [] },
    ]);
    expect(f?.id).toBe('d1');
    expect(f?.stage).toBe('Логистика');
    expect(f?.reservedKopecks).toBe(964_800_000);
    // все закрыты → берём первую
    expect(focusDeal([{ id: 'x', status: 'CLOSED', totalKopecks: '5' }])?.id).toBe('x');
  });

  it('dealStatusStage покрывает весь конвейер', () => {
    expect(dealStatusStage('DRAFT').stage).toBe('Допуск');
    expect(dealStatusStage('RESERVE_REQUESTED').next).toContain('банк');
    expect(dealStatusStage('CLOSED').stage).toBe('Закрыто');
    expect(dealStatusStage('UNKNOWN_X').stage).toBe('—');
  });

  it('строка сводки собирается из живых чисел', () => {
    const line = dealsSummaryLine(summarizeDeals([
      { status: 'RESERVED', totalKopecks: '964800000', payments: [{ status: 'RESERVED', amountKopecks: '964800000' }] },
    ]));
    expect(line).toContain('1 сделок');
    expect(line).toContain('резерв 9.65 млн ₽');
  });
});
