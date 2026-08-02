import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * P0.2-1A — demo lot route, quarantined in production.
 *
 * `GET` served three hardcoded lots to every caller, so a production seller or
 * buyer saw offers nobody had made. `POST` created a lot directly in
 * `AUCTION_OPEN` — immediately tradable — from a process array, defaulting
 * missing fields to `wheat` / `100 t` / `14 000 ₽`, with the seller taken from
 * a cookie. Nothing was persisted, nothing was authorized against an
 * organization, and no volume was held against a confirmed party, so the same
 * grain could be offered any number of times.
 *
 * Outside production both handlers behave as before, which keeps local demo
 * flows working. In production the fixtures are withheld and the write is
 * refused; the canonical path is the PostgreSQL auction authority in the API,
 * and confirmed grain lots wait for the ФГИС «Зерно» snapshot, reservation and
 * passport.
 */

const DEMO_LOTS = [
  { id: 'LOT-001', status: 'AUCTION_OPEN', crop: 'wheat', culture: 'wheat', volumeTon: 500, priceRubPerTon: 14200, region: 'Краснодарский край', sellerId: 'farmer@demo.ru', auctionType: 'OPEN_AUCTION', auctionEndsAt: new Date(Date.now() + 48 * 3600 * 1000).toISOString(), quality: { protein: 13.2, moisture: 12.5, gluten: 28 } },
  { id: 'LOT-002', status: 'AUCTION_OPEN', crop: 'barley', culture: 'barley', volumeTon: 300, priceRubPerTon: 12800, region: 'Ростовская область', sellerId: 'farmer@demo.ru', auctionType: 'PRIVATE_AUCTION', auctionEndsAt: new Date(Date.now() + 72 * 3600 * 1000).toISOString(), quality: { protein: 11.8, moisture: 13.1 } },
  { id: 'LOT-003', status: 'PUBLISHED', crop: 'corn', culture: 'corn', volumeTon: 200, priceRubPerTon: 13500, region: 'Ставропольский край', sellerId: 'farmer2@demo.ru', auctionType: 'INSTANT_OFFER', quality: { moisture: 14.0 } },
];

// In-memory store for demo-created lots
const createdLots: typeof DEMO_LOTS = [];

function isProductionRuntime(): boolean {
  return (process.env.NODE_ENV ?? 'development') === 'production';
}

export async function GET() {
  // No fixture reaches a production projection. An empty list is the honest
  // answer: this route has no authority over real lots.
  if (isProductionRuntime()) {
    return NextResponse.json([], {
      headers: { 'Cache-Control': 'no-store' },
    });
  }
  return NextResponse.json([...DEMO_LOTS, ...createdLots]);
}

export async function POST(request: Request) {
  if (isProductionRuntime()) {
    return NextResponse.json(
      {
        code: 'FGIS_VERIFIED_LOT_PATH_NOT_READY',
        message:
          'Создание лота этим маршрутом отключено: он не подтверждает объём партии ' +
          'и не удерживает его от повторной продажи.',
        nextStep:
          'Создайте лот из подтверждённой партии ФГИС «Зерно» после подключения организации.',
        stateChanged: false,
        attestation: 'NOT_ATTESTED',
      },
      { status: 410, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  const { cookies } = await import('next/headers');
  const { SESSION_COOKIE } = await import('../../../lib/auth-cookies');
  const jar = await cookies();
  const raw = jar.get(SESSION_COOKIE)?.value;
  let sellerEmail = 'farmer@demo.ru';
  try {
    const session = JSON.parse(decodeURIComponent(raw || '{}'));
    if (session.email) sellerEmail = session.email;
  } catch { /* ignore */ }

  const body = await request.json().catch(() => ({}));
  const newLot = {
    id: `LOT-${String(Date.now()).slice(-6)}`,
    status: 'AUCTION_OPEN',
    crop: body.crop || 'wheat',
    culture: body.crop || 'wheat',
    volumeTon: Number(body.volumeTon) || 100,
    priceRubPerTon: Number(body.priceRubPerTon) || 14000,
    region: body.region || 'Краснодарский край',
    sellerId: sellerEmail,
    auctionType: body.auctionType || 'OPEN_AUCTION',
    auctionEndsAt: new Date(Date.now() + 48 * 3600 * 1000).toISOString(),
    quality: body.quality || {},
    description: body.description || null,
    createdAt: new Date().toISOString(),
    sourceVerification: 'UNVERIFIED_MANUAL_DRAFT',
  };
  createdLots.push(newLot as never);
  return NextResponse.json(newLot, { status: 201 });
}
