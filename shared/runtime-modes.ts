export type RuntimeMode = 'PILOT' | 'PRODUCTION' | 'SANDBOX' | 'DEMO' | 'live-safe' | 'demo';

export const RUNTIME_MODES: RuntimeMode[] = ['PILOT', 'PRODUCTION', 'SANDBOX', 'DEMO'];

export function isProductionMode(mode?: string): boolean {
  return mode === 'PRODUCTION';
}

export function isPilotMode(mode?: string): boolean {
  return mode === 'PILOT';
}

export function isSandboxMode(mode?: string): boolean {
  return mode === 'SANDBOX' || mode === 'DEMO';
}

export function resolveRunMode(env?: string): RuntimeMode {
  if (env === 'production') return 'PRODUCTION';
  if (env === 'pilot') return 'PILOT';
  if (env === 'sandbox') return 'SANDBOX';
  return 'DEMO';
}
