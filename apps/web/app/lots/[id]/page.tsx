import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AppShell } from '../../../components/app-shell';
import { Breadcrumbs } from '../../../components/breadcrumbs';
import { DetailHero } from '../../../components/detail-hero';
import { NextStepBar } from '../../../components/next-step-bar';
import { PageAccessGuard } from '../../../components/page-access-guard';
import { TRANSACTIONAL_ROLES } from '../../../lib/route-roles';
import { apiServer } from '../../../lib/api-server';

type Lot = {
  id: string; status: string; crop: string; volumeTon: number;
  priceRubPerTon: number; region: string; sellerId: string;
  quality?: { protein?: number; moisture?: number; gluten?: number; impurity?: number };
  auctionType?: string; auctionEndsAt?: string; bidsCount?: number;
  description?: string; createdAt?: string;
};

const SEED: Record<string, Lot> = {
  'LOT-001': { id: 'LOT-001', status: 'BIDDING', crop: 'wheat', volumeTon: 500, priceRubPerTon: 14200, region: 'Краснодарский край', sellerId: 'farmer@demo.ru', auctionType: 'OPEN_AUCTION', bidsCount: 3, auctionEndsAt: '2026-04-07T18:00:00Z', quality: { protein: 13.2, moisture: 12.5, gluten: 28, impurity: 1.2 }, description: 'Пшеница 3 класс, новый урожай, Краснодарский край', createdAt: '2026-03-28T09:00:00Z' },
  'LOT-002': { id: 'LOT-002', status: 'OPEN', crop: 'barley', volumeTon: 300, priceRubPerTon: 12800, region: 'Ростовская область', sellerId: 'farmer@demo.ru', auctionType: 'PRIVATE_AUCTION', bidsCount: 1, auctionEndsAt: '2026-04-08T12:00:00Z', quality: { protein: 11.8, moisture: 13.1, impurity: 0.9 }, description: 'Ячмень кормовой, элеватор Ростов-1', createdAt: '2026-04-01T10:00:00Z' },
  'LOT-003': { id: 'LOT-003', status: 'MATCHED', crop: 'corn', volumeTon: 200, priceRubPerTon: 13500, region: 'Ставропольский край', sellerId: 'farmer@demo.ru', auctionType: 'INSTANT_OFFER', quality: { moisture: 14.0, impurity: 1.5 }, description: 'Кукуруза продовольственная, сертифицировано ФГИС', createdAt: '2026-04-03T08:00:00Z' },
};

const STATUS_RU: Record<string, string> = { DRAFT: 'Черновик', OPEN: 'Открыт', BIDDING: 'Торги идут', MATCHED: 'Сделка', CLOSED: 'Закрыт', CANCELLED: 'Отменён' };
const STATUS_COLOR: Record<string, string> = { BIDDING: 'amber', OPEN: 'green', MATCHED: 'gray', CLOSED: 'gray', DRAFT: 'gray', CANCELLED: 'red' };
const CROP_RU: Record<string, string> = { wheat: 'Пшеница', barley: 'Ячмень', corn: 'Кукуруза', sunflower: 'Подсолнечник' };
const AUCTION_TYPE_RU: Record<string, string> = { OPEN_AUCTION: 'Открытый аукцион', PRIVATE_AUCTION: 'Закрытый аукцион', INSTANT_OFFER: 'Мгновенная оферта', TARGET_ORDER: 'Целевой заказ' };

async function load(id: string): Promise<Lot | null> {
  try {
    const res = await apiServer(`/lots/${id}`);
    return res?.id ? res : SEED[id] ?? null;
  } catch {
    return SEED[id] ?? null;
  }
}

export default async function LotDetailPage({ params }: { params: { id: string } }) {
  const lot = await load(params.id);
  if (!lot) notFound();

  const total = Number(lot.volumeTon) * Number(lot.priceRubPerTon);
  const cropRu = CROP_RU[lot.crop] || lot.crop;
  const isActive = ['OPEN', 'BIDDING'].includes(lot.status);

  return (
    <PageAccessGuard allowedRoles={[...TRANSACTIONAL_ROLES, 'GUEST']}
      title="Доступ к лоту ограничен"
      subtitle="Детали лота доступны зарегистрированным участникам.">
      <AppShell title={`Лот ${lot.id}`} subtitle={`${cropRu} · ${lot.region}`}>
        <div className="space-y-6">
          <Breadcrumbs items={[
            { href: '/', label: 'Главная' },
            { href: '/lots', label: 'Лоты' },
            { label: lot.id },
          ]} />

          <DetailHero
            kicker={`Лот ${lot.id}`}
            title={`${cropRu} · ${Number(lot.volumeTon).toLocaleString('ru-RU')} т`}
            description={lot.description || `${cropRu}, ${lot.region}. Продавец: ${lot.sellerId}.`}
            chips={[
              STATUS_RU[lot.status] || lot.status,
              cropRu,
              lot.region,
              lot.auctionType ? AUCTION_TYPE_RU[lot.auctionType] || lot.auctionType : '',
            ].filter(Boolean)}
            nextStep={isActive ? `Подать заявку до ${lot.auctionEndsAt ? new Date(lot.auctionEndsAt).toLocaleDateString('ru-RU') : 'окончания торгов'}` : STATUS_RU[lot.status] || lot.status}
            owner={`Продавец: ${lot.sellerId}`}
            blockers={isActive ? 'Торги активны — подайте заявку своевременно' : 'Лот не активен'}
            actions={[
              ...(isActive ? [{ href: `/auctions/${lot.id}`, label: 'Участвовать в торгах' }] : []),
              { href: '/auctions', label: 'Все торги', variant: 'secondary' as const },
              { href: '/deals', label: 'Сделки', variant: 'secondary' as const },
            ]}
          />

          {/* Key metrics */}
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            {[
              { label: 'Объём', value: `${Number(lot.volumeTon).toLocaleString('ru-RU')} т` },
              { label: 'Цена/т', value: `${Number(lot.priceRubPerTon).toLocaleString('ru-RU')} ₽` },
              { label: 'Сумма', value: `${total.toLocaleString('ru-RU')} ₽` },
              { label: 'Заявок', value: lot.bidsCount != null ? String(lot.bidsCount) : '—' },
            ].map((m) => (
              <div key={m.label} className="soft-box" style={{ flex: '1 1 100px', textAlign: 'center' }}>
                <div style={{ fontWeight: 700, fontSize: '1.1rem' }}>{m.value}</div>
                <div className="muted small">{m.label}</div>
              </div>
            ))}
          </div>

          {/* Status + auction */}
          <div className="soft-box">
            <div className="section-title" style={{ marginBottom: 8 }}>Статус и торги</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
              <span className={`mini-chip ${STATUS_COLOR[lot.status] || 'gray'}`}>{STATUS_RU[lot.status] || lot.status}</span>
              {lot.auctionType && <span className="mini-chip">{AUCTION_TYPE_RU[lot.auctionType] || lot.auctionType}</span>}
            </div>
            <div className="muted small">
              {lot.bidsCount != null ? `Заявок: ${lot.bidsCount}` : ''}
              {lot.auctionEndsAt ? ` · Окончание торгов: ${new Date(lot.auctionEndsAt).toLocaleDateString('ru-RU')}` : ''}
              {lot.createdAt ? ` · Создан: ${new Date(lot.createdAt).toLocaleDateString('ru-RU')}` : ''}
            </div>
          </div>

          {/* Quality */}
          {lot.quality && Object.keys(lot.quality).length > 0 && (
            <div>
              <div className="section-title" style={{ marginBottom: 8 }}>Качественные характеристики</div>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                {lot.quality.protein != null && (
                  <div className="soft-box" style={{ flex: '1 1 100px', textAlign: 'center' }}>
                    <div style={{ fontWeight: 700 }}>{lot.quality.protein}%</div>
                    <div className="muted small">Белок</div>
                  </div>
                )}
                {lot.quality.moisture != null && (
                  <div className="soft-box" style={{ flex: '1 1 100px', textAlign: 'center' }}>
                    <div style={{ fontWeight: 700 }}>{lot.quality.moisture}%</div>
                    <div className="muted small">Влажность</div>
                  </div>
                )}
                {lot.quality.gluten != null && (
                  <div className="soft-box" style={{ flex: '1 1 100px', textAlign: 'center' }}>
                    <div style={{ fontWeight: 700 }}>{lot.quality.gluten}%</div>
                    <div className="muted small">Клейковина</div>
                  </div>
                )}
                {lot.quality.impurity != null && (
                  <div className="soft-box" style={{ flex: '1 1 100px', textAlign: 'center' }}>
                    <div style={{ fontWeight: 700 }}>{lot.quality.impurity}%</div>
                    <div className="muted small">Сорность</div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Seller info */}
          <div className="soft-box">
            <div className="section-title" style={{ marginBottom: 8 }}>Продавец</div>
            <div style={{ fontWeight: 700 }}>{lot.sellerId}</div>
            <div className="muted small" style={{ marginTop: 4 }}>Регион: {lot.region}</div>
          </div>

          {/* Links */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {isActive && <Link href={`/auctions/${lot.id}`} className="mini-chip green">Участвовать в торгах →</Link>}
            <Link href="/lots" className="mini-chip">← Все лоты</Link>
            <Link href="/auctions" className="mini-chip">Торговая площадка</Link>
            <Link href="/lab" className="mini-chip">Лаборатория</Link>
            <Link href="/documents" className="mini-chip">Документы</Link>
          </div>

          <NextStepBar
            title={isActive ? 'Торги активны — подавайте заявку' : 'Лот завершён'}
            detail={isActive
              ? `Открытый аукцион заканчивается ${lot.auctionEndsAt ? new Date(lot.auctionEndsAt).toLocaleDateString('ru-RU') : 'скоро'}. Текущих заявок: ${lot.bidsCount ?? 0}.`
              : 'Лот перешёл в следующий статус. Откройте связанную сделку.'}
            primary={{ href: isActive ? `/auctions/${lot.id}` : '/deals', label: isActive ? 'Торговая площадка' : 'Сделки' }}
            secondary={[{ href: '/lots', label: 'Все лоты' }, { href: '/market-center', label: 'Market center' }]}
          />
        </div>
      </AppShell>
    </PageAccessGuard>
  );
}
