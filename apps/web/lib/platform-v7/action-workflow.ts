import { platformV7ActionMessages, type PlatformV7ActionMessageId } from './action-messages';
import { runWithPlatformV7Feedback, type PlatformV7FeedbackRunnerResult } from './feedback-runner';
import { appendFeedbackToActionLog } from './action-log-feedback';
import { platformV7ShouldToast, platformV7ToastFromFeedback, type PlatformV7ToastPayload } from './feedback-toast';
import type { PlatformActionLogEntry, PlatformActionScope } from './action-log';

export interface PlatformV7ActionWorkflowInput<T> {
  actionId: PlatformV7ActionMessageId;
  entityId: string;
  scope: PlatformActionScope;
  actor: string;
  log: PlatformActionLogEntry[];
  run: () => Promise<T> | T;
  retry?: () => void;
  now?: () => string;
}

export interface PlatformV7ActionWorkflowResult<T> extends PlatformV7FeedbackRunnerResult<T> {
  log: PlatformActionLogEntry[];
  toasts: PlatformV7ToastPayload[];
}

export async function runPlatformV7ActionWorkflow<T>(
  input: PlatformV7ActionWorkflowInput<T>,
): Promise<PlatformV7ActionWorkflowResult<T>> {
  const outcome = await runWithPlatformV7Feedback({
    actionId: input.actionId,
    entityId: input.entityId,
    messages: platformV7ActionMessages(input.actionId),
    run: input.run,
    now: input.now,
  });

  const log = outcome.feedback.reduce(
    (current, feedback) => appendFeedbackToActionLog(current, feedback, input.scope, input.actor),
    input.log,
  );

  const toasts = outcome.feedback
    .filter(platformV7ShouldToast)
    .map((feedback) => platformV7ToastFromFeedback(feedback, input.retry));

  return {
    ...outcome,
    log,
    toasts,
  };
}
