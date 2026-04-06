import { resolveRunMode } from '../../../shared/runtime-modes';

export type RuntimeGapMode = 'snapshot' | 'degraded' | 'strict';

export function resolveRuntimeGapMode(env: Record<string, unknown> = process.env): RuntimeGapMode {
  const requested = String(env.PC_RUNTIME_FALLBACK_MODE || '').trim().toLowerCase();
  if (requested === 'snapshot' || requested === 'degraded' || requested === 'strict') return requested;
  const runMode = resolveRunMode(String(env.NODE_ENV || ''));
  if (runMode === 'live-safe') return 'strict';
  if (runMode === 'demo') return 'snapshot';
  return 'degraded';
}

export function runtimeGapSource(mode: RuntimeGapMode) {
  if (mode === 'strict') return 'strict-runtime-gap';
  if (mode === 'snapshot') return 'snapshot-runtime-gap';
  return 'degraded-runtime-gap';
}

export function shouldFailClosed(mode: RuntimeGapMode, critical = false) {
  return mode === 'strict' || critical;
}
