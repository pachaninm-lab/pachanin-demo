import { InternalServerErrorException } from '@nestjs/common';
import { ExportsService, tallyVolumeByCulture } from './exports.service';

type Deal = { culture?: string | null; volumeTons?: number | null; status: string; totalRub?: number };

// buildRosstatCsv приватный и синхронный: (deals, from, to). Зовём его напрямую —
// это тот самый путь, которым отчёт и собирается, без обхода через prisma.
function buildReport(deals: Deal[]): string {
  const svc = new ExportsService({} as never) as unknown as {
    buildRosstatCsv(d: unknown[], from: Date, to: Date): { content: string };
  };
  return svc.buildRosstatCsv(deals, new Date('2026-01-01'), new Date('2026-12-31')).content;
}

const closed = (culture: string | null, volumeTons: number): Deal => ({
  culture, volumeTons, status: 'CLOSED', totalRub: 0,
});

/**
 * Сумма чисел в колонке «Объём» свода по культурам.
 *
 * Кавычки снимаются намеренно: csvRow заключает каждое значение в кавычки, и
 * `Number('"5000"')` даёт NaN. Первая версия этой функции об этом забыла и
 * показывала ноль для КАЖДОГО случая, включая исправный, — то есть объявляла
 * работающий код сломанным.
 */
function reportedVolume(content: string): number {
  const summary = content.split('Культура,Объём (т)\n')[1] ?? '';
  return summary.split('\n').filter(Boolean).reduce((sum, line) => {
    const value = Number((line.split(',').pop() ?? '').replace(/^"|"$/gu, ''));
    return sum + (Number.isFinite(value) ? value : 0);
  }, 0);
}

describe('Форма 29-СХ: свод по культурам теряет тоннаж', () => {
  // Замерено ДО исправления на этих же пяти сделках: в отчёт попадало 2 400 т
  // из 10 400 т, а строка «constructor» несла «function Object() { … }3000».
  const mixed = [
    closed('Пшеница', 1200),
    closed('Ячмень', 800),
    closed('__proto__', 5000),
    closed('constructor', 3000),
    closed(null, 400),
  ];

  it('культура «__proto__» больше не съедает объём молча', () => {
    const content = buildReport([closed('Пшеница', 1200), closed('__proto__', 5000)]);
    expect(content).toContain('__proto__');
    expect(reportedVolume(content)).toBe(6200);
  });

  it('культура «constructor» даёт число, а не тело функции', () => {
    const content = buildReport([closed('constructor', 3000)]);
    expect(content).not.toContain('native code');
    expect(reportedVolume(content)).toBe(3000);
  });

  it('весь тоннаж доходит до отчёта: 10 400 т, а не 2 400 т', () => {
    expect(reportedVolume(buildReport(mixed))).toBe(10_400);
  });

  it('обычные культуры и пустая культура не изменились', () => {
    const content = buildReport([closed('Пшеница', 1200), closed('Ячмень', 800), closed(null, 400)]);
    expect(content).toContain('Пшеница');
    expect(content).toContain('Не указана');
    expect(reportedVolume(content)).toBe(2400);
  });

  it('одна культура в нескольких сделках складывается, а не затирается', () => {
    expect(reportedVolume(buildReport([closed('Рожь', 100), closed('Рожь', 250)]))).toBe(350);
  });

  it('расхождение свода с фактом останавливает выгрузку, а не искажает отчёт', () => {
    // Сторож — защита от повторного появления потери, а не от сегодняшнего
    // кода. Проверяем его напрямую: объём, читаемый по-разному на двух
    // проходах, обязан остановить сборку, а не дать «почти правильный» отчёт.
    let reads = 0;
    const drifting = [{
      culture: 'Пшеница',
      get volumeTons() { reads += 1; return reads === 1 ? 100 : 999; },
    }];
    expect(() => tallyVolumeByCulture(drifting)).toThrow(InternalServerErrorException);
  });

  it('на согласованных данных сторож молчит и отдаёт свод', () => {
    const tally = tallyVolumeByCulture([
      { culture: 'Рожь', volumeTons: 100 },
      { culture: 'Рожь', volumeTons: 250 },
      { culture: '__proto__', volumeTons: 5000 },
    ]);
    expect(tally.get('Рожь')).toBe(350);
    expect(tally.get('__proto__')).toBe(5000);
    expect([...tally.values()].reduce((s, v) => s + v, 0)).toBe(5350);
  });
});
