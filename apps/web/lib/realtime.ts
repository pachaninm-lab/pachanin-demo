export function isRealtimeEnabled() {
  return true;
}

type LiveSocket = {
  on(event: string, handler: (...args: any[]) => void): void;
  off(event: string, handler: (...args: any[]) => void): void;
  close(): void;
};

// Singleton SSE-backed socket for the client session
let _socket: LiveSocket | null = null;

/**
 * Returns a LiveSocket backed by Server-Sent Events (SSE).
 * Automatically reconnects on disconnect.
 * Call socket.on('event-name', handler) to subscribe.
 * Call socket.off('event-name', handler) to unsubscribe.
 */
export function getLiveSocket(): LiveSocket | null {
  if (typeof window === 'undefined') return null;
  if (_socket) return _socket;

  const listeners = new Map<string, Set<(...args: any[]) => void>>();

  function getHandlers(event: string) {
    if (!listeners.has(event)) listeners.set(event, new Set());
    return listeners.get(event)!;
  }

  let es: EventSource | null = null;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  function connect() {
    if (es) { es.close(); }
    es = new EventSource('/api/realtime');

    es.onopen = () => {
      if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
      getHandlers('connected').forEach((fn) => fn({ ts: Date.now() }));
    };

    es.onmessage = (evt) => {
      try {
        const payload = JSON.parse(evt.data);
        const event = payload.event || 'message';
        getHandlers(event).forEach((fn) => fn(payload.data ?? payload));
        getHandlers('*').forEach((fn) => fn({ event, data: payload.data ?? payload }));
      } catch { /* ignore malformed */ }
    };

    // Named SSE events (e.g. "event: deal.updated")
    const KNOWN_EVENTS = ['deal.updated', 'lab.result', 'payment.released', 'queue.slot.arrived', 'dispute.opened'];
    KNOWN_EVENTS.forEach((name) => {
      es!.addEventListener(name, (evt: MessageEvent) => {
        try {
          const data = JSON.parse(evt.data);
          getHandlers(name).forEach((fn) => fn(data));
          getHandlers('*').forEach((fn) => fn({ event: name, data }));
        } catch { /* ignore */ }
      });
    });

    es.onerror = () => {
      es?.close();
      es = null;
      // Reconnect after 5s
      reconnectTimer = setTimeout(connect, 5_000);
    };
  }

  connect();

  _socket = {
    on(event, handler) { getHandlers(event).add(handler); },
    off(event, handler) { getHandlers(event).delete(handler); },
    close() {
      if (reconnectTimer) clearTimeout(reconnectTimer);
      es?.close();
      _socket = null;
    },
  };

  return _socket;
}

/** Reset singleton (useful in tests or after logout) */
export function resetLiveSocket() {
  _socket?.close();
  _socket = null;
}
