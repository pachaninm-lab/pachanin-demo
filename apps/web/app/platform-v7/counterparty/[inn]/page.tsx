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
