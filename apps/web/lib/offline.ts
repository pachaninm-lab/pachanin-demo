export type OfflineConflictKind = 'late_sync' | 'terminal_state' | 'field_override' | 'duplicate_event';

export type OfflineConflictCase = {
  id: string;
  kind: OfflineConflictKind;
  title: string;
  detail: string;
  severity: 'low' | 'medium' | 'high';
};

const PRESETS: Record<OfflineConflictKind, Omit<OfflineConflictCase, 'id' | 'kind'>> = {
  late_sync: {
    title: 'Поздняя синхронизация',
    detail: 'Данные пришли после ручного действия и требуют сверки перед финальным статусом.',
    severity: 'medium'
  },
  terminal_state: {
    title: 'Конфликт terminal state',
    detail: 'Устройство отправило событие уже после закрытия рейса или кейса.',
    severity: 'high'
  },
  field_override: {
    title: 'Полевое переопределение',
    detail: 'Оператор и полевой контур дали разные версии последнего действия.',
    severity: 'medium'
  },
  duplicate_event: {
    title: 'Дублированное событие',
    detail: 'Один и тот же шаг был отправлен повторно и требует идемпотентной сверки.',
    severity: 'low'
  }
};

export function describeOfflineConflict(kind: OfflineConflictKind): OfflineConflictCase {
  const preset = PRESETS[kind];
  return {
    id: `offline-${kind}`,
    kind,
    ...preset
  };
}

// ---------------------------------------------------------------------------
// Offline action queue
// Persists actions to localStorage and drains them when connectivity returns.
// ---------------------------------------------------------------------------

const QUEUE_KEY = 'pc_offline_queue';
const MAX_RETRIES = 3;

export type QueuedAction = {
  id: string;
  type: string;
  payload: Record<string, unknown>;
  queuedAt: string;
  retries: number;
  endpoint?: string;
};

export function isOnline(): boolean {
  if (typeof navigator === 'undefined') return true;
  return navigator.onLine;
}

function readQueue(): QueuedAction[] {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]');
  } catch {
    return [];
  }
}

function writeQueue(queue: QueuedAction[]): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

/** Add an action to the offline queue to be synced when online. */
export function queueOfflineAction(action: Record<string, unknown>): void {
  if (typeof window === 'undefined') return;
  const queue = readQueue();
  const entry: QueuedAction = {
    id: crypto.randomUUID(),
    type: String(action.type ?? 'unknown'),
    payload: action,
    queuedAt: new Date().toISOString(),
    retries: 0,
    endpoint: action.endpoint as string | undefined,
  };
  queue.push(entry);
  writeQueue(queue);
}

/** Return a snapshot of the current offline queue (read-only). */
export function getOfflineQueue(): QueuedAction[] {
  return readQueue();
}

/** Remove a successfully synced action by id. */
export function removeFromQueue(id: string): void {
  const queue = readQueue().filter((a) => a.id !== id);
  writeQueue(queue);
}

/** Clear the entire offline queue (e.g. after full sync or logout). */
export function clearOfflineQueue(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(QUEUE_KEY);
}

/**
 * Drain the offline queue by POSTing each action to its endpoint.
 * Skips actions that have exceeded MAX_RETRIES.
 * Returns the number of successfully synced actions.
 */
export async function drainOfflineQueue(): Promise<{ synced: number; failed: number }> {
  if (!isOnline()) return { synced: 0, failed: 0 };

  const queue = readQueue();
  if (queue.length === 0) return { synced: 0, failed: 0 };

  let synced = 0;
  let failed = 0;

  for (const action of queue) {
    if (action.retries >= MAX_RETRIES) {
      // Dead-letter: remove from queue, increment failed
      removeFromQueue(action.id);
      failed++;
      continue;
    }

    const endpoint = action.endpoint || `/api/offline-sync`;
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ id: action.id, type: action.type, payload: action.payload, queuedAt: action.queuedAt }),
      });

      if (res.ok) {
        removeFromQueue(action.id);
        synced++;
      } else {
        // Increment retry count
        const q = readQueue();
        const idx = q.findIndex((a) => a.id === action.id);
        if (idx !== -1) { q[idx].retries += 1; writeQueue(q); }
        failed++;
      }
    } catch {
      const q = readQueue();
      const idx = q.findIndex((a) => a.id === action.id);
      if (idx !== -1) { q[idx].retries += 1; writeQueue(q); }
      failed++;
    }
  }

  return { synced, failed };
}

let drainListenerAttached = false;

/** Register a listener that drains the queue whenever the browser goes online. */
export function startOfflineSync(): void {
  if (typeof window === 'undefined' || drainListenerAttached) return;
  drainListenerAttached = true;

  window.addEventListener('online', () => {
    drainOfflineQueue().then(({ synced }) => {
      if (synced > 0) {
        console.info(`[pc:offline] synced ${synced} queued action(s)`);
      }
    });
  });

  // Also attempt a drain immediately in case we're already online with queued items
  if (isOnline()) {
    drainOfflineQueue();
  }
}

export function registerServiceWorker(): void {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;
  navigator.serviceWorker.register('/sw.js').catch(() => {/* silent */});
}
