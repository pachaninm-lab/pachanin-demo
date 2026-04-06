import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { SESSION_COOKIE } from '../../../lib/auth-cookies';

export const dynamic = 'force-dynamic';

const DEMO_LOTS = [
  { id: 'LOT-001', status: 'AUCTION_OPEN', crop: 'wheat', culture: 'wheat', volumeTon: 500, priceRubPerTon: 14200, region: 'Краснодарский край', sellerId: 'farmer@demo.ru', auctionType: 'OPEN_AUCTION', auctionEndsAt: new Date(Date.now() + 48 * 3600 * 1000).toISOString(), quality: { protein: 13.2, moisture: 12.5, gluten: 28 } },
  { id: 'LOT-002', status: 'AUCTION_OPEN', crop: 'barley', culture: 'barley', volumeTon: 300, priceRubPerTon: 12800, region: 'Ростовская область', sellerId: 'farmer@demo.ru', auctionType: 'PRIVATE_AUCTION', auctionEndsAt: new Date(Date.now() + 72 * 3600 * 1000).toISOString(), quality: { protein: 11.8, moisture: 13.1 } },
  { id: 'LOT-003', status: 'PUBLISHED', crop: 'corn', culture: 'corn', volumeTon: 200, priceRubPerTon: 13500, region: 'Ставропольский край', sellerId: 'farmer2@demo.ru', auctionType: 'INSTANT_OFFER', quality: { moisture: 14.0 } },
];

// In-memory store for demo-created lots
const createdLots: typeof DEMO_LOTS = [];

export async function GET() {
  return NextResponse.json([...DEMO_LOTS, ...createdLots]);
}

export async function POST(request: Request) {
  const jar = cookies();
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
  };
  createdLots.push(newLot as never);
  return NextResponse.json(newLot, { status: 201 });
}
