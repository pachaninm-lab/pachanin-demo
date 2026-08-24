const COMPOSE_INTERNAL_API_BASE_URL = 'http://api:3001/api';

function normalizeConfiguredBaseUrl(raw: string, production: boolean): string {
  try {
    const url = new URL(raw);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return '';
    if (url.username || url.password || url.search || url.hash) return '';

    if (production && url.protocol === 'http:') {
      if (url.origin !== 'http://api:3001') return '';
      if (url.pathname !== '/api' && url.pathname !== '/api/') return '';
      return COMPOSE_INTERNAL_API_BASE_URL;
    }

    return url.toString().replace(/\/$/, '');
  } catch {
    return '';
  }
}

export function resolveServerApiBaseUrl(env: NodeJS.ProcessEnv = process.env): string {
  const production = String(env.NODE_ENV || '').trim() === 'production';
  const explicitServerOrigin = String(env.API_URL || '').trim();

  if (explicitServerOrigin) {
    return normalizeConfiguredBaseUrl(explicitServerOrigin, production);
  }

  if (production) return COMPOSE_INTERNAL_API_BASE_URL;

  const publicDevelopmentOrigin = String(env.NEXT_PUBLIC_API_URL || '').trim();
  return publicDevelopmentOrigin
    ? normalizeConfiguredBaseUrl(publicDevelopmentOrigin, false)
    : '';
}

export const CANONICAL_COMPOSE_API_BASE_URL = COMPOSE_INTERNAL_API_BASE_URL;
