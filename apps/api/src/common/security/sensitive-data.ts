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

export const REDACTED = '[REDACTED]';

export type SensitiveValueRule = {
  readonly name: string;
  readonly pattern: RegExp;
  readonly replacement: string;
};

/** Шаблоны значений: срабатывают там, где чувствительное попало в текст. */
export const SENSITIVE_VALUE_RULES: readonly SensitiveValueRule[] = Object.freeze([
  { name: 'inn-12', pattern: /\b(\d{2})\d{8}(\d{2})\b/g, replacement: '$1********$2' },
  { name: 'ogrn-15', pattern: /\b(\d{1})\d{11}(\d{3})\b/g, replacement: '$1***********$2' },
  { name: 'bik', pattern: /\b04\d{7}\b/g, replacement: '04*******' },
  { name: 'bank-account', pattern: /\b([0-9]{5})[0-9]{10}([0-9]{5})\b/g, replacement: '$1**********$2' },
  { name: 'phone-ru', pattern: /(\+?7|8)[\s\-]?\(?\d{3}\)?\s?\d{3}[\s\-]?\d{2}[\s\-]?\d{2}/g, replacement: '+7***XXXXX' },
  { name: 'email', pattern: /([a-zA-Z0-9._%+\-]{1,3})[a-zA-Z0-9._%+\-]+@([a-zA-Z0-9\-]+\.[a-zA-Z]{2,})/g, replacement: '$1***@$2' },
  { name: 'card-number', pattern: /\b(\d{4})[\s\-]?\d{4}[\s\-]?\d{4}[\s\-]?(\d{4})\b/g, replacement: '$1 **** **** $2' },
  { name: 'passport-ru', pattern: /\b\d{4}[\s]?\d{6}\b/g, replacement: '**** ******' },
]);

/**
 * Имена полей, значение которых удаляется целиком независимо от формы.
 *
 * Хранятся нормализованно: нижний регистр без `-` и `_`, поэтому
 * `Set-Cookie`, `set_cookie` и `setCookie` — одно и то же имя. Сравнение
 * точное, а не по подстроке: подстрока вычищала бы `tokenCount` и подобные
 * безобидные поля и создавала бы ложное ощущение покрытия.
 */
export const SENSITIVE_FIELD_NAMES: readonly string[] = Object.freeze([
  // Учётные данные и секреты
  'password', 'passwordhash', 'newpassword', 'oldpassword', 'currentpassword',
  'secret', 'clientsecret', 'webhooksecret', 'hmacsecret', 'privatekey',
  'apikey', 'xapikey', 'apisecret',
  // Заголовки авторизации и сессии
  'authorization', 'proxyauthorization', 'cookie', 'setcookie',
  'token', 'accesstoken', 'refreshtoken', 'idtoken', 'bearer',
  'sessionid', 'sessiontoken', 'sid', 'csrf', 'csrftoken', 'xcsrftoken',
  // Второй фактор и восстановление
  'mfa', 'mfacode', 'mfasecret', 'totp', 'totpsecret', 'otp', 'otpcode',
  'recoverycode', 'recoverycodes', 'backupcode', 'backupcodes', 'resettoken',
  // Персональные данные
  'inn', 'ogrn', 'kpp', 'snils', 'passport', 'passportnumber', 'passportseries',
  'phone', 'phonenumber', 'email', 'address', 'birthdate', 'dateofbirth',
  // Платёжные и банковские
  'bankaccount', 'accountnumber', 'bik', 'cardnumber', 'pan', 'cvv', 'cvc',
]);

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
