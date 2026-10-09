import { afterEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { middleware } from '../../middleware';

afterEach(() => vi.unstubAllEnvs());

function guest(path: string, privateMode = 'off') {
  vi.stubEnv('PC_PRIVATE_MODE', privateMode);
  return middleware(new NextRequest(`https://xn----8sbjf4befbjgs9b.xn--p1ai${path}`));
}

describe('anonymous Gekta legal document routing', () => {
  it.each(['/legal/usloviya-ispolzovaniya-gekta', '/legal/politika-konfidencialnosti', '/legal/politika-obrabotki-personalnyh-dannyh'])('serves the exact notice document %s without login', async (path) => {
    const response = await guest(`${path}?v=2026-08-12.2&h=${'a'.repeat(64)}&p=${'b'.repeat(64)}`);
    expect(response.status).toBe(200);
    expect(response.headers.get('x-middleware-next')).toBe('1');
    expect(response.headers.get('location')).toBeNull();
    expect(response.headers.get('x-content-type-options')).toBe('nosniff');
  });

  it.each(['/legal/usloviya-ispolzovaniya-gekta', '/legal/politika-konfidencialnosti', '/legal/politika-obrabotki-personalnyh-dannyh'])('retains the whole-site private-mode owner gate for %s', async (path) => {
    vi.stubEnv('PC_PRIVATE_PASSWORD', 'private-cabinet-test-only');
    const response = await guest(path, 'on');
    expect(response.status).toBe(401);
    expect(response.headers.get('www-authenticate')).toContain('Basic');
    expect(response.headers.get('location')).toBeNull();
  });

  it.each(['/legal/private-document', '/legal/politika-konfidencialnosti/private', '/legal/politika-obrabotki-personalnyh-dannyh/private'])('retains guest enforcement for %s', async (path) => {
    const response = await guest(path);
    expect(response.status).toBe(307);
    expect(new URL(response.headers.get('location')!).pathname).toBe('/platform-v7');
  });

  it('keeps account and cabinet authority protected', async () => {
    const api = await guest('/api/private-account-data');
    expect(api.status).toBe(401);
    const cabinet = await guest('/platform-v7/bank');
    expect(cabinet.status).toBe(307);
    expect(new URL(cabinet.headers.get('location')!).pathname).toBe('/platform-v7/login');
  });
});
