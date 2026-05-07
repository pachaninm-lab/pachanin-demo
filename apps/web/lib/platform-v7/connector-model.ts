import type { PlatformV7EntityId, PlatformV7ExecutionRole, PlatformV7IsoDateTime } from './execution-model';

export type PlatformV7ConnectorMode =
  | 'not_connected'
  | 'test_mode'
  | 'awaiting_contract'
  | 'awaiting_access'
  | 'confirmed_external_connection'
  | 'external_error'
  | 'manual_review';

export type PlatformV7ConnectorStatus = 'ok' | 'degraded' | 'blocked' | 'manual_review';

export interface PlatformV7ConnectorState {
  id: PlatformV7EntityId;
  name: string;
  mode: PlatformV7ConnectorMode;
  status: PlatformV7ConnectorStatus;
  lastEventAt?: PlatformV7IsoDateTime;
  externalId?: string;
  error?: string;
  ownerRole: PlatformV7ExecutionRole;
  blocks: 'publication' | 'deal_creation' | 'shipment' | 'acceptance' | 'money_release' | 'none';
  fallback: 'manual_check' | 'retry' | 'operator_review' | 'none';
}

export function isPlatformV7ConnectorConfirmed(connector: PlatformV7ConnectorState): boolean {
  return connector.mode === 'confirmed_external_connection' && connector.status === 'ok' && Boolean(connector.externalId);
}

export function isPlatformV7ConnectorTestMode(connector: PlatformV7ConnectorState): boolean {
  return connector.mode === 'test_mode';
}

export function isPlatformV7ConnectorBlocking(connector: PlatformV7ConnectorState): boolean {
  return connector.blocks !== 'none' && ['blocked', 'manual_review'].includes(connector.status);
}

export function doesPlatformV7ConnectorNeedFallback(connector: PlatformV7ConnectorState): boolean {
  return connector.status !== 'ok' && connector.fallback !== 'none';
}

export function canPlatformV7ConnectorConfirmExternalEvent(connector: PlatformV7ConnectorState): boolean {
  return isPlatformV7ConnectorConfirmed(connector) && Boolean(connector.lastEventAt);
}
