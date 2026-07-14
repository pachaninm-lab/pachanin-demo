import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const repoRoot = path.resolve(process.cwd(), '../..');
const read = (relativePath: string) => fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
const exists = (relativePath: string) => fs.existsSync(path.join(repoRoot, relativePath));

const apiDocsPage = read('apps/web/app/platform-v7/api-docs/page.tsx');
const compliancePage = read('apps/web/app/platform-v7/compliance/page.tsx');
const canonicalOpenApi = read('docs/api/openapi.yaml');
const publishedOpenApi = read('apps/web/public/platform-v7/openapi.yaml');

describe('platform-v7 API docs legacy isolation', () => {
  it('keeps one canonical governed API documentation workspace', () => {
    expect(apiDocsPage).toContain('OperationalDecisionCockpit');
    expect(apiDocsPage).toContain("href='/platform-v7/openapi.yaml'");
    expect(canonicalOpenApi).toBe(publishedOpenApi);
    expect(compliancePage).toContain("href='/platform-v7/api-docs'");
    expect(compliancePage).toContain('OperationalQueueLink');
  });

  it('deletes the duplicate client-side fixture catalogue', () => {
    expect(exists('apps/web/components/platform-v7/ApiDocPanel.tsx')).toBe(false);
    expect(compliancePage).not.toContain('ApiDocPanel');
    expect(compliancePage).not.toContain('/api/v1/deals');
    expect(compliancePage).not.toContain('DL-9095');
    expect(compliancePage).not.toContain('EV-2026-00892');
    expect(compliancePage).not.toContain('useState');
  });

  it('does not weaken the evidence boundary of the canonical page', () => {
    expect(apiDocsPage).toContain('Write API пока не опубликован');
    expect(apiDocsPage).toContain('Write API is not published yet');
    expect(apiDocsPage).toContain('写入 API 尚未发布');
    expect(apiDocsPage).toContain('не подтверждает договор, боевые credentials');
    expect(apiDocsPage).toContain('does not confirm a contract, production credentials');
    expect(apiDocsPage).toContain('不证明合同、生产凭据');
    expect(canonicalOpenApi).not.toContain('\n    post:');
    expect(canonicalOpenApi).not.toContain('\n    patch:');
  });
});
