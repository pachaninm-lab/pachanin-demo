/**
 * WebSocket-клиент для real-time уведомлений.
 * Подключается к существующему RealtimeGateway (socket.io).
 */

type EventHandler = (data: any) => void;

class WebSocketClient {
  private socket: any = null;
  private handlers: Map<string, Set<EventHandler>> = new Map();
  private reconnectTimer: any = null;
  private connected = false;

  connect(token?: string) {
    if (typeof window === 'undefined') return;
    
    const url = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:4000';
    
    // Dynamic import of socket.io-client
    import('socket.io-client').then((mod) => {
      const io = (mod as any).default || (mod as any).io;
      this.socket = io(url, {
        auth: { token },
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionAttempts: 10,
      });

      this.socket.on('connect', () => {
        this.connected = true;
      });

      this.socket.on('disconnect', () => {
        this.connected = false;
      });

      // Forward all events to registered handlers
      const events = [
        'deal.status_changed', 'bid.placed', 'payment.received',
        'dispute.opened', 'shipment.status_changed', 'notification.new',
        'runtime.updated', 'runtime.role.updated', 'runtime.object.updated',
      ];

      events.forEach(event => {
        this.socket.on(event, (data: any) => {
          const handlers = this.handlers.get(event);
          if (handlers) handlers.forEach(h => h(data));
        });
      });
    }).catch(() => {
      this.connected = false;
    });
  }

  on(event: string, handler: EventHandler) {
    if (!this.handlers.has(event)) this.handlers.set(event, new Set());
    this.handlers.get(event)!.add(handler);
    return () => this.handlers.get(event)?.delete(handler);
  }

  disconnect() {
    this.socket?.disconnect();
    this.connected = false;
  }

  isConnected() { return this.connected; }
}

export const wsClient = new WebSocketClient();
