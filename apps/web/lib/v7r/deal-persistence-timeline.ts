import { projectQueueToDealTimeline } from '../platform-v7/persistence-queue';
import { buildStableV7rPersistenceState } from './persistence-queue';

export function buildDealPersistenceTimeline(dealId: string) {
  return projectQueueToDealTimeline(buildStableV7rPersistenceState(), dealId);
}

export function summarizeDealPersistenceTimeline(dealId: string) {
  const events = buildDealPersistenceTimeline(dealId);
  return {
    dealId,
    total: events.length,
    danger: events.filter((event) => event.type === 'danger').length,
    success: events.filter((event) => event.type === 'success').length,
    events,
  };
}
