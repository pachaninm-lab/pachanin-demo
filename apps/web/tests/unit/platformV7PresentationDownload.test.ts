import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const DOWNLOAD_PATH = '/downloads/prozrachnaya-tsena-presentation.pdf';
const ROUTE_FILE = resolve(
  process.cwd(),
  'app/downloads/prozrachnaya-tsena-presentation.pdf/route.ts',
);
const PACKAGE_FILE = resolve(process.cwd(), 'package.json');

describe('public presentation download', () => {
  it('keeps the platform download URL stable and routes to the approved current PDF', () => {
    const route = readFileSync(ROUTE_FILE, 'utf8');
    const pkg = JSON.parse(readFileSync(PACKAGE_FILE, 'utf8')) as {
      scripts: Record<string, string>;
    };

    expect(DOWNLOAD_PATH).toBe('/downloads/prozrachnaya-tsena-presentation.pdf');
    expect(route).toContain('11qCiCF_svPoqsh4ZczBxFi1CehQnDAiZ');
    expect(route).toContain('export=download');
    expect(route).toContain('NextResponse.redirect');
    expect(pkg.scripts.build).toBe('next build');
    expect(pkg.scripts.dev).toBe('next dev -p 3000');
  });
});
