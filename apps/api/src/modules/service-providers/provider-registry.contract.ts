import { createHash } from 'node:crypto';
import type {
  ProviderLegalRole,
  ServiceProviderCategory,
  ServiceProviderStage,
} from '../../../../../packages/domain-core/src';
import type { OrganizationCapabilityCode } from '../organization-capabilities/organization-capability.registry';

export const PROVIDER_CATEGORIES = [
  'LOGISTICS',
  'INSURANCE',
  'LAB',
  'SURVEY',
  'ELEVATOR',
  'PORT',
  'RAIL',
  'BANK',
] as const satisfies readonly ServiceProviderCategory[];

export const PROVIDER_STAGES = [
  'DISPATCH',
  'LAB',
  'RECEIVING',
  'EXPORT',
  'PAYMENT',
] as const satisfies readonly ServiceProviderStage[];

export const PROVIDER_LEGAL_ROLES = [
  'carrier',
  'expeditor',
  'mixed',
  'lab',
  'bank',
  'other',
] as const satisfies readonly ProviderLegalRole[];

export const PROVIDER_CATEGORY_CAPABILITY: Readonly<Record<
  ServiceProviderCategory,
  OrganizationCapabilityCode
>> = Object.freeze({
  LOGISTICS: 'PROVIDE_LOGISTICS',
  INSURANCE: 'PROVIDE_INSURANCE',
  LAB: 'PROVIDE_LAB_TESTING',
  SURVEY: 'PROVIDE_SURVEYING',
  ELEVATOR: 'PROVIDE_ELEVATOR_SERVICES',
  PORT: 'PROVIDE_LOGISTICS',
  RAIL: 'PROVIDE_LOGISTICS',
  BANK: 'PROVIDE_FINANCING',
});

type ProviderCommandBase = Readonly<{
  commandId: string;
  idempotencyKey: string;
  correlationId: string;
  expectedVersion: string;
  reason: string;
}>;

export type ProviderCapabilityCommand = ProviderCommandBase & Readonly<{
  entityType: 'PROVIDER_CAPABILITY';
  action: 'DECLARE' | 'REVOKE';
  category: ServiceProviderCategory;
  legalRole: ProviderLegalRole;
}>;

export type ServiceOfferingCommand = ProviderCommandBase & Readonly<{
  entityType: 'SERVICE_OFFERING';
  action: 'UPSERT' | 'WITHDRAW';
  offeringKey: string;
  category: ServiceProviderCategory;
  title: string | null;
  description: string | null;
  regions: readonly string[];
  cultures: readonly string[];
  stages: readonly ServiceProviderStage[];
}>;

export type ProviderRegistryCommand = ProviderCapabilityCommand | ServiceOfferingCommand;

export type ProviderRegistryCommandReceipt = Readonly<{
  commandId: string;
  idempotencyKey: string;
  correlationId: string;
  providerId: string;
  entityType: ProviderRegistryCommand['entityType'];
  entityId: string;
  category: ServiceProviderCategory;
  action: ProviderRegistryCommand['action'];
  status: string;
  version: string;
  replayed: boolean;
  requestFingerprint: string;
  committedAt: string;
  verificationMode: 'SERVER_HELD';
}>;

const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9:_.-]{2,239}$/;
const SAFE_OFFERING_KEY = /^[A-Za-z0-9][A-Za-z0-9_.-]{2,79}$/;

export class ProviderRegistryValidationError extends Error {
  constructor(
    readonly code:
      | 'COMMAND_ID_INVALID'
      | 'IDEMPOTENCY_KEY_INVALID'
      | 'CORRELATION_ID_INVALID'
      | 'EXPECTED_VERSION_INVALID'
      | 'HUMAN_REASON_INVALID'
      | 'PROVIDER_CATEGORY_INVALID'
      | 'PROVIDER_LEGAL_ROLE_INVALID'
      | 'OFFERING_KEY_INVALID'
      | 'OFFERING_DETAILS_INVALID'
      | 'IDEMPOTENCY_PAYLOAD_MISMATCH',
    message: string,
  ) {
    super(message);
    this.name = 'ProviderRegistryValidationError';
  }
}

export function isProviderCategory(value: string): value is ServiceProviderCategory {
  return PROVIDER_CATEGORIES.includes(value as ServiceProviderCategory);
}

export function isProviderLegalRole(value: string): value is ProviderLegalRole {
  return PROVIDER_LEGAL_ROLES.includes(value as ProviderLegalRole);
}

function normalizedStrings(values: readonly string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, 'ru'));
}

function validateBoundedStrings(values: readonly string[], maximumItems: number): boolean {
  return values.length <= maximumItems
    && values.every((value) => value.trim().length >= 2 && value.trim().length <= 120);
}

export function validateProviderRegistryCommand(command: ProviderRegistryCommand): void {
  for (const [value, code] of [
    [command.commandId, 'COMMAND_ID_INVALID'],
    [command.idempotencyKey, 'IDEMPOTENCY_KEY_INVALID'],
    [command.correlationId, 'CORRELATION_ID_INVALID'],
  ] as const) {
    if (!SAFE_ID.test(value)) throw new ProviderRegistryValidationError(code, `${code}: unsafe identifier`);
  }
  if (!/^(0|[1-9][0-9]{0,18})$/.test(command.expectedVersion)) {
    throw new ProviderRegistryValidationError(
      'EXPECTED_VERSION_INVALID',
      'expectedVersion must be a non-negative integer string',
    );
  }
  if (command.reason.trim().length < 10 || command.reason.trim().length > 2000) {
    throw new ProviderRegistryValidationError(
      'HUMAN_REASON_INVALID',
      'reason must contain 10..2000 characters',
    );
  }
  if (!isProviderCategory(command.category)) {
    throw new ProviderRegistryValidationError('PROVIDER_CATEGORY_INVALID', 'Unknown provider category');
  }
  if (command.entityType === 'PROVIDER_CAPABILITY') {
    if (!isProviderLegalRole(command.legalRole)) {
      throw new ProviderRegistryValidationError('PROVIDER_LEGAL_ROLE_INVALID', 'Unknown provider legal role');
    }
    return;
  }
  if (!SAFE_OFFERING_KEY.test(command.offeringKey)) {
    throw new ProviderRegistryValidationError('OFFERING_KEY_INVALID', 'Unsafe offering key');
  }
  if (command.action === 'WITHDRAW') return;
  if (
    !command.title
    || command.title.trim().length < 3
    || command.title.trim().length > 160
    || !command.description
    || command.description.trim().length < 10
    || command.description.trim().length > 2000
    || !validateBoundedStrings(command.regions, 50)
    || !validateBoundedStrings(command.cultures, 50)
    || command.stages.length === 0
    || command.stages.length > PROVIDER_STAGES.length
    || command.stages.some((stage) => !PROVIDER_STAGES.includes(stage))
  ) {
    throw new ProviderRegistryValidationError(
      'OFFERING_DETAILS_INVALID',
      'Offering title, description, coverage or stages are invalid',
    );
  }
}

export function stableProviderRegistryJson(value: unknown): unknown {
  if (value === undefined) return null;
  if (Array.isArray(value)) return value.map(stableProviderRegistryJson);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, stableProviderRegistryJson(item)]),
    );
  }
  return value;
}

export function providerRegistryDigest(value: unknown): string {
  return createHash('sha256')
    .update(JSON.stringify(stableProviderRegistryJson(value)))
    .digest('hex');
}

export function providerRegistryCommandFingerprint(command: ProviderRegistryCommand): string {
  validateProviderRegistryCommand(command);
  const offering = command.entityType === 'SERVICE_OFFERING'
    ? {
        offeringKey: command.offeringKey,
        title: command.title?.trim() ?? null,
        description: command.description?.trim() ?? null,
        regions: normalizedStrings(command.regions),
        cultures: normalizedStrings(command.cultures),
        stages: [...new Set(command.stages)].sort(),
      }
    : { legalRole: command.legalRole };
  return providerRegistryDigest({
    entityType: command.entityType,
    action: command.action,
    category: command.category,
    expectedVersion: command.expectedVersion,
    reason: command.reason.trim(),
    correlationId: command.correlationId,
    ...offering,
  });
}

export function assertProviderRegistryReplay(
  storedFingerprint: string,
  command: ProviderRegistryCommand,
): void {
  if (storedFingerprint !== providerRegistryCommandFingerprint(command)) {
    throw new ProviderRegistryValidationError(
      'IDEMPOTENCY_PAYLOAD_MISMATCH',
      'IDEMPOTENCY_PAYLOAD_MISMATCH',
    );
  }
}

export function normalizeProviderOffering(command: ServiceOfferingCommand) {
  return {
    title: command.title?.trim() ?? null,
    description: command.description?.trim() ?? null,
    regions: normalizedStrings(command.regions),
    cultures: normalizedStrings(command.cultures),
    stages: [...new Set(command.stages)].sort(),
  };
}
