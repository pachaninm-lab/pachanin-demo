import {
  toKopecks,
  fromKopecks,
  formatRub,
  splitKopecks,
  isWholeKopecks,
  assertMoneyInvariants,
  type MoneyKopecksSnapshot,
} from './money';

describe('money — toKopecks / fromKopecks (rounding rules)', () => {
  it('converts whole and 2-decimal roubles half-up', () => {
    expect(toKopecks(0)).toBe(0);
    expect(toKopecks(1)).toBe(100);
    expect(toKopecks(1.5)).toBe(150);
    expect(toKopecks(1234.56)).toBe(123456);
    expect(toKopecks(-1.5)).toBe(-150);
    expect(toKopecks(1.004)).toBe(100);
    expect(toKopecks(1.006)).toBe(101);
  });

  it('round-trips kopecks → roubles → kopecks', () => {
    for (const k of [0, 5, 100, 150, 123456, -150]) {
      expect(toKopecks(fromKopecks(k))).toBe(k);
    }
  });

  it('throws on non-finite input', () => {
    expect(() => toKopecks(NaN)).toThrow(/finite/);
    expect(() => toKopecks(Infinity)).toThrow(/finite/);
    expect(() => fromKopecks(NaN as any)).toThrow(/finite/);
  });
});

describe('money — formatRub', () => {
  it('formats kopecks as a Russian rouble string', () => {
    expect(formatRub(123456)).toBe('1 234,56 ₽');
    expect(formatRub(100)).toBe('1,00 ₽');
    expect(formatRub(5)).toBe('0,05 ₽');
    expect(formatRub(0)).toBe('0,00 ₽');
    expect(formatRub(-150)).toBe('-1,50 ₽');
    expect(formatRub(1000000000)).toBe('10 000 000,00 ₽');
  });
});

describe('money — splitKopecks (conserving)', () => {
  it('always conserves the total', () => {
    for (const [total, ratio] of [[101, 0.5], [100, 0.5], [333, 0.5], [777, 0.3]] as const) {
      const [a, b] = splitKopecks(total, ratio);
      expect(a + b).toBe(total);
    }
  });

  it('matches the dispute SPLIT rule (a = round(total*ratio))', () => {
    expect(splitKopecks(101, 0.5)).toEqual([51, 50]);
    expect(splitKopecks(100, 0.5)).toEqual([50, 50]);
  });

  it('throws on non-integer total', () => {
    expect(() => splitKopecks(100.5, 0.5)).toThrow(/integer kopecks/);
  });
});

describe('money — isWholeKopecks', () => {
  it('accepts safe integers only', () => {
    expect(isWholeKopecks(0)).toBe(true);
    expect(isWholeKopecks(123456)).toBe(true);
    expect(isWholeKopecks(-150)).toBe(true);
    expect(isWholeKopecks(1.5)).toBe(false);
    expect(isWholeKopecks(Number.MAX_SAFE_INTEGER + 2)).toBe(false);
  });
});

describe('money — assertMoneyInvariants', () => {
  function snap(overrides: Partial<MoneyKopecksSnapshot> = {}): MoneyKopecksSnapshot {
    return { totalKopecks: 100000, releasedKopecks: 0, disputedKopecks: 0, heldKopecks: 0, ...overrides };
  }

  it('passes for a valid snapshot', () => {
    expect(() => assertMoneyInvariants(snap({ releasedKopecks: 80000, disputedKopecks: 20000 }))).not.toThrow();
    expect(() => assertMoneyInvariants(snap({ releasedKopecks: 100000 }))).not.toThrow();
  });

  it('rejects negative release', () => {
    expect(() => assertMoneyInvariants(snap({ releasedKopecks: -1 }))).toThrow(/negative/);
  });

  it('rejects release exceeding available (over-release)', () => {
    expect(() =>
      assertMoneyInvariants(snap({ releasedKopecks: 90000, disputedKopecks: 20000 })),
    ).toThrow(/exceeds available/);
  });

  it('rejects when disputed + held + released exceed total', () => {
    expect(() =>
      assertMoneyInvariants(snap({ releasedKopecks: 50000, disputedKopecks: 30000, heldKopecks: 30000 })),
    ).toThrow(/exceed total|exceeds available/);
  });

  it('rejects non-integer (float) money fields', () => {
    expect(() => assertMoneyInvariants(snap({ releasedKopecks: 100.5 }))).toThrow(/integer kopecks/);
  });
});
