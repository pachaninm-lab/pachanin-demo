import { describe, expect, it } from 'vitest';
import {
  CANONICAL_COMPOSE_API_ORIGIN,
  resolveServerApiOrigin,
} from '../../lib/server/server-api-origin';

function env(values: Record<string, string | undefined>): NodeJS.ProcessEnv {
  return { ...values } as NodeJS.ProcessEnv;
}

describe('server API origin authority', () => {
  it('uses the exact canonical Compose API base including the Nest global prefix', () => {
    expect(resolveServerApiOrigin(env({ NODE_ENV: 'production' })))
      .toBe('http://api:3001/api');
    expect(CANONICAL_COMPOSE_API_ORIGIN).toBe('http://api:3001/api');
  });

  it('accepts only the exact canonical plaintext Compose API base in production', () => {
    expect(resolveServerApiOrigin(env({
      NODE_ENV: 'production',
      API_URL: 'http://api:3001/api',
    }))).toBe('http://api:3001/api');
    expect(resolveServerApiOrigin(env({
      NODE_ENV: 'production',
      API_URL: 'http://api:3001/api/',
    }))).toBe('http://api:3001/api');
  });

  it('accepts an explicit HTTPS server authority in production', () => {
    expect(resolveServerApiOrigin(env({
      NODE_ENV: 'production',
      API_URL: 'https://internal-api.example',
    }))).toBe('https://internal-api.example');
  });

  it.each([
    'http://api:3001',
    'http://attacker.example',
    'http://api.evil:3001/api',
    'http://api:3001/extra',
    'http://api:3001/api/extra',
    'http://user:pass@api:3001/api',
    'http://api:3001/api?x=1',
    'http://api:3001/api#fragment',
    'ftp://api:3001/api',
    'javascript:alert(1)',
    'not-a-url',
  ])('rejects unsafe production server authority %s', (API_URL) => {
    expect(resolveServerApiOrigin(env({ NODE_ENV: 'production', API_URL }))).toBe('');
  });

  it('rejects URL credentials, query and fragment on explicit authorities', () => {
    expect(resolveServerApiOrigin(env({
      NODE_ENV: 'production',
      API_URL: 'https://user:pass@internal-api.example',
    }))).toBe('');
    expect(resolveServerApiOrigin(env({
      NODE_ENV: 'production',
      API_URL: 'https://internal-api.example?x=1',
    }))).toBe('');
    expect(resolveServerApiOrigin(env({
      NODE_ENV: 'production',
      API_URL: 'https://internal-api.example#fragment',
    }))).toBe('');
  });

  it('ignores NEXT_PUBLIC_API_URL as production server authority', () => {
    expect(resolveServerApiOrigin(env({
      NODE_ENV: 'production',
      NEXT_PUBLIC_API_URL: 'https://attacker.example',
    }))).toBe('http://api:3001/api');
  });

  it('keeps NEXT_PUBLIC_API_URL available only as a non-production fallback', () => {
    expect(resolveServerApiOrigin(env({
      NODE_ENV: 'development',
      NEXT_PUBLIC_API_URL: 'http://localhost:3001',
    }))).toBe('http://localhost:3001');
  });

  it('fails closed on an invalid explicit API_URL instead of falling back', () => {
    expect(resolveServerApiOrigin(env({
      NODE_ENV: 'production',
      API_URL: 'http://attacker.example',
      NEXT_PUBLIC_API_URL: 'https://also-attacker.example',
    }))).toBe('');
  });
});
