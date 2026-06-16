import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const source = fs.readFileSync(path.join(process.cwd(), 'apps/web/middleware.ts'), 'utf8');

describe('platform-v7 server entry gate', () => {
  it('does not allow all platform-v7 routes unconditionally', () => {
    expect(source).not.toContain("isPublic(p) || p.startsWith('/platform-v7')");
  });

  it('sets an entry cookie only on the public root', () => {
    expect(source).toContain("const PLATFORM_V7_ENTRY_COOKIE = 'pc_v7_entry_seen'");
    expect(source).toContain("const isEntry = p === '/platform-v7'");
    expect(source).toContain('if (isEntry) markPlatformV7Entry(response)');
  });

  it('redirects direct cabinet route access back to the public entry', () => {
    expect(source).toContain('!isPlatformV7PublicPath(p) && !seenEntry');
    expect(source).toContain('return redirectToPlatformV7Entry(req)');
  });
});
