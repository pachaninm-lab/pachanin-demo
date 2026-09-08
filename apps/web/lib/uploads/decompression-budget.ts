/**
 * Потолок на выход распаковщика (ASVS V5.2.3).
 *
 * Тот же принцип, что в `image-dimensions.ts`, применённый к двум оставшимся
 * декодерам маршрута: предел размера файла защищает вход, а не выход. DEFLATE
 * даёт отношение около 1032:1, поэтому принимаемые восемь мегабайт разжимаются
 * примерно в восемь гигабайт, и происходит это внутри обработчика запроса на
 * маршруте, который не требует аутентификации.
 *
 * Требование говорит «before uncompressing», и одной проверки для него мало.
 * Объявленный несжатый размер лежит в центральном каталоге zip и его задаёт
 * отправитель — соврать в нём стоит двух байт. Поэтому границы две и они разной
 * природы:
 *
 *   1. `assertDeclaredEntry` — сверка объявленного до распаковки. Это буквально
 *      то, что просит требование, и это единственная половина, которая
 *      отказывает, не потратив ни байта памяти.
 *   2. `inflateWithinBudget` — `maxOutputLength` как исполняющая граница. Она
 *      делает утверждение истинным независимо от объявления и остаётся
 *      единственной защитой там, где объявления нет вовсе — в потоках PDF.
 *
 * Ни одна из них не заменяет другую: первая без второй верит отправителю,
 * вторая без первой позволяет потратить память до потолка на файле, который
 * сам объявил себя негодным.
 */

import { inflateRawSync, inflateSync } from 'node:zlib';

/** Не больше этого разжимается из одной записи или одного потока. */
export const MAX_INFLATED_ENTRY_BYTES = 64 * 1024 * 1024;

/**
 * Накопительный бюджет на запрос. Четыре файла, каждый в пределах нормы, вместе
 * исчерпывают память — ровно та причина, по которой пиксельный бюджет тоже
 * накопительный.
 */
export const MAX_REQUEST_INFLATED_BYTES = 96 * 1024 * 1024;

/** Столько записей максимум разбирается в архиве. Вторая половина требования. */
export const MAX_ARCHIVE_ENTRIES = 1_024;

/**
 * Отношение сжатия, выше которого запись считается бомбой без разбора
 * содержимого. Обычный docx держится в пределах нескольких десятков; 1032 —
 * теоретический потолок DEFLATE, и приблизиться к нему осмысленный документ не
 * может.
 */
export const MAX_DECLARED_COMPRESSION_RATIO = 200;

/**
 * Отказ по бюджету — не то же самое, что битый поток.
 *
 * `extractPdf` пропускает нечитаемые потоки и идёт дальше, и это правильно:
 * PDF в дикой природе бывает частично повреждён. Но если тем же `continue`
 * проматывать отказ по бюджету, граница перестаёт что-либо значить — отправитель
 * кладёт в файл сто бомб, каждая ловится и пропускается, и разбор продолжается.
 *
 * Поэтому у отказа по бюджету отдельный тип: вызывающий обязан отличить его от
 * повреждения и прервать разбор.
 */
export class DecompressionBudgetError extends Error {
  constructor(code: string) {
    super(code);
    this.name = 'DecompressionBudgetError';
  }
}

export type InflateBudget = { remaining: number };

export function createInflateBudget(): InflateBudget {
  return { remaining: MAX_REQUEST_INFLATED_BYTES };
}

/**
 * Проверка до распаковки — по числам, которые архив объявил о себе сам.
 *
 * Сюда попадают только заведомо негодные записи, и ни один байт на них не
 * тратится. Запись, которая соврала о своём размере, проходит эту проверку и
 * останавливается на `inflateWithinBudget`.
 */
export function assertDeclaredEntry(
  declaredUncompressedBytes: number,
  compressedBytes: number,
  budget: InflateBudget,
  label: string,
): void {
  if (!Number.isSafeInteger(declaredUncompressedBytes) || declaredUncompressedBytes < 0) {
    throw new DecompressionBudgetError(`ARCHIVE_ENTRY_SIZE_INVALID:${label}`);
  }
  if (declaredUncompressedBytes > MAX_INFLATED_ENTRY_BYTES) {
    throw new DecompressionBudgetError(`ARCHIVE_ENTRY_TOO_LARGE:${label}`);
  }
  if (declaredUncompressedBytes > budget.remaining) {
    throw new DecompressionBudgetError(`ARCHIVE_REQUEST_BUDGET_EXCEEDED:${label}`);
  }
  if (
    compressedBytes > 0 &&
    declaredUncompressedBytes / compressedBytes > MAX_DECLARED_COMPRESSION_RATIO
  ) {
    throw new DecompressionBudgetError(`ARCHIVE_COMPRESSION_RATIO_EXCEEDED:${label}`);
  }
}

export function assertArchiveEntryCount(entries: number, label: string): void {
  if (!Number.isSafeInteger(entries) || entries < 0) {
    throw new DecompressionBudgetError(`ARCHIVE_ENTRY_COUNT_INVALID:${label}`);
  }
  if (entries > MAX_ARCHIVE_ENTRIES) {
    throw new DecompressionBudgetError(`ARCHIVE_TOO_MANY_ENTRIES:${label}`);
  }
}

/**
 * Исполняющая граница. `maxOutputLength` останавливает zlib на потолке, а не
 * после того, как память уже занята: превышение приходит ошибкой из самого
 * распаковщика.
 *
 * Потолок берётся минимальным из предела записи и остатка бюджета, иначе
 * последний файл в запросе мог бы выйти за общий предел на величину своего
 * собственного.
 */
export function inflateWithinBudget(
  compressed: Buffer,
  budget: InflateBudget,
  options: { raw: boolean; label: string },
): Buffer {
  const ceiling = Math.min(MAX_INFLATED_ENTRY_BYTES, budget.remaining);
  if (ceiling <= 0) {
    throw new DecompressionBudgetError(`ARCHIVE_REQUEST_BUDGET_EXCEEDED:${options.label}`);
  }

  let inflated: Buffer;
  try {
    inflated = options.raw
      ? inflateRawSync(compressed, { maxOutputLength: ceiling })
      : inflateSync(compressed, { maxOutputLength: ceiling });
  } catch (error) {
    // zlib сообщает о превышении потолка кодом ERR_BUFFER_TOO_LARGE. Всё
    // остальное - повреждённый поток, и это другой разговор: он не обязан
    // прерывать разбор целиком.
    const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : '';
    if (code === 'ERR_BUFFER_TOO_LARGE') {
      throw new DecompressionBudgetError(`ARCHIVE_INFLATED_TOO_LARGE:${options.label}`);
    }
    throw error;
  }

  if (inflated.length > budget.remaining) {
    throw new DecompressionBudgetError(`ARCHIVE_REQUEST_BUDGET_EXCEEDED:${options.label}`);
  }
  budget.remaining -= inflated.length;
  return inflated;
}

/** Расширения, содержимое которых — zip-архив. */
const ARCHIVE_EXTENSIONS = new Set(['docx', 'xlsx']);

/** Маркер ZIP64: настоящий размер лежит в extra-поле, а не в этом. */
const ZIP64_SENTINEL = 0xffffffff;

export function isArchiveExtension(ext: string): boolean {
  return ARCHIVE_EXTENSIONS.has(ext);
}

/**
 * Проверка всего архива до любого распаковщика — та половина требования, ради
 * которой в нём стоит слово «before».
 *
 * Нужна отдельно от проверки одной записи, потому что xlsx распаковывает не этот
 * модуль, а ExcelJS: там исполняющей границы нет и не будет, и объявленные числа
 * — единственное, что можно спросить у файла, не потратив на него памяти.
 *
 * Нечитаемый каталог — отказ, а не пропуск. Тот же выбор, что в
 * `image-dimensions.ts` для нечитаемого заголовка: утверждать безопасность
 * файла, структуру которого не удалось прочитать, нечем.
 */
export function assertArchiveDeclared(ext: string, buffer: Buffer, budget: InflateBudget): void {
  if (!ARCHIVE_EXTENSIONS.has(ext)) return;

  let eocd = -1;
  for (let offset = Math.max(0, buffer.length - 65_557); offset <= buffer.length - 22; offset += 1) {
    if (buffer.readUInt32LE(offset) === 0x06054b50) eocd = offset;
  }
  if (eocd < 0) throw new DecompressionBudgetError(`ARCHIVE_DIRECTORY_UNREADABLE:${ext}`);

  const entries = buffer.readUInt16LE(eocd + 10);
  assertArchiveEntryCount(entries, ext);

  let cursor = buffer.readUInt32LE(eocd + 16);
  let declaredTotal = 0;
  for (let index = 0; index < entries; index += 1) {
    if (cursor + 46 > buffer.length || buffer.readUInt32LE(cursor) !== 0x02014b50) {
      throw new DecompressionBudgetError(`ARCHIVE_DIRECTORY_UNREADABLE:${ext}`);
    }
    const compressedSize = buffer.readUInt32LE(cursor + 20);
    const declaredSize = buffer.readUInt32LE(cursor + 24);
    if (declaredSize === ZIP64_SENTINEL || compressedSize === ZIP64_SENTINEL) {
      // Восьмимегабайтный загруженный файл ZIP64 не требуется. Читать его
      // extra-поле только ради того, чтобы отказать по размеру, незачем.
      throw new DecompressionBudgetError(`ARCHIVE_ZIP64_NOT_SUPPORTED:${ext}`);
    }
    const nameLength = buffer.readUInt16LE(cursor + 28);
    const extraLength = buffer.readUInt16LE(cursor + 30);
    const commentLength = buffer.readUInt16LE(cursor + 32);

    if (declaredSize > MAX_INFLATED_ENTRY_BYTES) {
      throw new DecompressionBudgetError(`ARCHIVE_ENTRY_TOO_LARGE:${ext}`);
    }
    if (
      compressedSize > 0 &&
      declaredSize / compressedSize > MAX_DECLARED_COMPRESSION_RATIO
    ) {
      throw new DecompressionBudgetError(`ARCHIVE_COMPRESSION_RATIO_EXCEEDED:${ext}`);
    }

    declaredTotal += declaredSize;
    if (declaredTotal > budget.remaining) {
      throw new DecompressionBudgetError(`ARCHIVE_REQUEST_BUDGET_EXCEEDED:${ext}`);
    }

    cursor += 46 + nameLength + extraLength + commentLength;
  }
}

/**
 * Чтение одной записи архива под бюджетом.
 *
 * Живёт здесь, а не в маршруте, по двум причинам. Маршрут App Router может
 * экспортировать только известные Next имена, поэтому вынесенное сюда можно
 * проверить тестом напрямую. И, что важнее, маршрут после этого не импортирует
 * `node:zlib` вовсе: пути распаковать что-либо в обход бюджета у него больше
 * нет.
 */
export function readArchiveEntry(buffer: Buffer, wanted: string, budget: InflateBudget): Buffer {
  let eocd = -1;
  for (let offset = Math.max(0, buffer.length - 65_557); offset <= buffer.length - 22; offset += 1) {
    if (buffer.readUInt32LE(offset) === 0x06054b50) eocd = offset;
  }
  if (eocd < 0) throw new Error('INVALID_ZIP_DOCUMENT');
  const entries = buffer.readUInt16LE(eocd + 10);
  assertArchiveEntryCount(entries, wanted);

  let cursor = buffer.readUInt32LE(eocd + 16);
  for (let index = 0; index < entries; index += 1) {
    if (buffer.readUInt32LE(cursor) !== 0x02014b50) throw new Error('INVALID_ZIP_DIRECTORY');
    const method = buffer.readUInt16LE(cursor + 10);
    const compressedSize = buffer.readUInt32LE(cursor + 20);
    // Соседнее поле каталога, которое до сих пор не читалось вовсе, и есть
    // предмет требования: объявленный несжатый размер записи.
    const declaredSize = buffer.readUInt32LE(cursor + 24);
    const nameLength = buffer.readUInt16LE(cursor + 28);
    const extraLength = buffer.readUInt16LE(cursor + 30);
    const commentLength = buffer.readUInt16LE(cursor + 32);
    const localOffset = buffer.readUInt32LE(cursor + 42);
    const name = buffer.subarray(cursor + 46, cursor + 46 + nameLength).toString('utf8');

    if (name === wanted) {
      if (buffer.readUInt32LE(localOffset) !== 0x04034b50) throw new Error('INVALID_ZIP_LOCAL_HEADER');
      const localNameLength = buffer.readUInt16LE(localOffset + 26);
      const localExtraLength = buffer.readUInt16LE(localOffset + 28);
      const start = localOffset + 30 + localNameLength + localExtraLength;
      const compressed = buffer.subarray(start, start + compressedSize);

      // До распаковки, по числам самого архива.
      assertDeclaredEntry(declaredSize, compressedSize, budget, wanted);

      if (method === 0) {
        if (compressed.length > budget.remaining) {
          throw new DecompressionBudgetError(`ARCHIVE_REQUEST_BUDGET_EXCEEDED:${wanted}`);
        }
        budget.remaining -= compressed.length;
        return compressed;
      }
      // И во время: объявление недостоверно, потолок - достоверен.
      if (method === 8) return inflateWithinBudget(compressed, budget, { raw: true, label: wanted });
      throw new Error('UNSUPPORTED_ZIP_COMPRESSION');
    }
    cursor += 46 + nameLength + extraLength + commentLength;
  }
  throw new Error('DOCUMENT_CONTENT_NOT_FOUND');
}

/**
 * Поток PDF под бюджетом. Возвращает `null` для повреждённого потока и
 * **бросает** при отказе по бюджету.
 *
 * Различие вынесено сюда намеренно. Разбор PDF пропускает нечитаемые потоки, и
 * это правильно: PDF в дикой природе бывает частично повреждён. Но если тем же
 * пропуском обходить отказ по бюджету, граница перестаёт что-либо значить -
 * отправитель кладёт в файл сто бомб, каждая ловится и пропускается, и разбор
 * идёт дальше. Решение принимается здесь, а не в `catch` вызывающего, чтобы
 * вызывающий не мог принять его неправильно.
 */
export function inflatePdfStream(stream: Buffer, budget: InflateBudget): Buffer | null {
  try {
    return inflateWithinBudget(stream, budget, { raw: false, label: 'pdf-stream' });
  } catch (error) {
    if (error instanceof DecompressionBudgetError) throw error;
    return null;
  }
}

/**
 * Проверка объявленного — необходимая, но не достаточная.
 *
 * Объявленный размер пишет отправитель, и для docx и PDF за ним стоит
 * исполняющая граница: распаковывает их этот модуль, и `maxOutputLength`
 * останавливает бомбу независимо от того, что она о себе сказала.
 *
 * Для xlsx такой границы нет: распаковывает ExcelJS через JSZip, а тот сверяет
 * объявленный размер с фактическим уже **после** того, как данные получены.
 * Значит подделанный на два байта каталог проходил предпроверку и дальше
 * разжимался без потолка — и предъявлять это как закрытое требование было бы
 * неправдой.
 *
 * Поэтому записи xlsx распаковываются здесь, под тем же бюджетом, и результат
 * выбрасывается. Это доказывает, что каталог не соврал, и списывает с бюджета
 * ровно те байты, которые ExcelJS затем и займёт, — списания не удваивая.
 * Пиковая память самой проверки — одна запись: разжатое не удерживается.
 */
export function assertArchiveInflatesWithinBudget(
  ext: string,
  buffer: Buffer,
  budget: InflateBudget,
): void {
  if (!ARCHIVE_EXTENSIONS.has(ext)) return;

  let eocd = -1;
  for (let offset = Math.max(0, buffer.length - 65_557); offset <= buffer.length - 22; offset += 1) {
    if (buffer.readUInt32LE(offset) === 0x06054b50) eocd = offset;
  }
  if (eocd < 0) throw new DecompressionBudgetError(`ARCHIVE_DIRECTORY_UNREADABLE:${ext}`);

  const entries = buffer.readUInt16LE(eocd + 10);
  assertArchiveEntryCount(entries, ext);

  let cursor = buffer.readUInt32LE(eocd + 16);
  for (let index = 0; index < entries; index += 1) {
    if (cursor + 46 > buffer.length || buffer.readUInt32LE(cursor) !== 0x02014b50) {
      throw new DecompressionBudgetError(`ARCHIVE_DIRECTORY_UNREADABLE:${ext}`);
    }
    const method = buffer.readUInt16LE(cursor + 10);
    const compressedSize = buffer.readUInt32LE(cursor + 20);
    const nameLength = buffer.readUInt16LE(cursor + 28);
    const extraLength = buffer.readUInt16LE(cursor + 30);
    const commentLength = buffer.readUInt16LE(cursor + 32);
    const localOffset = buffer.readUInt32LE(cursor + 42);

    if (localOffset + 30 > buffer.length || buffer.readUInt32LE(localOffset) !== 0x04034b50) {
      throw new DecompressionBudgetError(`ARCHIVE_DIRECTORY_UNREADABLE:${ext}`);
    }
    const localNameLength = buffer.readUInt16LE(localOffset + 26);
    const localExtraLength = buffer.readUInt16LE(localOffset + 28);
    const start = localOffset + 30 + localNameLength + localExtraLength;
    const compressed = buffer.subarray(start, start + compressedSize);

    if (method === 0) {
      if (compressed.length > budget.remaining) {
        throw new DecompressionBudgetError(`ARCHIVE_REQUEST_BUDGET_EXCEEDED:${ext}`);
      }
      budget.remaining -= compressed.length;
    } else if (method === 8) {
      // Результат не нужен: нужен сам факт, что он умещается в потолок.
      inflateWithinBudget(compressed, budget, { raw: true, label: ext });
    } else {
      throw new DecompressionBudgetError(`ARCHIVE_UNSUPPORTED_COMPRESSION:${ext}`);
    }

    cursor += 46 + nameLength + extraLength + commentLength;
  }
}
