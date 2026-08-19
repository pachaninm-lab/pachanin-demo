import { ONE_C_PROTOCOL_VERSION } from './one-c-connector.protocol';

/**
 * Machine-safe operational heartbeat for the local/server 1C connector.
 *
 * No free-text diagnostic, stack trace, path, hostname, credential, legal-entity
 * identifier or arbitrary metadata is accepted. The connector can report only
 * bounded state codes and version strings. Organization/binding scope always
 * comes from the persisted machine credential, never from this payload.
 */
export const OneCHeartbeatHealth = {
  READY: 'READY',
  DEGRADED: 'DEGRADED',
  BLOCKED: 'BLOCKED',
} as const;
export type OneCHeartbeatHealth =
  (typeof OneCHeartbeatHealth)[keyof typeof OneCHeartbeatHealth];

export const OneCHeartbeatDiagnosticCode = {
  ONE_C_UNAVAILABLE: 'ONE_C_UNAVAILABLE',
  DATABASE_UNAVAILABLE: 'DATABASE_UNAVAILABLE',
  EXTENSION_VERSION_MISMATCH: 'EXTENSION_VERSION_MISMATCH',
  PERMISSION_DENIED: 'PERMISSION_DENIED',
  CLOCK_SKEW: 'CLOCK_SKEW',
  UNSUPPORTED_CONFIGURATION: 'UNSUPPORTED_CONFIGURATION',
  BACKGROUND_JOB_DISABLED: 'BACKGROUND_JOB_DISABLED',
  NETWORK_DEGRADED: 'NETWORK_DEGRADED',
  LOCAL_QUEUE_BACKLOG: 'LOCAL_QUEUE_BACKLOG',
} as const;
export type OneCHeartbeatDiagnosticCode =
  (typeof OneCHeartbeatDiagnosticCode)[keyof typeof OneCHeartbeatDiagnosticCode];

export const ONE_C_HEARTBEAT_DIAGNOSTIC_CODES = Object.freeze(
  Object.values(OneCHeartbeatDiagnosticCode),
);

export interface OneCHeartbeatReport {
  readonly protocolVersion: string;
  readonly connectorVersion: string;
  readonly platformVersion: string;
  readonly configurationVersion: string;
  readonly health: OneCHeartbeatHealth;
  readonly diagnosticCodes: readonly OneCHeartbeatDiagnosticCode[];
}

export class OneCHeartbeatValidationError extends Error {
  constructor(readonly code: string) {
    super(code);
    this.name = 'OneCHeartbeatValidationError';
  }
}

export function validateOneCHeartbeatReport(report: OneCHeartbeatReport): void {
  if (report.protocolVersion !== ONE_C_PROTOCOL_VERSION) {
    throw new OneCHeartbeatValidationError('ONE_C_HEARTBEAT_PROTOCOL_INVALID');
  }
  boundedVersion(report.connectorVersion, 64, 'ONE_C_HEARTBEAT_CONNECTOR_VERSION_INVALID');
  boundedVersion(report.platformVersion, 96, 'ONE_C_HEARTBEAT_PLATFORM_VERSION_INVALID');
  boundedVersion(
    report.configurationVersion,
    96,
    'ONE_C_HEARTBEAT_CONFIGURATION_VERSION_INVALID',
  );

  if (!(Object.values(OneCHeartbeatHealth) as readonly string[]).includes(report.health)) {
    throw new OneCHeartbeatValidationError('ONE_C_HEARTBEAT_HEALTH_INVALID');
  }
  if (!Array.isArray(report.diagnosticCodes) || report.diagnosticCodes.length > 8) {
    throw new OneCHeartbeatValidationError('ONE_C_HEARTBEAT_DIAGNOSTICS_INVALID');
  }

  const seen = new Set<string>();
  for (const code of report.diagnosticCodes) {
    if (!(ONE_C_HEARTBEAT_DIAGNOSTIC_CODES as readonly string[]).includes(code)) {
      throw new OneCHeartbeatValidationError('ONE_C_HEARTBEAT_DIAGNOSTICS_INVALID');
    }
    if (seen.has(code)) {
      throw new OneCHeartbeatValidationError('ONE_C_HEARTBEAT_DIAGNOSTICS_INVALID');
    }
    seen.add(code);
  }

  if (report.health === OneCHeartbeatHealth.READY && report.diagnosticCodes.length !== 0) {
    throw new OneCHeartbeatValidationError('ONE_C_HEARTBEAT_DIAGNOSTICS_INVALID');
  }
  if (report.health !== OneCHeartbeatHealth.READY && report.diagnosticCodes.length === 0) {
    throw new OneCHeartbeatValidationError('ONE_C_HEARTBEAT_DIAGNOSTICS_REQUIRED');
  }
}

function boundedVersion(value: string, max: number, code: string): void {
  if (typeof value !== 'string' || value.trim().length < 1 || value.trim().length > max) {
    throw new OneCHeartbeatValidationError(code);
  }
  if (!/^[A-Za-z0-9._+() -]+$/.test(value.trim())) {
    throw new OneCHeartbeatValidationError(code);
  }
}
