import { createPlatformV7ActionFeedback, type PlatformV7ActionFeedback } from './action-feedback';

export interface PlatformV7FeedbackRunnerMessages {
  loading: string;
  success: string;
  error: string;
}

export interface PlatformV7FeedbackRunnerInput<T> {
  actionId: string;
  entityId: string;
  messages: PlatformV7FeedbackRunnerMessages;
  run: () => Promise<T> | T;
  now?: () => string;
}

export interface PlatformV7FeedbackRunnerResult<T> {
  result?: T;
  feedback: PlatformV7ActionFeedback[];
}

export async function runWithPlatformV7Feedback<T>(
  input: PlatformV7FeedbackRunnerInput<T>,
): Promise<PlatformV7FeedbackRunnerResult<T>> {
  const now = input.now ?? (() => new Date().toISOString());
  const feedback: PlatformV7ActionFeedback[] = [
    createPlatformV7ActionFeedback({
      actionId: input.actionId,
      entityId: input.entityId,
      status: 'loading',
      message: input.messages.loading,
      severity: 'info',
      retryable: false,
      timestamp: now(),
    }),
  ];

  try {
    const result = await input.run();
    feedback.push(
      createPlatformV7ActionFeedback({
        actionId: input.actionId,
        entityId: input.entityId,
        status: 'success',
        message: input.messages.success,
        severity: 'success',
        retryable: false,
        timestamp: now(),
      }),
    );
    return { result, feedback };
  } catch (error) {
    const reason = error instanceof Error && error.message ? error.message : input.messages.error;
    feedback.push(
      createPlatformV7ActionFeedback({
        actionId: input.actionId,
        entityId: input.entityId,
        status: 'error',
        message: `${input.messages.error}${reason === input.messages.error ? '' : ` ${reason}`}`,
        severity: 'error',
        retryable: true,
        timestamp: now(),
      }),
    );
    return { feedback };
  }
}

export function latestPlatformV7Feedback(feedback: PlatformV7ActionFeedback[]): PlatformV7ActionFeedback | null {
  return feedback.at(-1) ?? null;
}
