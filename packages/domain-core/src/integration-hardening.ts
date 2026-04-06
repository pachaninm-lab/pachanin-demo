import { resolveIntegrationContract } from './integration-contracts';

export type ConnectorRuntimeHealth = 'GREEN' | 'AMBER' | 'RED';
export type CallbackVerificationStatus = 'VERIFIED' | 'MISSING_SECRET' | 'MISSING_SIGNATURE' | 'SKIPPED_NON_CALLBACK';

export type RetryPolicyProfile = {
  provider: string;
  operation: string;
  maxAttempts: number;
  baseDelayMs: number;
  exponential: boolean;
  idempotent: boolean;
  escalateAfterMs: number;
};

export type DeadLetterDisposition = {
  action: 'requeue' | 'manual_review' | 'dead_letter';
  reasonCode: string;
  owner: string;
};

function normalizeProvider(value?: string | null) {
  return String(value || '').trim().toLowerCase();
}

export function resolveRetryPolicyProfile(provider?: string | null, operation?: string | null): RetryPolicyProfile {
  const contract = resolveIntegrationContract(provider, operation);
  const normalizedProvider = normalizeProvider(provider);
  const normalizedOperation = String(operation || '').trim().toLowerCase() || 'generic';
  if (contract) {
    const queueAndRetry = contract.degradedMode === 'queue_and_retry';
    return {
      provider: normalizedProvider,
      operation: normalizedOperation,
      maxAttempts: contract.retryPolicy === 'idempotent_retry' ? 5 : contract.retryPolicy === 'safe_retry' ? 4 : 1,
      baseDelayMs: contract.timeoutMs,
      exponential: contract.retryPolicy !== 'none',
      idempotent: contract.idempotent,
      escalateAfterMs: queueAndRetry ? contract.timeoutMs * 6 : contract.timeoutMs * 2
    };
  }
  return {
    provider: normalizedProvider,
    operation: normalizedOperation,
    maxAttempts: 3,
    baseDelayMs: 4000,
    exponential: true,
    idempotent: true,
    escalateAfterMs: 24000
  };
}

export function normalizeConnectorHealth(input: {
  provider?: string | null;
  mode?: string | null;
  configured?: boolean;
  status?: string | null;
  lastError?: string | null;
  backlog?: number | null;
  lateCallbacks?: number | null;
}) {
  const mode = String(input.mode || '').trim().toLowerCase();
  const status = String(input.status || '').trim().toUpperCase();
  const backlog = Number(input.backlog || 0);
  const lateCallbacks = Number(input.lateCallbacks || 0);
  const configured = input.configured !== false;
  const hasError = Boolean(String(input.lastError || '').trim());

  let health: ConnectorRuntimeHealth = 'GREEN';
  if (!configured || status === 'UNAVAILABLE' || status === 'FAILED') health = 'RED';
  else if (mode === 'sandbox' || mode === 'stub' || status === 'DEGRADED' || backlog > 0 || lateCallbacks > 0 || hasError) health = 'AMBER';
  if (status === 'RETRYING' && (backlog > 10 || lateCallbacks > 2)) health = 'RED';

  return {
    provider: normalizeProvider(input.provider),
    mode: mode || 'disabled',
    health,
    requiresOperatorAttention: health !== 'GREEN',
    queueBlocked: health === 'RED',
    queueBacklog: backlog,
    lateCallbacks,
    summary: health === 'GREEN'
      ? 'Коннектор в рабочем состоянии.'
      : health === 'AMBER'
        ? 'Коннектор требует operator review или controlled fallback.'
        : 'Коннектор блокирует безопасный шаг сделки.'
  };
}

export function evaluateCallbackVerification(input: {
  provider?: string | null;
  operation?: string | null;
  secretConfigured?: boolean;
  signaturePresent?: boolean;
}) {
  const contract = resolveIntegrationContract(input.provider, input.operation);
  if (!contract?.callbackRequired) {
    return { status: 'SKIPPED_NON_CALLBACK' as CallbackVerificationStatus, required: false };
  }
  if (!input.secretConfigured) {
    return { status: 'MISSING_SECRET' as CallbackVerificationStatus, required: true };
  }
  if (!input.signaturePresent) {
    return { status: 'MISSING_SIGNATURE' as CallbackVerificationStatus, required: true };
  }
  return { status: 'VERIFIED' as CallbackVerificationStatus, required: true };
}

export function resolveDeadLetterDisposition(input: {
  provider?: string | null;
  operation?: string | null;
  attempts?: number | null;
  validationFailed?: boolean;
  callbackVerificationFailed?: boolean;
  providerRejected?: boolean;
}) : DeadLetterDisposition {
  const retry = resolveRetryPolicyProfile(input.provider, input.operation);
  if (input.validationFailed) {
    return { action: 'manual_review', reasonCode: 'integration_payload_invalid', owner: 'operator' };
  }
  if (input.callbackVerificationFailed) {
    return { action: 'dead_letter', reasonCode: 'callback_signature_invalid', owner: 'security' };
  }
  if (input.providerRejected) {
    return { action: 'manual_review', reasonCode: 'provider_rejected_request', owner: 'integration_owner' };
  }
  if (Number(input.attempts || 0) >= retry.maxAttempts) {
    return { action: 'dead_letter', reasonCode: 'retry_budget_exhausted', owner: 'integration_owner' };
  }
  return { action: 'requeue', reasonCode: 'retry_window_active', owner: 'system' };
}
