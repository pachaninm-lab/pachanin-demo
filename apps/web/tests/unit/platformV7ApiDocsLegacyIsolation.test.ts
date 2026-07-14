import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const repoRoot = path.resolve(process.cwd(), '../..');
const read = (relativePath: string) => fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
const exists = (relativePath: string) => fs.existsSync(path.join(repoRoot, relativePath));

const apiDocsPage = read('apps/web/app/platform-v7/api-docs/page.tsx');
const compliancePage = read('apps/web/app/platform-v7/compliance/page.tsx');

describe('platform-v7 API docs legacy isolation', () => {
  it('keeps one canonical governed API documentation workspace', () => {
    expect(apiDocsPage).toContain('OperationalDecisionCockpit');
    expect(apiDocsPage).toContain('apps/api/openapi.yaml');
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
    expect(apiDocsPage).toContain('не создаёт API-ключи');
    expect(apiDocsPage).toContain('does not create API keys');
    expect(apiDocsPage).toContain('不会创建 API 密钥');
    expect(apiDocsPage).toContain('не подтверждает production-доступность');
    expect(apiDocsPage).toContain('does not prove a published endpoint');
  });
});
