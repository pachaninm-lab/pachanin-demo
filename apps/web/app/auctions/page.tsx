import Link from 'next/link';
import { AppShell } from '../../components/app-shell';
import { Breadcrumbs } from '../../components/breadcrumbs';
import { DetailHero } from '../../components/detail-hero';
import { NextStepBar } from '../../components/next-step-bar';
import { PageAccessGuard } from '../../components/page-access-guard';
import { TRANSACTIONAL_ROLES } from '../../lib/route-roles';
import { apiServer } from '../../lib/api-server';

type Lot = {
  id: string; status: string; crop: string; volumeTon: number;
  priceRubPerTon: number; region: string; sellerId: string;
  auctionType?: string; auctionEndsAt?: string; bidsCount?: number;
};

const SEED: Lot[] = [
  { id: 'LOT-001', status: 'BIDDING', crop: 'wheat', volumeTon: 500, priceRubPerTon: 14200,
    region: 'Краснодарский край', sellerId: 'farmer@demo.ru',
    auctionType: 'OPEN_AUCTION', bidsCount: 3, auctionEndsAt: '2026-04-07T18:00:00Z' },
  { id: 'LOT-002', status: 'OPEN', crop: 'barley', volumeTon: 300, priceRubPerTon: 12800,
    region: 'Ростовская область', sellerId: 'farmer@demo.ru',
    auctionType: 'PRIVATE_AUCTION', bidsCount: 1, auctionEndsAt: '2026-04-08T12:00:00Z' },
  { id: 'LOT-003', status: 'MATCHED', crop: 'corn', volumeTon: 200, priceRubPerTon: 13500,
    region: 'Ставропольский край', sellerId: 'farmer@demo.ru',
    auctionType: 'INSTANT_OFFER' },
];

const AUCTION_TYPES: Record<string, string> = {
  OPEN_AUCTION: 'Открытый аукцион',
  PRIVATE_AUCTION: 'Закрытый аукцион',
  INSTANT_OFFER: 'Мгновенная оферта',
  TARGET_ORDER: 'Целевой заказ',
};
const CROP_RU: Record<string, string> = { wheat: 'Пшеница', barley: 'Ячмень', corn: 'Кукуруза', sunflower: 'Подсолнечник' };
const STATUS_COLOR: Record<string, string> = { BIDDING: 'amber', OPEN: 'green', MATCHED: 'gray', CLOSED: 'gray' };
const STATUS_RU: Record<string, string> = { BIDDING: 'Торги идут', OPEN: 'Открыт', MATCHED: 'Сделка заключена', CLOSED: 'Закрыт' };

async function load(): Promise<Lot[]> {
  try {
    const res = await apiServer('/lots');
    const items: Lot[] = Array.isArray(res?.items) ? res.items : res?.length ? res : SEED;
    return items.filter((l) => l.auctionType || ['BIDDING', 'OPEN'].includes(l.status));
  } catch { return SEED; }
}

export default async function AuctionsPage() {
  const lots = await load();
  const active = lots.filter((l) => ['BIDDING', 'OPEN'].includes(l.status));
  const totalVolume = lots.reduce((s, l) => s + Number(l.volumeTon || 0), 0);

  return (
    <PageAccessGuard allowedRoles={[...TRANSACTIONAL_ROLES, 'GUEST']}
      title="Доступ к торгам ограничен"
      subtitle="Торговая площадка доступна зарегистрированным участникам.">
      <AppShell title="Торги" subtitle="Торговый origin layer: auction, instant offer, target order, operator-managed sale">
        <div className="space-y-6">
          <Breadcrumbs items={[{ href: '/', label: 'Главная' }, { label: 'Торги' }]} />

          <DetailHero
            kicker="Trade floor"
            title="Торговая площадка — аукционы, оферты и целевые заказы"
            description="Лот проходит путь: создание → публикация → торги → матчинг → сделка. Все типы торгов в одном контуре."
            chips={[`лотов ${lots.length}`, `активных ${active.length}`, `объём ${totalVolume.toLocaleString('ru-RU')} т`]}
            nextStep={active.length ? `Участвовать в ${active.length} активных торгах` : 'Активных торгов нет'}
            owner="farmer / buyer"
            blockers="Лот без валидных реквизитов не публикуется"
            actions={[
              { href: '/lots', label: 'Все лоты' },
              { href: '/deals', label: 'Сделки', variant: 'secondary' },
              { href: '/documents', label: 'Документы', variant: 'secondary' },
            ]}
          />

          {lots.length === 0 && (
            <div className="soft-box text-center muted">Активных торгов нет.</div>
          )}

          <div className="section-stack">
            {lots.map((l) => (
              <div key={l.id} className="soft-box"
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
                    <span className={`mini-chip ${STATUS_COLOR[l.status] || 'gray'}`}>{STATUS_RU[l.status] || l.status}</span>
                    {l.auctionType && <span className="mini-chip">{AUCTION_TYPES[l.auctionType] || l.auctionType}</span>}
                    <span className="muted tiny">{CROP_RU[l.crop] || l.crop}</span>
                  </div>
                  <div style={{ fontWeight: 700 }}>{l.id} · {l.region}</div>
                  <div className="muted small" style={{ marginTop: 4 }}>
                    {Number(l.volumeTon).toLocaleString('ru-RU')} т · {Number(l.priceRubPerTon).toLocaleString('ru-RU')} ₽/т
                  </div>
                  <div className="muted tiny" style={{ marginTop: 4 }}>
                    {l.bidsCount != null ? `Заявок: ${l.bidsCount}` : ''}
                    {l.auctionEndsAt ? ` · Окончание: ${new Date(l.auctionEndsAt).toLocaleDateString('ru-RU')}` : ''}
                  </div>
                </div>
                <Link href={`/auctions/${l.id}`} className="mini-chip">Открыть →</Link>
              </div>
            ))}
          </div>

          <NextStepBar
            title="Торги — точка входа в сделку"
            detail="После матчинга система автоматически создаёт сделку и запускает execution rail."
            primary={{ href: '/lots', label: 'Все лоты' }}
            secondary={[{ href: '/deals', label: 'Сделки' }, { href: '/market-center', label: 'Market center' }]}
          />
        </div>
      </AppShell>
    </PageAccessGuard>
  );
}
