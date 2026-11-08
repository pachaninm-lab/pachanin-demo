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

  it('дробный тоннаж не вызывает ложного отказа', () => {
    // Первая версия сторожа сравнивала суммы точным `!==` по float. Сложение
    // с плавающей точкой неассоциативно: свод складывает итоги корзин, а
    // контрольная сумма — сделки подряд. Замерено на 300 000 случайных
    // наборов с точностью до килограмма: точное сравнение давало ложный отказ
    // в 27 % случаев. Этот набор — один из них: 46 649,2 против
    // 46 649,200000000004.
    const deals = [
      { culture: 'Ячмень', volumeTons: 9201.1 },
      { culture: 'Овёс', volumeTons: 705.9 },
      { culture: 'Ячмень', volumeTons: 5555.8 },
      { culture: 'Пшеница', volumeTons: 6917.1 },
      { culture: 'Ячмень', volumeTons: 5309.5 },
      { culture: 'Ячмень', volumeTons: 8563.4 },
      { culture: 'Ячмень', volumeTons: 5337.7 },
      { culture: 'Ячмень', volumeTons: 758.4 },
      { culture: 'Овёс', volumeTons: 4300.3 },
    ];
    expect(() => tallyVolumeByCulture(deals)).not.toThrow();
    const tally = tallyVolumeByCulture(deals);
    expect(Math.round([...tally.values()].reduce((s, v) => s + v, 0) * 1000)).toBe(46_649_200);
  });

  it('расхождение в один килограмм сторож всё ещё видит', () => {
    let reads = 0;
    const drifting = [{
      culture: 'Пшеница',
      get volumeTons() { reads += 1; return reads === 1 ? 100.0 : 100.001; },
    }];
    expect(() => tallyVolumeByCulture(drifting)).toThrow(InternalServerErrorException);
  });

  it('свод и заголовок формы считаются по одной популяции сделок', () => {
    // Замерено ДО исправления: заголовок показывал 1 500 т по CLOSED/SETTLED,
    // а свод — 10 500 т, потому что шёл по всем сделкам и включал DRAFT
    // (7 000 т) и CANCELLED (2 000 т) как убранный урожай.
    const content = buildReport([
      { culture: 'Пшеница', volumeTons: 1000, status: 'CLOSED', totalRub: 10 },
      { culture: 'Ячмень', volumeTons: 500, status: 'SETTLED', totalRub: 5 },
      { culture: 'Кукуруза', volumeTons: 7000, status: 'DRAFT', totalRub: 70 },
      { culture: 'Пшеница', volumeTons: 2000, status: 'CANCELLED', totalRub: 20 },
    ]);
    expect(reportedVolume(content)).toBe(1500);
    expect(content).not.toContain('Кукуруза');
    // Заголовок формы объявляет тот же объём, что и свод.
    expect(content).toContain('"1500"');
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
