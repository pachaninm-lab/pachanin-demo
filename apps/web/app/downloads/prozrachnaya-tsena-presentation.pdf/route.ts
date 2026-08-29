import { brotliDecompressSync } from 'node:zlib';
import { NextResponse } from 'next/server';

import { PRESENTATION_PDF_BROTLI_BASE64_PART_00 } from '@/lib/presentation-pdf/part-00';
import { PRESENTATION_PDF_BROTLI_BASE64_PART_01 } from '@/lib/presentation-pdf/part-01';
import { PRESENTATION_PDF_BROTLI_BASE64_PART_02 } from '@/lib/presentation-pdf/part-02';
import { PRESENTATION_PDF_BROTLI_BASE64_PART_03 } from '@/lib/presentation-pdf/part-03';
import { PRESENTATION_PDF_BROTLI_BASE64_PART_04 } from '@/lib/presentation-pdf/part-04';
import { PRESENTATION_PDF_BROTLI_BASE64_PART_05 } from '@/lib/presentation-pdf/part-05';
import { PRESENTATION_PDF_BROTLI_BASE64_PART_06 } from '@/lib/presentation-pdf/part-06';
import { PRESENTATION_PDF_BROTLI_BASE64_PART_07 } from '@/lib/presentation-pdf/part-07';
import { PRESENTATION_PDF_BROTLI_BASE64_PART_08 } from '@/lib/presentation-pdf/part-08';
import { PRESENTATION_PDF_BROTLI_BASE64_PART_09 } from '@/lib/presentation-pdf/part-09';
import { PRESENTATION_PDF_BROTLI_BASE64_PART_10 } from '@/lib/presentation-pdf/part-10';
import { PRESENTATION_PDF_BROTLI_BASE64_PART_11 } from '@/lib/presentation-pdf/part-11';
import { PRESENTATION_PDF_BROTLI_BASE64_PART_12 } from '@/lib/presentation-pdf/part-12';
import { PRESENTATION_PDF_BROTLI_BASE64_PART_13 } from '@/lib/presentation-pdf/part-13';

const EXPECTED_BASE64_LENGTH = 264564;
const EXPECTED_BROTLI_BYTES = 198423;
const EXPECTED_PDF_BYTES = 312533;

const PRESENTATION_PDF_BROTLI_BASE64 = [
  PRESENTATION_PDF_BROTLI_BASE64_PART_00,
  PRESENTATION_PDF_BROTLI_BASE64_PART_01,
  PRESENTATION_PDF_BROTLI_BASE64_PART_02,
  PRESENTATION_PDF_BROTLI_BASE64_PART_03,
  PRESENTATION_PDF_BROTLI_BASE64_PART_04,
  PRESENTATION_PDF_BROTLI_BASE64_PART_05,
  PRESENTATION_PDF_BROTLI_BASE64_PART_06,
  PRESENTATION_PDF_BROTLI_BASE64_PART_07,
  PRESENTATION_PDF_BROTLI_BASE64_PART_08,
  PRESENTATION_PDF_BROTLI_BASE64_PART_09,
  PRESENTATION_PDF_BROTLI_BASE64_PART_10,
  PRESENTATION_PDF_BROTLI_BASE64_PART_11,
  PRESENTATION_PDF_BROTLI_BASE64_PART_12,
  PRESENTATION_PDF_BROTLI_BASE64_PART_13,
].join('');

function loadPresentationPdf(): Uint8Array {
  if (PRESENTATION_PDF_BROTLI_BASE64.length !== EXPECTED_BASE64_LENGTH) {
    throw new Error(
      `Presentation Base64 length mismatch: ${PRESENTATION_PDF_BROTLI_BASE64.length}`,
    );
  }

  const compressed = Buffer.from(PRESENTATION_PDF_BROTLI_BASE64, 'base64');
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

  return Uint8Array.from(pdf);
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
