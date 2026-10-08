import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { brotliDecompressSync, inflateSync } from 'node:zlib';

const EXPECTED_APPROVED_SOURCE_PDF_BYTES = 692279;
const EXPECTED_APPROVED_SOURCE_PDF_SHA256 = '5be757c4cac321aa99fbbee6517318aadf9db2db5dc5a67e506fb6d595d65a63';
const EXPECTED_PDF_BYTES = 1967106;
const EXPECTED_PDF_SHA256 = '7d6c1c0d4fc81abbbcb4f179d799279e617e23fb43feb2208195fc4b4738b009';
const EXPECTED_PDF_PAGES = 14;
const EXPECTED_BROTLI_BYTES = 1794646;
const EXPECTED_BROTLI_SHA256 = '8ecb82283842523646e48074ab2a7aa2f95982275d36dbb90642bb5a185b8670';
const EXPECTED_BASE64_LENGTH = 2392864;
const EXPECTED_CORRECTED_PDF_BYTES = 1967769;
const EXPECTED_CORRECTED_PDF_SHA256 = '447974af4f13ffa79120d302bc1f3e2395633333c1d5ef48486d1de18f783fa6';
const DOWNLOAD_PATH = '/downloads/prozrachnaya-tsena-presentation.pdf';
const ROUTE_FILE = resolve(
  process.cwd(),
  'app/downloads/prozrachnaya-tsena-presentation.pdf/route.ts',
);
const STATIC_FILE = resolve(process.cwd(), `public${DOWNLOAD_PATH}`);
const MATERIALIZER_FILE = resolve(
  process.cwd(),
  'scripts/materialize-presentation-pdf.mjs',
);
const HOME_FILE = resolve(
  process.cwd(),
  'components/platform-v7/PlatformV7StrategicHome.tsx',
);
const PACKAGE_FILE = resolve(process.cwd(), 'package.json');
const CONTRACT_FILE = resolve(process.cwd(), 'scripts/presentation-pdf-contract.mjs');
const FONT_RESOURCE_PATTERN =
  /\/(?:Type\s*\/Font\b|FontFile[23]?\b|FontDescriptor\b|BaseFont\b|ToUnicode\b|Font\b)/;

function readPart(index: number): string {
  const suffix = String(index).padStart(2, '0');
  const source = readFileSync(
    resolve(process.cwd(), `lib/presentation-pdf/part-${suffix}.ts`),
    'utf8',
  );
  const literals = [...source.matchAll(/"([A-Za-z0-9+/=]+)"/g)].map(
    (match) => match[1],
  );
  expect(literals.length).toBeGreaterThan(0);
  return literals.join('');
}

function reconstructBasePdf(): Buffer {
  const base64 = Array.from({ length: 14 }, (_, index) => readPart(index)).join('');
  expect(base64).toHaveLength(EXPECTED_BASE64_LENGTH);

  const compressed = Buffer.from(base64, 'base64');
  expect(compressed.byteLength).toBe(EXPECTED_BROTLI_BYTES);
  expect(createHash('sha256').update(compressed).digest('hex')).toBe(
    EXPECTED_BROTLI_SHA256,
  );

  return brotliDecompressSync(compressed);
}

function inspectablePdfSyntax(pdf: Buffer): string {
  const syntaxBuffers = [pdf];
  const streamStartMarker = Buffer.from('stream\n', 'ascii');
  const streamEndMarker = Buffer.from('\nendstream', 'ascii');
  let cursor = 0;
  let decodedStreams = 0;

  while (cursor < pdf.byteLength) {
    const markerOffset = pdf.indexOf(streamStartMarker, cursor);
    if (markerOffset < 0) break;
    const streamOffset = markerOffset + streamStartMarker.byteLength;
    const streamEnd = pdf.indexOf(streamEndMarker, streamOffset);
    expect(streamEnd).toBeGreaterThan(streamOffset);

    try {
      syntaxBuffers.push(inflateSync(pdf.subarray(streamOffset, streamEnd)));
      decodedStreams += 1;
    } catch {
      // Image and incremental streams may use another filter or no compression.
    }
    cursor = streamEnd + streamEndMarker.byteLength;
  }

  expect(decodedStreams).toBeGreaterThan(0);
  return Buffer.concat(syntaxBuffers).toString('latin1');
}

function materializeStaticPdf(): { pdf: Buffer; log: string } {
  const log = execFileSync(process.execPath, [MATERIALIZER_FILE], {
    cwd: process.cwd(),
    encoding: 'utf8',
  });
  expect(existsSync(STATIC_FILE)).toBe(true);
  return { pdf: readFileSync(STATIC_FILE), log };
}

afterAll(() => {
  rmSync(STATIC_FILE, { force: true });
});

describe('public presentation download', () => {
  it('pins the approved source transport and deterministically materializes the corrected static PDF', () => {
    const basePdf = reconstructBasePdf();
    expect(basePdf.byteLength).toBe(EXPECTED_PDF_BYTES);
    expect(basePdf.subarray(0, 5).toString('ascii')).toBe('%PDF-');
    expect(basePdf.subarray(-64).includes('%%EOF')).toBe(true);
    expect(createHash('sha256').update(basePdf).digest('hex')).toBe(EXPECTED_PDF_SHA256);
    expect(basePdf.toString('latin1').match(/\/Type\s*\/Page\b/g) ?? []).toHaveLength(
      EXPECTED_PDF_PAGES,
    );
    expect(inspectablePdfSyntax(basePdf)).not.toMatch(FONT_RESOURCE_PATTERN);

    const first = materializeStaticPdf();
    const second = materializeStaticPdf();

    expect(Buffer.compare(first.pdf, second.pdf)).toBe(0);
    expect(first.pdf.byteLength).toBe(EXPECTED_CORRECTED_PDF_BYTES);
    expect(Buffer.compare(first.pdf.subarray(0, basePdf.byteLength), basePdf)).toBe(0);
    expect(first.pdf.subarray(0, 5).toString('ascii')).toBe('%PDF-');
    expect(first.pdf.subarray(-64).includes('%%EOF')).toBe(true);
    expect(createHash('sha256').update(first.pdf).digest('hex')).toBe(
      EXPECTED_CORRECTED_PDF_SHA256,
    );
    expect(inspectablePdfSyntax(first.pdf)).not.toMatch(FONT_RESOURCE_PATTERN);

    const correctedText = first.pdf.toString('latin1');
    expect(correctedText.match(/% PC-GEKTA-FRAME-PATCH-V1/g)).toHaveLength(1);
    expect(correctedText).toContain('0.0588379 0.462646 0.431396 rg');
    expect(correctedText).toContain('42.01 187.80 39.55 190.26 39.55 193.30 c');
    expect(correctedText).toContain('/Contents [951 0 R 34 0 R]');
    expect(correctedText).toContain('/Size 952 /Root 1 0 R /Info 2 0 R');
    expect(correctedText).toContain('/Prev 1964320');

    expect(first.log).toContain('PRESENTATION_BROTLI_SHA256_REFERENCE_MATCH=1');
    expect(first.log).toContain(`PRESENTATION_BASE_PDF_BYTES=${EXPECTED_PDF_BYTES}`);
    expect(first.log).toContain(`PRESENTATION_PDF_PAGES=${EXPECTED_PDF_PAGES}`);
    expect(first.log).toContain(`PRESENTATION_BASE_PDF_SHA256=${EXPECTED_PDF_SHA256}`);
    expect(first.log).toMatch(/PRESENTATION_INSPECTED_FLATE_STREAMS=\d+/);
    expect(first.log).toContain('PRESENTATION_IOS_QUICKLOOK_FONT_DEPENDENCY=NONE');
    expect(first.log).toContain('PRESENTATION_GEKTA_FRAME_PATCH=PASS');
    expect(first.log).toContain(`PRESENTATION_PDF_SHA256=${EXPECTED_CORRECTED_PDF_SHA256}`);
  });

  it('keeps the stable public URL under static-file ownership and removes runtime Brotli work', () => {
    const home = readFileSync(HOME_FILE, 'utf8');
    const pkg = JSON.parse(readFileSync(PACKAGE_FILE, 'utf8')) as {
      scripts: Record<string, string>;
    };
    const materializer = readFileSync(MATERIALIZER_FILE, 'utf8');
    const contract = readFileSync(CONTRACT_FILE, 'utf8');

    expect(DOWNLOAD_PATH).toBe('/downloads/prozrachnaya-tsena-presentation.pdf');
    expect(existsSync(ROUTE_FILE)).toBe(false);
    expect(home).toContain(`href='${DOWNLOAD_PATH}'`);
    expect(home).toContain("download='Прозрачная_Цена_и_ГЕКТА.pdf'");
    expect(pkg.scripts.build).toBe(
      'node scripts/materialize-presentation-pdf.mjs && next build',
    );
    expect(pkg.scripts.dev).toBe('next dev -p 3000');
    expect(materializer).toContain('public${PRESENTATION_PDF_CONTRACT.downloadPath}');
    expect(materializer).toContain('brotliDecompressSync');
    expect(materializer).toContain('assertFontIndependentPdf');
    expect(materializer).toContain('PRESENTATION_GEKTA_FRAME_PATCH=PASS');
    expect(contract).toContain(`approvedSourcePdfBytes: ${EXPECTED_APPROVED_SOURCE_PDF_BYTES}`);
    expect(contract).toContain(`approvedSourcePdfSha256: '${EXPECTED_APPROVED_SOURCE_PDF_SHA256}'`);
    expect(contract).toContain("textRendering: 'vector-outlines'");
  });
});
