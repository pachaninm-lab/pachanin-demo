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
 * Профиль сверен с первичным источником, а не выбран по памяти. OWASP Password
 * Storage Cheat Sheet называет Argon2id первым выбором, scrypt — следующим,
 * если Argon2id недоступен, и bcrypt — только для legacy. Для scrypt приводится
 * лестница, где наивысший профиль — N=2^17 (128 МиБ), r=8, p=1, а более низкие
 * ступени обменивают память на параллелизм вплоть до N=2^13, r=8, p=10.
 *
 * Argon2id в Node без сторонней зависимости недоступен, а новая зависимость
 * открывает license/provenance/SBOM/vulnerability review. scrypt — санкционированная
 * этим же источником замена, и она уже есть в node:crypto.
 *
 * Взят наивысший профиль, а не средний. Прежняя версия этого модуля
 * использовала N=2^16, r=8, p=1 — значение, которого в лестнице OWASP нет
 * вообще, — и обосновывала его эквивалентностью действующему bcrypt cost 12.
 * Эквивалентность прежнему рабочему фактору не является standards-aligned
 * основанием: она измеряет то, что уже стоит, а не то, что рекомендовано.
 *
 * Измерено здесь (4 ядра), а не по памяти:
 *
 *   N=2^13 r=8 p=10   192 ms     8 МиБ
 *   N=2^14 r=8 p=5    211 ms    16 МиБ
 *   N=2^15 r=8 p=3    271 ms    32 МиБ
 *   N=2^16 r=8 p=2    387 ms    64 МиБ
 *   N=2^17 r=8 p=1    443 ms   128 МиБ   <- выбрано
 *
 * DoS-проверка, которая и решила вопрос 128 МиБ на проверку. Пиковая RSS
 * процесса НЕ растёт с числом запросов, потому что scrypt выполняется в
 * threadpool libuv, а он по умолчанию на 4 потока: одновременных проверок не
 * больше четырёх независимо от очереди.
 *
 *   4 параллельных проверки:  peak RSS 558 МиБ
 *  32 параллельных проверки:  peak RSS 559 МиБ, wall 3.6 s
 *
 * То есть под всплеском деградация выражается в очереди и задержке, а не в
 * исчерпании памяти. Потолок — примерно 128 МиБ × размер threadpool.
 *
 * Границы утверждения, которые остаются: потолок пропорционален
 * UV_THREADPOOL_SIZE, и если его поднять, поднимется и он. Число ядер на
 * production-VPS отсюда не проверяется, поэтому 560 МиБ — это измеренный
 * потолок на четырёхъядерной машине, а не обещание про конкретный хост.
 */
export const PASSWORD_SCRYPT_PARAMS = Object.freeze({ N: 131_072, r: 8, p: 1 });

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
 *   $scrypt$v=1$n=131072,r=8,p=1$<salt base64url>$<key base64url>
 *
 * Числа в этом примере — действующие параметры из PASSWORD_SCRYPT_PARAMS.
 * Пример однажды уже разошёлся с кодом: он остался на n=65536 после перехода
 * на профиль OWASP n=131072, и разобрать по нему настоящий хеш было нельзя.
 * Поэтому соответствие примера константе проверяется тестом, а не вниманием.
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
  if (!valid) return { valid, upgraded: false };
  return { valid, upgraded: await upgradePasswordHashIfNeeded(plain, storedHash, persist) };
}

/**
 * Перезапись хеша в новом формате — отдельно от проверки пароля.
 *
 * Разделение не косметическое, и цена слитности была найдена не рассуждением,
 * а провалившимся CI. Оба пути входа перечитывают учётные данные внутри
 * сериализуемой транзакции и отказывают, если сохранённый хеш изменился между
 * доказательством пароля и этой точкой: смена пароля в этом окне обязана
 * аннулировать доказательство. Перезапись, выполненная между теми же двумя
 * точками, — это ровно такое изменение, и защита срабатывала на ней:
 * CREDENTIAL_CHANGED_DURING_LOGIN, то есть первый же вход любой учётной записи
 * с legacy-хешем получал отказ. Защита права, неправ был момент перезаписи.
 *
 * Поэтому апгрейд выполняется ПОСЛЕ того, как решение о входе принято, и
 * только если вход удался. Два следствия, оба желаемые: перезапись не может
 * повлиять на результат аутентификации, и хеш не переписывается при входе,
 * который в итоге был отклонён — например, из-за отсутствия активного
 * членства.
 *
 * Возвращает true, только если новый хеш действительно записан.
 */
export async function upgradePasswordHashIfNeeded(
  plain: string,
  storedHash: string | null | undefined,
  persist?: (next: string, conditionalOn: string) => Promise<unknown>,
): Promise<boolean> {
  if (!persist || !needsRehash(storedHash)) return false;

  try {
    const next = await hashPassword(plain);
    await persist(next, storedHash as string);
    return true;
  } catch {
    // Сбой записи не имеет отношения к правильности пароля: он уже проверен.
    // Старый валидный хеш остаётся на месте, следующий вход попробует снова.
    return false;
  }
}
