import { describe, expect, it, vi } from 'vitest';
import { createPlatformV7ActionFeedback } from '@/lib/platform-v7/action-feedback';
import { platformV7ShouldToast, platformV7ToastFromFeedback, platformV7ToastTypeFromSeverity } from '@/lib/platform-v7/feedback-toast';

describe('platform-v7 feedback toast adapter', () => {
  it('maps severity to toast type', () => {
    expect(platformV7ToastTypeFromSeverity('success')).toBe('success');
    expect(platformV7ToastTypeFromSeverity('warning')).toBe('warning');
    expect(platformV7ToastTypeFromSeverity('error')).toBe('error');
    expect(platformV7ToastTypeFromSeverity('info')).toBe('info');
  });

  it('creates success toast payload from feedback', () => {
    const feedback = createPlatformV7ActionFeedback({
      actionId: 'releaseFunds',
      entityId: 'DL-9102',
      status: 'success',
      message: 'Деньги выпущены.',
    });

    expect(platformV7ToastFromFeedback(feedback)).toMatchObject({
      message: 'DL-9102: Деньги выпущены.',
      type: 'success',
      duration: 6000,
    });
  });

  it('adds retry action for retryable errors', () => {
    const retry = vi.fn();
    const feedback = createPlatformV7ActionFeedback({
      actionId: 'manualReview',
      entityId: 'DL-9118',
      status: 'error',
      message: 'Действие не выполнено.',
    });
    const toast = platformV7ToastFromFeedback(feedback, retry);

    expect(toast.type).toBe('error');
    expect(toast.duration).toBe(8000);
    expect(toast.actions?.[0]?.label).toBe('Повторить');
    toast.actions?.[0]?.onClick();
    expect(retry).toHaveBeenCalledOnce();
  });

  it('toasts only terminal feedback', () => {
    expect(platformV7ShouldToast(createPlatformV7ActionFeedback({ actionId: 'a', entityId: 'DL-1', status: 'loading', message: 'loading' }))).toBe(false);
    expect(platformV7ShouldToast(createPlatformV7ActionFeedback({ actionId: 'a', entityId: 'DL-1', status: 'success', message: 'done' }))).toBe(true);
    expect(platformV7ShouldToast(createPlatformV7ActionFeedback({ actionId: 'a', entityId: 'DL-1', status: 'error', message: 'failed' }))).toBe(true);
  });
});
