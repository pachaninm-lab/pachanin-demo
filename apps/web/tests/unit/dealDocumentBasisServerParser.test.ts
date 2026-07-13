import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const cwd = process.cwd();
const repoRoot = [cwd, path.resolve(cwd, '../..')]
  .find((candidate) => fs.existsSync(path.join(candidate, 'design-governance-v8.json')));

if (!repoRoot) throw new Error(`Cannot resolve repository root from ${cwd}`);

const source = fs.readFileSync(
  path.join(repoRoot, 'apps/web/lib/deal-document-basis-server.ts'),
  'utf8',
);

describe('document-basis server envelope parser', () => {
  it('fails closed on cross-Deal and cross-tenant document facts', () => {
    expect(source).toContain("throw new Error('document authority does not match Deal tenant')");
    expect(source).toContain("throw new Error('shipment authority does not match Deal tenant')");
    expect(source).toContain("throw new Error('laboratory authority does not match Deal tenant')");
  });

  it('requires authenticated no-store reads and never mutates authority', () => {
    expect(source).toContain('serverAuthHeaders()');
    expect(source).toContain("cache: 'no-store'");
    expect(source).not.toMatch(/method\s*:\s*['"](?:POST|PUT|PATCH|DELETE)['"]/i);
  });
});
