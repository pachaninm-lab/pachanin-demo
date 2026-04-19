declare global {
  interface Window {
    ym?: (id: number, method: string, goal?: string, params?: Record<string, unknown>) => void;
  }
}

const YM_ID = Number(process.env.NEXT_PUBLIC_YM_ID ?? '0');

export function trackEvent(name: string, params?: Record<string, unknown>): void {
  if (typeof window === 'undefined') return;
  try {
    if (typeof window.ym === 'function' && YM_ID) {
      window.ym(YM_ID, 'reachGoal', name, params);
    }
  } catch {
    // analytics must never break the app
  }
}

export function trackRoleSwitch(to: string): void {
  trackEvent('role_switched', { to });
}

export function trackLotCreated(lotId: string): void {
  trackEvent('lot_created', { lotId });
}

export function trackDisputeResolveClicked(dealId: string): void {
  trackEvent('dispute_resolve_clicked', { dealId });
}

export function trackGigaChatAsked(context?: string): void {
  trackEvent('gigachat_asked', { context });
}
