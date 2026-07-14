import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const repoRoot = path.resolve(process.cwd(), '../..');
const read = (relativePath: string) => fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');

const page = read('apps/web/app/platform-v7/operator-cockpit/queues/page.tsx');
const routePolicy = read('apps/web/lib/platform-v7/design-system-v8-route-policy.ts');
const governance = JSON.parse(read('design-governance-v8.json'));

describe('platform-v7 canonical operator queues route', () => {
  it('redirects the legacy secondary URL to the canonical operator workspace', () => {
    expect(page).toContain("import { redirect } from 'next/navigation'");
    expect(page).toContain('PLATFORM_V7_OPERATOR_ROUTE');
    expect(page).toContain('redirect(PLATFORM_V7_OPERATOR_ROUTE)');
  });

  it('does not render the fixture ESIA and FGIS queue runtime', () => {
    for (const forbidden of [
      'EsiaFgisRuntime',
      'OperatorQueuesPage',
      'queueEntries',
      'connectors',
      'FGIS pending',
      'Повторить sync',
      'Повторить',
      'useRouter',
      'usePlatformV7RStore',
      'useState',
      'style={{',
      '#0A7A5F',
      'rgba(',
    ]) {
      expect(page).not.toContain(forbidden);
    }
  });

  it('keeps the alias inside the minimal v8 runtime and governance boundary', () => {
    expect(routePolicy).toContain("'/platform-v7/operator-cockpit/queues'");
    expect(governance.governedRoots).toContain('apps/web/app/platform-v7/operator-cockpit/queues/page.tsx');
    expect(governance.migratedFiles).not.toContain('apps/web/app/platform-v7/operator-cockpit/queues/page.tsx');
  });
});
