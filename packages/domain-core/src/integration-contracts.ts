export type IntegrationOperationContract = {
  system: string;
  operation: string;
  method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'CALLBACK';
  timeoutMs: number;
  retryPolicy: 'none' | 'safe_retry' | 'idempotent_retry';
  idempotent: boolean;
  callbackRequired: boolean;
  degradedMode: 'fail_closed' | 'queue_and_retry' | 'manual_review';
};

export const INTEGRATION_OPERATION_CONTRACTS: IntegrationOperationContract[] = [
  { system: 'bank', operation: 'reserve_hold', method: 'POST', timeoutMs: 15000, retryPolicy: 'idempotent_retry', idempotent: true, callbackRequired: true, degradedMode: 'fail_closed' },
  { system: 'bank', operation: 'final_release', method: 'POST', timeoutMs: 15000, retryPolicy: 'idempotent_retry', idempotent: true, callbackRequired: true, degradedMode: 'fail_closed' },
  { system: 'edo', operation: 'send_document', method: 'POST', timeoutMs: 20000, retryPolicy: 'idempotent_retry', idempotent: true, callbackRequired: true, degradedMode: 'queue_and_retry' },
  { system: 'fgis_zerno', operation: 'submit_sdiz', method: 'POST', timeoutMs: 20000, retryPolicy: 'idempotent_retry', idempotent: true, callbackRequired: false, degradedMode: 'queue_and_retry' },
  { system: 'gps', operation: 'push_checkpoint', method: 'POST', timeoutMs: 5000, retryPolicy: 'safe_retry', idempotent: true, callbackRequired: false, degradedMode: 'queue_and_retry' },
  { system: 'lab', operation: 'publish_protocol', method: 'POST', timeoutMs: 10000, retryPolicy: 'idempotent_retry', idempotent: true, callbackRequired: false, degradedMode: 'manual_review' },
  { system: 'smartagro', operation: 'sync_forecast', method: 'GET', timeoutMs: 12000, retryPolicy: 'safe_retry', idempotent: true, callbackRequired: false, degradedMode: 'manual_review' },
  { system: 'esia', operation: 'profile_lookup', method: 'GET', timeoutMs: 10000, retryPolicy: 'safe_retry', idempotent: true, callbackRequired: false, degradedMode: 'manual_review' },
  { system: 'kep', operation: 'verify_signature', method: 'CALLBACK', timeoutMs: 15000, retryPolicy: 'idempotent_retry', idempotent: true, callbackRequired: true, degradedMode: 'manual_review' }
];

export function resolveIntegrationContract(system?: string | null, operation?: string | null) {
  const normalizedSystem = String(system || '').trim().toLowerCase();
  const normalizedOperation = String(operation || '').trim().toLowerCase();
  return INTEGRATION_OPERATION_CONTRACTS.find((item) => item.system === normalizedSystem && item.operation === normalizedOperation) || null;
}
