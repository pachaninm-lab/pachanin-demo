import { createHash, randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import ExcelJS from 'exceljs';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const MAX_FILES = 4;
const MAX_FILE_BYTES = 8 * 1024 * 1024;
const MAX_TOTAL_BYTES = 24 * 1024 * 1024;
const MAX_EXTRACTED_CHARS = 18_000;

const TEXT_EXTENSIONS = new Set(['txt', 'md', 'csv', 'json', 'xml']);
const RECOGNIZED_BUT_NOT_CONNECTED = new Set(['pdf', 'docx', 'doc', 'png', 'jpg', 'jpeg', 'heic']);

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
    .replace(/\n{4,}/gu, '\n\n\n')
    .trim();
  return {
    text: normalized.slice(0, MAX_EXTRACTED_CHARS),
    truncated: normalized.length > MAX_EXTRACTED_CHARS,
  };
}

async function extractWorkbook(file: File): Promise<{ text: string; truncated: boolean }> {
  const workbook = new ExcelJS.Workbook();
  const bytes = Buffer.from(await file.arrayBuffer());
  await workbook.xlsx.load(bytes);
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

async function extract(file: File): Promise<ExtractedDocument> {
  const ext = extension(file.name);
  const bytes = Buffer.from(await file.arrayBuffer());
  const checksumSha256 = createHash('sha256').update(bytes).digest('hex');
  let extracted: { text: string; truncated: boolean };

  if (TEXT_EXTENSIONS.has(ext)) {
    extracted = cleanText(bytes.toString('utf8'));
  } else if (ext === 'xlsx') {
    extracted = await extractWorkbook(file);
  } else if (RECOGNIZED_BUT_NOT_CONNECTED.has(ext)) {
    throw new Error(`PROCESSOR_NOT_CONNECTED:${ext}`);
  } else {
    throw new Error(`UNSUPPORTED_FILE_TYPE:${ext || 'unknown'}`);
  }

  if (!extracted.text) throw new Error('EMPTY_DOCUMENT');
  return {
    id: randomUUID(),
    name: file.name.slice(0, 180),
    mediaType: file.type || 'application/octet-stream',
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
  for (const file of files) {
    try {
      documents.push(await extract(file));
    } catch (error) {
      const code = error instanceof Error ? error.message : 'DOCUMENT_EXTRACTION_FAILED';
      rejected.push({ name: file.name.slice(0, 180), code });
    }
  }

  if (!documents.length) return json({ error: 'NO_DOCUMENTS_EXTRACTED', rejected }, 422);
  return json({ documents, rejected, limits: { maxFiles: MAX_FILES, maxFileBytes: MAX_FILE_BYTES } });
}
