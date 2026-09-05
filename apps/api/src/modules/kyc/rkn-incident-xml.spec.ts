import { BadRequestException } from '@nestjs/common';
import { KycService } from './kyc.service';

/**
 * Уведомление Роскомнадзора об инциденте с персональными данными (ASVS 5.0 V1.2.1).
 *
 * `generateRknIncidentNotification` собирал XML шаблонной строкой и подставлял
 * поля запроса без какого-либо кодирования. В дереве при этом уже лежал
 * `xml-escape.ts`, и его собственный комментарий описывает ровно этот класс
 * дефекта — но пользовались им два билдера из трёх.
 *
 * Замерено до правки, и это не порча разметки, а подделка содержания:
 * значение `description`, содержащее закрывающий тег, вносило в документ ВТОРОЙ
 * элемент `<КоличествоСубъектов>0</КоличествоСубъектов>` ПЕРЕД настоящим.
 * Парсер, читающий первое вхождение, увидел бы ноль пострадавших вместо
 * пятидесяти тысяч — то есть заниженный масштаб утечки в отчёте регулятору.
 */

const service = () => new KycService(undefined as never, undefined as never);

const VALID = {
  incidentType: 'УТЕЧКА',
  description: 'Инцидент',
  affectedSubjectsCount: 50_000,
  detectedAt: '2026-09-01T00:00:00.000Z',
  reporterFullName: 'Иванов И.И.',
  reporterPosition: 'ДПО',
};

describe('РКН-уведомление: содержание нельзя подделать через поле', () => {
  it('закрывающий тег в описании не создаёт второй элемент количества', () => {
    const { xml } = service().generateRknIncidentNotification({
      ...VALID,
      description: '</Описание><КоличествоСубъектов>0</КоличествоСубъектов><Описание>ничего',
    });

    // Ровно один элемент количества, и в нём настоящее число.
    expect(xml.match(/<КоличествоСубъектов>/gu)).toHaveLength(1);
    expect(xml).toContain('<КоличествоСубъектов>50000</КоличествоСубъектов>');
    // Полезная нагрузка не потеряна — она видна как текст, а не как разметка.
    expect(xml).toContain('&lt;/Описание&gt;');
    expect(xml).toContain('ничего');
  });

  it.each([
    ['incidentType'],
    ['reporterFullName'],
    ['reporterPosition'],
  ])('%s тоже не может внести элемент', (field) => {
    const { xml } = service().generateRknIncidentNotification({
      ...VALID,
      [field]: '</Оператор><Подделка/>',
    } as never);

    expect(xml).not.toContain('<Подделка/>');
    expect(xml).toContain('&lt;Подделка/&gt;');
  });

  it('амперсанд не ломает документ', () => {
    const { xml } = service().generateRknIncidentNotification({ ...VALID, description: 'Иванов & Ко' });
    expect(xml).toContain('Иванов &amp; Ко');
  });

  it('количество субъектов выводится числом, а не подставленной строкой', () => {
    // Замерено до правки: строка на этом месте вносила посторонний элемент и
    // оставляла висячий закрывающий тег.
    const { xml } = service().generateRknIncidentNotification({
      ...VALID,
      affectedSubjectsCount: 42.9 as never,
    });
    expect(xml).toContain('<КоличествоСубъектов>42</КоличествоСубъектов>');
  });

  it('невалидная дата обнаружения — отказ, а не пятисотка', () => {
    // Замерено до правки: `new Date('не дата').toISOString()` бросал
    // `RangeError: Invalid time value`, и вызывающий получал 500.
    expect(() => service().generateRknIncidentNotification({ ...VALID, detectedAt: 'не дата' }))
      .toThrow(BadRequestException);
  });

  it('отрицательное количество субъектов — отказ', () => {
    expect(() => service().generateRknIncidentNotification({ ...VALID, affectedSubjectsCount: -1 }))
      .toThrow(BadRequestException);
  });
});

describe('РКН-уведомление: обратная сторона', () => {
  it('обычное уведомление по-прежнему собирается и читается', () => {
    // Иначе «всё экранировано» прошло бы за успех и на пустом документе.
    const { xml, deadlineAt } = service().generateRknIncidentNotification(VALID);

    expect(xml).toContain('<Тип>УТЕЧКА</Тип>');
    expect(xml).toContain('<Описание>Инцидент</Описание>');
    expect(xml).toContain('<КоличествоСубъектов>50000</КоличествоСубъектов>');
    expect(xml).toContain('<ФИО>Иванов И.И.</ФИО>');
    expect(xml).not.toContain('&amp;');
  });

  it('срок уведомления остаётся 72 часа от обнаружения', () => {
    const { deadlineAt } = service().generateRknIncidentNotification(VALID);
    expect(deadlineAt).toBe('2026-09-04T00:00:00.000Z');
  });

  it('дата обнаружения выводится нормализованной', () => {
    // Заявляется прямо: в документ идёт разобранная дата, а не исходная строка.
    // Так значение не может нести текст помимо даты.
    const { xml } = service().generateRknIncidentNotification({ ...VALID, detectedAt: '2026-09-01' });
    expect(xml).toContain('<ДатаОбнаружения>2026-09-01T00:00:00.000Z</ДатаОбнаружения>');
  });
});
