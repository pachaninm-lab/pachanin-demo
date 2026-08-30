import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { brotliDecompressSync } from 'node:zlib';

const EXPECTED_BASE_PDF_BYTES = 312533;
const EXPECTED_BASE_PDF_SHA256 = '1f99bd881404624ef8fe8bec9a10caf10a021f8cacff3ed5a6633101255178a5';
const EXPECTED_PDF_PAGES = 14;
const EXPECTED_BROTLI_BYTES = 198423;
const EXPECTED_BASE64_LENGTH = 264564;
const DOWNLOAD_PATH = '/downloads/prozrachnaya-tsena-presentation.pdf';
const STATIC_PDF_FILE = resolve(process.cwd(), 'public/downloads/prozrachnaya-tsena-presentation.pdf');
const MATERIALIZER_FILE = resolve(process.cwd(), 'scripts/materialize-presentation-pdf.mjs');
const ROUTE_FILE = resolve(
  process.cwd(),
  'app/downloads/prozrachnaya-tsena-presentation.pdf/route.ts',
);
const HOME_FILE = resolve(
  process.cwd(),
  'components/platform-v7/PlatformV7StrategicHome.tsx',
);
const PACKAGE_FILE = resolve(process.cwd(), 'package.json');
const DOCKER_FILE = resolve(process.cwd(), '../../infra/docker/Dockerfile.web');

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

describe('public presentation download', () => {
  it('materializes a non-empty corrected 14-page PDF into public downloads', () => {
    const base64 = Array.from({ length: 14 }, (_, index) => readPart(index)).join('');
    expect(base64).toHaveLength(EXPECTED_BASE64_LENGTH);

    const compressed = Buffer.from(base64, 'base64');
    expect(compressed.byteLength).toBe(EXPECTED_BROTLI_BYTES);

    const basePdf = brotliDecompressSync(compressed);
    expect(basePdf.byteLength).toBe(EXPECTED_BASE_PDF_BYTES);
    expect(createHash('sha256').update(basePdf).digest('hex')).toBe(
      EXPECTED_BASE_PDF_SHA256,
    );
    expect(basePdf.toString('latin1').match(/\/Type\s*\/Page\b/g) ?? []).toHaveLength(
      EXPECTED_PDF_PAGES,
    );

    rmSync(STATIC_PDF_FILE, { force: true });
    const output = execFileSync(process.execPath, [MATERIALIZER_FILE], {
      cwd: process.cwd(),
      encoding: 'utf8',
    });

    expect(output).toContain('PRESENTATION_PDF_PAGES=14');
    expect(output).toContain('PRESENTATION_GEKTA_FRAME_PATCH=PASS');
    expect(existsSync(STATIC_PDF_FILE)).toBe(true);

    const correctedPdf = readFileSync(STATIC_PDF_FILE);
    const correctedText = correctedPdf.toString('latin1');
    expect(correctedPdf.byteLength).toBeGreaterThan(EXPECTED_BASE_PDF_BYTES);
    expect(correctedPdf.subarray(0, 5).toString('ascii')).toBe('%PDF-');
    expect(correctedPdf.subarray(-64).includes('%%EOF')).toBe(true);
    expect(correctedText).toContain('% PC-GEKTA-FRAME-PATCH-V1');
    expect(correctedText).toContain('0.0588379 0.462646 0.431396 rg');
    expect(correctedText).toContain('42.01 187.80 39.55 190.26 39.55 193.30 c');
    expect(correctedText).toMatch(/\/Contents \[\d+ 0 R \d+ 0 R\]/);
  });

  it('serves the presentation as a Docker-packaged static asset from the stable platform URL', () => {
    const home = readFileSync(HOME_FILE, 'utf8');
    const pkg = JSON.parse(readFileSync(PACKAGE_FILE, 'utf8')) as {
      scripts: Record<string, string>;
    };
    const docker = readFileSync(DOCKER_FILE, 'utf8');

    expect(DOWNLOAD_PATH).toBe('/downloads/prozrachnaya-tsena-presentation.pdf');
    expect(existsSync(ROUTE_FILE)).toBe(false);
    expect(pkg.scripts.build).toBe(
      'node scripts/materialize-presentation-pdf.mjs && next build',
    );
    expect(docker).toContain(
      'COPY --from=build --chown=nonroot:nonroot /workspace/apps/web/public ./public',
    );
    expect(home).toContain(`href='${DOWNLOAD_PATH}'`);
    expect(home).toContain("download='Прозрачная_Цена_и_ГЕКТА.pdf'");
  });
});
