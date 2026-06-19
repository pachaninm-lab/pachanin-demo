import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const source = fs.readFileSync(path.join(process.cwd(), 'middleware.ts'), 'utf8');

describe('platform-v7 security middleware logic', () => {
  it('keeps baseline security headers in the middleware', () => {
    const requiredHeaders = [
      'x-robots-tag',
      'x-content-type-options',
      'x-frame-options',
      'referrer-policy',
      'permissions-policy',
      'strict-transport-security',
      'content-security-policy',
      'cache-control',
    ];

    for (const header of requiredHeaders) {
      expect(source, `${header} should be set`).toContain(header);
    }
  });

  it('keeps entry and role cookies scoped, secure and sameSite=lax', () => {
    expect(source).toContain("response.cookies.set('pc-role'");
    expect(source).toContain("response.cookies.set(PLATFORM_V7_ENTRY_COOKIE");
    expect(source).toContain("sameSite: 'lax'");
    expect(source).toContain('secure: true');
    expect(source).toContain("path: '/'");
  });

  it('does not treat all platform-v7 routes as public or static assets', () => {
    expect(source).not.toContain("p.startsWith('/platform-v7') || isPublic(p)");
    expect(source).not.toContain("isPublic(p) || p.startsWith('/platform-v7')");
    expect(source).toContain('!isEntry && !isPlatformV7PublicPath(p) && !seenEntry');
  });

  it('keeps private mode and owner authorization controls wired', () => {
    expect(source).toContain("process.env.PC_PRIVATE_MODE === 'on'");
    expect(source).toContain('PC_PRIVATE_PASSWORD');
    expect(source).toContain('PC_OWNER_KEY');
    expect(source).toContain('privateUnauthorizedResponse');
  });
});
