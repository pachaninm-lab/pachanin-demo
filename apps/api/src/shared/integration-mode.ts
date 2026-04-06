export const INTEGRATION_MODES = ['disabled', 'stub', 'sandbox', 'live'] as const;
export type IntegrationMode = (typeof INTEGRATION_MODES)[number];

export function normalizeIntegrationMode(raw?: string | null, fallback: IntegrationMode = 'disabled'): IntegrationMode {
  const value = String(raw || '').trim().toLowerCase();
  if (!value) return fallback;
  if (value === 'disabled' || value === 'off' || value === 'false') return 'disabled';
  if (value === 'stub' || value === 'mock' || value === 'fake') return 'stub';
  if (value === 'sandbox' || value === 'test' || value === 'demo') return 'sandbox';
  if (value === 'live' || value === 'prod' || value === 'production') return 'live';
  return fallback;
}

export function isEnabledMode(mode?: string | null) {
  return normalizeIntegrationMode(mode) !== 'disabled';
}
