import Link from 'next/link';
import { AppShell } from '../../components/app-shell';
import { Breadcrumbs } from '../../components/breadcrumbs';
import { PageAccessGuard } from '../../components/page-access-guard';
import { TRADING_ROLES } from '../../lib/route-roles';
import { apiServer } from '../../lib/api-server';
import { LotsFilterClient } from './lots-filter-client';

type Lot = {
  id: string; status: string; title?: string; crop?: string; culture?: string;
  volumeTon?: number; volumeTons?: number; priceRubPerTon?: number; startPrice?: number;
  region: string; sellerId?: string; auctionType?: string; auctionEndsAt?: string;
};

const SEED: Lot[] = [
  { id: 'LOT-001', status: 'AUCTION_OPEN', title: 'Пшеница 3 класс · Краснодарский край', culture: 'wheat', crop: 'wheat', volumeTon: 500, volumeTons: 500, priceRubPerTon: 14200, startPrice: 14200, region: 'Краснодарский край', sellerId: 'farmer@demo.ru', auctionType: 'OPEN_AUCTION', auctionEndsAt: '2026-04-07T18:00:00Z' },
  { id: 'LOT-002', status: 'AUCTION_OPEN', title: 'Ячмень кормовой · Ростовская область', culture: 'barley', crop: 'barley', volumeTon: 300, volumeTons: 300, priceRubPerTon: 12800, startPrice: 12800, region: 'Ростовская область', sellerId: 'farmer@demo.ru', auctionType: 'PRIVATE_AUCTION', auctionEndsAt: '2026-04-08T12:00:00Z' },
  { id: 'LOT-003', status: 'PUBLISHED', title: 'Кукуруза продовольственная · Ставрополье', culture: 'corn', crop: 'corn', volumeTon: 200, volumeTons: 200, priceRubPerTon: 13500, startPrice: 13500, region: 'Ставропольский край', sellerId: 'farmer2@demo.ru', auctionType: 'INSTANT_OFFER' },
];

const CROP_RU: Record<string, string> = { wheat: 'Пшеница', barley: 'Ячмень', corn: 'Кукуруза', sunflower: 'Подсолнечник' };
const STATUS_RU: Record<string, string> = { PUBLISHED: 'Открыт', AUCTION_OPEN: 'Торги идут', BIDDING: 'Торги', OPEN: 'Открыт', MATCHED: 'Сделка' };

async function getLots(): Promise<Lot[]> {
  try {
    const res = await apiServer<any>('/lots');
    const items: Lot[] = Array.isArray(res?.items) ? res.items : Array.isArray(res) ? res : [];
    return items.length ? items : SEED;
  } catch {
    return SEED;
  }
}

export default async function LotsPage() {
  const lots = await getLots();
  const openLots = lots.filter((lot) => ['PUBLISHED', 'AUCTION_OPEN', 'BIDDING', 'OPEN'].includes(lot.status));

  return (
    <PageAccessGuard
      allowedRoles={[...TRADING_ROLES, 'LOGISTICIAN', 'EXECUTIVE', 'ACCOUNTING']}
      title="Каталог лотов доступен участникам рынка"
      subtitle="Для просмотра лотов и участия в торгах необходимо войти.">
      <AppShell title="Лоты и торги" subtitle="Активные зерновые партии — от торгов до execution rail">
        <div className="space-y-6">
          <Breadcrumbs items={[{ href: '/', label: 'Главная' }, { label: 'Лоты' }]} />

          <div className="hero-card">
            <div className="eyebrow">Каталог лотов</div>
            <h1 style={{ fontSize: 28, fontWeight: 800, marginTop: 8 }}>Активные зерновые партии</h1>
            <div className="muted" style={{ marginTop: 8, maxWidth: 760 }}>
              Только лоты, которые можно конвертировать в сделку. Торги → winner selection → execution rail.
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 14, flexWrap: 'wrap' }}>
              <Link href="/lots/create" className="primary-link">Создать лот</Link>
              <Link href="/auctions" className="secondary-link">Перейти к торгам</Link>
              <Link href="/market-center" className="secondary-link">Цены и netback</Link>
            </div>
          </div>

          <LotsFilterClient />

          <div className="stack-sm">
            {openLots.length === 0 ? (
              <div className="soft-box subtle">
                <div style={{ fontWeight: 600, marginBottom: 6 }}>Активных лотов пока нет</div>
                <div className="muted small">Создайте лот или проверьте позже — рынок обновляется ежедневно.</div>
                <div style={{ marginTop: 12 }}>
                  <Link href="/lots/create" className="primary-link">Создать первый лот</Link>
                </div>
              </div>
            ) : openLots.map((lot) => {
              const cropKey = lot.culture || lot.crop || '';
              const cropRu = CROP_RU[cropKey] || cropKey;
              const price = lot.priceRubPerTon ?? lot.startPrice ?? 0;
              const volume = lot.volumeTon ?? lot.volumeTons ?? 0;
              const isAuction = lot.status === 'AUCTION_OPEN' || lot.status === 'BIDDING';
              return (
                <Link key={lot.id} href={`/lots/${lot.id}`} className="soft-box card-link">
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
                    <div>
                      <div style={{ fontWeight: 700 }}>{lot.title || `${cropRu} · ${lot.region}`}</div>
                      <div className="muted tiny" style={{ marginTop: 6 }}>
                        {cropRu} · {Number(volume).toLocaleString('ru-RU')} т · {lot.region}
                      </div>
                      {lot.auctionEndsAt && (
                        <div className="muted tiny" style={{ marginTop: 4 }}>
                          До {new Date(lot.auctionEndsAt).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        </div>
                      )}
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontWeight: 800 }}>{Number(price).toLocaleString('ru-RU')} ₽/т</div>
                      <div style={{ fontWeight: 500, color: '#666', fontSize: '0.8rem', marginTop: 2 }}>
                        {(Number(price) * Number(volume)).toLocaleString('ru-RU')} ₽ итого
                      </div>
                      <div className={`status-chip ${isAuction ? 'warning' : 'success'}`} style={{ marginTop: 6 }}>
                        {STATUS_RU[lot.status] || lot.status}
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </AppShell>
    </PageAccessGuard>
  );
}
