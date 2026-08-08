import { NextRequest } from 'next/server';
import { describe, expect, it } from 'vitest';
import { middleware } from '../../middleware';

function request(pathname: string, cookie = 'pc-role=operator') {
  return new NextRequest(`https://example.test${pathname}`, { headers: { cookie } });
}

describe('P0 registration presentation-role boundary', () => {
  it('clears a stale public presentation role on the page and every registration API request', async () => {
    for (const pathname of [
      '/platform-v7/register',
      '/api/auth/register',
      '/api/auth/registration/status',
      '/api/auth/registration/resend',
      '/api/auth/registration/verify',
      '/api/auth/registration/additional-information',
    ]) {
      const response = await middleware(request(pathname));
      expect(response.headers.get('x-pc-role')).toBe('organization');
      expect(response.headers.get('set-cookie')).toContain('pc-role=;');
      expect(response.headers.get('set-cookie')).toContain('Max-Age=0');
    }
  });
});
