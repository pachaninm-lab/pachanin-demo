import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const middleware = fs.readFileSync(path.join(process.cwd(), 'apps/web/middleware.ts'), 'utf8');
const clientGuard = fs.readFileSync(path.join(process.cwd(), 'apps/web/components/platform-v7/PlatformV7SingleEntryGuard.tsx'), 'utf8');

describe('platform-v7 public route guards', () => {
  it('keeps contact and request pages public in middleware', () => {
    // Both public form pages must be in the platform-v7 public allow-list so the
    // entry-cookie gate does not redirect anonymous visitors away from them.
    expect(middleware).toContain("'/platform-v7/contact'");
    expect(middleware).toContain("'/platform-v7/request'");
    expect(middleware).toContain('PLATFORM_V7_PUBLIC_EXACT');
    // The public lead / inquiry API must stay reachable without a session.
    expect(middleware).toContain('PUBLIC_API_EXACT');
    expect(middleware).toContain("'/api/platform-v7/leads'");
  });

  it('keeps contact and request pages public in the client guard', () => {
    expect(clientGuard).toContain("'/platform-v7/contact'");
    expect(clientGuard).toContain("'/platform-v7/request'");
    expect(clientGuard).toContain('if (isPublicPath(path)) return;');
  });
});
