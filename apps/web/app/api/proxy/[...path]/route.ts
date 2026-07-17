import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { ACCESS_COOKIE, SESSION_COOKIE } from '../../../../lib/auth-cookies';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';
type CookieStore = Awaited<ReturnType<typeof cookies>>;
type DemoDeal = (typeof demoDeals)[number];
type DemoLocale = 'ru' | 'en' | 'zh';

const demoLots = [
  { id: 'LOT-001', status: 'AUCTION_OPEN', crop: 'wheat', culture: 'wheat', title: 'Пшеница 3 класс · Краснодарский край', volumeTon: 500, priceRubPerTon: 14200, region: 'Краснодарский край', sellerId: 'farmer@demo.ru', auctionType: 'OPEN_AUCTION', auctionEndsAt: new Date(Date.now() + 48 * 3600 * 1000).toISOString(), bidsCount: 3, quality: { protein: 13.2, moisture: 12.5, gluten: 28, impurity: 1.2 } },
  { id: 'LOT-002', status: 'AUCTION_OPEN', crop: 'barley', culture: 'barley', title: 'Ячмень кормовой · Ростовская область', volumeTon: 300, priceRubPerTon: 12800, region: 'Ростовская область', sellerId: 'farmer@demo.ru', auctionType: 'PRIVATE_AUCTION', auctionEndsAt: new Date(Date.now() + 72 * 3600 * 1000).toISOString(), bidsCount: 1, quality: { protein: 11.8, moisture: 13.1, impurity: 0.9 } },
  { id: 'LOT-003', status: 'PUBLISHED', crop: 'corn', culture: 'corn', title: 'Кукуруза продовольственная · Ставрополье', volumeTon: 200, priceRubPerTon: 13500, region: 'Ставропольский край', sellerId: 'farmer2@demo.ru', auctionType: 'INSTANT_OFFER', quality: { moisture: 14.0, impurity: 1.5 } },
];

const demoDeals = [
  { id: 'DEAL-001', lotId: 'LOT-001', status: 'IN_TRANSIT', sellerOrgId: 'org-farmer-1', buyerOrgId: 'org-buyer-1', volumeTons: 500, pricePerTon: 14200, totalRub: 7100000, currency: 'RUB', region: 'Краснодарский край', culture: 'wheat', createdAt: '2026-03-22T10:00:00Z', signedAt: '2026-03-25T12:00:00Z', nextAction: 'Ожидать прибытия груза на элеватор' },
  { id: 'DEAL-002', lotId: 'LOT-002', status: 'QUALITY_CHECK', sellerOrgId: 'org-farmer-1', buyerOrgId: 'org-buyer-2', volumeTons: 300, pricePerTon: 12800, totalRub: 3840000, currency: 'RUB', region: 'Ростовская область', culture: 'barley', createdAt: '2026-03-28T10:00:00Z', signedAt: '2026-04-01T09:00:00Z', nextAction: 'Лаборатория должна выдать протокол' },
  { id: 'DEAL-003', lotId: 'LOT-003', status: 'SIGNED', sellerOrgId: 'org-farmer-2', buyerOrgId: 'org-buyer-1', volumeTons: 200, pricePerTon: 13500, totalRub: 2700000, currency: 'RUB', region: 'Ставропольский край', culture: 'corn', createdAt: '2026-04-03T10:00:00Z', nextAction: 'Организовать логистику и начать погрузку' },
] as const;

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

function isAssistantPath(path: string): boolean {
  return path === 'ai-assistant/catalog' || path === 'ai-assistant/chat';
}

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
      message: 'Сервер не подтвердил ролевой контекст. Подмена реальных данных демонстрационными запрещена.',
      reason,
    },
    { status: 503, headers: { 'Cache-Control': 'no-store' } },
  );
}

function cleanText(value: unknown, limit: number): string {
  if (typeof value !== 'string') return '';
  return value.replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, limit);
}

function demoDealsFor(role: string, email: string): readonly DemoDeal[] {
  if (role === 'FARMER') return email.startsWith('farmer2@') ? demoDeals.filter((deal) => deal.sellerOrgId === 'org-farmer-2') : demoDeals.filter((deal) => deal.sellerOrgId === 'org-farmer-1');
  if (role === 'BUYER') return demoDeals.filter((deal) => deal.buyerOrgId === 'org-buyer-1');
  if (['LOGISTICIAN', 'DRIVER', 'LAB', 'ELEVATOR', 'ACCOUNTING', 'EXECUTIVE', 'SUPPORT_MANAGER', 'ADMIN'].includes(role)) return demoDeals;
  return [];
}

function localeFrom(value: unknown): DemoLocale {
  return value === 'en' || value === 'zh' ? value : 'ru';
}

function demoDealFromPath(path: unknown): string | null {
  const pagePath = cleanText(path, 500);
  const match = pagePath.match(/^\/platform-v7\/deals\/([^/]+)/u);
  if (!match) return null;
  try { return decodeURIComponent(match[1]); } catch { return null; }
}

function demoAssistantAnswer(message: string, locale: DemoLocale, deals: readonly DemoDeal[], selected: DemoDeal | null, role: string): string {
  const query = message.toLocaleLowerCase(locale === 'ru' ? 'ru-RU' : locale === 'zh' ? 'zh-CN' : 'en-GB');
  const labels = {
    ru: {
      intro: 'Синтетический демонстрационный контур. Доступные тебе сделки:',
      noDeals: 'В этой демонстрационной роли нет доступных сделок.',
      next: 'Следующий шаг', amount: 'Сумма', scope: `Роль ${role}. Я вижу только синтетические сделки, разрешённые этой демонстрационной роли.`,
      money: 'Денежный статус здесь демонстрационный. Выпуск денег не выполняется и не подтверждается помощником.',
      fallback: 'Укажи сделку или спроси о статусе, следующем шаге, документах, логистике, деньгах либо споре.',
    },
    en: {
      intro: 'Synthetic demonstration scope. Deals accessible to you:', noDeals: 'No deals are accessible to this demonstration role.', next: 'Next action', amount: 'Amount',
      scope: `Role ${role}. I can see only synthetic deals allowed to this demonstration role.`, money: 'The money status is synthetic. The assistant cannot execute or confirm a release.',
      fallback: 'Provide a deal or ask about status, next action, documents, logistics, money or a dispute.',
    },
    zh: {
      intro: '合成演示范围。你可以访问的交易：', noDeals: '该演示角色没有可访问交易。', next: '下一步', amount: '金额',
      scope: `角色 ${role}。我只能看到该演示角色获准访问的合成交易。`, money: '资金状态为合成演示数据。助手不能执行或确认放款。',
      fallback: '请指定交易，或询问状态、下一步、文件、物流、资金或争议。',
    },
  }[locale];

  if (query.includes('прав') || query.includes('доступ') || query.includes('role') || query.includes('access') || query.includes('权限')) return labels.scope;
  if (!deals.length) return labels.noDeals;
  if (selected) {
    const amount = new Intl.NumberFormat(locale === 'ru' ? 'ru-RU' : locale === 'zh' ? 'zh-CN' : 'en-GB', { style: 'currency', currency: selected.currency, maximumFractionDigits: 0 }).format(selected.totalRub);
    const base = `${selected.id}: ${selected.status.replaceAll('_', ' ')}. ${labels.next}: ${selected.nextAction}. ${labels.amount}: ${amount}.`;
    if (query.includes('деньг') || query.includes('выплат') || query.includes('money') || query.includes('payment') || query.includes('资金')) return `${base} ${labels.money}`;
    return base;
  }
  if (query.includes('сдел') || query.includes('внимани') || query.includes('deal') || query.includes('attention') || query.includes('交易')) {
    return `${labels.intro}\n${deals.map((deal, index) => `${index + 1}. ${deal.id} — ${deal.status.replaceAll('_', ' ')}; ${labels.next}: ${deal.nextAction}`).join('\n')}`;
  }
  return `${labels.fallback} ${labels.scope}`;
}

function demoAssistantResponse(method: string, path: string, role: string, email: string, body: any): Response | null {
  if (role === 'GUEST') return Response.json({ ok: false, code: 'AUTH_REQUIRED', message: 'Требуется демонстрационная сессия.' }, { status: 401 });
  const deals = demoDealsFor(role, email);

  if (method === 'GET' && path === 'ai-assistant/catalog') {
    return Response.json({
      title: 'Помощник сделки',
      mode: 'synthetic_demo',
      provider: 'local-deterministic',
      dataMode: 'synthetic_demo',
      authority: 'demo_role_scoped',
      modeRestriction: 'read_only',
      starterPrompts: ['Что требует моего внимания?', 'Покажи мои доступные сделки', 'Объясни статус сделки', 'Почему расчёт может быть заблокирован?'],
    }, { headers: { 'Cache-Control': 'no-store' } });
  }

  if (method === 'POST' && path === 'ai-assistant/chat') {
    const message = cleanText(body?.message, 4000);
    if (!message) return Response.json({ ok: false, code: 'AI_ASSISTANT_MESSAGE_REQUIRED', message: 'Введите вопрос.' }, { status: 400 });
    const locale = localeFrom(body?.locale);
    const requestedId = cleanText(body?.dealId, 120) || demoDealFromPath(body?.pagePath);
    const selected = requestedId ? deals.find((deal) => deal.id === requestedId) ?? null : null;
    if (requestedId && !selected) return Response.json({ ok: false, code: 'AI_ASSISTANT_DEAL_NOT_AVAILABLE', message: 'Сделка недоступна этой демонстрационной роли.' }, { status: 404 });
    const generatedAt = new Date().toISOString();
    return Response.json({
      requestId: `demo-ai-${Date.now()}`,
      answer: demoAssistantAnswer(message, locale, deals, selected, role),
      provider: 'local-deterministic',
      dataMode: 'synthetic_demo',
      mode: 'read_only',
      role,
      dealId: selected?.id ?? null,
      generatedAt,
      citations: selected ? [{ source: 'deal_workspace', label: `Синтетическая сделка ${selected.id}`, href: `/platform-v7/deals/${selected.id}/execution`, asOf: generatedAt }] : [{ source: 'deal_registry', label: 'Синтетический ролевой реестр', href: '/platform-v7/deals', asOf: generatedAt }],
      limitations: ['Используются только синтетические демонстрационные данные.', 'Помощник не меняет сделку и не выполняет денежные или юридически значимые действия.'],
    }, { headers: { 'Cache-Control': 'no-store' } });
  }
  return null;
}

function demoResponse(method: string, path: string, jar: CookieStore, body: any): Response | null {
  const { role, email } = readSessionRole(jar);
  const key = `${method.toUpperCase()} /${path}`;

  if (key === 'GET /auth/me') {
    if (role === 'GUEST') return Response.json({ authenticated: false, role: 'GUEST' }, { status: 401 });
    return Response.json({ authenticated: true, role, surfaceRole: role, email, orgName: 'Demo Org', fullName: email.split('@')[0] || role });
  }
  if (isAssistantPath(path)) return demoAssistantResponse(method.toUpperCase(), path, role, email, body);

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
  const demoToken = token.startsWith('demo.');
  const strictRealPath = requiresRealBackend(path) || (isAssistantPath(path) && !demoToken);
  const isDemo = !API_URL || demoToken;

  if (strictRealPath && !API_URL) return realBackendUnavailable('api_url_missing');
  if (strictRealPath && !token) return realBackendUnavailable('verified_session_missing');

  if (!isDemo) {
    try {
      const target = `${API_URL}/${path}`;
      const headers = new Headers(request.headers);
      headers.set('Authorization', `Bearer ${token}`);
      headers.delete('host');
      const requestBody = request.method === 'GET' || request.method === 'HEAD' ? undefined : await request.text();
      const response = await fetch(target, {
        method: request.method,
        headers,
        body: requestBody,
        cache: 'no-store',
        signal: AbortSignal.timeout(8000),
      });
      const text = await response.text();
      return new NextResponse(text, {
        status: response.status,
        headers: { 'content-type': response.headers.get('content-type') || 'application/json', 'Cache-Control': 'no-store' },
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
