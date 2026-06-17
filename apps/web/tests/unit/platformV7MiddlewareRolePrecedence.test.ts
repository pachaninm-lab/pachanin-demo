import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const source = fs.readFileSync(path.join(process.cwd(), 'apps/web/middleware.ts'), 'utf8');

describe('platform-v7 middleware role lock', () => {
  it('uses session/cookie as the only role source', () => {
    const start = source.indexOf('function resolveRole');
    const end = source.indexOf('function withRoleHeaders');
    const resolveRole = source.slice(start, end);

    expect(resolveRole).toContain('sessionRole');
    expect(resolveRole).toContain("req.cookies.get('pc-role')");
    expect(resolveRole).not.toContain('resolvePlatformV7PathRole');
    expect(resolveRole).not.toContain("searchParams.get('as')");
  });

  it('keeps guarded role routes and shared-screen access checks', () => {
    expect(source).toContain("prefix: '/platform-v7/bank'");
    expect(source).toContain("also: ['operator', 'executive']");
    expect(source).toContain("prefix: '/platform-v7/driver'");
    expect(source).toContain("prefix: '/platform-v7/elevator'");
    expect(source).toContain("prefix: '/platform-v7/lab'");
    expect(source).toContain("prefix: '/platform-v7/compliance'");
    expect(source).toContain('canAccessPlatformV7Path');
    expect(source).toContain('redirectToOwnPlatformV7Cabinet');
  });

  it('keeps standalone ai route inside the current cabinet', () => {
    expect(source).toContain("p === '/platform-v7/ai'");
    expect(source).toContain("p.startsWith('/platform-v7/ai/')");
    expect(source).toContain('return redirectToOwnPlatformV7Cabinet(req, resolvedRole)');
  });
});
