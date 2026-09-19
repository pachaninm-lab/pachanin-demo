import { createActionLogEntry, type PlatformActionLogEntry, type PlatformActionScope } from './action-log';

export type PlatformActionPhase = 'idle' | 'loading' | 'success' | 'error';

export interface PlatformActionRunnerInput<T> {
  readonly scope: PlatformActionScope;
  readonly objectId: string;
  readonly action: string;
  readonly actor?: string;
  readonly loadingMessage: string;
  readonly successMessage: (result: T) => string;
  readonly errorMessage: (error: unknown) => string;
  readonly run: () => Promise<T>;
  readonly at?: () => string;
}

export interface PlatformActionRunnerResult<T> {
  readonly phase: PlatformActionPhase;
  readonly result?: T;
  readonly log: PlatformActionLogEntry[];
}

function toErrorText(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return 'Unknown action error';
}

export async function runPlatformAction<T>(input: PlatformActionRunnerInput<T>): Promise<PlatformActionRunnerResult<T>> {
  const startedAt = input.at?.() ?? new Date().toISOString();
  const started = createActionLogEntry({
    scope: input.scope,
    status: 'started',
    objectId: input.objectId,
    action: input.action,
    actor: input.actor,
    at: startedAt,
    message: input.loadingMessage,
  });

  try {
    const result = await input.run();
    const completedAt = input.at?.() ?? new Date().toISOString();
    const success = createActionLogEntry({
      scope: input.scope,
      status: 'success',
      objectId: input.objectId,
      action: input.action,
      actor: input.actor,
      at: completedAt,
      message: input.successMessage(result),
    });

    return { phase: 'success', result, log: [started, success] };
  } catch (error) {
    const failedAt = input.at?.() ?? new Date().toISOString();
    const failed = createActionLogEntry({
      scope: input.scope,
      status: 'error',
      objectId: input.objectId,
      action: input.action,
      actor: input.actor,
      at: failedAt,
      message: input.errorMessage(error),
      error: toErrorText(error),
    });

    return { phase: 'error', log: [started, failed] };
  }
}
