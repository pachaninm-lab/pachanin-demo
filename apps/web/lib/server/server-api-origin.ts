const COMPOSE_INTERNAL_API_ORIGIN = 'http://api:3001';
const COMPOSE_INTERNAL_API_BASE = `${COMPOSE_INTERNAL_API_ORIGIN}/api`;

function normalizeConfiguredOrigin(raw: string, production: boolean): string {
  try {
    const url = new URL(raw);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return '';
    if (url.username || url.password || url.search || url.hash) return '';

    if (production && url.protocol === 'http:') {
      if (url.origin !== COMPOSE_INTERNAL_API_ORIGIN) return '';
      if (url.pathname !== '/api' && url.pathname !== '/api/') return '';
      return COMPOSE_INTERNAL_API_BASE;
    }

    return url.toString().replace(/\/$/, '');
  } catch {
    return '';
  }
}

export function resolveServerApiOrigin(env: NodeJS.ProcessEnv = process.env): string {
  const production = String(env.NODE_ENV || '').trim() === 'production';
  const explicitServerOrigin = String(env.API_URL || '').trim();

  if (explicitServerOrigin) {
    return normalizeConfiguredOrigin(explicitServerOrigin, production);
  }

  if (production) return COMPOSE_INTERNAL_API_BASE;

  const publicDevelopmentOrigin = String(env.NEXT_PUBLIC_API_URL || '').trim();
  return publicDevelopmentOrigin
    ? normalizeConfiguredOrigin(publicDevelopmentOrigin, false)
    : '';
}

export const CANONICAL_COMPOSE_API_ORIGIN = COMPOSE_INTERNAL_API_BASE;
