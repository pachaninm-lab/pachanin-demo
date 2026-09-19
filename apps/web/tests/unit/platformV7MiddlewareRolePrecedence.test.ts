import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const source = fs.readFileSync(path.join(process.cwd(), 'apps/web/middleware.ts'), 'utf8');

describe('platform-v7 middleware role precedence', () => {
  it('keeps path and session roles stronger than query ?as fallback', () => {
    const start = source.indexOf('function resolveRole');
    const end = source.indexOf('function withRoleHeaders');
    const resolveRole = source.slice(start, end);

    const pathIndex = resolveRole.indexOf('resolvePlatformV7PathRole');
    const sessionIndex = resolveRole.indexOf('sessionRole');
    const cookieIndex = resolveRole.indexOf("req.cookies.get('pc-role')");
    const queryIndex = resolveRole.indexOf("searchParams.get('as')");

    expect(pathIndex).toBeGreaterThanOrEqual(0);
    expect(sessionIndex).toBeGreaterThanOrEqual(0);
    expect(cookieIndex).toBeGreaterThanOrEqual(0);
    expect(queryIndex).toBeGreaterThanOrEqual(0);
    expect(pathIndex).toBeLessThan(queryIndex);
    expect(sessionIndex).toBeLessThan(queryIndex);
    expect(cookieIndex).toBeLessThan(queryIndex);
  });

  it('keeps concrete platform-v7 cabinet paths mapped to owned roles', () => {
    expect(source).toContain("pathname.startsWith('/platform-v7/bank')");
    expect(source).toContain("pathname.startsWith('/platform-v7/driver')");
    expect(source).toContain("pathname.startsWith('/platform-v7/elevator')");
    expect(source).toContain("pathname.startsWith('/platform-v7/lab')");
    expect(source).toContain("pathname.startsWith('/platform-v7/compliance')");
  });
});
