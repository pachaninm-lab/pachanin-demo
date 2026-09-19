import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const route = readFileSync(
  join(process.cwd(), 'app/api/platform-v7/organization-connect/route.ts'),
  'utf8',
);

describe('platform-v7 organization intake production API authority', () => {
  it('uses the canonical Compose API service when no explicit server URL is configured', () => {
    expect(route).toContain("const COMPOSE_INTERNAL_API_URL = 'http://api:3001';");
    expect(route).toContain("const explicitServerUrl = String(process.env.API_URL || '').trim();");
    expect(route).toContain("if (explicitServerUrl) return explicitServerUrl.replace(/\\/$/, '');");
    expect(route).toContain("if (process.env.NODE_ENV === 'production') return COMPOSE_INTERNAL_API_URL;");
  });

  it('does not depend on a NEXT_PUBLIC API URL for the production server-to-server hop', () => {
    const productionAuthority = route.indexOf("if (process.env.NODE_ENV === 'production') return COMPOSE_INTERNAL_API_URL;");
    const publicFallback = route.indexOf('process.env.NEXT_PUBLIC_API_URL');
    expect(productionAuthority).toBeGreaterThan(0);
    expect(publicFallback).toBeGreaterThan(productionAuthority);
    expect(route).toContain('const API_URL = resolveApiUrl();');
    expect(route).toContain('fetch(`${API_URL}/organization-intake/requests`');
  });
});
