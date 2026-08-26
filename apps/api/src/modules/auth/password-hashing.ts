import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import * as bcrypt from 'bcryptjs';

const scrypt = promisify(scryptCallback) as (
  password: string | Buffer,
  salt: Buffer,
  keylen: number,
  options: { N: number; r: number; p: number; maxmem: number },
) => Promise<Buffer>;

/**
 * Единственный источник рабочего фактора bcrypt для паролей платформы.
 *
 * Константа объявлена здесь, а не в каждом сервисе, по конкретной причине.
 * Пока стоимость записывалась литералом в четырёх местах, а хеш-заглушка для
 * несуществующего аккаунта считалась в пятом, эти числа разошлись: заглушка
 * стоила 10, реальные пароли — 12. Ветка «аккаунт не найден» выполняла
 * примерно вчетверо меньше работы, чем ветка «аккаунт найден», и время ответа
 * снова сообщало, зарегистрирован ли email — ровно тот канал, ради закрытия
 * которого заглушка и вводилась.
 *
 * Значение сохраняется и после перехода на scrypt: legacy-хеши продолжают
 * проверяться, а заглушка остаётся bcrypt-овой, чтобы обе ветки входа делали
 * сопоставимую работу для подавляющей части существующей популяции.
 */
export const PASSWORD_BCRYPT_COST = 12;

/**
 * Параметры scrypt для новых и изменённых паролей.
 *
 * bcrypt усекает вход на 72 байтах (ASVS V6.2.8), и это не косметика: при
 * верхней границе политики в 128 символов 56 из них не участвуют в хеше, а для
 * кириллицы, где символ занимает два байта UTF-8, эффективный предел наступает
 * после 36 символов — внутри длины, которую форма регистрации обещает
 * поддерживать. scrypt вход не усекает.
 *
 * Параметры выбраны измерением на целевом стеке, а не по памяти:
 *
 *   bcrypt cost 12 verify   338.8 ms
 *   scrypt N=16384  r=8 p=1 185.7 ms
 *   scrypt N=32768  r=8 p=1 258.5 ms
 *   scrypt N=65536  r=8 p=1 350.0 ms   <- выбрано
 *   scrypt N=131072 r=8 p=1 756.5 ms
 *
 * Сопоставимость с действующим рабочим фактором здесь обязательна, а не
 * желательна: если новые пароли считать заметно дешевле или дороже заглушки,
 * timing-оракул, ради закрытия которого написан весь модуль, откроется заново.
 *
 * Граница утверждения: N=2^16 — это 64 МиБ на одну проверку. Повышение до
 * N=2^17 дало бы 128 МиБ на проверку на VPS, где живут и API, и воркеры; это
 * операционное решение владельца, и здесь оно не принимается. Сверка параметров
 * с актуальными первичными источниками в этой среде не выполнялась, и ссылка по
 * памяти не приводится.
 */
export const PASSWORD_SCRYPT_PARAMS = Object.freeze({ N: 65_536, r: 8, p: 1 });

const SCRYPT_KEY_BYTES = 32;
const SCRYPT_SALT_BYTES = 16;
const SCRYPT_MAXMEM = 256 * 1024 * 1024;
const SCRYPT_SCHEME = 'scrypt';
const SCRYPT_VERSION = 1;

/** Хеш-заглушка для сравнения, когда учётной записи нет. */
export const DUMMY_PASSWORD_HASH = bcrypt.hashSync(
  'invalid-password-sentinel',
  PASSWORD_BCRYPT_COST,
);

/**
 * Формат хранения новой схемы.
 *
 * Алгоритм, версия и параметры записаны в самой строке, поэтому будущая смена
 * параметров не требует ни миграции, ни угадывания: старые записи проверяются
 * своими параметрами, новые пишутся текущими.
 *
 *   $scrypt$v=1$n=65536,r=8,p=1$<salt base64url>$<key base64url>
 */
function encodeScryptHash(salt: Buffer, key: Buffer): string {
  const { N, r, p } = PASSWORD_SCRYPT_PARAMS;
  return `$${SCRYPT_SCHEME}$v=${SCRYPT_VERSION}$n=${N},r=${r},p=${p}$${salt.toString('base64url')}$${key.toString('base64url')}`;
}

type ScryptRecord = { N: number; r: number; p: number; salt: Buffer; key: Buffer };

/**
 * Разбор с отказом по умолчанию.
 *
 * Всё, что не разобралось однозначно — чужая схема, неизвестная версия,
 * нечисловой параметр, испорченный base64 — возвращает null, а вызывающий
 * трактует null как «проверить нечем». Молча принять такую запись значило бы
 * пропускать вход по повреждённому хешу.
 */
function decodeScryptHash(stored: string): ScryptRecord | null {
  const parts = stored.split('$');
  if (parts.length !== 6 || parts[0] !== '') return null;
  if (parts[1] !== SCRYPT_SCHEME) return null;
  if (parts[2] !== `v=${SCRYPT_VERSION}`) return null;

  const params = new Map<string, number>();
  for (const pair of parts[3].split(',')) {
    const [name, raw] = pair.split('=');
    if (!name || raw === undefined || !/^\d+$/u.test(raw)) return null;
    params.set(name, Number(raw));
  }
  const N = params.get('n');
  const r = params.get('r');
  const p = params.get('p');
  if (!N || !r || !p) return null;
  if (!Number.isSafeInteger(N) || !Number.isSafeInteger(r) || !Number.isSafeInteger(p)) return null;
  // N обязан быть степенью двойки: scrypt иначе отвергнет параметр сам, но
  // отказать до вычисления дешевле и понятнее.
  if ((N & (N - 1)) !== 0) return null;

  let salt: Buffer;
  let key: Buffer;
  try {
    salt = Buffer.from(parts[4], 'base64url');
    key = Buffer.from(parts[5], 'base64url');
  } catch {
    return null;
  }
  if (salt.length === 0 || key.length === 0) return null;
  return { N, r, p, salt, key };
}

function isBcryptHash(stored: string): boolean {
  return /^\$2[aby]?\$\d{2}\$/u.test(stored);
}

/** Единственный способ получить хеш пароля для хранения. */
export async function hashPassword(plain: string): Promise<string> {
  const salt = randomBytes(SCRYPT_SALT_BYTES);
  const { N, r, p } = PASSWORD_SCRYPT_PARAMS;
  const key = await scrypt(plain, salt, SCRYPT_KEY_BYTES, { N, r, p, maxmem: SCRYPT_MAXMEM });
  return encodeScryptHash(salt, key);
}

export function accountExists(storedHash: string | null | undefined): boolean {
  return typeof storedHash === 'string' && storedHash.length > 0;
}

/**
 * Хеш, с которым будет выполнено сравнение.
 *
 * Вынесено в отдельную функцию, чтобы стоимость на ветке «аккаунта нет»
 * можно было проверить тестом напрямую, а не измерением времени: измерение
 * времени на общих CI-раннерах нестабильно и не объясняет причину падения.
 */
export function comparisonHashFor(storedHash: string | null | undefined): string {
  return accountExists(storedHash) ? (storedHash as string) : DUMMY_PASSWORD_HASH;
}

/**
 * Нужна ли перезапись хеша на текущую схему.
 *
 * Истинно для legacy-bcrypt и для scrypt-записи с параметрами, отличными от
 * действующих. Ложно для всего, что разобрать не удалось: перезаписывать
 * непонятную запись по успешной проверке нельзя, потому что успешной проверки
 * там и не будет.
 */
export function needsRehash(storedHash: string | null | undefined): boolean {
  if (!accountExists(storedHash)) return false;
  const stored = storedHash as string;
  if (isBcryptHash(stored)) return true;
  const record = decodeScryptHash(stored);
  if (!record) return false;
  const { N, r, p } = PASSWORD_SCRYPT_PARAMS;
  return record.N !== N || record.r !== r || record.p !== p;
}

async function verifyAgainst(plain: string, stored: string): Promise<boolean> {
  if (isBcryptHash(stored)) return bcrypt.compare(plain, stored);

  const record = decodeScryptHash(stored);
  if (!record) return false;

  const derived = await scrypt(plain, record.salt, record.key.length, {
    N: record.N,
    r: record.r,
    p: record.p,
    maxmem: SCRYPT_MAXMEM,
  });
  if (derived.length !== record.key.length) return false;
  return timingSafeEqual(derived, record.key);
}

/**
 * Проверка пароля, которая выполняется всегда — и когда учётная запись
 * найдена, и когда нет.
 *
 * Ветвление живёт здесь, а не у вызывающей стороны, чтобы новый путь входа
 * не мог случайно пропустить работу для несуществующего пользователя или
 * подставить заглушку другой стоимости.
 */
export async function verifyPassword(
  plain: string,
  storedHash: string | null | undefined,
): Promise<boolean> {
  const matches = await verifyAgainst(plain, comparisonHashFor(storedHash));
  // Сравнение уже выполнено, поэтому этот возврат не меняет времени ответа.
  // Он лишь исключает вход по значению самой заглушки.
  return accountExists(storedHash) && matches;
}

export type PasswordUpgradeOutcome = Readonly<{ valid: boolean; upgraded: boolean }>;

/**
 * Проверка с прозрачной перезаписью legacy-хеша.
 *
 * Порядок обязателен: сначала проверить старым хешем, и только по успеху
 * посчитать новый и записать его условно. Массовой перезаписи не происходит и
 * произойти не может — новый хеш существует лишь там, где пароль был предъявлен
 * и подтверждён.
 *
 * Сбой записи не превращает верный пароль в отказ. Это не мягкость: пароль был
 * проверен до попытки записи, и её результат к правильности пароля отношения не
 * имеет. Старый валидный хеш при сбое остаётся на месте, и следующий вход
 * попробует перезапись снова.
 *
 * persist получает conditionalOn — прежнее значение хеша, — чтобы вызывающая
 * сторона могла выполнить обновление атомарно и не затереть запись, изменённую
 * параллельным входом или сменой пароля.
 */
export async function verifyPasswordWithUpgrade(
  plain: string,
  storedHash: string | null | undefined,
  persist?: (next: string, conditionalOn: string) => Promise<unknown>,
): Promise<PasswordUpgradeOutcome> {
  const valid = await verifyPassword(plain, storedHash);
  if (!valid || !persist || !needsRehash(storedHash)) return { valid, upgraded: false };

  try {
    const next = await hashPassword(plain);
    await persist(next, storedHash as string);
    return { valid: true, upgraded: true };
  } catch {
    return { valid: true, upgraded: false };
  }
}
