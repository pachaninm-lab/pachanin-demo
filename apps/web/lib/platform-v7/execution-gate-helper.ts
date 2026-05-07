import type { PlatformV7ApiBoundaryId } from './api-boundary-contracts';
import { canPlatformV7RoleCallApiBoundary, getPlatformV7ApiBoundary } from './api-boundary-contracts';
import {
  buildPlatformV7ExecutionEnvelope,
  validatePlatformV7ExecutionEnvelope,
  type PlatformV7ExecutionEnvelope,
  type PlatformV7ExecutionEnvelopeInput,
} from './execution-envelope-helper';

export type PlatformV7ExecutionGateIssueCode =
  | 'boundary_not_found'
  | 'role_not_allowed'
  | 'envelope_invalid'
  | 'money_boundary_incomplete'
  | 'contract_only_boundary';

export type PlatformV7ExecutionGateIssue = {
  readonly code: PlatformV7ExecutionGateIssueCode;
  readonly message: string;
};

export type PlatformV7ExecutionGateResult = {
  readonly ok: boolean;
  readonly boundaryId: PlatformV7ApiBoundaryId;
  readonly actorRole: string;
  readonly envelope?: PlatformV7ExecutionEnvelope;
  readonly issues: readonly PlatformV7ExecutionGateIssue[];
  readonly payloadIssues: readonly string[];
  readonly contractOnly: true;
};

export function checkPlatformV7ExecutionGate(input: PlatformV7ExecutionEnvelopeInput): PlatformV7ExecutionGateResult {
  const boundary = getPlatformV7ApiBoundary(input.boundaryId);
  const issues: PlatformV7ExecutionGateIssue[] = [];

  if (!boundary) {
    return {
      ok: false,
      boundaryId: input.boundaryId,
      actorRole: input.actorRole,
      issues: [
        {
          code: 'boundary_not_found',
          message: `API boundary ${input.boundaryId} is not registered.`,
        },
      ],
      payloadIssues: [],
      contractOnly: true,
    };
  }

  if (!canPlatformV7RoleCallApiBoundary(input.actorRole, input.boundaryId)) {
    issues.push({
      code: 'role_not_allowed',
      message: `Role ${input.actorRole} cannot call boundary ${input.boundaryId}.`,
    });
  }

  const envelope = buildPlatformV7ExecutionEnvelope(input);
  const envelopeResult = validatePlatformV7ExecutionEnvelope(envelope);

  if (!envelopeResult.ok) {
    issues.push({
      code: 'envelope_invalid',
      message: `Execution envelope for ${input.boundaryId} is invalid.`,
    });
  }

  if (boundary.affectsMoney && (!envelope.auditEvent.moneyAmountMinor || !envelope.auditEvent.currency)) {
    issues.push({
      code: 'money_boundary_incomplete',
      message: `Money boundary ${input.boundaryId} requires amount and currency before execution.`,
    });
  }

  if (boundary.runtimeStatus === 'contract_only') {
    issues.push({
      code: 'contract_only_boundary',
      message: `Boundary ${input.boundaryId} is contract-only and requires server runtime before real execution.`,
    });
  }

  return {
    ok: issues.length === 1 && issues[0]?.code === 'contract_only_boundary' && envelopeResult.ok,
    boundaryId: input.boundaryId,
    actorRole: input.actorRole,
    envelope,
    issues,
    payloadIssues: envelopeResult.payloadIssues.map((issue) => issue.message),
    contractOnly: true,
  };
}

export function assertPlatformV7ExecutionGate(input: PlatformV7ExecutionEnvelopeInput) {
  const result = checkPlatformV7ExecutionGate(input);
  const blockingIssues = result.issues.filter((issue) => issue.code !== 'contract_only_boundary');

  if (blockingIssues.length > 0 || result.payloadIssues.length > 0) {
    throw new Error([...blockingIssues.map((issue) => issue.message), ...result.payloadIssues].join(' '));
  }

  return result;
}

export function canPlatformV7ExecutionGateProceedToRuntime(result: PlatformV7ExecutionGateResult): boolean {
  return result.ok === true && result.issues.every((issue) => issue.code === 'contract_only_boundary');
}
