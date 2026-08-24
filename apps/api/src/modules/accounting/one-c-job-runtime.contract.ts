import {
  IntegrationFailureClass,
  validateIntegrationCommandEnvelope,
  type IntegrationCommandEnvelope,
} from './integration-command.policy';
import {
  OneCSyncState,
  type OneCCommand,
  validateOneCCommandPayload,
} from './one-c-connector.protocol';

export const OneCJobStatus = {
  QUEUED: 'QUEUED',
  LEASED: 'LEASED',
  ACKNOWLEDGED: 'ACKNOWLEDGED',
  SUCCEEDED: 'SUCCEEDED',
  REJECTED: 'REJECTED',
  RECONCILIATION_REQUIRED: 'RECONCILIATION_REQUIRED',
  DEAD_LETTER: 'DEAD_LETTER',
} as const;
export type OneCJobStatus = (typeof OneCJobStatus)[keyof typeof OneCJobStatus];

export const OneCFailureEffectState = {
  CONFIRMED_NO_EFFECT: 'CONFIRMED_NO_EFFECT',
  UNKNOWN: 'UNKNOWN',
} as const;
export type OneCFailureEffectState =
  (typeof OneCFailureEffectState)[keyof typeof OneCFailureEffectState];

export const OneCReconciliationAction = {
  REQUEUE_CONFIRMED_NO_EFFECT: 'REQUEUE_CONFIRMED_NO_EFFECT',
  CONFIRM_CREATED_IN_1C: 'CONFIRM_CREATED_IN_1C',
  CONFIRM_POSTED: 'CONFIRM_POSTED',
  CONFIRM_REJECTED: 'CONFIRM_REJECTED',
  DEAD_LETTER: 'DEAD_LETTER',
} as const;
export type OneCReconciliationAction =
  (typeof OneCReconciliationAction)[keyof typeof OneCReconciliationAction];

export interface OneCJobReceiptEnvelope {
  readonly idempotencyKey: string;
  readonly payloadHash: string;
  readonly revision: number;
  readonly attempt: number;
}

export interface OneCJobResultReport extends OneCJobReceiptEnvelope {
  readonly resultState: typeof OneCSyncState.CREATED_IN_1C | typeof OneCSyncState.POSTED;
  readonly resultCode: string;
  readonly externalEvidenceId: string;
}

export interface OneCJobFailureReport extends OneCJobReceiptEnvelope {
  readonly failureClass: IntegrationFailureClass;
  readonly effectState: OneCFailureEffectState;
  readonly resultCode: string;
}

export interface OneCJobReconciliationCommand {
  readonly idempotencyKey: string;
  readonly action: OneCReconciliationAction;
  readonly reasonCode: string;
  readonly externalEvidenceId: string | null;
}

export class OneCJobRuntimeValidationError extends Error {
  constructor(readonly code: string) {
    super(code);
    this.name = 'OneCJobRuntimeValidationError';
  }
}

export function canonicalOneCJobPayload(
  command: OneCCommand,
  payload: Readonly<Record<string, unknown>>,
): string {
  validateOneCCommandPayload(command, payload);
  const canonical = stableJson(payload);
  if (Buffer.byteLength(canonical, 'utf8') > 65_536) {
    throw new OneCJobRuntimeValidationError('ONE_C_JOB_PAYLOAD_TOO_LARGE');
  }
  return canonical;
}

export function validateOneCJobReceiptEnvelope(
  envelope: OneCJobReceiptEnvelope,
  correlationId = 'server-derived',
): OneCJobReceiptEnvelope {
  try {
    validateIntegrationCommandEnvelope({
      ...envelope,
      correlationId,
      organizationId: 'server-derived',
      connectionId: 'server-derived',
      externalId: null,
    });
  } catch {
    throw new OneCJobRuntimeValidationError('ONE_C_JOB_RECEIPT_ENVELOPE_INVALID');
  }
  return envelope;
}

export function validateOneCJobResultReport(report: OneCJobResultReport): void {
  validateOneCJobReceiptEnvelope(report);
  if (![OneCSyncState.CREATED_IN_1C, OneCSyncState.POSTED].includes(report.resultState)) {
    throw new OneCJobRuntimeValidationError('ONE_C_JOB_RESULT_STATE_INVALID');
  }
  machineCode(report.resultCode, 'ONE_C_JOB_RESULT_CODE_INVALID');
  evidenceId(report.externalEvidenceId, 'ONE_C_JOB_EXTERNAL_EVIDENCE_INVALID');
}

export function validateOneCJobFailureReport(report: OneCJobFailureReport): void {
  validateOneCJobReceiptEnvelope(report);
  if (!(Object.values(IntegrationFailureClass) as readonly string[]).includes(report.failureClass)) {
    throw new OneCJobRuntimeValidationError('ONE_C_JOB_FAILURE_CLASS_INVALID');
  }
  if (!(Object.values(OneCFailureEffectState) as readonly string[]).includes(report.effectState)) {
    throw new OneCJobRuntimeValidationError('ONE_C_JOB_EFFECT_STATE_INVALID');
  }
  machineCode(report.resultCode, 'ONE_C_JOB_RESULT_CODE_INVALID');

  const ambiguous = report.failureClass === IntegrationFailureClass.UNKNOWN_RESULT;
  if (ambiguous && report.effectState !== OneCFailureEffectState.UNKNOWN) {
    throw new OneCJobRuntimeValidationError('ONE_C_JOB_EFFECT_STATE_INVALID');
  }
  const transient = ([
    IntegrationFailureClass.TRANSIENT_NETWORK,
    IntegrationFailureClass.TRANSIENT_TIMEOUT,
    IntegrationFailureClass.TRANSIENT_RATE_LIMIT,
    IntegrationFailureClass.TRANSIENT_PROVIDER_5XX,
  ] as readonly IntegrationFailureClass[]).includes(report.failureClass);
  if (!transient && !ambiguous && report.effectState !== OneCFailureEffectState.CONFIRMED_NO_EFFECT) {
    throw new OneCJobRuntimeValidationError('ONE_C_JOB_EFFECT_STATE_INVALID');
  }
}

export function validateOneCJobReconciliationCommand(
  command: OneCJobReconciliationCommand,
): void {
  machineIdentifier(command.idempotencyKey, 'ONE_C_JOB_IDEMPOTENCY_KEY_INVALID');
  if (!(Object.values(OneCReconciliationAction) as readonly string[]).includes(command.action)) {
    throw new OneCJobRuntimeValidationError('ONE_C_JOB_RECONCILIATION_ACTION_INVALID');
  }
  machineCode(command.reasonCode, 'ONE_C_JOB_REASON_CODE_INVALID');
  const needsEvidence = ([
    OneCReconciliationAction.CONFIRM_CREATED_IN_1C,
    OneCReconciliationAction.CONFIRM_POSTED,
  ] as readonly OneCReconciliationAction[]).includes(command.action);
  if (needsEvidence) {
    evidenceId(command.externalEvidenceId, 'ONE_C_JOB_EXTERNAL_EVIDENCE_INVALID');
  } else if (command.externalEvidenceId !== null) {
    throw new OneCJobRuntimeValidationError('ONE_C_JOB_EXTERNAL_EVIDENCE_INVALID');
  }
}

function stableJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  const object = value as Record<string, unknown>;
  return `{${Object.keys(object)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableJson(object[key])}`)
    .join(',')}}`;
}

function machineIdentifier(value: unknown, code: string): asserts value is string {
  if (
    typeof value !== 'string'
    || !/^[A-Za-z0-9:_.@-]{1,240}$/.test(value)
  ) throw new OneCJobRuntimeValidationError(code);
}

function machineCode(value: unknown, code: string): asserts value is string {
  if (typeof value !== 'string' || !/^[A-Z0-9][A-Z0-9_.:-]{0,95}$/.test(value)) {
    throw new OneCJobRuntimeValidationError(code);
  }
}

function evidenceId(value: unknown, code: string): asserts value is string {
  if (typeof value !== 'string' || !/^[A-Za-z0-9:_.@/-]{1,240}$/.test(value)) {
    throw new OneCJobRuntimeValidationError(code);
  }
}
