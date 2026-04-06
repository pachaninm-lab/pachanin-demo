import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AppShell } from '../../../components/app-shell';
import { Breadcrumbs } from '../../../components/breadcrumbs';
import { NextStepBar } from '../../../components/next-step-bar';
import { PageAccessGuard } from '../../../components/page-access-guard';
import { TRANSACTIONAL_ROLES } from '../../../lib/route-roles';
import { apiServer } from '../../../lib/api-server';

type Bid = { id: string; buyerOrgId: string; amount: number; submittedAt: string };
type Lot = {
  id: string; status: string; crop: string; volumeTon: number;
  priceRubPerTon: number; region: string; sellerId: string;
  auctionType?: string; auctionEndsAt?: string; bidsCount?: number;
  quality?: Record<string, number>; description?: string;
  bids?: Bid[];
};

const SEED: Record<string, Lot> = {
  'LOT-001': {
    id: 'LOT-001', status: 'BIDDING', crop: 'wheat', volumeTon: 500,
    priceRubPerTon: 14200, region: 'Краснодарский край', sellerId: 'farmer@demo.ru',
    auctionType: 'OPEN_AUCTION', bidsCount: 3, auctionEndsAt: '2026-04-07T18:00:00Z',
    quality: { protein: 13.2, moisture: 12.5, gluten: 28, impurity: 1.2 },
    description: 'Пшеница 3 класс, новый урожай, Краснодарский край',
    bids: [
      { id: 'BID-001', buyerOrgId: 'org-buyer-1', amount: 14200, submittedAt: '2026-04-05T10:00:00Z' },
      { id: 'BID-002', buyerOrgId: 'org-buyer-2', amount: 14350, submittedAt: '2026-04-05T11:30:00Z' },
      { id: 'BID-003', buyerOrgId: 'org-buyer-3', amount: 14500, submittedAt: '2026-04-06T09:00:00Z' },
    ],
  },
  'LOT-002': {
    id: 'LOT-002', status: 'OPEN', crop: 'barley', volumeTon: 300,
    priceRubPerTon: 12800, region: 'Ростовская область', sellerId: 'farmer@demo.ru',
    auctionType: 'PRIVATE_AUCTION', bidsCount: 1, auctionEndsAt: '2026-04-08T12:00:00Z',
    quality: { protein: 11.8, moisture: 13.1, impurity: 0.9 },
    description: 'Ячмень кормовой, элеватор Ростов-1',
    bids: [
      { id: 'BID-004', buyerOrgId: 'org-buyer-1', amount: 12800, submittedAt: '2026-04-06T08:00:00Z' },
    ],
  },
  'LOT-003': {
    id: 'LOT-003', status: 'MATCHED', crop: 'corn', volumeTon: 200,
    priceRubPerTon: 13500, region: 'Ставропольский край', sellerId: 'farmer@demo.ru',
    auctionType: 'INSTANT_OFFER', bidsCount: 0,
    quality: { moisture: 14.0, impurity: 1.5 },
    description: 'Кукуруза продовольственная',
    bids: [],
  },
};

const STATUS_RU: Record<string, string> = { DRAFT: 'Черновик', OPEN: 'Открыт', BIDDING: 'Торги идут', MATCHED: 'Сделка заключена', CLOSED: 'Закрыт' };
const AUCTION_TYPE_RU: Record<string, string> = { OPEN_AUCTION: 'Открытый аукцион', PRIVATE_AUCTION: 'Закрытый аукцион', INSTANT_OFFER: 'Мгновенная оферта', TARGET_ORDER: 'Целевой заказ' };
const CROP_RU: Record<string, string> = { wheat: 'Пшеница', barley: 'Ячмень', corn: 'Кукуруза', sunflower: 'Подсолнечник' };

async function load(id: string): Promise<Lot | null> {
  try {
    const res = await apiServer(`/lots/${id}`);
    return res?.id ? res : SEED[id] ?? null;
  } catch {
    return SEED[id] ?? null;
  }
}

export default async function AuctionDetailPage({ params }: { params: { id: string } }) {
  const lot = await load(params.id);
  if (!lot) notFound();

  const isActive = ['OPEN', 'BIDDING'].includes(lot.status);
  const cropRu = CROP_RU[lot.crop] || lot.crop;
  const bids = lot.bids || [];
  const bestBid = bids.length ? bids.reduce((b, c) => c.amount > b.amount ? c : b) : null;

  return (
    <PageAccessGuard allowedRoles={[...TRANSACTIONAL_ROLES, 'GUEST']}
      title="Доступ к торгам ограничен"
      subtitle="Торговая площадка доступна зарегистрированным участникам.">
      <AppShell title={`Торги ${lot.id}`} subtitle={`${cropRu} · ${lot.region} · ${AUCTION_TYPE_RU[lot.auctionType || ''] || lot.auctionType}`}>
        <div className="space-y-6">
          <Breadcrumbs items={[
            { href: '/', label: 'Главная' },
            { href: '/auctions', label: 'Торги' },
            { label: lot.id },
          ]} />

          {/* Header */}
          <div className="soft-box">
            <div style={{ display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
              <span className={`mini-chip ${isActive ? 'green' : 'gray'}`}>{STATUS_RU[lot.status] || lot.status}</span>
              {lot.auctionType && <span className="mini-chip">{AUCTION_TYPE_RU[lot.auctionType] || lot.auctionType}</span>}
              <span className="muted tiny">{cropRu}</span>
            </div>
            <h2 style={{ fontWeight: 700, fontSize: '1.2rem', marginBottom: 6 }}>
              {cropRu} · {Number(lot.volumeTon).toLocaleString('ru-RU')} т · {Number(lot.priceRubPerTon).toLocaleString('ru-RU')} ₽/т
            </h2>
            <div className="muted small">{lot.description}</div>
            {lot.auctionEndsAt && (
              <div style={{ marginTop: 8, fontWeight: 600, color: isActive ? '#92400e' : 'inherit' }}>
                {isActive ? `⏱ Окончание: ${new Date(lot.auctionEndsAt).toLocaleString('ru-RU')}` : `Завершено: ${new Date(lot.auctionEndsAt).toLocaleString('ru-RU')}`}
              </div>
            )}
          </div>

          {/* Metrics */}
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            {[
              { label: 'Стартовая цена', value: `${Number(lot.priceRubPerTon).toLocaleString('ru-RU')} ₽/т` },
              { label: 'Лучшая заявка', value: bestBid ? `${bestBid.amount.toLocaleString('ru-RU')} ₽/т` : '—' },
              { label: 'Объём', value: `${Number(lot.volumeTon).toLocaleString('ru-RU')} т` },
              { label: 'Заявок', value: String(bids.length) },
            ].map((m) => (
              <div key={m.label} className="soft-box" style={{ flex: '1 1 100px', textAlign: 'center' }}>
                <div style={{ fontWeight: 700, fontSize: '1.05rem' }}>{m.value}</div>
                <div className="muted small">{m.label}</div>
              </div>
            ))}
          </div>

          {/* Quality */}
          {lot.quality && Object.keys(lot.quality).length > 0 && (
            <div className="soft-box">
              <div className="section-title" style={{ marginBottom: 8 }}>Качество</div>
              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                {Object.entries(lot.quality).map(([k, v]) => (
                  <div key={k}>
                    <span className="muted small">{k === 'protein' ? 'Белок' : k === 'moisture' ? 'Влажность' : k === 'gluten' ? 'Клейковина' : k === 'impurity' ? 'Сорность' : k}: </span>
                    <b>{v}%</b>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Bid list */}
          <div>
            <div className="section-title" style={{ marginBottom: 8 }}>Заявки ({bids.length})</div>
            {bids.length === 0 ? (
              <div className="soft-box muted">Заявок пока нет.</div>
            ) : (
              <div className="section-stack">
                {[...bids].sort((a, b) => b.amount - a.amount).map((bid, i) => (
                  <div key={bid.id} className="soft-box" style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    borderLeft: i === 0 ? '3px solid var(--color-green, #22c55e)' : undefined,
                  }}>
                    <div>
                      <div style={{ fontWeight: i === 0 ? 700 : 400 }}>
                        {bid.amount.toLocaleString('ru-RU')} ₽/т
                        {i === 0 && <span className="mini-chip green" style={{ marginLeft: 8 }}>Лучшая</span>}
                      </div>
                      <div className="muted tiny">{bid.buyerOrgId} · {new Date(bid.submittedAt).toLocaleString('ru-RU')}</div>
                    </div>
                    <span className="mini-chip gray">{bid.id}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Action area */}
          {isActive && (
            <div className="soft-box" style={{ background: 'var(--color-green-soft, #f0fdf4)' }}>
              <div className="section-title" style={{ marginBottom: 6 }}>Подать заявку</div>
              <div className="muted small" style={{ marginBottom: 10 }}>
                Войдите как покупатель (BUYER) и подайте заявку через API: POST /api/lots/{lot.id}/bids
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <span className="mini-chip">POST /api/lots/{lot.id}/bids</span>
                <span className="mini-chip gray">{'{"amount": 14600}'}</span>
              </div>
            </div>
          )}

          {lot.status === 'MATCHED' && (
            <div className="soft-box" style={{ background: 'var(--color-amber-soft, #fef3c7)' }}>
              <div style={{ fontWeight: 700 }}>Лот сматчирован — сделка создана</div>
              <div className="muted small" style={{ marginTop: 4 }}>Перейдите в сделки для продолжения процесса исполнения.</div>
              <div style={{ marginTop: 8 }}>
                <Link href="/deals" className="mini-chip">Открыть сделки →</Link>
              </div>
            </div>
          )}

          {/* Navigation */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Link href={`/lots/${lot.id}`} className="mini-chip">Карточка лота</Link>
            <Link href="/auctions" className="mini-chip">← Все торги</Link>
            <Link href="/deals" className="mini-chip">Сделки</Link>
            <Link href="/documents" className="mini-chip">Документы</Link>
          </div>

          <NextStepBar
            title={isActive ? `Торги активны: ${bids.length} заявок, лучшая ${bestBid ? bestBid.amount.toLocaleString('ru-RU') + ' ₽/т' : '—'}` : 'Торги завершены'}
            detail={isActive ? 'Подайте заявку до окончания аукциона. Победитель получит автоматически сформированную сделку.' : 'Сделка переходит в execution rail.'}
            primary={{ href: '/deals', label: 'Сделки' }}
            secondary={[{ href: '/auctions', label: 'Все торги' }, { href: '/lots', label: 'Все лоты' }]}
          />
        </div>
      </AppShell>
    </PageAccessGuard>
  );
}
