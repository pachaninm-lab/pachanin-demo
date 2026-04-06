import { normalizeIntegrationMode } from './integration-mode';

export type ProviderHealthSnapshot = {
  provider: string;
  enabled: boolean;
  healthy: boolean;
  mode: 'stub' | 'sandbox' | 'live' | 'disabled';
  details?: Record<string, unknown>;
};

type EnvShape = Record<string, string | undefined>;

type ProviderDefinition = {
  provider: string;
  enabledKey: string;
  modeKey?: string;
  requiredKeys?: string[];
  defaults?: Record<string, unknown>;
};

const DEFINITIONS: ProviderDefinition[] = [
  { provider: 'edo', enabledKey: 'EDO_ENABLED', modeKey: 'INTEGRATION_EDO_MODE', requiredKeys: ['EDO_BASE_URL'], defaults: { scope: 'documents' } },
  { provider: 'fgis_zerno', enabledKey: 'FGIS_ENABLED', modeKey: 'INTEGRATION_FGIS_ZERNO_MODE', requiredKeys: ['FGIS_BASE_URL'], defaults: { scope: 'traceability' } },
  { provider: 'bank', enabledKey: 'BANK_ENABLED', modeKey: 'INTEGRATION_BANK_MODE', requiredKeys: ['BANK_CALLBACK_SECRET'], defaults: { scope: 'payments' } },
  { provider: 'gps', enabledKey: 'GPS_ENABLED', modeKey: 'INTEGRATION_GPS_MODE', requiredKeys: ['GPS_PROVIDER'], defaults: { scope: 'tracking' } },
  { provider: 'lab', enabledKey: 'LAB_ENABLED', modeKey: 'INTEGRATION_LAB_MODE', requiredKeys: ['LAB_PROVIDER'], defaults: { scope: 'quality' } },
  { provider: 'smartagro', enabledKey: 'SMARTAGRO_ENABLED', modeKey: 'SMARTAGRO_AUTH_MODE', requiredKeys: ['SMARTAGRO_BASE_URL'], defaults: { scope: 'forecast' } }
];

function asBool(value?: string) {
  return String(value || '').toLowerCase() === 'true';
}

function detectMode(env: EnvShape, definition: ProviderDefinition): ProviderHealthSnapshot['mode'] {
  const explicitMode = normalizeIntegrationMode(definition.modeKey ? env[definition.modeKey] || '' : '', 'disabled');
  if (explicitMode !== 'disabled') return explicitMode;
  return asBool(env[definition.enabledKey]) ? 'sandbox' : 'disabled';
}

export function buildProviderHealthSnapshot(env: EnvShape): ProviderHealthSnapshot[] {
  return DEFINITIONS.map((definition) => {
    const enabled = asBool(env[definition.enabledKey]);
    const mode = detectMode(env, definition);
    const missing = (definition.requiredKeys || []).filter((key) => !env[key]);
    const healthy = !enabled || mode === 'disabled' || missing.length === 0;
    return {
      provider: definition.provider,
      enabled,
      healthy,
      mode,
      details: {
        ...(definition.defaults || {}),
        missing,
        configuredKeys: (definition.requiredKeys || []).filter((key) => !!env[key]),
      }
    };
  });
}
