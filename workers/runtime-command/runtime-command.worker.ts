import { runtimeStore } from '../../apps/api/src/shared/runtime-store';

export async function executeRuntimeCommand(action: string, payload?: Record<string, any>, idempotencyKey?: string) {
  return runtimeStore.queueCommand(action, payload || {}, idempotencyKey);
}
