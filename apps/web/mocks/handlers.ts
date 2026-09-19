import { http, HttpResponse, delay } from 'msw';
import deals from './fixtures/deals.json';
import disputes from './fixtures/disputes.json';
import bankEvents from './fixtures/bank-events.json';
import rfqList from './fixtures/rfq.json';
import batchesMap from './fixtures/batches.json';

// Readiness matrix per deal
function getReadinessMatrix(dealId: string) {
  const deal = deals.find(d => d.id === dealId) as Record<string, unknown> | undefined;
  const hasDispute = !!(deal?.dispute);
  const blockers = (deal?.blockers as string[]) ?? [];

  return {
    dealId,
    contours: [
      {
        id: 'fgis', label: 'СДИЗ (ФГИС Зерно)',
        status: dealId === 'DL-9102' ? 'done' : 'pending',
        owner: 'Продавец / Логистика',
        blocker: dealId !== 'DL-9102' ? 'Нет сведений о партии в ФГИС' : null,
        nextAction: dealId !== 'DL-9102' ? 'Сформировать СДИЗ в ФГИС Зерно' : null,
        sla: '0.5 дня',
        fgisId: dealId === 'DL-9102' ? 'SDIZ-2026-TBO-00441' : null,
      },
      {
        id: 'epd', label: 'ЭПД / ГИС',
        status: dealId === 'DL-9102' ? 'done' : 'pending',
        owner: 'Перевозчик',
        blocker: dealId !== 'DL-9102' ? 'Нет данных о рейсе' : null,
        nextAction: dealId !== 'DL-9102' ? 'Создать ЭПД и передать перевозчику' : null,
        sla: '0.5 дня',
        epdId: dealId === 'DL-9102' ? 'EPD-2026-03-4921' : null,
      },
      {
        id: 'edo', label: 'ЭДО (договор / акт)',
        status: blockers.includes('docs_missing_act') ? 'blocked' : 'done',
        owner: 'Продавец + Покупатель',
        blocker: blockers.includes('docs_missing_act') ? 'Акт приёмки не подписан (форма А)' : null,
        nextAction: blockers.includes('docs_missing_act') ? 'Подписать акт КЭП/МЧД' : null,
        sla: '1 день',
      },
      {
        id: 'acceptance', label: 'Приёмка',
        status: hasDispute ? 'blocked' : 'done',
        owner: 'Покупатель',
        blocker: hasDispute ? 'Активный спор по качеству' : null,
        nextAction: hasDispute ? 'Разрешить спор или подтвердить частичную приёмку' : null,
        sla: '0.5 дня',
      },
      {
        id: 'lab', label: 'Лаборатория',
        status: blockers.includes('lab_mismatch') ? 'blocked' : blockers.includes('lab_pending') ? 'pending' : 'done',
        owner: 'Отдел качества',
        blocker: blockers.includes('lab_mismatch') ? 'Расхождение: влажность 14.8% (норма ≤14%)' : null,
        nextAction: blockers.includes('lab_mismatch') ? 'Передать арбитру, ожидать решения' : null,
        sla: '2 дня',
      },
      {
        id: 'bank', label: 'Банк / Платёж',
        status: blockers.includes('bank_callback_mismatch') ? 'blocked' : 'done',
        owner: 'Финансовый отдел',
        blocker: blockers.includes('bank_callback_mismatch') ? 'CB-442 Mismatch — ручная сверка обязательна' : null,
        nextAction: blockers.includes('bank_callback_mismatch') ? 'Эскалировать в Сбер, закрыть CB-442' : null,
        sla: '0.5 дня',
        nominalAccountId: dealId === 'DL-9102' ? 'NA-SBER-DL9102' : null,
      },
      {
        id: 'dispute', label: 'Спор',
        status: hasDispute ? 'active' : 'none',
        owner: 'Отдел споров',
        blocker: hasDispute ? `Активный спор ${(deal?.dispute as {id:string})?.id}` : null,
        nextAction: hasDispute ? 'Загрузить заключение эксперта' : null,
        sla: '5 дней',
        disputeId: hasDispute ? (deal?.dispute as {id:string})?.id : null,
      },
    ],
  };
}

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

  // Release
  http.post('/api/deals/:id/release', async ({ request }) => {
    await delay(800 + Math.random() * 700);
    const body = await request.json() as Record<string, unknown>;
    return HttpResponse.json({
      success: true, sandbox: true,
      message: 'SANDBOX: операция симулирована',
      amount: body?.amount,
      nominalAccountId: 'NA-SBER-DL9102',
      sberTxId: `SBR-${Date.now()}`,
    });
  }),

  // Deal readiness matrix
  http.get('/api/deals/:id/readiness', ({ params }) => {
    return HttpResponse.json(getReadinessMatrix(params.id as string));
  }),

  // Batch passport
  http.get('/api/deals/:id/passport', ({ params }) => {
    const batch = (batchesMap as Record<string, unknown>)[params.id as string];
    if (!batch) {
      return HttpResponse.json({
        batchId: `BATCH-${params.id}-001`, dealId: params.id,
        crop: 'Нет данных', fgisStatus: 'pending',
        quality: [], route: [], events: [],
        scores: { disputeRisk: 0, qualityScore: 100, deliveryScore: 100, sellerRating: 0 },
      });
    }
    return HttpResponse.json(batch);
  }),

  // Nominal Account (Sber API simulation)
  http.post('/api/deals/:id/nominal/reserve', async () => {
    await delay(1200);
    return HttpResponse.json({ success: true, sandbox: true, nominalAccountId: `NA-SBER-${Date.now()}`, status: 'reserved', message: 'SANDBOX: зарезервировано на номинальном счёте Сбер' });
  }),
  http.post('/api/deals/:id/nominal/confirm', async () => {
    await delay(1000);
    return HttpResponse.json({ success: true, sandbox: true, status: 'confirmed', sberTxId: `SBR-CONF-${Date.now()}`, message: 'SANDBOX: частичный транш подтверждён' });
  }),
  http.post('/api/deals/:id/nominal/complete', async () => {
    await delay(1500);
    return HttpResponse.json({ success: true, sandbox: true, status: 'completed', sberTxId: `SBR-COMP-${Date.now()}`, message: 'SANDBOX: сделка закрыта, средства переведены' });
  }),

  // ФГИС Зерно simulation
  http.post('/api/fgis/sdiz', async ({ request }) => {
    await delay(600);
    const body = await request.json() as Record<string, unknown>;
    return HttpResponse.json({ success: true, sandbox: true, sdizId: `SDIZ-2026-${Date.now()}`, status: 'signed', dealId: body?.dealId, message: 'SANDBOX: СДИЗ зарегистрирован в ФГИС Зерно' });
  }),
  http.get('/api/fgis/batch/:batchId', async ({ params }) => {
    await delay(400);
    return HttpResponse.json({ sandbox: true, batchId: params.batchId, status: 'registered', sdizList: [`SDIZ-2026-${params.batchId}`] });
  }),

  // Disputes list
  http.get('/api/disputes', () => {
    return HttpResponse.json({ data: disputes, total: disputes.length });
  }),
  http.get('/api/disputes/:id', ({ params }) => {
    const dispute = disputes.find(d => d.id === params.id);
    if (!dispute) return HttpResponse.json({ error: 'Not found' }, { status: 404 });
    return HttpResponse.json(dispute);
  }),
  http.post('/api/disputes', async ({ request }) => {
    await delay(800);
    const body = await request.json() as Record<string, unknown>;
    return HttpResponse.json({ success: true, sandbox: true, disputeId: `DK-${new Date().getFullYear()}-${90 + Math.floor(Math.random() * 9)}`, status: 'initiated', dealId: body?.dealId, message: 'SANDBOX: спор создан' }, { status: 201 });
  }),

  // Bank status
  http.get('/api/bank/status', () => {
    if (Math.random() < 0.05) return HttpResponse.json({ error: 'Bank unavailable' }, { status: 503 });
    return HttpResponse.json(bankEvents);
  }),

  // Field events
  http.post('/api/field/events', async ({ request }) => {
    await delay(200);
    const body = await request.json() as { events?: unknown[] };
    return HttpResponse.json({ received: (body?.events as unknown[])?.length ?? 0, duplicates: 0 });
  }),

  // RFQ list
  http.get('/api/rfq', () => {
    return HttpResponse.json({ data: rfqList, total: rfqList.length });
  }),
  http.get('/api/rfq/:id', ({ params }) => {
    const rfq = rfqList.find(r => r.id === params.id);
    if (!rfq) return HttpResponse.json({ error: 'Not found' }, { status: 404 });
    return HttpResponse.json(rfq);
  }),
  http.post('/api/rfq', async ({ request }) => {
    await delay(500);
    const body = await request.json() as Record<string, unknown>;
    return HttpResponse.json({ success: true, sandbox: true, rfqId: `RFQ-00${rfqList.length + 1}`, status: 'open', expiresAt: new Date(Date.now() + 7 * 86400 * 1000).toISOString(), message: 'SANDBOX: RFQ опубликован', ...body }, { status: 201 });
  }),
  http.post('/api/rfq/:id/offer', async ({ request, params }) => {
    await delay(600);
    const body = await request.json() as Record<string, unknown>;
    return HttpResponse.json({ success: true, sandbox: true, offerId: `OFF-${params.id}-${Math.floor(Math.random() * 900 + 100)}`, rfqId: params.id, status: 'submitted', message: 'SANDBOX: оферта подана', ...body }, { status: 201 });
  }),
  http.post('/api/rfq/:id/accept', async ({ request }) => {
    await delay(1000);
    const body = await request.json() as Record<string, unknown>;
    return HttpResponse.json({ success: true, sandbox: true, dealId: `DL-${9120 + Math.floor(Math.random() * 20)}`, offerId: body?.offerId, message: 'SANDBOX: оферта принята, сделка создана' });
  }),
];
