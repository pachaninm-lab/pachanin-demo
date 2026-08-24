import { IntegrationFailureClass } from './integration-command.policy';
import {
  OneCFailureEffectState,
  OneCJobRuntimeValidationError,
  OneCReconciliationAction,
  canonicalOneCJobPayload,
  validateOneCJobFailureReport,
  validateOneCJobReconciliationCommand,
  validateOneCJobResultReport,
} from './one-c-job-runtime.contract';
import { OneCCommand, OneCSyncState } from './one-c-connector.protocol';

describe('1C durable job runtime contract', () => {
  const envelope = {
    idempotencyKey: 'receipt-1', payloadHash: 'a'.repeat(64), revision: 1, attempt: 1,
  };

  it('canonicalizes only the exact command payload allow-list', () => {
    expect(canonicalOneCJobPayload(OneCCommand.GET_DOCUMENT_STATUS, {
      externalDocumentId: 'one-c-doc-1', documentId: 'doc-1',
    })).toBe('{"documentId":"doc-1","externalDocumentId":"one-c-doc-1"}');
    expect(() => canonicalOneCJobPayload(OneCCommand.GET_DOCUMENT_STATUS, {
      documentId: 'doc-1', sql: 'select * from users',
    })).toThrow('payload field is not allowed');
  });

  it('requires evidence for a bounded reported success', () => {
    expect(() => validateOneCJobResultReport({
      ...envelope, resultState: OneCSyncState.CREATED_IN_1C,
      resultCode: 'ONE_C_DRAFT_CREATED', externalEvidenceId: 'one-c-guid-1',
    })).not.toThrow();
    expect(() => validateOneCJobResultReport({
      ...envelope, resultState: OneCSyncState.CREATED_IN_1C,
      resultCode: 'ONE_C_DRAFT_CREATED', externalEvidenceId: '',
    })).toThrow(OneCJobRuntimeValidationError);
  });

  it('permits transient retry only with explicit confirmed-no-effect evidence', () => {
    expect(() => validateOneCJobFailureReport({
      ...envelope, failureClass: IntegrationFailureClass.TRANSIENT_NETWORK,
      effectState: OneCFailureEffectState.CONFIRMED_NO_EFFECT,
      resultCode: 'ONE_C_NETWORK_UNAVAILABLE',
    })).not.toThrow();
    expect(() => validateOneCJobFailureReport({
      ...envelope, failureClass: IntegrationFailureClass.BUSINESS_REJECTION,
      effectState: OneCFailureEffectState.UNKNOWN, resultCode: 'ONE_C_PERIOD_CLOSED',
    })).toThrow('ONE_C_JOB_EFFECT_STATE_INVALID');
  });

  it('requires bounded explicit human reconciliation actions', () => {
    expect(() => validateOneCJobReconciliationCommand({
      idempotencyKey: 'reconcile-1', action: OneCReconciliationAction.CONFIRM_POSTED,
      reasonCode: 'ONE_C_POSTING_CONFIRMED', externalEvidenceId: 'one-c-doc-1',
    })).not.toThrow();
    expect(() => validateOneCJobReconciliationCommand({
      idempotencyKey: 'reconcile-2', action: OneCReconciliationAction.DEAD_LETTER,
      reasonCode: 'password=secret', externalEvidenceId: null,
    })).toThrow('ONE_C_JOB_REASON_CODE_INVALID');
  });
});
