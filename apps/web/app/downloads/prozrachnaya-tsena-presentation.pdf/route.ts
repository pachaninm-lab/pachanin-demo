import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { brotliDecompressSync } from 'node:zlib';
import { NextResponse } from 'next/server';

const EXPECTED_BASE64_LENGTH = 264564;
const EXPECTED_BROTLI_BYTES = 198423;
const EXPECTED_PDF_BYTES = 312533;
const PRESENTATION_PART_COUNT = 14;

let cachedPresentationPdf: Uint8Array | undefined;

function readPresentationPart(index: number): string {
  const suffix = String(index).padStart(2, '0');
  const source = readFileSync(
    resolve(process.cwd(), `lib/presentation-pdf/part-${suffix}.ts`),
    'utf8',
  );
  const literals = [...source.matchAll(/"([A-Za-z0-9+/=]+)"/g)].map(
    (match) => match[1],
  );

  if (literals.length === 0) {
    throw new Error(`Presentation part ${suffix} contains no Base64 payload.`);
  }

  return literals.join('');
}

function loadPresentationPdf(): Uint8Array {
  if (cachedPresentationPdf) {
    return cachedPresentationPdf;
  }

  const base64 = Array.from(
    { length: PRESENTATION_PART_COUNT },
    (_, index) => readPresentationPart(index),
  ).join('');

  if (base64.length !== EXPECTED_BASE64_LENGTH) {
    throw new Error(`Presentation Base64 length mismatch: ${base64.length}`);
  }

  const compressed = Buffer.from(base64, 'base64');
  if (compressed.byteLength !== EXPECTED_BROTLI_BYTES) {
    throw new Error(`Presentation Brotli length mismatch: ${compressed.byteLength}`);
  }

  const pdf = brotliDecompressSync(compressed);
  if (pdf.byteLength !== EXPECTED_PDF_BYTES) {
    throw new Error(`Presentation PDF length mismatch: ${pdf.byteLength}`);
  }
  if (pdf.subarray(0, 5).toString('ascii') !== '%PDF-') {
    throw new Error('Presentation output is not a PDF.');
  }
  if (!pdf.subarray(-64).includes(Buffer.from('%%EOF'))) {
    throw new Error('Presentation PDF EOF marker is missing.');
  }

  cachedPresentationPdf = Uint8Array.from(pdf);
  return cachedPresentationPdf;
}

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export function GET() {
  const presentationPdf = loadPresentationPdf();
  const body = new ArrayBuffer(presentationPdf.byteLength);
  new Uint8Array(body).set(presentationPdf);

  return new NextResponse(body, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition':
        `attachment; filename="prozrachnaya-tsena-presentation.pdf"; filename*=UTF-8''${encodeURIComponent('Прозрачная_Цена_ГЕКТА_актуальная_презентация.pdf')}`,
      'Content-Length': String(presentationPdf.byteLength),
      'Cache-Control': 'private, no-store, max-age=0',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
