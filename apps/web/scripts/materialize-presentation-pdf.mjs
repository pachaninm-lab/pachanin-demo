import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { brotliDecompressSync } from 'node:zlib';

const EXPECTED_PDF_BYTES = 312533;
const EXPECTED_PDF_SHA256 = '1f99bd881404624ef8fe8bec9a10caf10a021f8cacff3ed5a6633101255178a5';
const EXPECTED_PDF_PAGES = 14;
const EXPECTED_BROTLI_BYTES = 198423;
const REFERENCE_BROTLI_SHA256 = 'e99c503bb653bfc1f4c2fd800a5bc230404a6d22d02f3d1362cb66e1172b0612';
const EXPECTED_BASE64_LENGTH = 264564;
const PRESENTATION_GEKTA_FRAME_PATCH_MARKER = '% PC-GEKTA-FRAME-PATCH-V1';
const OVERLAY_STREAM =
  [
    'q',
    '0.0588379 0.462646 0.431396 rg',
    '39.55 204.00 m',
    '277.25 204.00 l',
    '277.25 193.30 l',
    '277.25 190.26 274.79 187.80 271.75 187.80 c',
    '45.05 187.80 l',
    '42.01 187.80 39.55 190.26 39.55 193.30 c',
    'h f',
    'Q',
  ].join('\n') + '\n';

const WEB_ROOT = fileURLToPath(new URL('../', import.meta.url));
const OUTPUT = resolve(WEB_ROOT, 'public/downloads/prozrachnaya-tsena-presentation.pdf');

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
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

function requiredMatch(value, pattern, label) {
  const match = value.match(pattern);
  if (!match) {
    throw new Error(`Presentation PDF ${label} was not found.`);
  }
  return match;
}

function xrefEntry(offset) {
  return `${String(offset).padStart(10, '0')} 00000 n`;
}

function applyPresentationGektaFramePatch(pdf) {
  if (pdf.subarray(0, 5).toString('ascii') !== '%PDF-') {
    throw new Error('Presentation source is not a PDF.');
  }

  const text = pdf.toString('latin1');
  if (text.includes(PRESENTATION_GEKTA_FRAME_PATCH_MARKER)) {
    throw new Error('Presentation Gekta frame patch is already applied.');
  }

  const startXrefMatch = requiredMatch(
    text,
    /startxref\s+(\d+)\s+%%EOF\s*$/,
    'final startxref',
  );
  const previousStartXref = Number(startXrefMatch[1]);
  if (
    !Number.isSafeInteger(previousStartXref) ||
    previousStartXref <= 0 ||
    previousStartXref >= pdf.byteLength
  ) {
    throw new Error('Presentation PDF startxref is invalid.');
  }

  const xrefText = text.slice(
    previousStartXref,
    Math.min(text.length, previousStartXref + 8192),
  );
  const xrefObject = requiredMatch(
    xrefText,
    /^(\d+)\s+0\s+obj\s*<<(.*?)>>/s,
    'xref stream dictionary',
  );
  const dictionary = xrefObject[2];
  if (/\/Encrypt\b/.test(dictionary)) {
    throw new Error('Encrypted presentation PDFs are not supported.');
  }

  const size = Number(requiredMatch(dictionary, /\/Size\s+(\d+)/, 'xref Size')[1]);
  const rootObject = Number(
    requiredMatch(dictionary, /\/Root\s+(\d+)\s+0\s+R/, 'Root reference')[1],
  );
  const infoMatch = dictionary.match(/\/Info\s+(\d+)\s+0\s+R/);
  const idMatch = dictionary.match(
    /\/ID\s*(\[\s*<[^>]+>\s*<[^>]+>\s*\])/s,
  );
  if (!Number.isSafeInteger(size) || size <= 0) {
    throw new Error('Presentation PDF xref Size is invalid.');
  }

  const pageObjectMarker = '\n4 0 obj';
  let pageObjectOffset = text.indexOf(pageObjectMarker);
  if (pageObjectOffset < 0 && text.startsWith('4 0 obj')) {
    pageObjectOffset = 0;
  }
  if (pageObjectOffset < 0) {
    throw new Error('Presentation PDF first page object was not found.');
  }

  const pageObjectEnd = text.indexOf('endobj', pageObjectOffset);
  if (pageObjectEnd < 0) {
    throw new Error('Presentation PDF first page object is incomplete.');
  }

  const pageObjectNumber = 4;
  const pageObject = text
    .slice(pageObjectOffset, pageObjectEnd + 'endobj'.length)
    .replace(/^\n/, '')
    .trim();
  if (
    !/\/Type\s*\/Page\b/.test(pageObject) ||
    !/\/MediaBox\s*\[\s*0\s+0\s+960(?:\.0?1)?\s+540\s*\]/.test(pageObject)
  ) {
    throw new Error('Presentation PDF first page geometry is unexpected.');
  }

  const contentsObject = Number(
    requiredMatch(
      pageObject,
      /\/Contents\s+(\d+)\s+0\s+R/,
      'page Contents reference',
    )[1],
  );
  const newObjectNumber = size;
  const updatedPageObject = pageObject.replace(
    /\/Contents\s+\d+\s+0\s+R/,
    `/Contents [${newObjectNumber} 0 R ${contentsObject} 0 R]`,
  );
  if (updatedPageObject === pageObject) {
    throw new Error('Presentation PDF page Contents could not be patched.');
  }

  const prefix = `\n${PRESENTATION_GEKTA_FRAME_PATCH_MARKER}\n`;
  const overlayObject =
    `${newObjectNumber} 0 obj\n` +
    `<< /Length ${Buffer.byteLength(OVERLAY_STREAM, 'ascii')} >>\n` +
    `stream\n${OVERLAY_STREAM}endstream\nendobj\n`;
  const pageRevision = `${updatedPageObject}\n`;

  const overlayOffset = pdf.byteLength + Buffer.byteLength(prefix, 'ascii');
  const pageOffset = overlayOffset + Buffer.byteLength(overlayObject, 'ascii');
  const xrefOffset = pageOffset + Buffer.byteLength(pageRevision, 'latin1');
  const infoTrailer = infoMatch ? ` /Info ${infoMatch[1]} 0 R` : '';
  const idTrailer = idMatch ? ` /ID ${idMatch[1]}` : '';
  const xrefAndTrailer = [
    'xref',
    `${pageObjectNumber} 1`,
    xrefEntry(pageOffset),
    `${newObjectNumber} 1`,
    xrefEntry(overlayOffset),
    'trailer',
    `<< /Size ${newObjectNumber + 1} /Root ${rootObject} 0 R${infoTrailer}${idTrailer} /Prev ${previousStartXref} >>`,
    'startxref',
    String(xrefOffset),
    '%%EOF',
    '',
  ].join('\n');

  return Buffer.concat([
    pdf,
    Buffer.from(prefix, 'ascii'),
    Buffer.from(overlayObject, 'ascii'),
    Buffer.from(pageRevision, 'latin1'),
    Buffer.from(xrefAndTrailer, 'ascii'),
  ]);
}

const base64 = Array.from({ length: 14 }, (_, index) => readPart(index)).join('');
if (base64.length !== EXPECTED_BASE64_LENGTH) {
  throw new Error(`Presentation base64 length mismatch: ${base64.length}`);
}

const compressed = Buffer.from(base64, 'base64');
if (compressed.byteLength !== EXPECTED_BROTLI_BYTES) {
  throw new Error(`Presentation Brotli length mismatch: ${compressed.byteLength}`);
}
const brotliSha256 = sha256(compressed);

const pdf = brotliDecompressSync(compressed);
if (pdf.byteLength !== EXPECTED_PDF_BYTES) {
  throw new Error(`Presentation PDF length mismatch: ${pdf.byteLength}`);
}
if (sha256(pdf) !== EXPECTED_PDF_SHA256) {
  throw new Error('Presentation PDF SHA-256 mismatch.');
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

const correctedPdf = applyPresentationGektaFramePatch(pdf);
const correctedText = correctedPdf.toString('latin1');
if (correctedPdf.byteLength <= pdf.byteLength) {
  throw new Error('Corrected presentation PDF was not extended.');
}
if (correctedPdf.subarray(0, 5).toString('ascii') !== '%PDF-') {
  throw new Error('Corrected presentation output is not a PDF.');
}
if (!correctedPdf.subarray(-64).includes('%%EOF')) {
  throw new Error('Corrected presentation PDF EOF marker is missing.');
}
if (!correctedText.includes(PRESENTATION_GEKTA_FRAME_PATCH_MARKER)) {
  throw new Error('Corrected presentation marker is missing.');
}
if (!correctedText.includes('0.0588379 0.462646 0.431396 rg')) {
  throw new Error('Corrected presentation green frame is missing.');
}
if (!/\/Contents \[\d+ 0 R \d+ 0 R\]/.test(correctedText)) {
  throw new Error('Corrected presentation first-page overlay is not linked.');
}

mkdirSync(dirname(OUTPUT), { recursive: true });
writeFileSync(OUTPUT, correctedPdf, { mode: 0o644 });

console.log(`PRESENTATION_PDF_MATERIALIZED=${OUTPUT}`);
console.log(`PRESENTATION_BROTLI_SHA256=${brotliSha256}`);
console.log(`PRESENTATION_BROTLI_SHA256_REFERENCE=${REFERENCE_BROTLI_SHA256}`);
console.log(
  `PRESENTATION_BROTLI_SHA256_REFERENCE_MATCH=${brotliSha256 === REFERENCE_BROTLI_SHA256 ? 1 : 0}`,
);
console.log(`PRESENTATION_BASE_PDF_BYTES=${pdf.byteLength}`);
console.log(`PRESENTATION_PDF_BYTES=${correctedPdf.byteLength}`);
console.log(`PRESENTATION_PDF_PAGES=${pages.length}`);
console.log(`PRESENTATION_BASE_PDF_SHA256=${EXPECTED_PDF_SHA256}`);
console.log(`PRESENTATION_PDF_SHA256=${sha256(correctedPdf)}`);
console.log('PRESENTATION_GEKTA_FRAME_PATCH=PASS');
