import { http, HttpResponse, delay } from 'msw';
import deals from './fixtures/deals.json';
import disputes from './fixtures/disputes.json';
import bankEvents from './fixtures/bank-events.json';

export const handlers = [
  // Deals list
  http.get('/api/deals', () => {
    return HttpResponse.json({ data: deals, total: deals.length });
  }),

  // Single deal
  http.get('/api/deals/:id', ({ params }) => {
    const deal = deals.find(d => d.id === params.id);
    if (!deal) return HttpResponse.json({ error: 'Not found' }, { status: 404 });
    return HttpResponse.json(deal);
  }),

  // Release (simulated with delay)
  http.post('/api/deals/:id/release', async ({ request }) => {
    await delay(800 + Math.random() * 700); // 800–1500ms
    const body = await request.json() as Record<string, unknown>;
    return HttpResponse.json({
      success: true,
      sandbox: true,
      message: 'SANDBOX: операция симулирована',
      amount: body?.amount,
    });
  }),

  // Disputes list
  http.get('/api/disputes', () => {
    return HttpResponse.json({ data: disputes, total: disputes.length });
  }),

  // Single dispute
  http.get('/api/disputes/:id', ({ params }) => {
    const dispute = disputes.find(d => d.id === params.id);
    if (!dispute) return HttpResponse.json({ error: 'Not found' }, { status: 404 });
    return HttpResponse.json(dispute);
  }),

  // Bank status — occasionally 503 for error state testing
  http.get('/api/bank/status', () => {
    if (Math.random() < 0.05) {
      return HttpResponse.json({ error: 'Bank unavailable' }, { status: 503 });
    }
    return HttpResponse.json(bankEvents);
  }),

  // Field events (idempotent)
  http.post('/api/field/events', async ({ request }) => {
    await delay(200);
    const body = await request.json() as { events?: unknown[] };
    return HttpResponse.json({
      received: (body?.events as unknown[])?.length ?? 0,
      duplicates: 0,
    });
  }),
];
