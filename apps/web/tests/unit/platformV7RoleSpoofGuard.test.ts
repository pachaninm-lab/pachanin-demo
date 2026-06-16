import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const source = fs.readFileSync(path.join(process.cwd(), 'apps/web/middleware.ts'), 'utf8');

describe('platform-v7 role spoof guard', () => {
  it('does not let query role override path, session or cookie role in middleware resolution', () => {
    const resolveRole = source.slice(source.indexOf('function resolveRole'), source.indexOf('function withRoleHeaders'));

    const queryIndex = resolveRole.indexOf("searchParams.get('as')");
    const pathIndex = resolveRole.indexOf('resolvePlatformV7PathRole');
    const sessionIndex = resolveRole.indexOf('sessionRole');
    const cookieIndex = resolveRole.indexOf("req.cookies.get('pc-role')");

    expect(pathIndex).toBeGreaterThanOrEqual(0);
    expect(sessionIndex).toBeGreaterThanOrEqual(0);
    expect(cookieIndex).toBeGreaterThanOrEqual(0);
    expect(queryIndex).toBeGreaterThanOrEqual(0);
    expect(pathIndex).toBeLessThan(queryIndex);
    expect(sessionIndex).toBeLessThan(queryIndex);
    expect(cookieIndex).toBeLessThan(queryIndex);
  });
});
