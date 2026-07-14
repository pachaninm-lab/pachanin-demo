import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const repoRoot = path.resolve(process.cwd(), '../..');
const read = (relativePath: string) => fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
const exists = (relativePath: string) => fs.existsSync(path.join(repoRoot, relativePath));

const page = read('apps/web/app/platform-v7/api-docs/page.tsx');
const compliance = read('apps/web/app/platform-v7/compliance/page.tsx');
const routePolicy = read('apps/web/lib/platform-v7/design-system-v8-route-policy.ts');
const canonical = read('docs/api/openapi.yaml');
const published = read('apps/web/public/platform-v7/openapi.yaml');
const scope = read('scripts/check-design-system-v8-pr-scope.mjs');
const guard = read('.github/workflows/platform-v7-autopilot-guard.yml');
const workflow = read('.github/workflows/design-system-v8.yml');

describe('platform-v7 API docs legacy isolation', () => {
  it('keeps the protected API contract on the minimal v8 runtime', () => {
    expect(routePolicy).toContain("'/platform-v7/api-docs'");
    expect(page).toContain("testId='platform-v7-api-docs-v8'");
    expect(page).toContain("href='/platform-v7/openapi.yaml'");
    expect(page).not.toContain("href='/api/openapi.yaml'");
  });

  it('removes the synthetic API catalogue from compliance', () => {
    expect(compliance).not.toContain('ApiDocPanel');
    expect(exists('apps/web/components/platform-v7/ApiDocPanel.tsx')).toBe(false);
    expect(page).not.toContain('/api/v1');
    expect(page).not.toContain('X-Api-Key');
  });

  it('uses one controller-verified canonical and published specification', () => {
    expect(published).toBe(canonical);
    expect(canonical).toContain('x-maturity: controlled-integration-contract');
    expect(canonical).not.toContain('GrainFlow');
    expect(canonical).not.toContain('grainflow.ru');
    expect(canonical).not.toContain('\n    post:');
  });

  it('registers API contract artifacts in scope and CI', () => {
    expect(scope).toContain("'apps/web/public/platform-v7/openapi.yaml'");
    expect(scope).toContain("'docs/api/openapi.yaml'");
    expect(guard).toContain("'apps/web/public/platform-v7/**'");
    expect(guard).toContain("'docs/api/**'");
    expect(workflow).toContain("'apps/web/app/platform-v7/api-docs/**'");
    expect(workflow).toContain('tests/unit/platformV7ApiDocsAuthority.test.ts');
    expect(workflow).toContain('tests/unit/platformV7ApiDocsLegacyIsolation.test.ts');
  });
});
