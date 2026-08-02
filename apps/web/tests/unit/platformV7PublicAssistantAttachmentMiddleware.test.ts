import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(resolve(process.cwd(), 'middleware.ts'), 'utf8');

function publicApiExactBlock(): string {
  const start = source.indexOf('const PUBLIC_API_EXACT = new Set([');
  const end = source.indexOf(']);', start);
  if (start < 0 || end < 0) throw new Error('PUBLIC_API_EXACT block not found');
  return source.slice(start, end + 3);
}

describe('public assistant attachment middleware boundary', () => {
  it('admits only the exact bounded attachment endpoint through the public API set', () => {
    const block = publicApiExactBlock();
    expect(block).toContain("'/api/public-platform-assistant/attachments'");
    expect(block).not.toContain("'/api/public-platform-assistant/'");
    expect(block).not.toContain("p.startsWith('/api/public-platform-assistant')");
  });

  it('retains the unauthenticated fail-closed branch for every non-public API path', () => {
    expect(source).toContain("if (p.startsWith('/api/'))");
    expect(source).toContain("message: 'unauthenticated'");
    expect(source).toContain('{ status: 401 }');
  });
});
