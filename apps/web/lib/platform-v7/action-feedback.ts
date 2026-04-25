export type PlatformV7ActionStatus = 'idle' | 'loading' | 'success' | 'error';
export type PlatformV7ActionSeverity = 'success' | 'warning' | 'error' | 'info';

export interface PlatformV7ActionFeedback {
  actionId: string;
  entityId: string;
  status: PlatformV7ActionStatus;
  message: string;
  severity: PlatformV7ActionSeverity;
  retryable: boolean;
  timestamp: string;
}

export interface PlatformV7ActionLogEvent {
  id: string;
  actionId: string;
  entityId: string;
  actor: string;
  message: string;
  severity: PlatformV7ActionSeverity;
  timestamp: string;
}

export function createPlatformV7ActionFeedback(args: {
  actionId: string;
  entityId: string;
  status: PlatformV7ActionStatus;
  message: string;
  severity?: PlatformV7ActionSeverity;
  retryable?: boolean;
  timestamp?: string;
}): PlatformV7ActionFeedback {
  return {
    actionId: args.actionId,
    entityId: args.entityId,
    status: args.status,
    message: args.message,
    severity: args.severity ?? (args.status === 'error' ? 'error' : args.status === 'success' ? 'success' : 'info'),
    retryable: args.retryable ?? args.status === 'error',
    timestamp: args.timestamp ?? new Date().toISOString(),
  };
}

export function actionFeedbackToLogEvent(feedback: PlatformV7ActionFeedback, actor: string): PlatformV7ActionLogEvent {
  return {
    id: `${feedback.actionId}:${feedback.entityId}:${feedback.timestamp}`,
    actionId: feedback.actionId,
    entityId: feedback.entityId,
    actor,
    message: feedback.message,
    severity: feedback.severity,
    timestamp: feedback.timestamp,
  };
}

export function platformV7ActionToastMessage(feedback: Pick<PlatformV7ActionFeedback, 'entityId' | 'message'>): string {
  return `${feedback.entityId}: ${feedback.message}`;
}

export function isPlatformV7ActionTerminal(status: PlatformV7ActionStatus): boolean {
  return status === 'success' || status === 'error';
}
