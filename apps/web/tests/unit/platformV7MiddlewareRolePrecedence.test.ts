import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const source = fs.readFileSync(path.join(process.cwd(), 'apps/web/middleware.ts'), 'utf8');

describe('platform-v7 middleware role lock', () => {
  it('uses session/cookie as the only role source and does not infer role from URL', () => {
    const start = source.indexOf('function resolveRole');
    const end = source.indexOf('function withRoleHeaders');
    const resolveRole = source.slice(start, end);

    expect(resolveRole).toContain('sessionRole');
    expect(resolveRole).toContain("req.cookies.get('pc-role')");
    expect(resolveRole).not.toContain('resolvePlatformV7PathRole');
    expect(resolveRole).not.toContain("searchParams.get('as')");
    expect(resolveRole).not.toContain('queryRole');
  });

  it('keeps concrete platform-v7 cabinet paths mapped only for foreign-route redirect guards', () => {
    expect(source).toContain("{ prefix: '/platform-v7/bank', role: 'bank' }");
    expect(source).toContain("{ prefix: '/platform-v7/driver', role: 'driver' }");
    expect(source).toContain("{ prefix: '/platform-v7/elevator', role: 'elevator' }");
    expect(source).toContain("{ prefix: '/platform-v7/lab', role: 'lab' }");
    expect(source).toContain("{ prefix: '/platform-v7/compliance', role: 'compliance' }");
    expect(source).toContain('redirectToOwnPlatformV7Cabinet');
  });

  it('blocks standalone AI route so AI remains inside the current cabinet', () => {
    expect(source).toContain("p === '/platform-v7/ai'");
    expect(source).toContain("p.startsWith('/platform-v7/ai/')");
    expect(source).toContain('return redirectToOwnPlatformV7Cabinet(req, resolvedRole)');
  });
});
