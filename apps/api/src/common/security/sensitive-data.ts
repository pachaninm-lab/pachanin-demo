/**
 * Единственная классификация чувствительных данных платформы.
 *
 * До появления этого модуля классификаций было три и они расходились:
 * middleware логирования знал восемь классов значений и восемнадцать имён
 * полей, MaskedLoggerService — свои двенадцать шаблонов, а outbound-обработчик
 * Sentry вычищал пять имён ключей на одном уровне объекта. Самая слабая из
 * трёх стояла на канале, который уходит наружу.
 *
 * Расхождение здесь невозможно по построению: и внутренние логи, и outbound
 * telemetry берут один список, а тест перебирает его целиком и падает, если
 * какой-то класс перестал вычищаться на любом из каналов. Добавить класс во
 * внутреннюю классификацию и молча забыть про Sentry больше нельзя.
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
export const SENSITIVE_FIELD_CLASSES: Readonly<Record<string, DataClassId>> = Object.freeze({
  // C10 — секреты аутентификации
  password: 'C10_AUTH_SECRET',
  passwordhash: 'C10_AUTH_SECRET',
  newpassword: 'C10_AUTH_SECRET',
  oldpassword: 'C10_AUTH_SECRET',
  currentpassword: 'C10_AUTH_SECRET',
  authorization: 'C10_AUTH_SECRET',
  proxyauthorization: 'C10_AUTH_SECRET',
  cookie: 'C10_AUTH_SECRET',
  setcookie: 'C10_AUTH_SECRET',
  token: 'C10_AUTH_SECRET',
  accesstoken: 'C10_AUTH_SECRET',
  refreshtoken: 'C10_AUTH_SECRET',
  idtoken: 'C10_AUTH_SECRET',
  bearer: 'C10_AUTH_SECRET',
  sessionid: 'C10_AUTH_SECRET',
  sessiontoken: 'C10_AUTH_SECRET',
  sid: 'C10_AUTH_SECRET',
  csrf: 'C10_AUTH_SECRET',
  csrftoken: 'C10_AUTH_SECRET',
  xcsrftoken: 'C10_AUTH_SECRET',
  apikey: 'C10_AUTH_SECRET',
  xapikey: 'C10_AUTH_SECRET',
  mfa: 'C10_AUTH_SECRET',
  mfacode: 'C10_AUTH_SECRET',
  mfasecret: 'C10_AUTH_SECRET',
  totp: 'C10_AUTH_SECRET',
  totpsecret: 'C10_AUTH_SECRET',
  otp: 'C10_AUTH_SECRET',
  otpcode: 'C10_AUTH_SECRET',
  recoverycode: 'C10_AUTH_SECRET',
  recoverycodes: 'C10_AUTH_SECRET',
  backupcode: 'C10_AUTH_SECRET',
  backupcodes: 'C10_AUTH_SECRET',
  resettoken: 'C10_AUTH_SECRET',

  // C11 — криптографические и системные секреты
  secret: 'C11_CRYPTO_SECRET',
  clientsecret: 'C11_CRYPTO_SECRET',
  webhooksecret: 'C11_CRYPTO_SECRET',
  hmacsecret: 'C11_CRYPTO_SECRET',
  apisecret: 'C11_CRYPTO_SECRET',
  privatekey: 'C11_CRYPTO_SECRET',
  encryptionkey: 'C11_CRYPTO_SECRET',
  signingkey: 'C11_CRYPTO_SECRET',

  // C5 — идентификационные данные физлица
  inn: 'C5_PD_IDENTITY',
  ogrn: 'C5_PD_IDENTITY',
  snils: 'C5_PD_IDENTITY',
  passport: 'C5_PD_IDENTITY',
  passportnumber: 'C5_PD_IDENTITY',
  passportseries: 'C5_PD_IDENTITY',
  driverlicense: 'C5_PD_IDENTITY',
  birthdate: 'C5_PD_IDENTITY',
  dateofbirth: 'C5_PD_IDENTITY',

  // C6 — финансовые данные физлица или ИП
  bankaccount: 'C6_PD_FINANCIAL',
  accountnumber: 'C6_PD_FINANCIAL',
  cardnumber: 'C6_PD_FINANCIAL',
  pan: 'C6_PD_FINANCIAL',
  cvv: 'C6_PD_FINANCIAL',
  cvc: 'C6_PD_FINANCIAL',

  // C7 — операционные данные, персональные из-за связи с человеком
  geolocation: 'C7_PD_OPERATIONAL',
  coordinates: 'C7_PD_OPERATIONAL',
  drivername: 'C7_PD_OPERATIONAL',

  // C5 через реквизит юрлица: КПП идентифицирует организацию, не человека
  kpp: 'C2_BUSINESS_CONFIDENTIAL',
  bik: 'C2_BUSINESS_CONFIDENTIAL',

  // C4 — данные аккаунта и доступа
  emailverified: 'C4_PD_ACCOUNT',
  phoneverified: 'C4_PD_ACCOUNT',
  mfaenabled: 'C4_PD_ACCOUNT',
  clientip: 'C4_PD_ACCOUNT',
  ipaddress: 'C4_PD_ACCOUNT',
  // Владелец допускает редактирование C3/C4 во внешних каналах, «где они не
  // обязательны». Для user agent необходимость спорна: он полезен при разборе
  // ошибки. Пока применяется буквальное правило — редактировать; послабление
  // должно быть осознанным решением владельца, и оно записано в openItems
  // канонической схемы, а не принято здесь по умолчанию.
  useragent: 'C4_PD_ACCOUNT',

  // C3 — обычные персональные данные
  phone: 'C3_PD_BASIC',
  phonenumber: 'C3_PD_BASIC',
  email: 'C3_PD_BASIC',
  address: 'C3_PD_BASIC',
  fullname: 'C3_PD_BASIC',
});

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
