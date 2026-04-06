import { buildProviderHealthSnapshot } from '../../shared/provider-health.shared';
import { INTEGRATION_MODES, normalizeIntegrationMode } from '../../shared/integration-mode';

export type AppEnv = Record<string, string | undefined>;

const REQUIRED_KEYS = ['ACCESS_TOKEN_SECRET', 'REFRESH_TOKEN_SECRET'];
const MODE_KEYS = [
  'INTEGRATION_EDO_MODE',
  'INTEGRATION_FGIS_ZERNO_MODE',
  'INTEGRATION_BANK_MODE',
  'INTEGRATION_GPS_MODE',
  'INTEGRATION_LAB_MODE',
  'SMARTAGRO_AUTH_MODE'
] as const;
const BOOLEAN_KEYS = [
  'ENABLE_MOCK_AUTH',
  'ALLOW_USER_SELF_REGISTRATION',
  'SMARTAGRO_USE_SANDBOX_SAMPLES',
  'EDO_ENABLED',
  'FGIS_ENABLED',
  'BANK_ENABLED',
  'GPS_ENABLED',
  'LAB_ENABLED',
  'SMARTAGRO_ENABLED',
  'ENABLE_PUBLIC_RUNTIME_READS',
  'ENABLE_PUBLIC_RUNTIME_MUTATIONS',
  'ENABLE_PUBLIC_PILOT_PREVIEW',
  'ENABLE_PUBLIC_LOT_REPORTS',
  'ENABLE_PUBLIC_METRICS',
  'ENABLE_OPERATOR_PREVIEW',
  'ENABLE_INTEGRATION_PREVIEW',
  'ENABLE_PUBLIC_MARKET_DATA',
  'ENABLE_PUBLIC_HEALTH_DETAILS',
  'ENABLE_PUBLIC_PREVIEW_IN_PROD',
  'INTEGRATION_EVENT_LOG_OUTBOX',
  'INTEGRATION_OPEN_INCIDENT_ON_FAILURE'
] as const;
const RUNTIME_PERSISTENCE_MODES = ['file', 'hybrid', 'db', 'db-strict'] as const;

function isBoolLike(value?: string) {
  return value == null || value === '' || ['true', 'false'].includes(String(value).toLowerCase());
}

function isPositiveNumberLike(value?: string) {
  return value == null || value === '' || Number.isFinite(Number(value));
}

function isHttpUrlList(value?: string) {
  if (value == null || value.trim() == '') return true;
  return value.split(',').map((item) => item.trim()).filter(Boolean).every((item) => {
    try {
      const url = new URL(item);
      return ['http:', 'https:'].includes(url.protocol);
    } catch {
      return false;
    }
  });
}

export function validateEnv(env: AppEnv) {
  const errors: string[] = [];

  for (const key of REQUIRED_KEYS) {
    const value = String(env[key] || '').trim();
    if (!value || value.startsWith('change-me')) errors.push(`${key} must be set to a non-placeholder value`);
  }

  if (!isPositiveNumberLike(env.PORT)) errors.push('PORT must be numeric');
  if (!isPositiveNumberLike(env.OUTBOX_MAX_ATTEMPTS)) errors.push('OUTBOX_MAX_ATTEMPTS must be numeric');
  if (!isPositiveNumberLike(env.INTEGRATION_RETRY_BASE_MS)) errors.push('INTEGRATION_RETRY_BASE_MS must be numeric');
  if (!isPositiveNumberLike(env.INTEGRATION_RETRY_MAX_ATTEMPTS)) errors.push('INTEGRATION_RETRY_MAX_ATTEMPTS must be numeric');
  if (!isPositiveNumberLike(env.OUTBOX_RETRY_BASE_MS)) errors.push('OUTBOX_RETRY_BASE_MS must be numeric');
  if (!isPositiveNumberLike(env.REPUTATION_THRESHOLD_RESTRICT)) errors.push('REPUTATION_THRESHOLD_RESTRICT must be numeric');
  if (!isPositiveNumberLike(env.REPUTATION_THRESHOLD_REVIEW)) errors.push('REPUTATION_THRESHOLD_REVIEW must be numeric');
  if (!isPositiveNumberLike(env.REPUTATION_THRESHOLD_OK)) errors.push('REPUTATION_THRESHOLD_OK must be numeric');
  if (!isPositiveNumberLike(env.RATE_LIMIT_AUTH_LOGIN)) errors.push('RATE_LIMIT_AUTH_LOGIN must be numeric');
  if (!isPositiveNumberLike(env.RATE_LIMIT_AUTH_REGISTER)) errors.push('RATE_LIMIT_AUTH_REGISTER must be numeric');
  if (!isPositiveNumberLike(env.RATE_LIMIT_AUTH_REFRESH)) errors.push('RATE_LIMIT_AUTH_REFRESH must be numeric');
  if (!isPositiveNumberLike(env.RATE_LIMIT_UPLOADS)) errors.push('RATE_LIMIT_UPLOADS must be numeric');
  if (!isPositiveNumberLike(env.RATE_LIMIT_INTEGRATION_CALLBACKS)) errors.push('RATE_LIMIT_INTEGRATION_CALLBACKS must be numeric');
  if (!isPositiveNumberLike(env.RATE_LIMIT_OPERATOR_ACTIONS)) errors.push('RATE_LIMIT_OPERATOR_ACTIONS must be numeric');
  if (!isPositiveNumberLike(env.RATE_LIMIT_WINDOW_SECONDS)) errors.push('RATE_LIMIT_WINDOW_SECONDS must be numeric');
  if (!isPositiveNumberLike(env.MAX_DOCUMENT_SIZE_BYTES)) errors.push('MAX_DOCUMENT_SIZE_BYTES must be numeric');
  if (!isHttpUrlList(env.MARKET_NEWS_FEEDS)) errors.push('MARKET_NEWS_FEEDS must contain valid http/https URLs');
  if (!isHttpUrlList(env.MARKET_ANALYTICS_FEEDS)) errors.push('MARKET_ANALYTICS_FEEDS must contain valid http/https URLs');

  for (const key of BOOLEAN_KEYS) {
    if (!isBoolLike(env[key])) errors.push(`${key} must be true or false`);
  }

  for (const key of MODE_KEYS) {
    const raw = env[key];
    if (!raw) continue;
    const normalized = normalizeIntegrationMode(raw, '__invalid__' as any);
    if (!INTEGRATION_MODES.includes(normalized as any)) {
      errors.push(`${key} must be one of: ${INTEGRATION_MODES.join(', ')}`);
    }
  }

  const runtimeMode = String(env.RUNTIME_PERSISTENCE_MODE || 'hybrid').toLowerCase();
  if (!(RUNTIME_PERSISTENCE_MODES as readonly string[]).includes(runtimeMode)) {
    errors.push(`RUNTIME_PERSISTENCE_MODE must be one of: ${RUNTIME_PERSISTENCE_MODES.join(', ')}`);
  }
  if (runtimeMode !== 'file' && !env.DATABASE_URL) {
    errors.push('DATABASE_URL is required when RUNTIME_PERSISTENCE_MODE is not file');
  }

  const providers = buildProviderHealthSnapshot(env);
  for (const provider of providers) {
    if (provider.mode === 'live' && provider.enabled && !provider.healthy) {
      const missing = Array.isArray(provider.details?.missing) ? provider.details?.missing.join(', ') : 'provider credentials';
      errors.push(`Live provider ${provider.provider} is missing required configuration: ${missing}`);
    }
  }

  const okThreshold = Number(env.REPUTATION_THRESHOLD_OK ?? 65);
  const reviewThreshold = Number(env.REPUTATION_THRESHOLD_REVIEW ?? 45);
  const restrictThreshold = Number(env.REPUTATION_THRESHOLD_RESTRICT ?? 30);
  if (Number.isFinite(okThreshold) && Number.isFinite(reviewThreshold) && Number.isFinite(restrictThreshold)) {
    if (!(okThreshold > reviewThreshold && reviewThreshold >= restrictThreshold)) {
      errors.push('Reputation thresholds must satisfy OK > REVIEW >= RESTRICT');
    }
  }

  if (errors.length) {
    throw new Error(`Invalid environment configuration:\n${errors.map((item) => `- ${item}`).join('\n')}`);
  }

  return env;
}
