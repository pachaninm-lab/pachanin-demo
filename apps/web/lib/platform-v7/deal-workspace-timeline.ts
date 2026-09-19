export type PlatformV7DealTimelineEventType =
  | 'status'
  | 'document'
  | 'logistics'
  | 'money'
  | 'quality'
  | 'dispute'
  | 'system';

export interface PlatformV7DealTimelineEvent {
  id: string;
  type: PlatformV7DealTimelineEventType;
  actor: string;
  action: string;
  at: string;
  severity: 'info' | 'success' | 'warning' | 'danger';
}

export interface PlatformV7DealTimelineFilter {
  type?: PlatformV7DealTimelineEventType;
  actor?: string;
  severity?: PlatformV7DealTimelineEvent['severity'];
}

export function sortPlatformV7DealTimeline(events: PlatformV7DealTimelineEvent[]): PlatformV7DealTimelineEvent[] {
  return [...events].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
}

export function filterPlatformV7DealTimeline(
  events: PlatformV7DealTimelineEvent[],
  filter: PlatformV7DealTimelineFilter,
): PlatformV7DealTimelineEvent[] {
  return sortPlatformV7DealTimeline(events).filter((event) => {
    if (filter.type && event.type !== filter.type) return false;
    if (filter.actor && event.actor !== filter.actor) return false;
    if (filter.severity && event.severity !== filter.severity) return false;
    return true;
  });
}

export function platformV7DealTimelineEventKey(event: PlatformV7DealTimelineEvent): string {
  return `${event.id}:${event.at}`;
}

export function platformV7DealTimelineSummary(events: PlatformV7DealTimelineEvent[]) {
  return events.reduce(
    (acc, event) => ({
      ...acc,
      [event.type]: acc[event.type] + 1,
    }),
    { status: 0, document: 0, logistics: 0, money: 0, quality: 0, dispute: 0, system: 0 } satisfies Record<PlatformV7DealTimelineEventType, number>,
  );
}
