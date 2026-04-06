import Link from 'next/link';
import { AppShell } from '../../../components/app-shell';
import { Breadcrumbs } from '../../../components/breadcrumbs';
import { PageAccessGuard } from '../../../components/page-access-guard';
import { SELLER_ROLES } from '../../../lib/route-roles';

const CROPS = [
  { value: 'wheat', label: 'Пшеница' },
  { value: 'barley', label: 'Ячмень' },
  { value: 'corn', label: 'Кукуруза' },
  { value: 'sunflower', label: 'Подсолнечник' },
  { value: 'oat', label: 'Овёс' },
  { value: 'rye', label: 'Рожь' },
];

const AUCTION_TYPES = [
  { value: 'OPEN_AUCTION', label: 'Открытый аукцион', desc: 'Все участники видят заявки' },
  { value: 'PRIVATE_AUCTION', label: 'Закрытый аукцион', desc: 'Заявки скрыты' },
  { value: 'INSTANT_OFFER', label: 'Мгновенная оферта', desc: 'Продажа по фиксированной цене' },
  { value: 'TARGET_ORDER', label: 'Целевой заказ', desc: 'Адресная продажа конкретному покупателю' },
];

export default function CreateLotPage() {
  return (
    <PageAccessGuard allowedRoles={[...SELLER_ROLES]}
      title="Создание лота ограничено"
      subtitle="Создавать лоты могут только продавцы (FARMER) и операторы.">
      <AppShell title="Создать лот" subtitle="Новый лот для торговой площадки">
        <div className="space-y-6">
          <Breadcrumbs items={[
            { href: '/', label: 'Главная' },
            { href: '/lots', label: 'Лоты' },
            { label: 'Создать' },
          ]} />

          {/* Info banner */}
          <div className="soft-box" style={{ background: 'var(--color-green-soft, #f0fdf4)' }}>
            <div style={{ fontWeight: 700, marginBottom: 4 }}>Создание лота через API</div>
            <div className="muted small" style={{ marginBottom: 8 }}>
              Форма демонстрирует структуру данных. Реальное создание — POST /api/lots
            </div>
            <div style={{ fontFamily: 'monospace', fontSize: '0.8rem', background: 'white', padding: '8px 12px', borderRadius: 6, border: '1px solid var(--color-border, #e5e7eb)' }}>
              {`POST /api/lots\n{\n  "crop": "wheat",\n  "volumeTon": 500,\n  "priceRubPerTon": 14200,\n  "region": "Краснодарский край",\n  "auctionType": "OPEN_AUCTION",\n  "quality": { "protein": 13.2, "moisture": 12.5 }\n}`}
            </div>
          </div>

          {/* Form fields (static display) */}
          <div className="soft-box">
            <div className="section-title" style={{ marginBottom: 12 }}>Основные параметры</div>

            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
              <div style={{ flex: '1 1 200px' }}>
                <div className="muted small" style={{ marginBottom: 4 }}>Культура *</div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {CROPS.map((c) => (
                    <span key={c.value} className="mini-chip" style={{ cursor: 'pointer' }}>{c.label}</span>
                  ))}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
              <div style={{ flex: '1 1 140px' }}>
                <div className="muted small" style={{ marginBottom: 4 }}>Объём (т) *</div>
                <div className="soft-box" style={{ fontFamily: 'monospace', color: 'var(--color-muted)' }}>500</div>
              </div>
              <div style={{ flex: '1 1 140px' }}>
                <div className="muted small" style={{ marginBottom: 4 }}>Цена (₽/т) *</div>
                <div className="soft-box" style={{ fontFamily: 'monospace', color: 'var(--color-muted)' }}>14200</div>
              </div>
            </div>

            <div style={{ marginBottom: 12 }}>
              <div className="muted small" style={{ marginBottom: 4 }}>Регион *</div>
              <div className="soft-box" style={{ color: 'var(--color-muted)' }}>Краснодарский край</div>
            </div>
          </div>

          {/* Auction type */}
          <div className="soft-box">
            <div className="section-title" style={{ marginBottom: 12 }}>Тип торгов *</div>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              {AUCTION_TYPES.map((t) => (
                <div key={t.value} className="soft-box" style={{ flex: '1 1 160px', cursor: 'pointer' }}>
                  <div style={{ fontWeight: 700, fontSize: '0.85rem' }}>{t.label}</div>
                  <div className="muted tiny" style={{ marginTop: 2 }}>{t.desc}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Quality */}
          <div className="soft-box">
            <div className="section-title" style={{ marginBottom: 12 }}>Качественные характеристики</div>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              {[
                { label: 'Белок (%)', key: 'protein' },
                { label: 'Влажность (%)', key: 'moisture' },
                { label: 'Клейковина (%)', key: 'gluten' },
                { label: 'Сорность (%)', key: 'impurity' },
              ].map((f) => (
                <div key={f.key} style={{ flex: '1 1 120px' }}>
                  <div className="muted small" style={{ marginBottom: 4 }}>{f.label}</div>
                  <div className="soft-box" style={{ fontFamily: 'monospace', color: 'var(--color-muted)' }}>—</div>
                </div>
              ))}
            </div>
          </div>

          {/* API hint */}
          <div className="soft-box">
            <div className="section-title" style={{ marginBottom: 8 }}>Статусная машина лота</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {['DRAFT', 'OPEN', 'BIDDING', 'MATCHED', 'CLOSED'].map((s, i, arr) => (
                <span key={s} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span className="mini-chip">{s}</span>
                  {i < arr.length - 1 && <span className="muted">→</span>}
                </span>
              ))}
            </div>
            <div className="muted small" style={{ marginTop: 8 }}>
              PATCH /api/lots/{'{id}'}/status — для смены статуса. Валидация через status-policy-engine.
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Link href="/lots" className="mini-chip">← Все лоты</Link>
            <Link href="/auctions" className="mini-chip">Торговая площадка</Link>
          </div>
        </div>
      </AppShell>
    </PageAccessGuard>
  );
}
