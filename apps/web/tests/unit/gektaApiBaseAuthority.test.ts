import { afterEach, describe, expect, it } from 'vitest';
import { gektaApiBase } from '../../lib/server/gekta-auth-route';

const original = {
  nodeEnv: process.env.NODE_ENV,
  apiUrl: process.env.API_URL,
  publicApiUrl: process.env.NEXT_PUBLIC_API_URL,
};

function setEnv(name: string, value: string | undefined) {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}

function restoreEnv() {
  setEnv('NODE_ENV', original.nodeEnv);
  setEnv('API_URL', original.apiUrl);
  setEnv('NEXT_PUBLIC_API_URL', original.publicApiUrl);
}

afterEach(restoreEnv);

describe('Gekta server API base authority', () => {
  it('uses the canonical Compose API base in production when API_URL is absent', () => {
    setEnv('NODE_ENV', 'production');
    setEnv('API_URL', undefined);
    setEnv('NEXT_PUBLIC_API_URL', 'https://public.example.test/api');

    expect(gektaApiBase()).toBe('http://api:3001/api');
  });

  it('accepts the exact canonical production API base', () => {
    setEnv('NODE_ENV', 'production');
    setEnv('API_URL', 'http://api:3001/api/');

    expect(gektaApiBase()).toBe('http://api:3001/api');
  });

  it('fails closed on a production API_URL that omits the Nest /api prefix', () => {
    setEnv('NODE_ENV', 'production');
    setEnv('API_URL', 'http://api:3001');
    setEnv('NEXT_PUBLIC_API_URL', 'https://public.example.test/api');

    expect(gektaApiBase()).toBe('');
  });

  it('keeps the public API variable non-authoritative in production', () => {
    setEnv('NODE_ENV', 'production');
    setEnv('API_URL', undefined);
    setEnv('NEXT_PUBLIC_API_URL', 'https://attacker.example/api');

    expect(gektaApiBase()).toBe('http://api:3001/api');
  });

  it('preserves the non-production public fallback', () => {
    setEnv('NODE_ENV', 'development');
    setEnv('API_URL', undefined);
    setEnv('NEXT_PUBLIC_API_URL', 'http://localhost:3001/api/');

    expect(gektaApiBase()).toBe('http://localhost:3001/api');
  });
});
