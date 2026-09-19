import type { PlatformV7ActionFeedback } from './action-feedback';
import { appendActionLogEntry, createActionLogEntry, type PlatformActionLogEntry, type PlatformActionScope } from './action-log';

function mapFeedbackStatus(status: PlatformV7ActionFeedback['status']): PlatformActionLogEntry['status'] {
  if (status === 'success') return 'success';
  if (status === 'error') return 'error';
  return 'started';
}

export function createActionLogEntryFromFeedback(
  feedback: PlatformV7ActionFeedback,
  scope: PlatformActionScope,
  actor = 'system',
): PlatformActionLogEntry {
  return createActionLogEntry({
    scope,
    status: mapFeedbackStatus(feedback.status),
    objectId: feedback.entityId,
    action: feedback.actionId,
    message: feedback.message,
    actor,
    at: feedback.timestamp,
    error: feedback.status === 'error' ? feedback.message : undefined,
  });
}

export function appendFeedbackToActionLog(
  log: PlatformActionLogEntry[],
  feedback: PlatformV7ActionFeedback,
  scope: PlatformActionScope,
  actor = 'system',
): PlatformActionLogEntry[] {
  return appendActionLogEntry(log, createActionLogEntryFromFeedback(feedback, scope, actor));
}
