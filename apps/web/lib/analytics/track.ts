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

export function trackReleaseConfirmed(dealId: string): void {
  trackEvent('release_confirmed', { dealId });
}

export function trackDriverArrived(routeId: string): void {
  trackEvent('driver_arrived', { routeId });
}

export function trackBlockerRemoved(blockerId: string, dealId?: string): void {
  trackEvent('blocker_removed', { blockerId, dealId });
}

export function trackGigaChatAsked(context?: string): void {
  trackEvent('giga_chat_asked', { context });
}
