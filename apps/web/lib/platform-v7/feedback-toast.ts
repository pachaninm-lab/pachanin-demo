import { platformV7ActionToastMessage, type PlatformV7ActionFeedback, type PlatformV7ActionSeverity } from './action-feedback';

export type PlatformV7ToastType = 'success' | 'warning' | 'error' | 'info';

export interface PlatformV7ToastAction {
  label: string;
  onClick: () => void;
}

export interface PlatformV7ToastPayload {
  message: string;
  type: PlatformV7ToastType;
  actions?: PlatformV7ToastAction[];
  duration?: number;
}

const TOAST_TYPE_BY_SEVERITY: Record<PlatformV7ActionSeverity, PlatformV7ToastType> = {
  success: 'success',
  warning: 'warning',
  error: 'error',
  info: 'info',
};

export function platformV7ToastTypeFromSeverity(severity: PlatformV7ActionSeverity): PlatformV7ToastType {
  return TOAST_TYPE_BY_SEVERITY[severity];
}

export function platformV7ToastFromFeedback(
  feedback: PlatformV7ActionFeedback,
  retry?: () => void,
): PlatformV7ToastPayload {
  const actions = feedback.retryable && retry ? [{ label: 'Повторить', onClick: retry }] : undefined;

  return {
    message: platformV7ActionToastMessage(feedback),
    type: platformV7ToastTypeFromSeverity(feedback.severity),
    actions,
    duration: feedback.status === 'error' ? 8000 : 6000,
  };
}

export function platformV7ShouldToast(feedback: PlatformV7ActionFeedback): boolean {
  return feedback.status === 'success' || feedback.status === 'error';
}
