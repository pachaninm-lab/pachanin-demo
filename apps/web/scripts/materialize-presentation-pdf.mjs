import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { brotliDecompressSync } from 'node:zlib';

const EXPECTED_PDF_BYTES = 312533;
const EXPECTED_PDF_SHA256 = '1f99bd881404624ef8fe8bec9a10caf10a021f8cacff3ed5a6633101255178a5';
const EXPECTED_PDF_PAGES = 14;
const EXPECTED_BROTLI_BYTES = 198423;
const EXPECTED_BROTLI_SHA256 = 'e99c503bb653bfc1f4c2fd800a5bc230404a6d22d02f3d1362cb66e1172b0612';
const EXPECTED_BASE64_LENGTH = 264564;

const WEB_ROOT = fileURLToPath(new URL('../', import.meta.url));
const OUTPUT = resolve(WEB_ROOT, 'public/downloads/prozrachnaya-tsena-presentation.pdf');

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function readPart(index) {
  const suffix = String(index).padStart(2, '0');
  const source = readFileSync(
    resolve(WEB_ROOT, `lib/presentation-pdf/part-${suffix}.ts`),
    'utf8',
  );
  const literals = [...source.matchAll(/"([A-Za-z0-9+/=]+)"/g)].map((match) => match[1]);
  if (literals.length === 0) {
    throw new Error(`Presentation transport part ${suffix} contains no base64 payload.`);
  }
  return literals.join('');
}

const base64 = Array.from({ length: 14 }, (_, index) => readPart(index)).join('');
if (base64.length !== EXPECTED_BASE64_LENGTH) {
  throw new Error(`Presentation base64 length mismatch: ${base64.length}`);
}

const compressed = Buffer.from(base64, 'base64');
if (compressed.byteLength !== EXPECTED_BROTLI_BYTES) {
  throw new Error(`Presentation Brotli length mismatch: ${compressed.byteLength}`);
}
const compressedSha256 = sha256(compressed);
if (compressedSha256 !== EXPECTED_BROTLI_SHA256) {
  throw new Error(`Presentation Brotli SHA-256 mismatch: ${compressedSha256}`);
}

const pdf = brotliDecompressSync(compressed);
if (pdf.byteLength !== EXPECTED_PDF_BYTES) {
  throw new Error(`Presentation PDF length mismatch: ${pdf.byteLength}`);
}
if (pdf.subarray(0, 5).toString('ascii') !== '%PDF-') {
  throw new Error('Presentation output is not a PDF.');
}
if (!pdf.subarray(-64).includes('%%EOF')) {
  throw new Error('Presentation PDF EOF marker is missing.');
}
const pages = pdf.toString('latin1').match(/\/Type\s*\/Page\b/g) ?? [];
if (pages.length !== EXPECTED_PDF_PAGES) {
  throw new Error(`Presentation page count mismatch: ${pages.length}`);
}
const pdfSha256 = sha256(pdf);
if (pdfSha256 !== EXPECTED_PDF_SHA256) {
  throw new Error(`Presentation PDF SHA-256 mismatch: ${pdfSha256}`);
}

mkdirSync(dirname(OUTPUT), { recursive: true });
writeFileSync(OUTPUT, pdf, { mode: 0o644 });

console.log(`PRESENTATION_PDF_MATERIALIZED=${OUTPUT}`);
console.log(`PRESENTATION_BROTLI_SHA256=${compressedSha256}`);
console.log(`PRESENTATION_PDF_BYTES=${pdf.byteLength}`);
console.log(`PRESENTATION_PDF_PAGES=${pages.length}`);
console.log(`PRESENTATION_PDF_SHA256=${pdfSha256}`);
