import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const source = fs.readFileSync(path.join(process.cwd(), 'apps/web/middleware.ts'), 'utf8');

describe('platform-v7 server shell persistence', () => {
  it('does not expose platform-v7 through the generic public-path shortcut', () => {
    expect(source).not.toContain("isPublic(p) || p.startsWith('/platform-v7')");
  });

  it('still marks the public root entry for backwards-compatible visits', () => {
    expect(source).toContain("const PLATFORM_V7_ENTRY_COOKIE = 'pc_v7_entry_seen'");
    expect(source).toContain("const isEntry = p === '/platform-v7'");
    expect(source).toContain('if (isEntry) markPlatformV7Entry(response)');
  });

  it('keeps direct cabinet route access inside the protected shell response', () => {
    expect(source).not.toContain('!isPlatformV7PublicPath(p) && !seenEntry');
    expect(source).not.toContain('return redirectToPlatformV7Entry(req)');
    expect(source).toContain('Protected platform-v7 routes must stay inside the app shell');
  });
});
