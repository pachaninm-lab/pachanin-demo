import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const middleware = fs.readFileSync(path.join(process.cwd(), 'apps/web/middleware.ts'), 'utf8');
const clientGuard = fs.readFileSync(path.join(process.cwd(), 'apps/web/components/platform-v7/PlatformV7SingleEntryGuard.tsx'), 'utf8');

describe('platform-v7 public route guards', () => {
  it('keeps contact and request pages public in middleware', () => {
    expect(middleware).toContain("'/platform-v7/contact'");
    expect(middleware).toContain("'/platform-v7/request'");
    expect(middleware).toContain('function normalizePathname');
    expect(middleware).toContain('PLATFORM_V7_LEADS_API');
    expect(middleware).toContain('path === PLATFORM_LOCK_LOGIN_API').toBeFalsy;
  });

  it('keeps contact and request pages public in the client guard', () => {
    expect(clientGuard).toContain("'/platform-v7/contact'");
    expect(clientGuard).toContain("'/platform-v7/request'");
    expect(clientGuard).toContain('if (isPublicPath(path)) return;');
  });
});
