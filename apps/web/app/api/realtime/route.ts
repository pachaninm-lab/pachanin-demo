import { cookies } from 'next/headers';
import { SESSION_COOKIE } from '../../../lib/auth-cookies';

export const dynamic = 'force-dynamic';

// Demo events streamed to connected clients
const DEMO_EVENTS = [
  { event: 'deal.updated', data: { dealId: 'DEAL-001', status: 'IN_TRANSIT', message: 'Рейс отправлен' } },
  { event: 'lab.result', data: { sampleId: 'LAB-001', dealId: 'DEAL-002', status: 'COMPLETED', protein: '13.2%' } },
  { event: 'payment.released', data: { paymentId: 'PAY-001', dealId: 'DEAL-001', amountRub: 7100000 } },
  { event: 'queue.slot.arrived', data: { slotId: 'SLOT-003', vehicle: 'К789ЛМ', dealId: 'DEAL-003' } },
  { event: 'dispute.opened', data: { disputeId: 'DISPUTE-003', dealId: 'DEAL-002', type: 'weight', severity: 'MEDIUM' } },
];

export async function GET() {
  const jar = cookies();
  const raw = jar.get(SESSION_COOKIE)?.value;
  let role = 'GUEST';
  try {
    const session = JSON.parse(decodeURIComponent(raw || '{}'));
    role = session.role || 'GUEST';
  } catch { /* ignore */ }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      // Send connection confirmation
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ event: 'connected', data: { role, ts: Date.now() } })}\n\n`));

      let idx = 0;
      const interval = setInterval(() => {
        const ev = DEMO_EVENTS[idx % DEMO_EVENTS.length];
        controller.enqueue(encoder.encode(`event: ${ev.event}\ndata: ${JSON.stringify({ ...ev.data, ts: Date.now() })}\n\n`));
        idx++;
        // Also send a heartbeat every 15s
        if (idx % 3 === 0) {
          controller.enqueue(encoder.encode(`: heartbeat\n\n`));
        }
      }, 15_000);

      // Clean up on disconnect
      return () => clearInterval(interval);
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
