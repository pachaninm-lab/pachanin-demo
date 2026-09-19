import { NextResponse } from 'next/server';
import { randomBytes } from 'crypto';

export const dynamic = 'force-dynamic';

/**
 * P0.2-1A — legacy demo lot route, closed in production.
 *
 * `GET` served three hardcoded lots to every caller, so a production seller or
 * buyer saw offers nobody had made. `POST` created a lot directly in
 * `AUCTION_OPEN` — immediately tradable — from a process array, defaulting
 * missing fields to `wheat` / `100 t` / `14 000 ₽`, with the seller taken from
 * a cookie. Nothing was persisted, nothing was authorized against an
 * organization, and no volume was held against a confirmed party, so the same
 * grain could be offered any number of times.
 *
 * Both handlers are now withdrawn in production and return the same structured
 * fail-closed denial as the API contour. Outside production — reached only
 * through the explicit test-only binding below — the demo behaviour is
 * unchanged so local flows keep working.
 *
 * The canonical path is the PostgreSQL auction authority in the API; confirmed
 * grain lots wait for the ФГИС «Зерно» snapshot, reservation and passport.
 */

const DEMO_LOTS = [
  { id: 'LOT-001', status: 'AUCTION_OPEN', crop: 'wheat', culture: 'wheat', volumeTon: 500, priceRubPerTon: 14200, region: 'Краснодарский край', sellerId: 'farmer@demo.ru', auctionType: 'OPEN_AUCTION', auctionEndsAt: new Date(Date.now() + 48 * 3600 * 1000).toISOString(), quality: { protein: 13.2, moisture: 12.5, gluten: 28 } },
  { id: 'LOT-002', status: 'AUCTION_OPEN', crop: 'barley', culture: 'barley', volumeTon: 300, priceRubPerTon: 12800, region: 'Ростовская область', sellerId: 'farmer@demo.ru', auctionType: 'PRIVATE_AUCTION', auctionEndsAt: new Date(Date.now() + 72 * 3600 * 1000).toISOString(), quality: { protein: 11.8, moisture: 13.1 } },
  { id: 'LOT-003', status: 'PUBLISHED', crop: 'corn', culture: 'corn', volumeTon: 200, priceRubPerTon: 13500, region: 'Ставропольский край', sellerId: 'farmer2@demo.ru', auctionType: 'INSTANT_OFFER', quality: { moisture: 14.0 } },
];

// In-memory store for demo-created lots. Never reachable in production.
const createdLots: typeof DEMO_LOTS = [];

/**
 * Production is the default, so a missing or misspelled `NODE_ENV` keeps the
 * strict contour rather than reopening the demo surface.
 */
function isLegacyLotContourEnabled(): boolean {
  const nodeEnv = process.env.NODE_ENV ?? 'production';
  return nodeEnv === 'test' || nodeEnv === 'development';
}

const NO_STORE = {
  'Cache-Control': 'no-store, no-cache, must-revalidate',
  Pragma: 'no-cache',
} as const;

function retiredContourResponse(route: string) {
  // Correlation code only — the durable audit fact for this boundary is written
  // by the API, which owns the PostgreSQL authority. The web route holds no
  // database credentials and must not open its own audit channel.
  const correlationCode = `FGIS-${randomBytes(4).toString('hex').toUpperCase()}`;
  return NextResponse.json(
    {
      code: 'LEGACY_FGIS_LOT_CONTOUR_RETIRED',
      message:
        'Устаревший контур лотов отключён: он не подтверждает объём партии, ' +
        'не удерживает его от повторной продажи и не хранит лот в PostgreSQL.',
      nextStep:
        'Создайте лот из подтверждённой партии ФГИС «Зерно» после подключения организации.',
      correlationCode,
      stateChanged: false,
      attestation: 'NOT_ATTESTED',
      boundary: 'LEGACY_FGIS_QUARANTINE',
      route,
    },
    { status: 410, headers: NO_STORE },
  );
}

export async function GET() {
  if (!isLegacyLotContourEnabled()) {
    return retiredContourResponse('GET /api/lots');
  }
  return NextResponse.json([...DEMO_LOTS, ...createdLots], { headers: NO_STORE });
}

export async function POST(request: Request) {
  if (!isLegacyLotContourEnabled()) {
    return retiredContourResponse('POST /api/lots');
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
  return NextResponse.json(newLot, { status: 201, headers: NO_STORE });
}
