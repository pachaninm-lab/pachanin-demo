import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { brotliDecompressSync } from 'node:zlib';

const EXPECTED_PDF_BYTES = 312533;
const EXPECTED_PDF_SHA256 = '1f99bd881404624ef8fe8bec9a10caf10a021f8cacff3ed5a6633101255178a5';
const EXPECTED_PDF_PAGES = 14;
const EXPECTED_BROTLI_BYTES = 198423;
const EXPECTED_BASE64_LENGTH = 264564;
const DOWNLOAD_PATH = '/downloads/prozrachnaya-tsena-presentation.pdf';
const STATIC_FILE = resolve(process.cwd(), `public${DOWNLOAD_PATH}`);
const ROUTE_FILE = resolve(
  process.cwd(),
  'app/downloads/prozrachnaya-tsena-presentation.pdf/route.ts',
);
const MATERIALIZER_FILE = resolve(process.cwd(), 'scripts/materialize-presentation-pdf.mjs');
const HOME_FILE = resolve(
  process.cwd(),
  'components/platform-v7/PlatformV7StrategicHome.tsx',
);
const PACKAGE_FILE = resolve(process.cwd(), 'package.json');
const NEXT_CONFIG_FILE = resolve(process.cwd(), 'next.config.js');

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

function materializePresentation(): Buffer {
  execFileSync(process.execPath, [MATERIALIZER_FILE], {
    cwd: process.cwd(),
    stdio: 'pipe',
  });
  expect(existsSync(STATIC_FILE)).toBe(true);
  return readFileSync(STATIC_FILE);
}

describe('public presentation download', () => {
  it('keeps the exact approved 14-page base transport', () => {
    const base64 = Array.from({ length: 14 }, (_, index) => readPart(index)).join('');
    expect(base64).toHaveLength(EXPECTED_BASE64_LENGTH);

    const compressed = Buffer.from(base64, 'base64');
    expect(compressed.byteLength).toBe(EXPECTED_BROTLI_BYTES);

    const pdf = brotliDecompressSync(compressed);
    expect(pdf.byteLength).toBe(EXPECTED_PDF_BYTES);
    expect(pdf.subarray(0, 5).toString('ascii')).toBe('%PDF-');
    expect(pdf.subarray(-64).includes('%%EOF')).toBe(true);
    expect(createHash('sha256').update(pdf).digest('hex')).toBe(EXPECTED_PDF_SHA256);
    expect(pdf.toString('latin1').match(/\/Type\s*\/Page\b/g) ?? []).toHaveLength(
      EXPECTED_PDF_PAGES,
    );
  });

  it('materializes the corrected PDF deterministically before runtime', () => {
    rmSync(STATIC_FILE, { force: true });
    try {
      const first = materializePresentation();
      const second = materializePresentation();

      expect(Buffer.compare(first, second)).toBe(0);
      expect(first.byteLength).toBeGreaterThan(EXPECTED_PDF_BYTES);
      expect(first.subarray(0, 5).toString('ascii')).toBe('%PDF-');
      expect(first.subarray(-64).includes('%%EOF')).toBe(true);

      const correctedText = first.toString('latin1');
      expect(correctedText).toContain('% PC-GEKTA-FRAME-PATCH-V1');
      expect(correctedText).toContain('0.0588379 0.462646 0.431396 rg');
      expect(correctedText).toContain('42.01 187.80 39.55 190.26 39.55 193.30 c');
      expect(correctedText).toMatch(/\/Contents \[\d+ 0 R \d+ 0 R\]/);
    } finally {
      rmSync(STATIC_FILE, { force: true });
    }
  });

  it('serves the build-time PDF from the stable public URL without a runtime route', () => {
    const materializer = readFileSync(MATERIALIZER_FILE, 'utf8');
    const home = readFileSync(HOME_FILE, 'utf8');
    const nextConfig = readFileSync(NEXT_CONFIG_FILE, 'utf8');
    const pkg = JSON.parse(readFileSync(PACKAGE_FILE, 'utf8')) as {
      scripts: Record<string, string>;
    };

    expect(DOWNLOAD_PATH).toBe('/downloads/prozrachnaya-tsena-presentation.pdf');
    expect(existsSync(ROUTE_FILE)).toBe(false);
    expect(materializer).toContain("public/downloads/prozrachnaya-tsena-presentation.pdf");
    expect(materializer).toContain('brotliDecompressSync');
    expect(materializer).toContain('PRESENTATION_GEKTA_FRAME_PATCH=PASS');
    expect(pkg.scripts.build).toBe('node scripts/materialize-presentation-pdf.mjs && next build');
    expect(pkg.scripts.dev).toBe('next dev -p 3000');
    expect(nextConfig).toContain("source: '/downloads/prozrachnaya-tsena-presentation.pdf'");
    expect(nextConfig).toContain("key: 'Content-Type', value: 'application/pdf'");
    expect(nextConfig).toContain("key: 'Content-Disposition'");
    expect(nextConfig).toContain('attachment; filename=');
    expect(home).toContain(`href='${DOWNLOAD_PATH}'`);
    expect(home).toContain("download='Прозрачная_Цена_и_ГЕКТА.pdf'");
  });
});
