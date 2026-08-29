import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { brotliDecompressSync } from 'node:zlib';

import {
  applyPresentationGektaFramePatch,
  PRESENTATION_GEKTA_FRAME_PATCH_MARKER,
} from '../../app/downloads/prozrachnaya-tsena-presentation.pdf/route';

const EXPECTED_PDF_BYTES = 312533;
const EXPECTED_PDF_SHA256 = '1f99bd881404624ef8fe8bec9a10caf10a021f8cacff3ed5a6633101255178a5';
const EXPECTED_PDF_PAGES = 14;
const EXPECTED_BROTLI_BYTES = 198423;
const EXPECTED_BASE64_LENGTH = 264564;
const DOWNLOAD_PATH = '/downloads/prozrachnaya-tsena-presentation.pdf';
const ROUTE_FILE = resolve(
  process.cwd(),
  'app/downloads/prozrachnaya-tsena-presentation.pdf/route.ts',
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

describe('public presentation download', () => {
  it('reconstructs the approved base PDF and applies the frame correction deterministically', () => {
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

    const correctedA = applyPresentationGektaFramePatch(pdf);
    const correctedB = applyPresentationGektaFramePatch(pdf);
    expect(Buffer.compare(correctedA, correctedB)).toBe(0);
    expect(correctedA.byteLength).toBeGreaterThan(EXPECTED_PDF_BYTES);
    expect(correctedA.subarray(0, 5).toString('ascii')).toBe('%PDF-');
    expect(correctedA.subarray(-64).includes('%%EOF')).toBe(true);

    const correctedText = correctedA.toString('latin1');
    expect(correctedText).toContain(PRESENTATION_GEKTA_FRAME_PATCH_MARKER);
    expect(correctedText).toContain('0.0588379 0.462646 0.431396 rg');
    expect(correctedText).toContain('42.01 187.80 39.55 190.26 39.55 193.30 c');
    expect(correctedText).toMatch(/\/Contents \[\d+ 0 R \d+ 0 R\]/);
    expect(() => applyPresentationGektaFramePatch(correctedA)).toThrow(
      'Presentation Gekta frame patch is already applied.',
    );
  });

  it('serves the corrected PDF from the stable platform URL', () => {
    const route = readFileSync(ROUTE_FILE, 'utf8');
    const home = readFileSync(HOME_FILE, 'utf8');
    const pkg = JSON.parse(readFileSync(PACKAGE_FILE, 'utf8')) as {
      scripts: Record<string, string>;
    };

    expect(DOWNLOAD_PATH).toBe('/downloads/prozrachnaya-tsena-presentation.pdf');
    expect(route).not.toContain('drive.google.com');
    expect(route).not.toContain('NextResponse.redirect');
    expect(route).not.toContain("from 'node:fs'");
    expect(route).not.toContain('readFileSync');
    expect(route).not.toContain('process.cwd()');
    expect(route).toContain("from '@/lib/presentation-pdf/part-00'");
    expect(route).toContain("from '@/lib/presentation-pdf/part-13'");
    expect(route).not.toContain("from '@/lib/presentation-pdf/gekta-frame-patch'");
    expect(route).toContain('export function applyPresentationGektaFramePatch');
    expect(route).toContain('const PRESENTATION_PDF_BROTLI_BASE64 = [');
    expect(route).toContain('cachedPresentationPdf');
    expect(route).toContain('brotliDecompressSync');
    expect(route).toContain('applyPresentationGektaFramePatch(pdf)');
    expect(route).toContain("'Content-Type': 'application/pdf'");
    expect(route).toContain("'Content-Disposition'");
    expect(route).toContain('attachment; filename=');
    expect(route).toContain("'Content-Length'");
    expect(route).toContain("export const runtime = 'nodejs'");
    expect(home).toContain(`href='${DOWNLOAD_PATH}'`);
    expect(home).toContain("download='Прозрачная_Цена_и_ГЕКТА.pdf'");
    expect(pkg.scripts.build).toBe('next build');
    expect(pkg.scripts.dev).toBe('next dev -p 3000');
  });
});
