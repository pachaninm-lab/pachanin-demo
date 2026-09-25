import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import {
  InitiateKycDto,
  RknIncidentDto,
  TransactionAmlCheckDto,
  VerifyInnDto,
  VerifyOrganizationDto,
} from './kyc.dto';

/**
 * V2.2.1 / V2.2.2 — тела KYC/AML.
 *
 * Пять обработчиков объявляли тело инлайн-типом, который стирается до `Object`,
 * поэтому пайп на них не действовал вовсе. Значения уходят в реестр ФНС, в
 * проверку по спискам ПОД/ФТ и в XML для Роскомнадзора.
 *
 * Пайп берётся ровно той же конфигурации, что в main.ts.
 */

const pipe = new ValidationPipe({ whitelist: true, forbidNonWhitelisted: false, transform: true });
const через = <T>(metatype: new () => T) => (value: unknown) =>
  pipe.transform(value, { type: 'body', metatype } as never);

describe('ИНН проверяется по форме, а не на непустоту', () => {
  it.each([
    ['слишком короткий', '77000000'],
    ['слишком длинный', '7700000000000'],
    ['одиннадцать цифр — такой длины не бывает', '77000000001'],
    ['с буквами', '77000000AB'],
    ['с пробелом', '770000000 '],
    ['пустой', ''],
  ])('%s отклоняется', async (_name, inn) => {
    await expect(через(VerifyInnDto)({ inn })).rejects.toThrow();
  });

  it.each([['организация, 10 цифр', '7700000001'], ['ИП, 12 цифр', '770000000123']])(
    '%s принимается',
    async (_name, inn) => {
      await expect(через(VerifyInnDto)({ inn })).resolves.toEqual({ inn });
    },
  );

  it('ОГРН допускает 13 и 15 цифр и отвергает прочее', async () => {
    await expect(через(VerifyInnDto)({ inn: '7700000001', ogrn: '1027700000001' })).resolves.toBeDefined();
    await expect(через(VerifyInnDto)({ inn: '7700000001', ogrn: '304770000000012' })).resolves.toBeDefined();
    await expect(через(VerifyInnDto)({ inn: '7700000001', ogrn: '12345' })).rejects.toThrow();
  });
});

describe('Банковские реквизиты организации', () => {
  it('БИК не той длины отклоняется', async () => {
    await expect(через(VerifyOrganizationDto)({ inn: '7700000001', bik: '04452522' })).rejects.toThrow();
  });

  it('счёт не той длины отклоняется', async () => {
    await expect(
      через(VerifyOrganizationDto)({ inn: '7700000001', bankAccount: '4070281000000000123' }),
    ).rejects.toThrow();
  });

  it('корректный комплект проходит', async () => {
    await expect(
      через(VerifyOrganizationDto)({
        inn: '7700000001',
        organizationName: 'ООО Зерно',
        bik: '044525225',
        bankAccount: '40702810000000001234',
      }),
    ).resolves.toMatchObject({ bik: '044525225' });
  });
});

describe('Сумма в проверке ПОД/ФТ', () => {
  it.each([
    ['отрицательная', -1],
    ['дробные копейки', 10.5],
    ['за пределом точности', Number.MAX_SAFE_INTEGER + 2],
  ])('%s отклоняется', async (_name, amountKopecks) => {
    await expect(
      через(TransactionAmlCheckDto)({ transactionId: 'tx-1', amountKopecks }),
    ).rejects.toThrow();
  });

  it.each([
    ['строка', 'много'],
    ['пустая строка', ''],
    ['строка из пробелов', '   '],
    ['false', false],
    ['строка с числом', '100'],
    ['null', null],
  ])('%s отклоняется, а не приводится к нулю', async (_name, amountKopecks) => {
    // Найдено ревью и подтверждено замером: с `@Type(() => Number)` пайп
    // превращал '', '   ' и false в НОЛЬ ещё до `@IsInt` и границ, и они
    // проходили как законная нулевая сумма. Приведение убрано; тело приходит
    // как JSON, поэтому число обязано прийти числом.
    await expect(
      через(TransactionAmlCheckDto)({ transactionId: 'tx-1', amountKopecks }),
    ).rejects.toThrow();
  });

  it('обычная сумма проходит, включая ноль', async () => {
    await expect(через(TransactionAmlCheckDto)({ transactionId: 'tx-1', amountKopecks: 0 }))
      .resolves.toMatchObject({ amountKopecks: 0 });
    await expect(через(TransactionAmlCheckDto)({ transactionId: 'tx-1', amountKopecks: 1_000_00 }))
      .resolves.toMatchObject({ amountKopecks: 100000 });
  });

  it('ИНН сторон проверяется той же формой', async () => {
    await expect(
      через(TransactionAmlCheckDto)({ transactionId: 'tx-1', amountKopecks: 1, payerInn: 'ООО' }),
    ).rejects.toThrow();
  });
});

describe('Инициация KYC', () => {
  it('без organizationId отказ', async () => {
    await expect(через(InitiateKycDto)({ inn: '7700000001' })).rejects.toThrow();
  });

  it('обычный запрос проходит', async () => {
    await expect(
      через(InitiateKycDto)({ organizationId: 'org-1', inn: '7700000001', notes: 'плановая проверка' }),
    ).resolves.toMatchObject({ organizationId: 'org-1' });
  });
});

describe('Уведомление РКН: форма отсекается до сборки документа', () => {
  const VALID = {
    incidentType: 'УТЕЧКА',
    description: 'Инцидент',
    affectedSubjectsCount: 50_000,
    detectedAt: '2026-09-01T00:00:00.000Z',
    reporterFullName: 'Иванов И.И.',
    reporterPosition: 'ДПО',
  };

  it('нечисловое количество субъектов отклоняется', async () => {
    await expect(
      через(RknIncidentDto)({ ...VALID, affectedSubjectsCount: '0</КоличествоСубъектов><Подделка/>' }),
    ).rejects.toThrow();
  });

  it('дробное количество субъектов отклоняется', async () => {
    // Найдено мутацией, а не чтением: прежний тест подавал строку, а её
    // отвергал `@Min` через NaN, поэтому снятие `@IsInt` набор не замечал.
    // Дробное значение проходит и Min, и Max — и должно отсекаться именно
    // целочисленностью. Людей не бывает 42,9.
    await expect(через(RknIncidentDto)({ ...VALID, affectedSubjectsCount: 42.9 })).rejects.toThrow();
  });

  it('дата обнаружения обязана быть датой', async () => {
    await expect(через(RknIncidentDto)({ ...VALID, detectedAt: 'не дата' })).rejects.toThrow();
  });

  it.each([
    ['31 февраля', '2026-02-31'],
    ['30 февраля с временем', '2026-02-30T00:00:00.000Z'],
  ])('%s отклоняется, а не сдвигается молча', async (_name, detectedAt) => {
    // Найдено ревью и подтверждено замером: нестрогий `@IsDateString()`
    // принимал такую дату, а `new Date('2026-02-31')` давал `2026-03-03`.
    // Документ регулятору и срок 72 часа считались бы от даты на три дня
    // позже присланной, и ни одна проверка по пути этого бы не заметила.
    await expect(через(RknIncidentDto)({ ...VALID, detectedAt })).rejects.toThrow();
  });

  it('смещение часового пояса остаётся допустимым', async () => {
    // Обратная сторона строгого режима: он не должен отвергать законные формы.
    await expect(
      через(RknIncidentDto)({ ...VALID, detectedAt: '2026-09-01T01:00:00+03:00' }),
    ).resolves.toBeDefined();
  });

  it.each([['пустая строка', ''], ['false', false]])(
    'количество субъектов %s отклоняется, а не становится нулём',
    async (_name, affectedSubjectsCount) => {
      await expect(
        через(RknIncidentDto)({ ...VALID, affectedSubjectsCount }),
      ).rejects.toThrow();
    },
  );

  it('пустое описание отклоняется', async () => {
    await expect(через(RknIncidentDto)({ ...VALID, description: '' })).rejects.toThrow();
  });

  it('корректное уведомление проходит', async () => {
    await expect(через(RknIncidentDto)(VALID)).resolves.toMatchObject({ affectedSubjectsCount: 50_000 });
  });

  it('содержимое описания остаётся свободным текстом', async () => {
    // Обратная сторона: граница проверяет форму, а не цензурирует содержание.
    // Экранирование — задача сервиса, и оно проверяется отдельным набором.
    await expect(
      через(RknIncidentDto)({ ...VALID, description: 'Обнаружен доступ к БД <клиенты> & логам' }),
    ).resolves.toMatchObject({ description: 'Обнаружен доступ к БД <клиенты> & логам' });
  });
});
