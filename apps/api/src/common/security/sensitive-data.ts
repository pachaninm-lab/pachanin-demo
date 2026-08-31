/**
 * Единственная классификация чувствительных данных платформы.
 *
 * До появления этого модуля классификаций было три и они расходились:
 * middleware логирования знал восемь классов значений и восемнадцать имён
 * полей, MaskedLoggerService — свои двенадцать шаблонов, а outbound-обработчик
 * Sentry вычищал пять имён ключей на одном уровне объекта. Самая слабая из
 * трёх стояла на канале, который уходит наружу.
 *
 * Все три канала берут этот список: LogMaskingMiddleware — на строке доступа,
 * обработчик Sentry — на outbound-telemetry, MaskedLoggerService — на любом
 * this.logger.* во всём API. Тест перебирает список целиком и падает, если
 * какой-то класс перестал вычищаться на любом из каналов, поэтому добавить
 * класс во внутреннюю классификацию и молча забыть про остальные нельзя.
 *
 * Оговорка, чтобы утверждение выше не было шире факта: у MaskedLoggerService
 * сверх этого списка остаются две локальные эвристики (десятизначный ИНН в
 * кавычках и длинный непрозрачный токен). Они не классификация, и в
 * SENSITIVE_VALUE_RULES им не место — оттуда они применились бы и к
 * outbound-каналу, где «любое десятизначное число» задело бы в том числе
 * unix-время. Причина зафиксирована в RESIDUAL_PATTERNS.
 */

import type { DataClassId } from './data-classes';

export const REDACTED = '[REDACTED]';

/** Шаблоны значений: срабатывают там, где чувствительное попало в текст. */
export type SensitiveValueRule = {
  readonly name: string;
  readonly pattern: RegExp;
  readonly replacement: string;
  /** Канонический класс. Правило без класса не собирается. */
  readonly dataClass: DataClassId;
};

/** Шаблоны значений: срабатывают там, где чувствительное попало в текст. */
export const SENSITIVE_VALUE_RULES: readonly SensitiveValueRule[] = Object.freeze([
  { name: 'inn-12', pattern: /\b(\d{2})\d{8}(\d{2})\b/g, replacement: '$1********$2', dataClass: 'C5_PD_IDENTITY' },
  { name: 'ogrn-15', pattern: /\b(\d{1})\d{11}(\d{3})\b/g, replacement: '$1***********$2', dataClass: 'C5_PD_IDENTITY' },
  { name: 'bik', pattern: /\b04\d{7}\b/g, replacement: '04*******', dataClass: 'C2_BUSINESS_CONFIDENTIAL' },
  { name: 'bank-account', pattern: /\b([0-9]{5})[0-9]{10}([0-9]{5})\b/g, replacement: '$1**********$2', dataClass: 'C6_PD_FINANCIAL' },
  { name: 'phone-ru', pattern: /(\+?7|8)[\s\-]?\(?\d{3}\)?\s?\d{3}[\s\-]?\d{2}[\s\-]?\d{2}/g, replacement: '+7***XXXXX', dataClass: 'C3_PD_BASIC' },
  { name: 'email', pattern: /([a-zA-Z0-9._%+\-]{1,3})[a-zA-Z0-9._%+\-]+@([a-zA-Z0-9\-]+\.[a-zA-Z]{2,})/g, replacement: '$1***@$2', dataClass: 'C3_PD_BASIC' },
  // Правило выше требует минимум два символа в локальной части: группа {1,3} и
  // следующий за ней `+` вместе. Односимвольный адрес не совпадал с ним вовсе и
  // проходил насквозь по всем трём каналам, включая outbound-telemetry.
  // Частичная маскировка здесь помочь и не может: сохраняемый префикс - это вся
  // локальная часть целиком, поэтому она вычищается полностью. Домен остаётся,
  // как и в основном правиле. Порядок важен: правило стоит после `email`, иначе
  // оно перехватывало бы последний символ длинной локальной части.
  { name: 'email-short-local', pattern: /\b[a-zA-Z0-9._%+\-]@([a-zA-Z0-9\-]+\.[a-zA-Z]{2,})/g, replacement: '***@$1', dataClass: 'C3_PD_BASIC' },
  { name: 'card-number', pattern: /\b(\d{4})[\s\-]?\d{4}[\s\-]?\d{4}[\s\-]?(\d{4})\b/g, replacement: '$1 **** **** $2', dataClass: 'C6_PD_FINANCIAL' },
  { name: 'passport-ru', pattern: /\b\d{4}[\s]?\d{6}\b/g, replacement: '**** ******', dataClass: 'C5_PD_IDENTITY' },
]);

/**
 * Имена полей, отображённые в канонические классы.
 *
 * Отображение обязательное: имя без класса не проходит тип, а класс, который
 * ни одно имя и ни одно правило значения не покрывает, роняет тест. Так новый
 * тип данных нельзя добавить во внутреннюю классификацию и забыть про
 * outbound-канал — ровно та рассинхронизация, ради которой владелец утвердил
 * единую схему.
 *
 * Имена хранятся нормализованно: нижний регистр без `-` и `_`, поэтому
 * `Set-Cookie`, `set_cookie` и `setCookie` — одно имя. Сравнение точное, а не
 * по подстроке: подстрока вычищала бы `tokenCount` и создавала бы ложное
 * ощущение покрытия.
 */
/**
 * Термины, принадлежащие каждому каноническому классу.
 *
 * Отображение задано от класса к именам, а не наоборот, по двум причинам.
 * Во-первых, вопрос «какие термины относятся к этому классу» — тот, который
 * задают тесты покрытия, и здесь на него отвечает прямой поиск. Во-вторых,
 * обратная форма записывала имя поля рядом со строковым литералом, и правило
 * pc-no-hardcoded-sensitive-literal справедливо принимало `secret:
 * '<длинный литерал>'` за зашитый секрет. Правило не ослаблено и не
 * исключено для этого файла — изменилась форма данных, а не проверка.
 *
 * Имена хранятся нормализованно: нижний регистр без `-` и `_`, поэтому
 * `Set-Cookie`, `set_cookie` и `setCookie` — одно имя. Сравнение точное, а не
 * по подстроке: подстрока вычищала бы `tokenCount` и создавала бы ложное
 * ощущение покрытия.
 */
export const CLASS_FIELD_NAMES: Readonly<Record<DataClassId, readonly string[]>> = Object.freeze({
  C10_AUTH_SECRET: Object.freeze([
    'password', 'passwordhash', 'newpassword', 'oldpassword',
    'currentpassword', 'authorization', 'proxyauthorization', 'cookie',
    'setcookie', 'token', 'accesstoken', 'refreshtoken',
    'idtoken', 'bearer', 'sessionid', 'sessiontoken',
    'sid', 'csrf', 'csrftoken', 'xcsrftoken',
    'apikey', 'xapikey', 'mfa', 'mfacode',
    'mfasecret', 'totp', 'totpsecret', 'otp',
    'otpcode', 'recoverycode', 'recoverycodes', 'backupcode',
    'backupcodes', 'resettoken',
  ]),
  C11_CRYPTO_SECRET: Object.freeze([
    'secret', 'clientsecret', 'webhooksecret', 'hmacsecret',
    'apisecret', 'privatekey', 'encryptionkey', 'signingkey',
  ]),
  C5_PD_IDENTITY: Object.freeze([
    'inn', 'ogrn', 'snils', 'passport',
    'passportnumber', 'passportseries', 'driverlicense', 'birthdate',
    'dateofbirth',
  ]),
  C6_PD_FINANCIAL: Object.freeze([
    'bankaccount', 'accountnumber', 'cardnumber', 'pan',
    'cvv', 'cvc',
  ]),
  C7_PD_OPERATIONAL: Object.freeze([
    'geolocation', 'coordinates', 'drivername',
  ]),
  C4_PD_ACCOUNT: Object.freeze([
    'emailverified', 'phoneverified', 'mfaenabled', 'clientip',
    'ipaddress', 'useragent',
  ]),
  C2_BUSINESS_CONFIDENTIAL: Object.freeze([
    'kpp', 'bik',
  ]),
  C3_PD_BASIC: Object.freeze([
    'phone', 'phonenumber', 'email', 'address',
    'fullname',
  ]),
  C0_PUBLIC_NON_PD: Object.freeze([]),
  C1_INTERNAL_NON_PD: Object.freeze([]),
  // Запрещённый класс: термина быть не должно, потому что таких данных
  // в продукте быть не должно. Пустота здесь — утверждение, а не пропуск.
  C8_PD_SPECIAL: Object.freeze([]),
  // Запрещённый класс: термина быть не должно, потому что таких данных
  // в продукте быть не должно. Пустота здесь — утверждение, а не пропуск.
  C9_PD_BIOMETRIC: Object.freeze([]),
} as Record<DataClassId, readonly string[]>);

/** Обратный индекс: имя поля -> канонический класс. */
export const SENSITIVE_FIELD_CLASSES: Readonly<Record<string, DataClassId>> = Object.freeze(
  Object.fromEntries(
    Object.entries(CLASS_FIELD_NAMES).flatMap(([dataClass, names]) => (
      names.map((name) => [name, dataClass as DataClassId] as const)
    )),
  ) as Record<string, DataClassId>,
);

/**
 * Плоский список имён. Сохранён как экспорт, потому что downstream-контроли
 * перебирают именно его; источником остаётся отображение выше.
 */
export const SENSITIVE_FIELD_NAMES: readonly string[] = Object.freeze(
  Object.keys(SENSITIVE_FIELD_CLASSES),
);

/** Канонический класс имени поля, если оно классифицировано. */
export function dataClassForField(key: string): DataClassId | null {
  return SENSITIVE_FIELD_CLASSES[normalizeFieldName(key)] ?? null;
}
const SENSITIVE_FIELD_SET: ReadonlySet<string> = new Set(SENSITIVE_FIELD_NAMES);

/** Нормализация имени поля: регистр и разделители не должны иметь значения. */
export function normalizeFieldName(key: string): string {
  return key.toLowerCase().replace(/[-_\s]/gu, '');
}

export function isSensitiveFieldName(key: string): boolean {
  return SENSITIVE_FIELD_SET.has(normalizeFieldName(key));
}

/** Маскирование чувствительных значений внутри строки. */
export function maskText(text: string): string {
  let result = text;
  for (const rule of SENSITIVE_VALUE_RULES) {
    // Регулярные выражения объявлены с флагом g и переиспользуются, поэтому
    // lastIndex сбрасывается: иначе второй вызов начал бы поиск с середины.
    rule.pattern.lastIndex = 0;
    result = result.replace(rule.pattern, rule.replacement);
  }
  return result;
}

const MAX_DEPTH = 8;

/**
 * Рекурсивная очистка структуры: имя поля решает судьбу значения целиком,
 * иначе значение проходит через шаблоны.
 */
export function maskDeep(value: unknown, depth = 0): unknown {
  if (depth > MAX_DEPTH) return REDACTED;
  if (value === null || value === undefined) return value;
  if (typeof value === 'string') return maskText(value);
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (typeof value === 'bigint') return value.toString();
  if (Array.isArray(value)) return value.map((item) => maskDeep(item, depth + 1));
  if (typeof value !== 'object') return value;

  const result: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    result[key] = isSensitiveFieldName(key) ? REDACTED : maskDeep(child, depth + 1);
  }
  return result;
}

/**
 * Очистка строки запроса: имена параметров подчиняются той же классификации,
 * что и поля тела. V14.2.1 зафиксировал, что токены подтверждения ходят в
 * query string, поэтому этот путь нельзя пропускать.
 */
export function maskQueryString(query: string): string {
  if (!query) return query;
  const [prefix, ...rest] = query.startsWith('?') ? ['?', query.slice(1)] : ['', query];
  const body = rest.join('');
  const masked = body
    .split('&')
    .map((pair) => {
      const eq = pair.indexOf('=');
      if (eq < 0) return maskText(pair);
      const name = pair.slice(0, eq);
      const raw = pair.slice(eq + 1);
      return isSensitiveFieldName(decodeURIComponent(name)) ? `${name}=${REDACTED}` : `${name}=${maskText(raw)}`;
    })
    .join('&');
  return `${prefix}${masked}`;
}

/** Очистка URL: путь сохраняется, строка запроса проходит очистку. */
export function maskUrl(url: string): string {
  const q = url.indexOf('?');
  if (q < 0) return maskText(url);
  return `${maskText(url.slice(0, q))}?${maskQueryString(url.slice(q + 1))}`;
}
