import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const middleware = readFileSync(join(process.cwd(), 'middleware.ts'), 'utf8');
const liveAcceptance = readFileSync(
  join(process.cwd(), '../../scripts/production-full-stack-live-acceptance.sh'),
  'utf8',
);

const publicApiStart = middleware.indexOf('const PUBLIC_API_EXACT = new Set([');
const publicApiEnd = middleware.indexOf(']);', publicApiStart);
const publicApiBlock = middleware.slice(publicApiStart, publicApiEnd);

describe('public organization intake middleware boundary', () => {
  it('allows the public intake endpoint before cabinet session enforcement', () => {
    expect(publicApiStart).toBeGreaterThanOrEqual(0);
    expect(publicApiBlock).toContain("'/api/platform-v7/organization-connect'");
    expect(middleware.match(/'\/api\/platform-v7\/organization-connect'/gu)).toHaveLength(1);

    const publicBranch = middleware.indexOf('|| PUBLIC_API_EXACT.has(p)');
    const unauthenticatedBranch = middleware.indexOf("if (p.startsWith('/api/')) {");
    expect(publicBranch).toBeGreaterThanOrEqual(0);
    expect(publicBranch).toBeLessThan(unauthenticatedBranch);
  });

  it('binds the endpoint used by production live acceptance', () => {
    expect(liveAcceptance).toContain(
      '-X POST "$LIVE_BASE/api/platform-v7/organization-connect"',
    );
  });
});
