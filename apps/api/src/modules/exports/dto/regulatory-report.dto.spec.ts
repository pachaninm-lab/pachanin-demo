import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';

import {
  ExportRegulatoryReportDto,
  REGULATORY_REPORT_TYPES,
} from './regulatory-report.dto';

/**
 * V2.2.1 / V1.3.3 — период отчёта, уходящего регулятору.
 *
 * exportRegulatoryReport — единственная выгрузка, покидающая платформу: МСХ,
 * Росстат, ФНС, Росфинмониторинг. Обработчик объявлял тело инлайн-типом,
 * поэтому пайп не проверял ни поля, ни их согласованность.
 *
 * Ниже сперва воспроизводится то, что из этого следовало — на тех же
 * выражениях, что стоят в сервисе, — и лишь затем проверяется отказ на двери.
 */

const pipe = new ValidationPipe({ whitelist: true, forbidNonWhitelisted: false, transform: true });
const body = (value: unknown) =>
  pipe.transform(value, { type: 'body', metatype: ExportRegulatoryReportDto } as never);

/** Заголовок формы 29-СХ ровно как в buildRosstatCsv. */
const periodHeader = (from: Date, to: Date) =>
  `${from.toISOString().split('T')[0]} - ${to.toISOString().split('T')[0]}`;

/** Итоги формы по выборке сделок — те же reduce, что в сервисе. */
const totals = (deals: { status: string; volumeTons?: number; totalRub?: number }[]) => {
  const closed = deals.filter((d) => d.status === 'CLOSED' || d.status === 'SETTLED');
  return {
    deals: closed.length,
    volume: closed.reduce((s, d) => s + (d.volumeTons ?? 0), 0),
    rub: closed.reduce((s, d) => s + (d.totalRub ?? 0), 0),
  };
};

describe('что получалось до правки', () => {
  it('неразбираемая дата роняет сборку отчёта пятисоткой', () => {
    // Контроллер отдавал сервису new Date(params.from) без проверки, а
    // заголовок формы печатается через from.toISOString().
    expect(() => periodHeader(new Date('прошлый квартал'), new Date('2026-03-31'))).toThrow(RangeError);
    expect(() => periodHeader(new Date('2026-01-01'), new Date(''))).toThrow(RangeError);
  });

  it('обратный период даёт правильно оформленный отчёт с нулями', () => {
    // gte: from, lte: to при from > to не совпадает ни с одной строкой,
    // поэтому сервис строит форму по пустой выборке.
    expect(totals([])).toEqual({ deals: 0, volume: 0, rub: 0 });
    // И этот же ноль печатается как отчётность за период — то самое ложное
    // донесение, которое сервис уже отказывается выпускать, когда до него
    // доходят другим путём.
    expect(periodHeader(new Date('2026-06-30'), new Date('2026-01-01')))
      .toBe('2026-06-30 - 2026-01-01');
  });
});

describe('теперь отвергается на двери', () => {
  it.each(REGULATORY_REPORT_TYPES)('%s по-прежнему принимается', async (type) => {
    await expect(body({ type })).resolves.toMatchObject({ type });
  });

  it('неизвестный тип отчёта — отказ, а не Error и пятисотка из сервиса', async () => {
    await expect(body({ type: 'rosstat_v2' })).rejects.toThrow();
    await expect(body({ type: '' })).rejects.toThrow();
    await expect(body({})).rejects.toThrow();
  });

  it.each(['from', 'to'])('%s обязан быть разбираемой датой', async (field) => {
    const base: Record<string, string> = { type: 'rosstat', from: '2026-01-01', to: '2026-03-31' };
    await expect(body({ ...base, [field]: 'прошлый квартал' })).rejects.toThrow();
    await expect(body({ ...base, [field]: '' })).rejects.toThrow();
    await expect(body(base)).resolves.toBeDefined();
  });

  it('обратный период отвергается', async () => {
    await expect(body({ type: 'rosstat', from: '2026-06-30', to: '2026-01-01' })).rejects.toThrow();
  });

  it('период из одного мгновения тоже: gte/lte делают его пустым', async () => {
    const instant = '2026-01-01T00:00:00.000Z';
    await expect(body({ type: 'fns', from: instant, to: instant })).rejects.toThrow();
  });

  it('прямой период проходит', async () => {
    await expect(body({ type: 'msh', from: '2026-01-01', to: '2026-03-31' }))
      .resolves.toMatchObject({ from: '2026-01-01', to: '2026-03-31' });
  });

  // Сервис сам подставляет последние 30 дней, когда границы не переданы, и это
  // окно упорядочено по построению — сравнивать нечего.
  it('оба конца необязательны: окно по умолчанию остаётся за сервисом', async () => {
    await expect(body({ type: 'rosstat' })).resolves.toMatchObject({ type: 'rosstat' });
    await expect(body({ type: 'rosstat', from: '2026-01-01' })).resolves.toBeDefined();
    await expect(body({ type: 'rosstat', to: '2026-03-31' })).resolves.toBeDefined();
  });

  // Иначе на одну кривую дату пришло бы два сообщения: и «не дата», и
  // «обратный период», потому что NaN не меньше ничего. Сообщения лежат в
  // ответе исключения, а не в его message: BadRequestException от пайпа
  // печатает «Bad Request Exception», и проверка по нему прошла бы на любой
  // причине отказа вообще.
  it('неразбираемая дата не порождает второй жалобы о порядке', async () => {
    const complaints = await body({ type: 'rosstat', from: 'не дата', to: '2026-01-01' })
      .then(() => [] as string[])
      .catch((error: { getResponse?: () => { message?: string[] } }) => error.getResponse?.()?.message ?? []);
    expect(complaints.join(' | ')).toMatch(/ISO 8601/iu);
    expect(complaints.join(' | ')).not.toMatch(/период отчёта регулятору/u);
  });

  it('а обратный период порождает именно жалобу о порядке', async () => {
    const complaints = await body({ type: 'rosstat', from: '2026-06-30', to: '2026-01-01' })
      .then(() => [] as string[])
      .catch((error: { getResponse?: () => { message?: string[] } }) => error.getResponse?.()?.message ?? []);
    expect(complaints.join(' | ')).toMatch(/период отчёта регулятору/u);
  });
});
