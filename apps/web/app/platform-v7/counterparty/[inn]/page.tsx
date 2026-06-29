import type { Metadata } from 'next';
import { CounterpartyTrustCard, type CounterpartyTrust, type Verification } from '@/components/platform-v7/VerificationBadge';
import { IntegrationStatusWidget } from '@/components/platform-v7/IntegrationStatusWidget';

export function generateMetadata({ params }: { params: { inn: string } }): Metadata {
  return {
    title: `Контрагент ИНН ${params.inn}`,
    description: `Профиль контрагента с рейтингами, верификацией и историей сделок.`,
  };
}

function getCounterpartyDemo(inn: string): CounterpartyTrust {
  return {
    orgId: `org-${inn}`,
    inn,
    name: inn === '6164065090'
      ? 'ООО «АгроТрейд Юг»'
      : inn === '2309160154'
      ? 'ИП Ковалёв Сергей Александрович'
      : `Организация ИНН ${inn}`,
    verifications: [
      { source: 'EGRUL',     level: 'VERIFIED', verifiedAt: '2024-01-15T00:00:00Z' },
      { source: 'FNS',       level: 'VERIFIED', verifiedAt: '2024-02-01T00:00:00Z' },
      { source: 'FGIS_ZERNO', level: inn === '2309160154' ? 'PARTIAL' : 'VERIFIED', verifiedAt: '2024-02-10T00:00:00Z', note: inn === '2309160154' ? 'Частичная верификация: 2 из 4 партий' : undefined },
      { source: 'AML',       level: 'VERIFIED', verifiedAt: '2024-01-20T00:00:00Z' },
      { source: 'SPARK',     level: 'VERIFIED', verifiedAt: '2024-03-01T00:00:00Z' },
      { source: 'UKEP',      level: inn === '6164065090' ? 'VERIFIED' : 'PENDING', note: inn !== '6164065090' ? 'Сертификат в процессе выпуска' : undefined },
    ] satisfies Verification[],
    riskScore: inn === '6164065090' ? 18 : inn === '2309160154' ? 42 : 35,
    dealCount: inn === '6164065090' ? 47 : 12,
    rating: inn === '6164065090' ? 4.8 : 4.2,
  };
}

const DEAL_HISTORY = [
  { dealId: 'DL-9106', culture: 'Пшеница 3кл', volumeTons: 120, status: 'В пути', amountRub: 9_650_000, date: '2024-03-01' },
  { dealId: 'DL-9102', culture: 'Ячмень 2кл',  volumeTons: 85,  status: 'Спор',   amountRub: 6_240_000, date: '2024-02-15' },
  { dealId: 'DL-9095', culture: 'Кукуруза',     volumeTons: 200, status: 'Закрыт', amountRub: 12_800_000, date: '2024-01-20' },
];

const REVIEWS = [
  { id: 'r1', author: 'ООО «ЗернэкспортТрейд»', role: 'Покупатель', rating: 5, dealId: 'DL-9095', date: '2024-01-25', text: 'Документы по кукурузе пришли вовремя. СДИЗ и ЭТрН подписаны без замечаний. Вес сошёлся — спора не было. Рекомендую.', verified: true },
  { id: 'r2', author: 'Элеватор ТМБ-03',        role: 'Элеватор',   rating: 4, dealId: 'DL-9095', date: '2024-01-22', text: 'Качество партии в норме, протокол выдан с первого отбора. Небольшая задержка с акт приёмки — менеджер долго согласовывал форму.', verified: true },
  { id: 'r3', author: 'Логист ИП Кравцов В.Е.',  role: 'Перевозчик', rating: 5, dealId: 'DL-9102', date: '2024-02-20', text: 'Загрузка прошла точно по графику. ЭТрН выставлен сразу, данные в ГИС ЭПД переданы без ручных правок.', verified: false },
];

function StarRating({ value }: { value: number }) {
  return (
    <span aria-label={`Рейтинг ${value} из 5`} style={{ fontSize: 13, letterSpacing: 1 }}>
      {[1,2,3,4,5].map((s) => (
        <span key={s} style={{ color: s <= value ? '#FBBF24' : '#CBD5E1' }}>★</span>
      ))}
    </span>
  );
}

function RatingBar({ label, count, total }: { label: string; count: number; total: number }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: 11 }}>
      <span style={{ color: '#FBBF24', minWidth: 14 }}>{label}★</span>
      <div style={{ flex: 1, height: 6, borderRadius: 3, background: 'var(--p7-color-border, #24342F)', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: '#FBBF24', borderRadius: 3 }} />
      </div>
      <span style={{ color: 'var(--pc-text-muted)', minWidth: 16 }}>{count}</span>
    </div>
  );
}

export default function CounterpartyProfilePage({ params }: { params: { inn: string } }) {
  const trust = getCounterpartyDemo(params.inn);

  return (
    <main style={{ display: 'grid', gap: 16, padding: '4px 0 24px', maxWidth: 860, margin: '0 auto' }}>
      {/* Header */}
      <section style={{ background: 'var(--p7-color-surface, #0E1A18)', border: '1px solid var(--p7-color-border, #24342F)', borderRadius: 16, padding: '1.5rem', display: 'grid', gap: '1rem' }}>
        <div>
          <div className="caption" style={{ marginBottom: '0.25rem' }}>Контрагент</div>
          <h1 className="heading-3" style={{ margin: 0 }}>{trust.name}</h1>
          <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem', fontSize: 'var(--text-sm)', color: 'var(--pc-text-muted)' }}>
            <span className="mono">ИНН {trust.inn}</span>
            {trust.dealCount && <span>{trust.dealCount} сделок</span>}
            {trust.rating && <span>★ {trust.rating}</span>}
          </div>
        </div>
        <CounterpartyTrustCard trust={trust} />
      </section>

      {/* Deal history */}
      <section style={{ background: 'var(--p7-color-surface, #0E1A18)', border: '1px solid var(--p7-color-border, #24342F)', borderRadius: 16, padding: '1.25rem', display: 'grid', gap: '0.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 className="heading-4" style={{ margin: 0 }}>История сделок</h2>
          <span className="caption">данные демо</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
          {DEAL_HISTORY.map((deal) => (
            <a
              key={deal.dealId}
              href={`/platform-v7/deals/${deal.dealId}/clean`}
              className="hover-row"
              style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.625rem 0.75rem', borderRadius: '8px', textDecoration: 'none', color: 'inherit' }}
            >
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)', color: 'var(--p7-color-brand)', fontWeight: 700, minWidth: '5rem' }}>{deal.dealId}</span>
              <span style={{ flex: 1, fontSize: 'var(--text-sm)' }}>{deal.culture} · {deal.volumeTons} т</span>
              <span
                className="status-badge"
                data-status={deal.status === 'Закрыт' ? 'closed' : deal.status === 'Спор' ? 'dispute' : 'active'}
              >
                {deal.status}
              </span>
              <span style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--pc-text-primary)', flexShrink: 0 }}>
                {new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 }).format(deal.amountRub)}
              </span>
              <span style={{ fontSize: 'var(--text-xs)', color: 'var(--pc-text-muted)', flexShrink: 0 }}>
                {new Date(deal.date).toLocaleDateString('ru-RU')}
              </span>
            </a>
          ))}
        </div>
      </section>

      {/* Reviews & ratings — Блок 9 */}
      <section style={{ background: 'var(--p7-color-surface, #0E1A18)', border: '1px solid var(--p7-color-border, #24342F)', borderRadius: 16, padding: '1.25rem', display: 'grid', gap: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
          <h2 className="heading-4" style={{ margin: 0 }}>Рейтинг и отзывы</h2>
          <span className="caption">от верифицированных участников</span>
        </div>

        {/* Rating summary */}
        <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '1rem', alignItems: 'center' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 36, fontWeight: 900, color: 'var(--pc-text-primary)', lineHeight: 1 }}>{trust.rating?.toFixed(1) ?? '—'}</div>
            <StarRating value={Math.round(trust.rating ?? 0)} />
            <div style={{ fontSize: 10, color: 'var(--pc-text-muted)', marginTop: 4 }}>{REVIEWS.length} отзыва</div>
          </div>
          <div style={{ display: 'grid', gap: '0.25rem' }}>
            {[5,4,3,2,1].map((s) => (
              <RatingBar key={s} label={String(s)} count={REVIEWS.filter((r) => r.rating === s).length} total={REVIEWS.length} />
            ))}
          </div>
        </div>

        {/* Individual reviews */}
        <div style={{ display: 'grid', gap: '0.75rem' }}>
          {REVIEWS.map((review) => (
            <div key={review.id} style={{ padding: '0.875rem', borderRadius: 10, background: 'var(--p7-color-surface-muted, #14211D)', border: '1px solid var(--p7-color-border, #24342F)', display: 'grid', gap: '0.375rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.375rem' }}>
                <div>
                  <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--pc-text-primary)' }}>{review.author}</span>
                  {' '}
                  <span style={{ fontSize: 10, color: 'var(--pc-text-muted)' }}>· {review.role}</span>
                  {review.verified && (
                    <span style={{ marginLeft: 6, fontSize: 9, fontWeight: 700, color: '#0A7A5F', background: 'rgba(10,122,95,0.1)', border: '1px solid rgba(10,122,95,0.2)', borderRadius: 4, padding: '1px 5px' }}>✓ верифицирован</span>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
                  <StarRating value={review.rating} />
                  <span style={{ fontSize: 9, color: 'var(--pc-text-muted)', fontFamily: 'var(--font-mono)' }}>{new Date(review.date).toLocaleDateString('ru-RU')}</span>
                </div>
              </div>
              <p style={{ margin: 0, fontSize: 12, color: 'var(--pc-text-secondary)', lineHeight: 1.55 }}>{review.text}</p>
              <div style={{ fontSize: 9, color: 'var(--pc-text-muted)', fontFamily: 'var(--font-mono)' }}>Сделка {review.dealId}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Guarantees block — Блок 9 */}
      <section style={{ background: 'var(--p7-color-surface, #0E1A18)', border: '1px solid var(--p7-color-border, #24342F)', borderRadius: 16, padding: '1.25rem', display: 'grid', gap: '0.75rem' }}>
        <h2 className="heading-4" style={{ margin: 0 }}>Гарантии сделки</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.5rem' }}>
          {[
            { icon: '🔒', title: 'Эскроу-расчёт', desc: 'Деньги резервируются на платформе и выплачиваются только после подтверждения приёмки' },
            { icon: '⚖️', title: 'Арбитраж', desc: 'Встроенный арбитражный механизм с формированием доказательного пакета' },
            { icon: '📋', title: 'УКЭП документы', desc: 'Все документы подписываются квалифицированной электронной подписью' },
            { icon: '🌾', title: 'ФГИС «Зерно»', desc: 'Данные о партии верифицируются через государственную информационную систему' },
          ].map((item) => (
            <div key={item.title} style={{ padding: '0.875rem', borderRadius: '10px', background: 'var(--p7-color-surface-muted)' }}>
              <div style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>{item.icon}</div>
              <div style={{ fontWeight: 600, fontSize: 'var(--text-sm)', marginBottom: '0.25rem', color: 'var(--pc-text-primary)' }}>{item.title}</div>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--pc-text-muted)', lineHeight: 1.5 }}>{item.desc}</div>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
