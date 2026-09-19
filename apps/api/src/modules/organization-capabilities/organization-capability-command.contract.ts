import { createHash } from 'node:crypto';
import type {
  OrganizationCapabilityAction,
  OrganizationCapabilityCode,
  OrganizationCapabilityStatus,
} from './organization-capability.registry';

export type OrganizationCapabilityCommand = Readonly<{
  commandId: string;
  idempotencyKey: string;
  correlationId: string;
  capabilityCode: OrganizationCapabilityCode;
  action: OrganizationCapabilityAction;
  expectedVersion: string;
  reason: string;
}>;

export type OrganizationCapabilityCommandReceipt = Readonly<{
  commandId: string;
  idempotencyKey: string;
  correlationId: string;
  organizationId: string;
  capabilityCode: OrganizationCapabilityCode;
  action: OrganizationCapabilityAction;
  status: OrganizationCapabilityStatus;
  version: string;
  replayed: boolean;
  requestFingerprint: string;
  committedAt: string;
  enforcementMode: 'SHADOW';
}>;

const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9:_.-]{2,239}$/;

export class OrganizationCapabilityCommandValidationError extends Error {
  constructor(
    readonly code:
      | 'COMMAND_ID_INVALID'
      | 'IDEMPOTENCY_KEY_INVALID'
      | 'CORRELATION_ID_INVALID'
      | 'EXPECTED_VERSION_INVALID'
      | 'HUMAN_REASON_INVALID',
    message: string,
  ) {
    super(message);
    this.name = 'OrganizationCapabilityCommandValidationError';
  }
}
function assertId(
  value: string,
  code: OrganizationCapabilityCommandValidationError['code'],
): void {
  if (!SAFE_ID.test(value)) {
    throw new OrganizationCapabilityCommandValidationError(code, `${code}: unsafe identifier`);
  }
}

export function validateOrganizationCapabilityCommand(
  command: OrganizationCapabilityCommand,
): void {
  assertId(command.commandId, 'COMMAND_ID_INVALID');
  assertId(command.idempotencyKey, 'IDEMPOTENCY_KEY_INVALID');
  assertId(command.correlationId, 'CORRELATION_ID_INVALID');
  if (!/^(0|[1-9][0-9]{0,18})$/.test(command.expectedVersion)) {
    throw new OrganizationCapabilityCommandValidationError(
      'EXPECTED_VERSION_INVALID',
      'expectedVersion must be a non-negative integer string',
    );
  }
  const reason = command.reason.trim();
  if (reason.length < 10 || reason.length > 2000) {
    throw new OrganizationCapabilityCommandValidationError(
      'HUMAN_REASON_INVALID',
      'reason must contain 10..2000 characters',
    );
  }
}

export function stableOrganizationCapabilityJson(value: unknown): unknown {
  if (value === undefined) return null;
  if (Array.isArray(value)) return value.map(stableOrganizationCapabilityJson);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, stableOrganizationCapabilityJson(item)]),
    );
  }
  return value;
}

export function organizationCapabilityDigest(value: unknown): string {
  return createHash('sha256')
    .update(JSON.stringify(stableOrganizationCapabilityJson(value)))
    .digest('hex');
}

export function organizationCapabilityCommandFingerprint(
  command: OrganizationCapabilityCommand,
): string {
  validateOrganizationCapabilityCommand(command);
  return organizationCapabilityDigest({
    action: command.action,
    capabilityCode: command.capabilityCode,
    correlationId: command.correlationId,
    expectedVersion: command.expectedVersion,
    reason: command.reason.trim(),
  });
}

export function assertOrganizationCapabilityReplay(
  storedFingerprint: string,
  command: OrganizationCapabilityCommand,
): void {
  if (storedFingerprint !== organizationCapabilityCommandFingerprint(command)) {
    throw new OrganizationCapabilityCommandValidationError(
      'IDEMPOTENCY_KEY_INVALID',
      'IDEMPOTENCY_PAYLOAD_MISMATCH',
    );
  }
}
