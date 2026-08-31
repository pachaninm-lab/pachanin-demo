/**
 * Проверка того, что содержимое загруженного файла соответствует расширению его
 * имени (ASVS V5.2.2).
 *
 * Модуль вынесен из маршрута загрузки и не имеет зависимостей: маршрут тянет
 * next/server, ExcelJS и дочерние процессы, а этот контроль должен быть
 * проверяем сам по себе, без всего этого. Импортируется маршрутом и его тестом.
 */

/** Форматы без сигнатуры: у plain text её не существует. */
export const TEXT_EXTENSIONS = new Set(['txt', 'md', 'csv', 'json', 'xml']);

/**
 * Сигнатуры содержимого для форматов, которые маршрут принимает.
 *
 * Расширение имени выбирает обработчик, а имя целиком контролирует отправитель,
 * поэтому до разбора байтов нужно убедиться, что содержимое соответствует
 * заявленному типу (ASVS V5.2.2). Сравнение идёт по первым байтам: новых
 * зависимостей это не требует, а разбор недоверенных байтов перестаёт зависеть
 * от недоверенной строки.
 *
 * `zip` намеренно один для docx и xlsx: оба — ZIP-контейнеры, и различить их
 * можно только по содержимому архива. Это делают сами экстракторы, которые
 * падают на чужом архиве; здесь проверяется контейнер.
 */
export const CONTENT_SIGNATURES: ReadonlyArray<{
  kind: string;
  offset: number;
  bytes: readonly number[];
}> = [
  { kind: 'png', offset: 0, bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
  { kind: 'jpeg', offset: 0, bytes: [0xff, 0xd8, 0xff] },
  { kind: 'pdf', offset: 0, bytes: [0x25, 0x50, 0x44, 0x46, 0x2d] },
  { kind: 'zip', offset: 0, bytes: [0x50, 0x4b, 0x03, 0x04] },
  { kind: 'zip', offset: 0, bytes: [0x50, 0x4b, 0x05, 0x06] },
  { kind: 'zip', offset: 0, bytes: [0x50, 0x4b, 0x07, 0x08] },
  { kind: 'ole2', offset: 0, bytes: [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1] },
  // ISO-BMFF: длина бокса занимает первые четыре байта, тип начинается с пятого.
  { kind: 'isobmff', offset: 4, bytes: [0x66, 0x74, 0x79, 0x70] },
];

/** Бренды ISO-BMFF, которыми маркируется HEIC; прочие контейнеры не принимаются. */
const HEIC_BRANDS = new Set(['heic', 'heix', 'heim', 'heis', 'hevc', 'hevx', 'mif1', 'msf1']);

/** Тип, устанавливаемый сервером; клиентский file.type в ответ не попадает. */
export const MEDIA_TYPES: Readonly<Record<string, string>> = {
  txt: 'text/plain',
  md: 'text/markdown',
  csv: 'text/csv',
  json: 'application/json',
  xml: 'application/xml',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  heic: 'image/heic',
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
};

/** Что расширение обязано увидеть в содержимом. Текстовых форматов здесь нет намеренно. */
const EXPECTED_CONTENT: Readonly<Record<string, string>> = {
  png: 'png',
  jpg: 'jpeg',
  jpeg: 'jpeg',
  heic: 'isobmff',
  pdf: 'pdf',
  docx: 'zip',
  xlsx: 'zip',
  doc: 'ole2',
};

/**
 * Что эта проверка доказывает, и чего не доказывает.
 *
 * Доказывает: ведущая сигнатура содержимого соответствует заявленному
 * расширению, поэтому разбор больше не выбирается строкой от отправителя.
 *
 * НЕ доказывает, что файл является исключительно этим типом. Polyglot —
 * например, PDF-заголовок и ZIP-тело — определится по ведущей сигнатуре как
 * pdf: под расширением .pdf он пройдёт, под .docx, .xlsx, .png и .txt будет
 * отвергнут. Направление отказа безопасное, но «устойчивость к polyglot» здесь
 * не заявляется и заявляться не должна. Ответственность за содержимое после
 * этой точки остаётся на самих экстракторах.
 *
 * Также не доказывает различение docx и xlsx: оба ZIP, и обоим один и тот же
 * архив проходит проверку. Различает их только содержимое архива, что делают
 * экстракторы.
 */
export function detectContent(bytes: Buffer): string | null {
  for (const signature of CONTENT_SIGNATURES) {
    const end = signature.offset + signature.bytes.length;
    if (bytes.length < end) continue;
    if (signature.bytes.every((byte, index) => bytes[signature.offset + index] === byte)) {
      return signature.kind;
    }
  }
  return null;
}

/**
 * Сверяет заявленное расширение с содержимым.
 *
 * Для текстовых форматов утверждать нечего: у plain text нет сигнатуры, и
 * говорить, будто мы её проверяем, было бы неправдой. Проверяется ровно то, что
 * здесь проверяемо, — что файл с текстовым расширением не является узнаваемым
 * бинарным контейнером. Так `.txt`, внутри которого PDF или ZIP, отвергается,
 * а настоящий текст проходит.
 */
export function assertContentMatchesExtension(ext: string, bytes: Buffer): void {
  const detected = detectContent(bytes);

  if (TEXT_EXTENSIONS.has(ext)) {
    if (detected !== null) throw new Error(`CONTENT_TYPE_MISMATCH:${ext}`);
    return;
  }

  const expected = EXPECTED_CONTENT[ext];
  if (!expected) return;
  if (detected !== expected) throw new Error(`CONTENT_TYPE_MISMATCH:${ext}`);

  if (ext === 'heic') {
    const brand = bytes.length >= 12 ? bytes.subarray(8, 12).toString('latin1').toLowerCase() : '';
    if (!HEIC_BRANDS.has(brand)) throw new Error(`CONTENT_TYPE_MISMATCH:${ext}`);
  }
}
