import 'reflect-metadata';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { BadRequestException, ValidationPipe } from '@nestjs/common';
import {
  AppendMessageDto,
  CreateConversationDto,
  CreateProjectDto,
  DeclarePhoneDto,
  ImportHistoryDto,
  RenameProjectDto,
  UpdateConversationDto,
} from './dto/gekta.dto';
import {
  ExtendTrialDto,
  GrantAccessDto,
  GrantLifetimeDto,
  ResetQuotaDto,
  RevokeGrantDto,
  SuspendAccountDto,
} from './dto/gekta-operator.dto';
import { GEKTA_IMPORT_MAX_CONVERSATIONS } from './gekta.contract';
import { GektaController, GektaOperatorController } from './gekta.controller';
import { GektaAccessService } from './gekta-access.service';

/**
 * V2.2.1 / V2.2.2 — граница запроса кабинета Гекты.
 *
 * Тринадцать обработчиков объявляли тело инлайн-типом. Инлайн-тип стирается до
 * `Object`, и глобальный ValidationPipe на него не действует: это измерено в
 * `common/validation/request-body-validation-mechanism.spec.ts`.
 *
 * Каждый набор ниже начинается с того, что происходило ДО прохода. Значения не
 * выведены из документации: они сняты с работающего кода и с работающей
 * PostgreSQL 16.13.
 */

// Пайп настроен ровно так же, как глобальный в main.ts.
const pipe = new ValidationPipe({ whitelist: true, forbidNonWhitelisted: false, transform: true });

async function accept<T>(metatype: new () => T, payload: unknown): Promise<T> {
  return (await pipe.transform(payload, { type: 'body', metatype } as never)) as T;
}

async function reject(metatype: new () => unknown, payload: unknown): Promise<string> {
  try {
    await pipe.transform(payload, { type: 'body', metatype } as never);
  } catch (error) {
    if (error instanceof BadRequestException) return JSON.stringify(error.getResponse());
    return `${(error as Error).constructor.name}: ${(error as Error).message}`;
  }
  throw new Error(`ожидался отказ, но тело прошло: ${JSON.stringify(payload)}`);
}

describe('каждое тело кабинета Гекты объявлено классом, а не инлайн-типом', () => {
  const controller = readFileSync(join(__dirname, 'gekta.controller.ts'), 'utf8');
  const code = controller.replace(/\/\*[\s\S]*?\*\//gu, '').replace(/^\s*\/\/.*$/gmu, '');

  it('в контроллере не осталось ни одного инлайн-тела', () => {
    expect(code).not.toMatch(/@Body\(\)\s+body:\s*\{/u);
    expect(code).not.toMatch(/@Body\(\)\s+body:\s*Record</u);
  });

  it('импорт больше не проносит тело в сервис через as never', () => {
    expect(code).not.toContain('as never');
  });

  /**
   * Проверка на исходнике сама по себе слабая — её обходит любая
   * переформулировка. Это же утверждение снимается с метаданных времени
   * выполнения: именно их читает ValidationPipe, и именно они превращались в
   * `Object` у инлайн-тела.
   */
  it.each([
    ['declarePhone', GektaController, DeclarePhoneDto],
    ['createProject', GektaController, CreateProjectDto],
    ['renameProject', GektaController, RenameProjectDto],
    ['createConversation', GektaController, CreateConversationDto],
    ['appendMessage', GektaController, AppendMessageDto],
    ['updateConversation', GektaController, UpdateConversationDto],
    ['importHistory', GektaController, ImportHistoryDto],
    ['grant', GektaOperatorController, GrantAccessDto],
    ['grantLifetime', GektaOperatorController, GrantLifetimeDto],
    ['revoke', GektaOperatorController, RevokeGrantDto],
    ['extendTrial', GektaOperatorController, ExtendTrialDto],
    ['suspend', GektaOperatorController, SuspendAccountDto],
    ['resetQuota', GektaOperatorController, ResetQuotaDto],
  ])('%s несёт класс DTO в метаданных, а не стёртый Object', (method, controller, dto) => {
    const types = Reflect.getMetadata('design:paramtypes', controller.prototype, method as string) as unknown[];
    // Nest хранит разбор параметров маршрута на конструкторе; 3 — это @Body().
    const args = Reflect.getMetadata('__routeArguments__', controller, method as string) as
      Record<string, { index: number }>;
    const bodyKey = Object.keys(args).find((key) => key.startsWith('3:'));
    expect(bodyKey).toBeDefined();
    const bodyIndex = args[bodyKey as string]?.index as number;
    expect(types[bodyIndex]).toBe(dto);
    // Стёртый инлайн-тип дал бы здесь ровно Object — то, что было до прохода.
    expect(types[bodyIndex]).not.toBe(Object);
  });
});

/**
 * Столбцы объявлены как `locale VarChar(8)` и `role VarChar(16)`. Проверено на
 * PostgreSQL 16.13: вставка девяти символов в varchar(8) даёт
 * «value too long for type character varying(8)» — PostgreSQL не обрезает, а
 * отказывает. До этого прохода ввод пользователя становился 500.
 */
describe('locale: граница держит тот же предел, что и столбец', () => {
  it('«ru» проходит', async () => {
    await expect(accept(CreateProjectDto, { name: 'Поле', locale: 'ru' })).resolves.toMatchObject({ locale: 'ru' });
  });

  it('«en» и «zh» проходят — это те локали, которые шлёт кабинет', async () => {
    await expect(accept(CreateConversationDto, { title: 'x', locale: 'en' })).resolves.toMatchObject({ locale: 'en' });
    await expect(accept(CreateConversationDto, { title: 'x', locale: 'zh' })).resolves.toMatchObject({ locale: 'zh' });
  });

  it('локаль длиннее столбца отклоняется, а не уходит в PostgreSQL', async () => {
    expect(await reject(CreateProjectDto, { name: 'Поле', locale: 'ru-RU-x-verylong' })).toContain('locale');
  });

  it('объект вместо локали отклоняется: String({}) давал «[object Object]» длиной 15', async () => {
    expect(await reject(CreateProjectDto, { name: 'Поле', locale: {} })).toContain('locale');
  });
});

/**
 * До прохода тело импорта уходило в сервис через `as never`. Замерено на самом
 * сервисе: `[{}]` давало «TypeError: Cannot read properties of undefined
 * (reading 'replace')», а диалог без `messages` — то же самое на 'slice'.
 * Оба — 500 на вводе пользователя.
 */
describe('импорт анонимной истории: форма тела проверяется до сервиса', () => {
  const conversation = {
    title: 'Диалог',
    locale: 'ru',
    createdAt: '2026-09-01T00:00:00.000Z',
    messages: [{ role: 'user', body: 'Когда сеять пшеницу?' }],
  };

  it('то, что шлёт кабинет, проходит целиком', async () => {
    const result = await accept(ImportHistoryDto, { conversations: [conversation] });
    expect(result.conversations).toHaveLength(1);
    expect(result.conversations[0]?.messages[0]?.role).toBe('user');
  });

  it('пустой объект вместо диалога отклоняется', async () => {
    expect(await reject(ImportHistoryDto, { conversations: [{}] })).toContain('title');
  });

  it('диалог без сообщений отклоняется', async () => {
    expect(await reject(ImportHistoryDto, { conversations: [{ title: 'ok', locale: 'ru' }] })).toContain('messages');
  });

  it('conversations вообще не массив — отклоняется', async () => {
    expect(await reject(ImportHistoryDto, { conversations: 'всё' })).toContain('conversations');
  });

  /**
   * Ключевое расхождение, которое закрывает этот проход: живой маршрут
   * дописывания нормализовал любую роль к «user», а импорт писал её как есть.
   * Замерено: роль «system» доходила до Prisma, и PostgreSQL её принимал —
   * столбец varchar(16), а не перечисление.
   */
  it('произвольная роль в импорте отклоняется — раньше она сохранялась как есть', async () => {
    expect(await reject(ImportHistoryDto, {
      conversations: [{ ...conversation, messages: [{ role: 'system', body: 'x' }] }],
    })).toContain('role');
  });

  it('обе настоящие роли проходят', async () => {
    const result = await accept(ImportHistoryDto, {
      conversations: [{ ...conversation, messages: [{ role: 'user', body: 'a' }, { role: 'assistant', body: 'b' }] }],
    });
    expect(result.conversations[0]?.messages.map((message) => message.role)).toEqual(['user', 'assistant']);
  });

  it('неразбираемая дата отклоняется — раньше в Prisma уходил Invalid Date', async () => {
    expect(await reject(ImportHistoryDto, { conversations: [{ ...conversation, createdAt: 'not-a-date' }] }))
      .toContain('createdAt');
  });

  it('несуществующая дата отклоняется: строгий режим не принимает 31 февраля', async () => {
    expect(await reject(ImportHistoryDto, { conversations: [{ ...conversation, createdAt: '2026-02-31T00:00:00.000Z' }] }))
      .toContain('createdAt');
  });

  /**
   * Сервер импортирует не больше GEKTA_IMPORT_MAX_CONVERSATIONS за запрос и
   * раньше молча выбрасывал остаток. Клиент видел ok и помечал перенос
   * выполненным. Теперь предел объявлен на границе, а клиент режет части по
   * тому же числу — см. gektaServerHistory.test.ts.
   */
  it('часть длиннее серверного предела отклоняется, а не обрезается молча', async () => {
    const tooMany = Array.from({ length: GEKTA_IMPORT_MAX_CONVERSATIONS + 1 }, (_, index) => ({
      ...conversation,
      title: `Диалог ${index}`,
    }));
    expect(await reject(ImportHistoryDto, { conversations: tooMany })).toContain('conversations');
  });

  it('ровно предел проходит', async () => {
    const exact = Array.from({ length: GEKTA_IMPORT_MAX_CONVERSATIONS }, (_, index) => ({
      ...conversation,
      title: `Диалог ${index}`,
    }));
    await expect(accept(ImportHistoryDto, { conversations: exact })).resolves.toBeDefined();
  });
});

describe('дописывание сообщения', () => {
  it('то, что шлёт кабинет, проходит', async () => {
    const result = await accept(AppendMessageDto, {
      role: 'assistant', body: 'Ответ', citations: [], attachments: [],
    });
    expect(result.role).toBe('assistant');
  });

  it('произвольная роль отклоняется, а не превращается молча в «user»', async () => {
    expect(await reject(AppendMessageDto, { role: 'system', body: 'x' })).toContain('role');
  });

  it('пустое тело сообщения отклоняется', async () => {
    expect(await reject(AppendMessageDto, { role: 'user', body: '' })).toContain('body');
  });

  it('лишнее поле срезается whitelist, а не сохраняется', async () => {
    const result = await accept(AppendMessageDto, { role: 'user', body: 'x', accountId: 'чужой' });
    expect(result).not.toHaveProperty('accountId');
  });
});

describe('проекты и диалоги', () => {
  it('пустое имя проекта отклоняется на границе', async () => {
    expect(await reject(CreateProjectDto, { name: '' })).toContain('name');
    expect(await reject(RenameProjectDto, { name: '' })).toContain('name');
  });

  it('projectId: null остаётся разрешённым — это «вынести из проекта»', async () => {
    const result = await accept(UpdateConversationDto, { projectId: null });
    expect(result.projectId).toBeNull();
  });

  it('отсутствие projectId и явный null различимы после проверки', async () => {
    const renaming = await accept(UpdateConversationDto, { title: 'Новое имя' });
    expect(renaming.projectId).toBeUndefined();
  });

  it('телефон обязателен и ограничен по длине', async () => {
    expect(await reject(DeclarePhoneDto, {})).toContain('phone');
    expect(await reject(DeclarePhoneDto, { phone: '7'.repeat(64) })).toContain('phone');
    await expect(accept(DeclarePhoneDto, { phone: '+7 900 000-00-00' })).resolves.toMatchObject({ phone: '+7 900 000-00-00' });
  });
});

/**
 * Консоль владельца уже требует причину (`requireReason`), но проверка на
 * стороне браузера — не исполнение. Сервер принимал пустую строку, а объект
 * записывал в неизменяемый журнал как «[object Object]».
 */
describe('операторские действия: журнал без причины больше не пишется', () => {
  const dtos: Array<[string, new () => unknown]> = [
    ['grant-lifetime', GrantLifetimeDto],
    ['revoke', RevokeGrantDto],
    ['reset-quota', ResetQuotaDto],
  ];

  it.each(dtos)('%s требует причину', async (_name, dto) => {
    expect(await reject(dto, {})).toContain('reason');
    expect(await reject(dto, { reason: '' })).toContain('reason');
    expect(await reject(dto, { reason: '   ' })).toContain('reason');
    expect(await reject(dto, { reason: {} })).toContain('reason');
    await expect(accept(dto as never, { reason: 'Обращение №12' })).resolves.toBeDefined();
  });

  it('причина длиннее журнальной колонки отклоняется', async () => {
    expect(await reject(GrantLifetimeDto, { reason: 'a'.repeat(501) })).toContain('reason');
  });
});

describe('выдача доступа', () => {
  it('то, что шлёт консоль, проходит', async () => {
    await expect(accept(GrantAccessDto, { kind: 'DAYS_7', reason: 'Обращение' })).resolves.toMatchObject({ kind: 'DAYS_7' });
    await expect(accept(GrantAccessDto, { kind: 'DAYS_30', reason: 'Обращение' })).resolves.toBeDefined();
    await expect(accept(GrantAccessDto, {
      kind: 'UNTIL_DATE', until: '2026-12-31T00:00:00.000Z', reason: 'Обращение',
    })).resolves.toBeDefined();
  });

  /**
   * Раньше нераспознанный вид молча становился DAYS_7. Для LIFETIME это было
   * верной границей прав — у него отдельное разрешение, — но оператор об этом
   * не узнавал. Отказ границы честнее молчаливой подмены и границу прав не
   * ослабляет: LIFETIME по-прежнему выдаётся только своим маршрутом.
   */
  it('LIFETIME на этом маршруте отклоняется, а не превращается в DAYS_7', async () => {
    expect(await reject(GrantAccessDto, { kind: 'LIFETIME', reason: 'Обращение' })).toContain('kind');
  });

  it('опечатка в виде гранта отклоняется', async () => {
    expect(await reject(GrantAccessDto, { kind: 'DAYS_300', reason: 'Обращение' })).toContain('kind');
  });

  it('UNTIL_DATE без даты отклоняется — раньше это был обычный Error, то есть 500', async () => {
    expect(await reject(GrantAccessDto, { kind: 'UNTIL_DATE', reason: 'Обращение' })).toContain('until');
  });

  it('UNTIL_DATE с неразбираемой датой отклоняется', async () => {
    expect(await reject(GrantAccessDto, { kind: 'UNTIL_DATE', until: 'мусор', reason: 'Обращение' })).toContain('until');
  });

  it('дата не требуется там, где вид гранта её не использует', async () => {
    await expect(accept(GrantAccessDto, { kind: 'DAYS_7', reason: 'Обращение' })).resolves.toBeDefined();
  });
});

/**
 * `new Date('мусор')` — объект, то есть значение истинное. Сторожевая проверка
 * сервиса `!expiresAt` его не ловила: измерено.
 */
describe('сервис выдачи: неразбираемая дата больше не проходит сторожевую проверку', () => {
  const access = new GektaAccessService({} as never);

  it('Invalid Date отклоняется до обращения к базе', async () => {
    await expect(access.grantManualAccess({
      accountId: 'acct', kind: 'UNTIL_DATE', until: new Date('мусор'), grantedBy: 'op', reason: 'r',
    })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('отсутствие даты по-прежнему отклоняется', async () => {
    await expect(access.grantManualAccess({
      accountId: 'acct', kind: 'UNTIL_DATE', until: null, grantedBy: 'op', reason: 'r',
    })).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('продление пробного периода', () => {
  it('то, что шлёт консоль, проходит', async () => {
    await expect(accept(ExtendTrialDto, { days: 30, reason: 'Обращение' })).resolves.toMatchObject({ days: 30 });
  });

  it('строка вместо числа отклоняется, а не приводится молча', async () => {
    expect(await reject(ExtendTrialDto, { days: '30', reason: 'Обращение' })).toContain('days');
  });

  /**
   * Значение выбрано внутри разрешённого диапазона намеренно. Прогон мутаций
   * поймал здесь дырку в этой самой проверке: сначала стояло 0.5, которое
   * отклоняет @Min(1), поэтому снятие @IsInt() не роняло ничего. Условие,
   * мимо которого проходит мутация, — не условие.
   */
  it('дробное число дней отклоняется, даже когда оно внутри диапазона', async () => {
    expect(await reject(ExtendTrialDto, { days: 30.5, reason: 'Обращение' })).toContain('days');
  });

  it('ноль, отрицательное и больше года отклоняются', async () => {
    expect(await reject(ExtendTrialDto, { days: 0, reason: 'Обращение' })).toContain('days');
    expect(await reject(ExtendTrialDto, { days: -30, reason: 'Обращение' })).toContain('days');
    expect(await reject(ExtendTrialDto, { days: 366, reason: 'Обращение' })).toContain('days');
  });

  it('поле необязательно: без него контроллер подставляет тридцать дней', async () => {
    const result = await accept(ExtendTrialDto, { reason: 'Обращение' });
    expect(result.days).toBeUndefined();
  });
});

/**
 * Замерено: `body?.suspended !== false` истинно и для строки «false», и для
 * нуля. Оператор, снимавший приостановку, ставил её заново.
 */
describe('приостановка аккаунта', () => {
  it('то, что шлёт консоль, проходит в обе стороны', async () => {
    await expect(accept(SuspendAccountDto, { suspended: true, reason: 'Обращение' })).resolves.toMatchObject({ suspended: true });
    await expect(accept(SuspendAccountDto, { suspended: false, reason: 'Обращение' })).resolves.toMatchObject({ suspended: false });
  });

  it('строка «false» отклоняется, а не приостанавливает аккаунт', async () => {
    expect(await reject(SuspendAccountDto, { suspended: 'false', reason: 'Обращение' })).toContain('suspended');
  });

  it('ноль отклоняется, а не приостанавливает аккаунт', async () => {
    expect(await reject(SuspendAccountDto, { suspended: 0, reason: 'Обращение' })).toContain('suspended');
  });

  it('отсутствие поля отклоняется: приостановка требует явного намерения', async () => {
    expect(await reject(SuspendAccountDto, { reason: 'Обращение' })).toContain('suspended');
  });
});
