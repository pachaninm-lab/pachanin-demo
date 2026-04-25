import { runPlatformV7ActionWorkflow, type PlatformV7ActionWorkflowInput, type PlatformV7ActionWorkflowResult } from './action-workflow';
import type { PlatformActionLogEntry } from './action-log';
import type { PlatformV7ToastPayload } from './feedback-toast';

export type PlatformV7ToastSink = (toast: PlatformV7ToastPayload) => void;
export type PlatformV7ActionLogSink = (log: PlatformActionLogEntry[]) => void;

export interface PlatformV7ActionControlInput<T> extends PlatformV7ActionWorkflowInput<T> {
  onToast?: PlatformV7ToastSink;
  onLog?: PlatformV7ActionLogSink;
}

export async function executePlatformV7Action<T>(
  input: PlatformV7ActionControlInput<T>,
): Promise<PlatformV7ActionWorkflowResult<T>> {
  const outcome = await runPlatformV7ActionWorkflow(input);

  input.onLog?.(outcome.log);
  outcome.toasts.forEach((toast) => input.onToast?.(toast));

  return outcome;
}

export function platformV7ActionIsBusy(activeActionId: string | null, targetActionId: string): boolean {
  return activeActionId === targetActionId;
}
