import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { ACCESS_COOKIE, SESSION_COOKIE } from '../../../../lib/auth-cookies';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';
const CANONICAL_DEAL_ID = 'DEAL-INDUSTRIAL-001';
type CookieStore = Awaited<ReturnType<typeof cookies>>;

// Legacy demonstration data remains temporarily for old, non-canonical surfaces.
// The canonical deal path below is strictly real-backend-only and never falls
// through to these process-local values.
const demoLots = [
  { id: 'LOT-001', status: 'AUCTION_OPEN', crop: 'wheat', culture: 'wheat', title: 'Пшеница 3 класс · Краснодарский край', volumeTon: 500, priceRubPerTon: 14200, region: 'Краснодарский край', sellerId: 'farmer@demo.ru', auctionType: 'OPEN_AUCTION', auctionEndsAt: new Date(Date.now() + 48 * 3600 * 1000).toISOString(), bidsCount: 3, quality: { protein: 13.2, moisture: 12.5, gluten: 28, impurity: 1.2 } },
  { id: 'LOT-002', status: 'AUCTION_OPEN', crop: 'barley', culture: 'barley', title: 'Ячмень кормовой · Ростовская область', volumeTon: 300, priceRubPerTon: 12800, region: 'Ростовская область', sellerId: 'farmer@demo.ru', auctionType: 'PRIVATE_AUCTION', auctionEndsAt: new Date(Date.now() + 72 * 3600 * 1000).toISOString(), bidsCount: 1, quality: { protein: 11.8, moisture: 13.1, impurity: 0.9 } },
  { id: 'LOT-003', status: 'PUBLISHED', crop: 'corn', culture: 'corn', title: 'Кукуруза продовольственная · Ставрополье', volumeTon: 200, priceRubPerTon: 13500, region: 'Ставропольский край', sellerId: 'farmer2@demo.ru', auctionType: 'INSTANT_OFFER', quality: { moisture: 14.0, impurity: 1.5 } },
];

const demoDeals = [
  { id: 'DEAL-001', lotId: 'LOT-001', status: 'IN_TRANSIT', sellerOrgId: 'org-farmer-1', buyerOrgId: 'org-buyer-1', volumeTons: 500, pricePerTon: 14200, totalRub: 7100000, currency: 'RUB', region: 'Краснодарский край', culture: 'wheat', createdAt: '2026-03-22T10:00:00Z', signedAt: '2026-03-25T12:00:00Z', nextAction: 'Ожидать прибытия груза на элеватор' },
  { id: 'DEAL-002', lotId: 'LOT-002', status: 'QUALITY_CHECK', sellerOrgId: 'org-farmer-1', buyerOrgId: 'org-buyer-2', volumeTons: 300, pricePerTon: 12800, totalRub: 3840000, currency: 'RUB', region: 'Ростовская область', culture: 'barley', createdAt: '2026-03-28T10:00:00Z', signedAt: '2026-04-01T09:00:00Z', nextAction: 'Лаборатория должна выдать протокол' },
  { id: 'DEAL-003', lotId: 'LOT-003', status: 'SIGNED', sellerOrgId: 'org-farmer-2', buyerOrgId: 'org-buyer-1', volumeTons: 200, pricePerTon: 13500, totalRub: 2700000, currency: 'RUB', region: 'Ставропольский край', culture: 'corn', createdAt: '2026-04-03T10:00:00Z', nextAction: 'Организовать логистику и начать погрузку' },
];

const demoDisputes = [
  { id: 'DISPUTE-001', dealId: 'DEAL-001', status: 'UNDER_REVIEW', type: 'quality', claimAmountRub: 127500, description: 'Влажность зерна 15.2% вместо заявленных 13%', severity: 'MEDIUM', createdAt: '2026-04-01T14:00:00Z', owner: 'operator@demo.ru', slaMinutes: 180 },
  { id: 'DISPUTE-002', dealId: 'DEAL-002', status: 'OPEN', type: 'weight', claimAmountRub: 86250, description: 'Расхождение веса на 7.5 тонн по весовой квитанции', severity: 'HIGH', createdAt: '2026-04-03T09:00:00Z', slaMinutes: 30 },
];

const demoPayments = [
  { id: 'PAY-001', dealId: 'DEAL-001', status: 'HOLD', type: 'prepayment', amountRub: 2130000, description: 'Предоплата 30% по сделке DEAL-001', initiatedAt: '2026-03-26T10:00:00Z', dueAt: '2026-04-26T10:00:00Z' },
  { id: 'PAY-002', dealId: 'DEAL-002', status: 'PENDING_RELEASE', type: 'final_payment', amountRub: 3840000, description: 'Финальный платёж по сделке DEAL-002', initiatedAt: '2026-04-04T10:00:00Z' },
];

const demoNotifications = [
  { id: 'N-001', type: 'deal.update', title: 'Сделка DEAL-001 в пути', body: 'Рейс К789ЛМ отправлен. Ожидаемое прибытие: 08.04.2026', createdAt: '2026-04-06T08:00:00Z', read: false, href: '/deals/DEAL-001' },
  { id: 'N-002', type: 'lab.result', title: 'Результат лаборатории', body: 'Проба по DEAL-002 готова. Требуется проверка.', createdAt: '2026-04-05T16:30:00Z', read: false, href: '/lab/DEAL-002' },
  { id: 'N-003', type: 'dispute.opened', title: 'Новый спор DISPUTE-002', body: 'Открыт спор по весу. SLA: 30 минут.', createdAt: '2026-04-03T09:00:00Z', read: true, href: '/disputes/DISPUTE-002' },
];

function readSessionRole(jar: CookieStore): { role: string; email: string } {
  try {
    const raw = jar.get(SESSION_COOKIE)?.value;
    if (!raw) return { role: 'GUEST', email: '' };
    const parsed = JSON.parse(decodeURIComponent(raw));
    return { role: parsed.role || 'GUEST', email: parsed.email || '' };
  } catch {
    return { role: 'GUEST', email: '' };
  }
}

// The industrial execution surface is strictly real-backend-only for EVERY
// deal (not just the canonical test deal): a silent demo fallback on a command
// path would fabricate deal state. CANONICAL_DEAL_ID stays as the default
// workspace target for role dashboards.
function requiresRealBackend(path: string): boolean {
  return path === 'deals/accessible'
    || /^deals\/[^/]+\/(execution-workspace|correlation-timeline)$/.test(path)
    || /^deals\/[^/]+\/commands\//.test(path);
}

function realBackendUnavailable(reason: string) {
  return NextResponse.json(
    {
      ok: false,
      code: 'REAL_BACKEND_REQUIRED',
      message: 'Единая сделка недоступна: сервер не подтвердил состояние. Демо-ответ запрещён.',
      reason,
    },
    { status: 503 },
  );
}

function demoResponse(method: string, path: string, jar: CookieStore, body: any): Response | null {
  const { role, email } = readSessionRole(jar);
  const key = `${method.toUpperCase()} /${path}`;

  if (key === 'GET /auth/me') {
    if (role === 'GUEST') return Response.json({ authenticated: false, role: 'GUEST' }, { status: 401 });
    return Response.json({ authenticated: true, role, surfaceRole: role, email, orgName: 'Demo Org', fullName: email.split('@')[0] || role });
  }

  if (key === 'GET /lots') return Response.json(demoLots);
  if (key === 'POST /lots') {
    const lot = { id: `LOT-${String(Date.now()).slice(-6)}`, status: 'AUCTION_OPEN', sellerId: email, ...body, createdAt: new Date().toISOString() };
    demoLots.push(lot as never);
    return Response.json(lot, { status: 201 });
  }
  if (path.startsWith('lots/') && method === 'GET') {
    const id = path.split('/')[1];
    const lot = demoLots.find((item) => item.id === id);
    return lot ? Response.json(lot) : Response.json({ message: 'not found' }, { status: 404 });
  }

  if (key === 'GET /deals') return Response.json({ items: demoDeals, total: demoDeals.length });
  if (path.startsWith('deals/') && method === 'GET') {
    const id = path.split('/')[1];
    const deal = demoDeals.find((item) => item.id === id);
    return deal ? Response.json(deal) : Response.json({ message: 'not found' }, { status: 404 });
  }

  if (key === 'GET /disputes') return Response.json({ items: demoDisputes, total: demoDisputes.length });
  if (path.startsWith('disputes/') && method === 'GET') {
    const id = path.split('/')[1];
    const dispute = demoDisputes.find((item) => item.id === id);
    return dispute ? Response.json(dispute) : Response.json({ message: 'not found' }, { status: 404 });
  }

  if (key === 'GET /payments') return Response.json({ items: demoPayments, total: demoPayments.length });
  if (key === 'GET /notifications') return Response.json({ items: demoNotifications, unread: demoNotifications.filter((item) => !item.read).length });
  if (key === 'POST /labs/complete') return Response.json({ ok: true, status: 'COMPLETED', nextRail: 'settlement' });
  if (key === 'POST /labs/flag-quality-dispute') return Response.json({ ok: true, status: 'DISPUTED', disputeId: `DISPUTE-${String(Date.now()).slice(-6)}` });
  if (path.includes('settlement') && path.includes('confirm') && method === 'POST') return Response.json({ ok: true, status: 'CONFIRMED' });
  if (path.includes('settlement') && path.includes('release') && method === 'POST') return Response.json({ ok: true, status: 'RELEASED' });
  if (key === 'POST /offline-sync') return Response.json({ ok: true, synced: true });
  return null;
}

async function proxy(request: Request, params: { path: string[] }) {
  const path = params.path.join('/');
  const jar = await cookies();
  const token = jar.get(ACCESS_COOKIE)?.value || '';
  const strictRealPath = requiresRealBackend(path);
  const isDemo = !API_URL || token.startsWith('demo.');

  if (strictRealPath && !API_URL) return realBackendUnavailable('api_url_missing');
  if (strictRealPath && (!token || token.startsWith('demo.'))) return realBackendUnavailable('verified_session_missing');

  if (!isDemo) {
    try {
      const target = `${API_URL}/${path}`;
      const headers = new Headers(request.headers);
      headers.set('Authorization', `Bearer ${token}`);
      headers.delete('host');
      const body = request.method === 'GET' || request.method === 'HEAD' ? undefined : await request.text();
      const response = await fetch(target, {
        method: request.method,
        headers,
        body,
        cache: 'no-store',
        signal: AbortSignal.timeout(8000),
      });
      const text = await response.text();
      return new NextResponse(text, {
        status: response.status,
        headers: { 'content-type': response.headers.get('content-type') || 'application/json' },
      });
    } catch {
      if (strictRealPath) return realBackendUnavailable('backend_unreachable');
    }
  }

  if (strictRealPath) return realBackendUnavailable('real_backend_not_used');

  let body: any = {};
  try {
    if (request.method !== 'GET' && request.method !== 'HEAD') body = await request.json().catch(() => ({}));
  } catch {
    body = {};
  }

  const demo = demoResponse(request.method, path, jar, body);
  if (demo) return demo;

  return NextResponse.json({ ok: false, demo: true, path, message: 'Demo endpoint is not implemented.' }, { status: 404 });
}

export async function GET(request: Request, props: { params: Promise<{ path: string[] }> }) {
  const params = await props.params;
  return proxy(request, params);
}
export async function POST(request: Request, props: { params: Promise<{ path: string[] }> }) {
  const params = await props.params;
  return proxy(request, params);
}
export async function PATCH(request: Request, props: { params: Promise<{ path: string[] }> }) {
  const params = await props.params;
  return proxy(request, params);
}
export async function PUT(request: Request, props: { params: Promise<{ path: string[] }> }) {
  const params = await props.params;
  return proxy(request, params);
}
export async function DELETE(request: Request, props: { params: Promise<{ path: string[] }> }) {
  const params = await props.params;
  return proxy(request, params);
}
