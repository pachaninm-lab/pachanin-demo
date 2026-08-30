import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { brotliDecompressSync } from 'node:zlib';

const EXPECTED_PDF_BYTES = 312533;
const EXPECTED_PDF_SHA256 = '1f99bd881404624ef8fe8bec9a10caf10a021f8cacff3ed5a6633101255178a5';
const EXPECTED_PDF_PAGES = 14;
const EXPECTED_BROTLI_BYTES = 198423;
const EXPECTED_BROTLI_SHA256 = 'e99c503bb653bfc1f4c2fd800a5bc230404a6d22d02f3d1362cb66e1172b0612';
const EXPECTED_BASE64_LENGTH = 264564;
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

    const first = materializeStaticPdf();
    const second = materializeStaticPdf();

    expect(Buffer.compare(first.pdf, second.pdf)).toBe(0);
    expect(first.pdf.byteLength).toBeGreaterThan(EXPECTED_PDF_BYTES);
    expect(first.pdf.subarray(0, 5).toString('ascii')).toBe('%PDF-');
    expect(first.pdf.subarray(-64).includes('%%EOF')).toBe(true);

    const correctedText = first.pdf.toString('latin1');
    expect(correctedText).toContain('% PC-GEKTA-FRAME-PATCH-V1');
    expect(correctedText).toContain('0.0588379 0.462646 0.431396 rg');
    expect(correctedText).toContain('42.01 187.80 39.55 190.26 39.55 193.30 c');
    expect(correctedText).toMatch(/\/Contents \[\d+ 0 R \d+ 0 R\]/);

    expect(first.log).toContain('PRESENTATION_BROTLI_SHA256_REFERENCE_MATCH=1');
    expect(first.log).toContain(`PRESENTATION_BASE_PDF_BYTES=${EXPECTED_PDF_BYTES}`);
    expect(first.log).toContain(`PRESENTATION_PDF_PAGES=${EXPECTED_PDF_PAGES}`);
    expect(first.log).toContain(`PRESENTATION_BASE_PDF_SHA256=${EXPECTED_PDF_SHA256}`);
    expect(first.log).toContain('PRESENTATION_GEKTA_FRAME_PATCH=PASS');

    const correctedSha = createHash('sha256').update(first.pdf).digest('hex');
    expect(first.log).toContain(`PRESENTATION_PDF_SHA256=${correctedSha}`);
  });

  it('keeps the stable public URL under static-file ownership and removes runtime Brotli work', () => {
    const home = readFileSync(HOME_FILE, 'utf8');
    const pkg = JSON.parse(readFileSync(PACKAGE_FILE, 'utf8')) as {
      scripts: Record<string, string>;
    };
    const materializer = readFileSync(MATERIALIZER_FILE, 'utf8');

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
    expect(materializer).toContain('PRESENTATION_GEKTA_FRAME_PATCH=PASS');
  });
});
