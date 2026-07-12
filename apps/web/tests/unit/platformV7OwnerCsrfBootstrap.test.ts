import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');
const page = read('apps/web/app/platform-v7/staff/page.tsx');
const prepareRoute = read('apps/web/app/platform-v7/staff/prepare/route.ts');

describe('platform-v7 owner CSRF bootstrap', () => {
  it('repairs a valid legacy owner session before rendering disabled cabinet buttons', () => {
    expect(page).toContain("cookieStore.get(CSRF_COOKIE)?.value || ''");
    expect(page).toContain("verification.status === 'verified' && !csrfToken");
    expect(page).toContain("redirect('/platform-v7/staff/prepare')");
  });

  it('issues a same-site CSRF cookie only when an access session exists and returns to staff', () => {
    expect(prepareRoute).toContain('request.cookies.get(ACCESS_COOKIE)');
    expect(prepareRoute).toContain("target.pathname = '/platform-v7/login'");
    expect(prepareRoute).toContain('generateCsrfToken()');
    expect(prepareRoute).toContain('response.cookies.set(CSRF_COOKIE');
    expect(prepareRoute).toContain('csrfCookieSecurity()');
    expect(prepareRoute).toContain("new URL('/platform-v7/staff', request.url)");
    expect(prepareRoute).toContain("NextResponse.redirect(target, 303)");
    expect(prepareRoute).toContain("'Cache-Control', 'no-store, no-cache, must-revalidate, private'");
  });
});
