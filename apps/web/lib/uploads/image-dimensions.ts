/**
 * Ограниченное чтение размеров изображения из заголовка (ASVS V5.2.6).
 *
 * Модуль читает только заголовок и не декодирует ни одного пикселя. Он нужен
 * потому, что предел размера файла защищает вход, а не выход декодера: сжатие
 * даёт отношение в тысячи раз, и стобайтовый PNG может объявить 65535×65535.
 * Таймаут в runBinary ограничивает время, а не резидентную память, и
 * исчерпание памяти наступает раньше, чем он сработает.
 *
 * Почему не библиотека: sharp присутствует в репозитории только как запись в
 * pnpm.overrides и из apps/web не разрешается, а apps/web не объявляет ни одной
 * image-библиотеки. Почему не ImageMagick: Dockerfile.web копирует в рантайм
 * только convert, identify туда не попадает вовсе, а в среде сборки этой
 * проверки нет ни одного декодера, поэтому решение на внешнем бинаре нельзя
 * подтвердить прогоном.
 *
 * Это не универсальный парсер изображений. Это три конкретные структуры
 * заголовка тех трёх форматов, которые маршрут действительно принимает, с
 * проверкой границ на каждом чтении и жёстким пределом числа итераций.
 */

/** Пределы. Подобраны так, чтобы покрывать съёмку документа телефоном и скан A4 до 400 dpi. */
export const MAX_IMAGE_WIDTH = 20_000;
export const MAX_IMAGE_HEIGHT = 20_000;
/** 30 мегапикселей на изображение: ~120 МБ в RGBA, верхняя граница современных телефонных матриц. */
export const MAX_IMAGE_PIXELS = 30_000_000;
/** Накопительный бюджет на запрос: до четырёх файлов, но не больше этого суммарно. */
export const MAX_REQUEST_IMAGE_PIXELS = 60_000_000;

/** Столько боксов и маркеров разбирается максимум, чтобы разбор сам не стал нагрузкой. */
const MAX_HEADER_STEPS = 512;

export type ImageGeometry = Readonly<{ width: number; height: number; frames: number }>;

function readUInt32BE(bytes: Buffer, offset: number): number | null {
  return offset + 4 <= bytes.length ? bytes.readUInt32BE(offset) : null;
}

/**
 * PNG: сигнатура восемь байт, затем длина и тип чанка. IHDR обязателен и идёт
 * первым, ширина и высота лежат сразу за его типом. acTL, если он есть,
 * объявляет число кадров APNG - его нужно учесть, иначе многокадровый файл
 * обойдёт пиксельный бюджет по одному кадру.
 */
function pngGeometry(bytes: Buffer): ImageGeometry | null {
  if (bytes.length < 24) return null;
  if (bytes.toString('latin1', 12, 16) !== 'IHDR') return null;
  const width = readUInt32BE(bytes, 16);
  const height = readUInt32BE(bytes, 20);
  if (width === null || height === null) return null;

  let frames = 1;
  let offset = 8;
  for (let step = 0; step < MAX_HEADER_STEPS; step += 1) {
    const length = readUInt32BE(bytes, offset);
    if (length === null || length > bytes.length) break;
    const type = bytes.length >= offset + 8 ? bytes.toString('latin1', offset + 4, offset + 8) : '';
    if (!type) break;
    if (type === 'acTL') {
      const declared = readUInt32BE(bytes, offset + 8);
      if (declared !== null && declared > 0) frames = declared;
      break;
    }
    if (type === 'IDAT' || type === 'IEND') break;
    offset += 12 + length;
    if (offset <= 8 || offset >= bytes.length) break;
  }
  return { width, height, frames };
}

/**
 * JPEG: обход маркеров от смещения два. Сегменты пропускаются по объявленной
 * длине; SOF0..SOF15 несут размеры, кроме DHT, JPG, DAC, которые делят тот же
 * диапазон. Высота идёт перед шириной.
 */
function jpegGeometry(bytes: Buffer): ImageGeometry | null {
  let offset = 2;
  for (let step = 0; step < MAX_HEADER_STEPS; step += 1) {
    if (offset + 4 > bytes.length) return null;
    if (bytes[offset] !== 0xff) return null;
    const marker = bytes[offset + 1];
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      offset += 2;
      continue;
    }
    const length = bytes.readUInt16BE(offset + 2);
    if (length < 2) return null;
    const isStartOfFrame = marker >= 0xc0 && marker <= 0xcf
      && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
    if (isStartOfFrame) {
      if (offset + 9 > bytes.length) return null;
      const height = bytes.readUInt16BE(offset + 5);
      const width = bytes.readUInt16BE(offset + 7);
      return { width, height, frames: 1 };
    }
    if (marker === 0xda) return null; // начало данных: размеры так и не встретились
    offset += 2 + length;
  }
  return null;
}

/**
 * ISO-BMFF (HEIC): обход боксов в поисках ispe, который объявляет размеры.
 * Файл может нести несколько изображений, поэтому берётся максимум по всем
 * найденным ispe, а их количество - как число кадров: бюджет должен покрывать
 * то, что декодер может развернуть, а не только первое изображение.
 */
function isoBmffGeometry(bytes: Buffer): ImageGeometry | null {
  let width = 0;
  let height = 0;
  let found = 0;
  for (let offset = 0, step = 0; step < MAX_HEADER_STEPS; step += 1) {
    const marker = bytes.indexOf('ispe', offset, 'latin1');
    if (marker < 0) break;
    const declaredWidth = readUInt32BE(bytes, marker + 8);
    const declaredHeight = readUInt32BE(bytes, marker + 12);
    if (declaredWidth !== null && declaredHeight !== null) {
      width = Math.max(width, declaredWidth);
      height = Math.max(height, declaredHeight);
      found += 1;
    }
    offset = marker + 4;
    if (offset >= bytes.length) break;
  }
  return found > 0 ? { width, height, frames: found } : null;
}

/** Размеры для тех и только тех типов, которые маршрут принимает как изображения. */
export function readImageGeometry(kind: string, bytes: Buffer): ImageGeometry | null {
  if (kind === 'png') return pngGeometry(bytes);
  if (kind === 'jpeg') return jpegGeometry(bytes);
  if (kind === 'isobmff') return isoBmffGeometry(bytes);
  return null;
}

/** Расширение -> тип содержимого, который для него читается. */
const GEOMETRY_KIND: Readonly<Record<string, string>> = {
  png: 'png',
  jpg: 'jpeg',
  jpeg: 'jpeg',
  heic: 'isobmff',
};

export function isImageExtension(ext: string): boolean {
  return Object.prototype.hasOwnProperty.call(GEOMETRY_KIND, ext);
}

/**
 * Бюджет запроса. Изменяемый объект, потому что предел накопительный: четыре
 * файла по отдельности в пределах нормы могут вместе исчерпать память.
 */
export type PixelBudget = { remaining: number };

export function createPixelBudget(): PixelBudget {
  return { remaining: MAX_REQUEST_IMAGE_PIXELS };
}

/**
 * Отказ до записи файла на диск и до запуска декодера.
 *
 * Нечитаемый заголовок - это отказ, а не пропуск: IHDR для PNG, SOF для JPEG и
 * ispe для HEIC обязательны по своим спецификациям, поэтому невозможность их
 * прочитать означает malformed, и утверждать безопасность такого файла нечем.
 *
 * Порядок проверок исключает переполнение: ширина и высота сверяются с
 * пределами по отдельности до умножения, поэтому произведение заведомо не
 * выходит за безопасный диапазон. Кадры домножаются после того, как площадь
 * одного кадра уже ограничена.
 */
export function assertImageWithinPixelBudget(ext: string, bytes: Buffer, budget: PixelBudget): void {
  const kind = GEOMETRY_KIND[ext];
  if (!kind) return;

  const geometry = readImageGeometry(kind, bytes);
  if (geometry === null) throw new Error(`IMAGE_HEADER_UNREADABLE:${ext}`);

  const { width, height, frames } = geometry;
  if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height) || !Number.isSafeInteger(frames)) {
    throw new Error(`IMAGE_DIMENSIONS_INVALID:${ext}`);
  }
  if (width <= 0 || height <= 0 || frames <= 0) throw new Error(`IMAGE_DIMENSIONS_INVALID:${ext}`);
  if (width > MAX_IMAGE_WIDTH) throw new Error(`IMAGE_WIDTH_EXCEEDED:${ext}`);
  if (height > MAX_IMAGE_HEIGHT) throw new Error(`IMAGE_HEIGHT_EXCEEDED:${ext}`);

  const perFrame = width * height;
  if (perFrame > MAX_IMAGE_PIXELS) throw new Error(`IMAGE_PIXELS_EXCEEDED:${ext}`);

  const total = perFrame * frames;
  if (total > MAX_IMAGE_PIXELS) throw new Error(`IMAGE_PIXELS_EXCEEDED:${ext}`);
  if (total > budget.remaining) throw new Error(`IMAGE_REQUEST_PIXEL_BUDGET_EXCEEDED:${ext}`);

  budget.remaining -= total;
}
