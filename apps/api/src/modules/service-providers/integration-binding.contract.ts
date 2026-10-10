import { createHash } from 'node:crypto';
import type { IntegrationBindingType } from '../../../../../packages/domain-core/src';
import { INTEGRATION_BINDING_TYPES } from '../../../../../packages/domain-core/src';

type CommandBase = Readonly<{
  bindingKey: string;
  commandId: string;
  idempotencyKey: string;
  correlationId: string;
  expectedVersion: string;
  reason: string;
}>;

export type IntegrationBindingCommand = CommandBase & (
  | Readonly<{
      action: 'UPSERT';
      providerCapabilityId: string;
      capabilityCode: string;
      transportType: IntegrationBindingType;
      environment: string;
      endpointReference: string | null;
      credentialReference: string | null;
    }>
  | Readonly<{
      action: 'WITHDRAW';
    }>
);

export type IntegrationBindingCommandReceipt = Readonly<{
  commandId: string;
  idempotencyKey: string;
  correlationId: string;
  integrationBindingId: string;
  bindingKey: string;
  action: IntegrationBindingCommand['action'];
  status: string;
  version: string;
  replayed: boolean;
  requestFingerprint: string;
  committedAt: string;
  maturityAuthority: 'SERVER_HELD_EVIDENCE';
}>;

const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9:_.-]{2,239}$/;
const SAFE_BINDING_KEY = /^[A-Za-z0-9][A-Za-z0-9_.-]{2,79}$/;
const SAFE_CAPABILITY_CODE = /^[A-Z][A-Z0-9_.-]{2,79}$/;
const SAFE_ENVIRONMENT = /^[A-Z][A-Z0-9_]{1,31}$/;
const SAFE_ENDPOINT_REFERENCE = /^(?:endpoint|config|binding):[A-Za-z0-9][A-Za-z0-9:_.\/-]{1,220}$/;
const SAFE_CREDENTIAL_REFERENCE = /^(?:secret|vault|kms|credential):[A-Za-z0-9][A-Za-z0-9:_.\/-]{1,220}$/;

export class IntegrationBindingValidationError extends Error {
  constructor(
    readonly code:
      | 'BINDING_KEY_INVALID'
      | 'COMMAND_ID_INVALID'
      | 'IDEMPOTENCY_KEY_INVALID'
      | 'CORRELATION_ID_INVALID'
      | 'EXPECTED_VERSION_INVALID'
      | 'HUMAN_REASON_INVALID'
      | 'PROVIDER_CAPABILITY_ID_INVALID'
      | 'CAPABILITY_CODE_INVALID'
      | 'TRANSPORT_TYPE_INVALID'
      | 'ENVIRONMENT_INVALID'
      | 'REFERENCE_INVALID'
      | 'IDEMPOTENCY_PAYLOAD_MISMATCH',
    message: string,
  ) {
    super(message);
    this.name = 'IntegrationBindingValidationError';
  }
}

function stable(value: unknown): unknown {
  if (value === undefined) return null;
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, stable(item)]),
    );
  }
  return value;
}

export function integrationBindingDigest(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(stable(value))).digest('hex');
}

export function stableIntegrationBindingJson(value: unknown): unknown {
  return stable(value);
}

export function validateIntegrationBindingCommand(command: IntegrationBindingCommand): void {
  if (!SAFE_BINDING_KEY.test(command.bindingKey)) {
    throw new IntegrationBindingValidationError('BINDING_KEY_INVALID', 'Unsafe binding key');
  }
  for (const [value, code] of [
    [command.commandId, 'COMMAND_ID_INVALID'],
    [command.idempotencyKey, 'IDEMPOTENCY_KEY_INVALID'],
    [command.correlationId, 'CORRELATION_ID_INVALID'],
  ] as const) {
    if (!SAFE_ID.test(value)) throw new IntegrationBindingValidationError(code, `${code}: unsafe identifier`);
  }
  if (!/^(0|[1-9][0-9]{0,18})$/.test(command.expectedVersion)) {
    throw new IntegrationBindingValidationError(
      'EXPECTED_VERSION_INVALID',
      'expectedVersion must be a non-negative integer string',
    );
  }
  if (command.reason.trim().length < 10 || command.reason.trim().length > 2000) {
    throw new IntegrationBindingValidationError(
      'HUMAN_REASON_INVALID',
      'reason must contain 10..2000 characters',
    );
  }
  if (command.action === 'WITHDRAW') return;
  if (!SAFE_ID.test(command.providerCapabilityId)) {
    throw new IntegrationBindingValidationError(
      'PROVIDER_CAPABILITY_ID_INVALID',
      'Unsafe provider capability id',
    );
  }
  if (!SAFE_CAPABILITY_CODE.test(command.capabilityCode)) {
    throw new IntegrationBindingValidationError('CAPABILITY_CODE_INVALID', 'Unsafe capability code');
  }
  if (!INTEGRATION_BINDING_TYPES.includes(command.transportType)) {
    throw new IntegrationBindingValidationError('TRANSPORT_TYPE_INVALID', 'Unknown transport type');
  }
  if (!SAFE_ENVIRONMENT.test(command.environment)) {
    throw new IntegrationBindingValidationError('ENVIRONMENT_INVALID', 'Unsafe environment');
  }
  if (
    command.endpointReference !== null
    && !SAFE_ENDPOINT_REFERENCE.test(command.endpointReference.trim())
  ) {
    throw new IntegrationBindingValidationError(
      'REFERENCE_INVALID',
      'endpointReference must be an opaque endpoint:, config: or binding: reference',
    );
  }
  if (
    command.credentialReference !== null
    && !SAFE_CREDENTIAL_REFERENCE.test(command.credentialReference.trim())
  ) {
    throw new IntegrationBindingValidationError(
      'REFERENCE_INVALID',
      'credentialReference must be an opaque secret:, vault:, kms: or credential: reference',
    );
  }
}

export function integrationBindingCommandFingerprint(command: IntegrationBindingCommand): string {
  validateIntegrationBindingCommand(command);
  return integrationBindingDigest({
    ...command,
    reason: command.reason.trim(),
    ...(command.action === 'UPSERT' ? {
      endpointReference: command.endpointReference?.trim() ?? null,
      credentialReference: command.credentialReference?.trim() ?? null,
    } : {}),
  });
}

export function assertIntegrationBindingReplay(
  storedFingerprint: string,
  command: IntegrationBindingCommand,
): void {
  if (storedFingerprint !== integrationBindingCommandFingerprint(command)) {
    throw new IntegrationBindingValidationError(
      'IDEMPOTENCY_PAYLOAD_MISMATCH',
      'IDEMPOTENCY_PAYLOAD_MISMATCH',
    );
  }
}

export function isIntegrationBindingAction(value: string): value is IntegrationBindingCommand['action'] {
  return value === 'UPSERT' || value === 'WITHDRAW';
}
