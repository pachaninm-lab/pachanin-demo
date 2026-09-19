import { createHash } from 'node:crypto';
import {
  CommodityProfileAction,
  type CommodityProfileLifecycle,
} from './commodity-profile.policy';

export type CommodityProfileCommand = {
  commandId: string;
  idempotencyKey: string;
  correlationId: string;
  profileId: string;
  profileVersionId?: string;
  action: Exclude<CommodityProfileAction, 'READ'>;
  expectedVersion: string;
  reason: string;
  payload?: Record<string, unknown>;
};

export type CommodityProfileCommandReceipt = {
  commandId: string;
  idempotencyKey: string;
  correlationId: string;
  profileId: string;
  profileVersionId?: string;
  action: CommodityProfileCommand['action'];
  lifecycle?: CommodityProfileLifecycle;
  version: string;
  replayed: boolean;
  requestFingerprint: string;
  committedAt: string;
};

const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9:_.-]{2,239}$/;

export class CommodityProfileCommandValidationError extends Error {
  constructor(
    readonly code:
      | 'COMMAND_ID_INVALID'
      | 'IDEMPOTENCY_KEY_INVALID'
      | 'CORRELATION_ID_INVALID'
      | 'PROFILE_ID_INVALID'
      | 'PROFILE_VERSION_ID_INVALID'
      | 'EXPECTED_VERSION_INVALID'
      | 'HUMAN_REASON_INVALID'
      | 'PAYLOAD_INVALID',
    message: string,
  ) {
    super(message);
    this.name = 'CommodityProfileCommandValidationError';
  }
}

function assertId(value: string, code: CommodityProfileCommandValidationError['code']): void {
  if (!SAFE_ID.test(value)) throw new CommodityProfileCommandValidationError(code, `${code}: unsafe identifier`);
}

function stable(value: unknown): unknown {
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

export function validateCommodityProfileCommand(command: CommodityProfileCommand): void {
  assertId(command.commandId, 'COMMAND_ID_INVALID');
  assertId(command.idempotencyKey, 'IDEMPOTENCY_KEY_INVALID');
  assertId(command.correlationId, 'CORRELATION_ID_INVALID');
  assertId(command.profileId, 'PROFILE_ID_INVALID');
  if (command.profileVersionId) assertId(command.profileVersionId, 'PROFILE_VERSION_ID_INVALID');
  if (!/^(0|[1-9][0-9]{0,18})$/.test(command.expectedVersion)) {
    throw new CommodityProfileCommandValidationError('EXPECTED_VERSION_INVALID', 'expectedVersion must be a non-negative integer string');
  }
  const reason = command.reason.trim();
  if (reason.length < 10 || reason.length > 2000) {
    throw new CommodityProfileCommandValidationError('HUMAN_REASON_INVALID', 'reason must contain 10..2000 characters');
  }
  if (command.payload !== undefined && (
    command.payload === null
    || Array.isArray(command.payload)
    || typeof command.payload !== 'object'
  )) {
    throw new CommodityProfileCommandValidationError('PAYLOAD_INVALID', 'payload must be an object');
  }
}

export function commodityProfileCommandFingerprint(command: CommodityProfileCommand): string {
  validateCommodityProfileCommand(command);
  return createHash('sha256')
    .update(JSON.stringify(stable({
      action: command.action,
      correlationId: command.correlationId,
      expectedVersion: command.expectedVersion,
      payload: command.payload ?? {},
      profileId: command.profileId,
      profileVersionId: command.profileVersionId ?? null,
      reason: command.reason.trim(),
    })))
    .digest('hex');
}

export function assertIdempotentReplay(
  storedFingerprint: string,
  command: CommodityProfileCommand,
): void {
  const candidate = commodityProfileCommandFingerprint(command);
  if (storedFingerprint !== candidate) {
    throw new CommodityProfileCommandValidationError(
      'PAYLOAD_INVALID',
      'IDEMPOTENCY_PAYLOAD_MISMATCH',
    );
  }
}
