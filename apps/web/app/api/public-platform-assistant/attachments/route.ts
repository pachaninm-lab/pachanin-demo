import { createHash, randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { NextRequest, NextResponse } from 'next/server';
import ExcelJS from 'exceljs';
import {
  MEDIA_TYPES,
  TEXT_EXTENSIONS,
  assertContentMatchesExtension,
} from '../../../../lib/uploads/content-signature';
import {
  type PixelBudget,
  assertImageWithinPixelBudget,
  createPixelBudget,
} from '../../../../lib/uploads/image-dimensions';
import {
  type InflateBudget,
  assertArchiveDeclared,
  createInflateBudget,
  inflatePdfStream,
  readArchiveEntry,
} from '../../../../lib/uploads/decompression-budget';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const execFileAsync = promisify(execFile);
const MAX_FILES = 4;
const MAX_FILE_BYTES = 8 * 1024 * 1024;
const MAX_TOTAL_BYTES = 24 * 1024 * 1024;
const MAX_EXTRACTED_CHARS = 18_000;
const MAX_OCR_PDF_PAGES = 4;
const OCR_TIMEOUT_MS = 30_000;
const MIN_NATIVE_PDF_TEXT = 80;
const OCR_LANGUAGES = 'rus+eng+chi_sim';

const IMAGE_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'heic']);
const RECOGNIZED_BUT_NOT_CONNECTED = new Set(['doc']);

type ExtractedDocument = Readonly<{
  id: string;
  name: string;
  mediaType: string;
  size: number;
  checksumSha256: string;
  text: string;
  truncated: boolean;
}>;

function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      'Cache-Control': 'no-store, max-age=0',
      'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'",
      'Referrer-Policy': 'no-referrer',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

function extension(name: string): string {
  const value = name.toLowerCase().split('.').pop();
  return value && value !== name.toLowerCase() ? value : '';
}

function cleanText(value: string): { text: string; truncated: boolean } {
  const normalized = value
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/gu, ' ')
    .replace(/[ \t]+/gu, ' ')
    .replace(/ *\n */gu, '\n')
    .replace(/\n{4,}/gu, '\n\n\n')
    .trim();
  return {
    text: normalized.slice(0, MAX_EXTRACTED_CHARS),
    truncated: normalized.length > MAX_EXTRACTED_CHARS,
  };
}

function decodeXml(value: string): string {
  return value
    .replace(/&lt;/gu, '<')
    .replace(/&gt;/gu, '>')
    .replace(/&quot;/gu, '"')
    .replace(/&apos;/gu, "'")
    .replace(/&amp;/gu, '&');
}

function extractDocx(bytes: Buffer, budget: InflateBudget): { text: string; truncated: boolean } {
  const xml = readArchiveEntry(bytes, 'word/document.xml', budget).toString('utf8');
  const text = decodeXml(xml)
    .replace(/<w:tab\b[^>]*\/>/gu, '\t')
    .replace(/<w:br\b[^>]*\/>/gu, '\n')
    .replace(/<\/w:p>/gu, '\n')
    .replace(/<[^>]+>/gu, ' ');
  return cleanText(text);
}

function decodePdfLiteral(value: string): string {
  return value
    .replace(/\\([0-7]{1,3})/gu, (_, octal: string) => String.fromCharCode(Number.parseInt(octal, 8)))
    .replace(/\\n/gu, '\n')
    .replace(/\\r/gu, '\r')
    .replace(/\\t/gu, '\t')
    .replace(/\\b/gu, '\b')
    .replace(/\\f/gu, '\f')
    .replace(/\\([()\\])/gu, '$1');
}

function decodePdfHex(value: string): string {
  const normalized = value.replace(/\s+/gu, '');
  if (!normalized || !/^[0-9a-f]+$/iu.test(normalized)) return '';
  const bytes = Buffer.from(normalized.length % 2 ? `${normalized}0` : normalized, 'hex');
  if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
    let output = '';
    for (let offset = 2; offset + 1 < bytes.length; offset += 2) output += String.fromCharCode(bytes.readUInt16BE(offset));
    return output;
  }
  return bytes.toString('latin1');
}

function pdfTextOperators(content: string): string[] {
  const values: string[] = [];
  for (const match of content.matchAll(/\((?:\\.|[^\\)])*\)\s*Tj/gu)) {
    const literal = match[0].replace(/\s*Tj$/u, '').slice(1, -1);
    values.push(decodePdfLiteral(literal));
  }
  for (const match of content.matchAll(/<([0-9a-f\s]+)>\s*Tj/giu)) values.push(decodePdfHex(match[1]));
  for (const match of content.matchAll(/\[([\s\S]*?)\]\s*TJ/gu)) {
    const body = match[1];
    for (const literal of body.matchAll(/\((?:\\.|[^\\)])*\)/gu)) values.push(decodePdfLiteral(literal[0].slice(1, -1)));
    for (const hex of body.matchAll(/<([0-9a-f\s]+)>/giu)) values.push(decodePdfHex(hex[1]));
  }
  return values;
}

function extractPdf(bytes: Buffer, budget: InflateBudget): { text: string; truncated: boolean } {
  const source = bytes.toString('latin1');
  const values = pdfTextOperators(source);
  const streamPattern = /stream\r?\n([\s\S]*?)\r?\nendstream/gu;
  for (const match of source.matchAll(streamPattern)) {
    const start = match.index ?? 0;
    const dictionary = source.slice(Math.max(0, start - 500), start);
    let stream: Buffer = Buffer.from(match[1], 'latin1');
    if (/\/FlateDecode\b/u.test(dictionary)) {
      // У потока PDF объявленного несжатого размера нет, поэтому здесь работает
      // только исполняющая граница. Пропуск повреждённого потока и отказ по
      // бюджету разделяет сам вызываемый, а не catch здесь: у этого места нет
      // возможности перепутать их.
      const inflated = inflatePdfStream(stream, budget);
      if (inflated === null) continue;
      stream = inflated;
    }
    values.push(...pdfTextOperators(stream.toString('latin1')));
  }
  return cleanText(values.join('\n'));
}

async function runBinary(command: string, args: string[]): Promise<void> {
  try {
    await execFileAsync(command, args, {
      timeout: OCR_TIMEOUT_MS,
      maxBuffer: 2 * 1024 * 1024,
      windowsHide: true,
      env: {
        ...process.env,
        PATH: process.env.PATH || '/usr/local/bin:/usr/bin:/bin',
        TESSDATA_PREFIX: process.env.TESSDATA_PREFIX || '/usr/share/tesseract-ocr/5/tessdata',
        LANG: 'C.UTF-8',
      },
    });
  } catch (error) {
    const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : '';
    if (code === 'ETIMEDOUT') throw new Error('OCR_TIMEOUT');
    throw new Error('OCR_PROCESSING_FAILED');
  }
}

async function ocrImage(bytes: Buffer, ext: string): Promise<{ text: string; truncated: boolean }> {
  const workdir = await mkdtemp(join(tmpdir(), 'tai-ocr-'));
  try {
    const source = join(workdir, `source.${ext === 'jpeg' ? 'jpg' : ext}`);
    const normalized = join(workdir, 'normalized.png');
    const outputBase = join(workdir, 'result');
    await writeFile(source, bytes, { mode: 0o600 });

    const input = ext === 'heic' ? normalized : source;
    if (ext === 'heic') {
      await runBinary('/usr/bin/convert', [source, '-auto-orient', '-strip', normalized]);
    }

    await runBinary('/usr/bin/tesseract', [input, outputBase, '-l', OCR_LANGUAGES, '--oem', '1', '--psm', '3']);
    return cleanText(await readFile(`${outputBase}.txt`, 'utf8'));
  } finally {
    await rm(workdir, { recursive: true, force: true });
  }
}

async function ocrPdf(bytes: Buffer): Promise<{ text: string; truncated: boolean }> {
  const workdir = await mkdtemp(join(tmpdir(), 'tai-ocr-pdf-'));
  try {
    const source = join(workdir, 'source.pdf');
    const pagePrefix = join(workdir, 'page');
    await writeFile(source, bytes, { mode: 0o600 });
    await runBinary('/usr/bin/pdftoppm', [
      '-f', '1', '-l', String(MAX_OCR_PDF_PAGES), '-r', '180', '-png', source, pagePrefix,
    ]);

    const pages = (await readdir(workdir))
      .filter((name) => name.startsWith('page') && name.endsWith('.png'))
      .sort()
      .slice(0, MAX_OCR_PDF_PAGES);
    if (!pages.length) throw new Error('OCR_PROCESSING_FAILED');

    const chunks: string[] = [];
    for (const [index, page] of pages.entries()) {
      const outputBase = join(workdir, `ocr-${index + 1}`);
      await runBinary('/usr/bin/tesseract', [join(workdir, page), outputBase, '-l', OCR_LANGUAGES, '--oem', '1', '--psm', '3']);
      chunks.push(await readFile(`${outputBase}.txt`, 'utf8'));
    }
    return cleanText(chunks.join('\n\n'));
  } finally {
    await rm(workdir, { recursive: true, force: true });
  }
}

async function extractWorkbook(file: File): Promise<{ text: string; truncated: boolean }> {
  const workbook = new ExcelJS.Workbook();
  const bytes = Buffer.from(new Uint8Array(await file.arrayBuffer()));
  await workbook.xlsx.load(bytes as unknown as Parameters<typeof workbook.xlsx.load>[0]);
  const lines: string[] = [];
  workbook.eachSheet((sheet) => {
    lines.push(`# ${sheet.name}`);
    sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      const values = row.values;
      const cells = Array.isArray(values)
        ? values.slice(1).map((value) => {
            if (value === null || value === undefined) return '';
            if (typeof value === 'object' && 'text' in value && typeof value.text === 'string') return value.text;
            if (typeof value === 'object' && 'result' in value) return String(value.result ?? '');
            return String(value);
          })
        : [];
      lines.push(`${rowNumber}: ${cells.join(' | ')}`);
    });
  });
  return cleanText(lines.join('\n'));
}

async function extract(
  file: File,
  budget: PixelBudget,
  inflateBudget: InflateBudget,
): Promise<ExtractedDocument> {
  const ext = extension(file.name);
  const bytes: Buffer = Buffer.from(new Uint8Array(await file.arrayBuffer()));
  const checksumSha256 = createHash('sha256').update(bytes).digest('hex');
  let extracted: { text: string; truncated: boolean };

  // До любого разбора: содержимое обязано соответствовать расширению, иначе
  // обработчик выбирается строкой, которую задаёт отправитель.
  assertContentMatchesExtension(ext, bytes);

  // И до запуска декодера: объявленные размеры обязаны укладываться в пределы.
  // Предел размера файла ограничивает вход, а не выход распаковщика.
  assertImageWithinPixelBudget(ext, bytes, budget);

  // То же правило для архивов. Здесь оно нужно ещё и потому, что xlsx
  // распаковывает ExcelJS: остановить его на потолке нельзя, и объявленные
  // числа - единственное, что можно спросить у файла до этого.
  assertArchiveDeclared(ext, bytes, inflateBudget);

  if (TEXT_EXTENSIONS.has(ext)) {
    extracted = cleanText(bytes.toString('utf8'));
  } else if (ext === 'xlsx') {
    extracted = await extractWorkbook(file);
  } else if (ext === 'docx') {
    extracted = extractDocx(bytes, inflateBudget);
  } else if (ext === 'pdf') {
    const native = extractPdf(bytes, inflateBudget);
    extracted = native.text.length >= MIN_NATIVE_PDF_TEXT ? native : await ocrPdf(bytes);
  } else if (IMAGE_EXTENSIONS.has(ext)) {
    extracted = await ocrImage(bytes, ext);
  } else if (RECOGNIZED_BUT_NOT_CONNECTED.has(ext)) {
    throw new Error(`PROCESSOR_NOT_CONNECTED:${ext}`);
  } else {
    throw new Error(`UNSUPPORTED_FILE_TYPE:${ext || 'unknown'}`);
  }

  if (!extracted.text) throw new Error('EMPTY_DOCUMENT');
  return {
    id: randomUUID(),
    name: file.name.slice(0, 180),
    mediaType: MEDIA_TYPES[ext] ?? 'application/octet-stream',
    size: file.size,
    checksumSha256,
    text: extracted.text,
    truncated: extracted.truncated,
  };
}

export async function POST(request: NextRequest) {
  if (request.headers.get('sec-fetch-site') === 'cross-site') {
    return json({ error: 'CROSS_SITE_REQUEST_BLOCKED' }, 403);
  }

  const declaredLength = Number(request.headers.get('content-length') || '0');
  if (Number.isFinite(declaredLength) && declaredLength > MAX_TOTAL_BYTES + 1_000_000) {
    return json({ error: 'UPLOAD_TOO_LARGE' }, 413);
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return json({ error: 'INVALID_MULTIPART_BODY' }, 400);
  }

  const files = form.getAll('files').filter((entry): entry is File => entry instanceof File);
  if (!files.length) return json({ error: 'FILES_REQUIRED' }, 400);
  if (files.length > MAX_FILES) return json({ error: 'TOO_MANY_FILES', maxFiles: MAX_FILES }, 400);

  const total = files.reduce((sum, file) => sum + file.size, 0);
  if (total > MAX_TOTAL_BYTES || files.some((file) => file.size > MAX_FILE_BYTES)) {
    return json({ error: 'UPLOAD_TOO_LARGE', maxFileBytes: MAX_FILE_BYTES, maxTotalBytes: MAX_TOTAL_BYTES }, 413);
  }

  const documents: ExtractedDocument[] = [];
  const rejected: Array<{ name: string; code: string }> = [];
  const budget = createPixelBudget();
  const inflateBudget = createInflateBudget();
  for (const file of files) {
    try {
      documents.push(await extract(file, budget, inflateBudget));
    } catch (error) {
      const code = error instanceof Error ? error.message : 'DOCUMENT_EXTRACTION_FAILED';
      rejected.push({ name: file.name.slice(0, 180), code });
    }
  }

  if (!documents.length) return json({ error: 'NO_DOCUMENTS_EXTRACTED', rejected }, 422);
  return json({
    documents,
    rejected,
    limits: {
      maxFiles: MAX_FILES,
      maxFileBytes: MAX_FILE_BYTES,
      maxOcrPdfPages: MAX_OCR_PDF_PAGES,
    },
  });
}
