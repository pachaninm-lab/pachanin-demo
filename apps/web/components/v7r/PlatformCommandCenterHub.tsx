import Link from 'next/link';

const S = 'var(--pc-bg-card, #fff)';
const B = 'var(--pc-border, #E4E6EA)';
const T = 'var(--pc-text-primary, #0F1419)';
const M = 'var(--pc-text-secondary, #64748B)';
const BRAND = 'var(--pc-accent-strong, #0A7A5F)';
const BRAND_BG = 'var(--pc-accent-bg, rgba(10,122,95,0.08))';
const BRAND_BORDER = 'var(--pc-accent-border, rgba(10,122,95,0.18))';

const spineAnchors = [
  { key: 'лот', value: 'LOT-2403' },
  { key: 'сделка', value: 'DL-9106' },
  { key: 'логистика', value: 'TRIP-SIM-001' },
];

const fiveSecondAnswers = [
  'Что происходит',
  'Где деньги',
  'Где груз',
  'Где документы',
  'Что заблокировано',
  'Кто следующий',
];

const roleLinks = [
  { label: 'Продавец', href: '/platform-v7/seller?as=seller' },
  { label: 'Покупатель', href: '/platform-v7/buyer?as=buyer' },
  { label: 'Логистика', href: '/platform-v7/logistics?as=logistics' },
  { label: 'Водитель', href: '/platform-v7/driver?as=driver' },
  { label: 'Банк', href: '/platform-v7/bank?as=bank' },
  { label: 'Оператор', href: '/platform-v7/control-tower?as=operator' },
];

export function PlatformCommandCenterHub() {
  return (
    <main style={{ display: 'grid', gap: 16, padding: '4px 0 24px' }}>
      <section
        data-testid='platform-command-center-hero'
        style={{ background: S, border: `1px solid ${B}`, borderRadius: 24, padding: 22, display: 'grid', gap: 14 }}
      >
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ display: 'inline-flex', padding: '5px 10px', borderRadius: 999, background: BRAND_BG, border: `1px solid ${BRAND_BORDER}`, color: BRAND, fontSize: 11, fontWeight: 900 }}>
            controlled-pilot
          </span>
          <span style={{ display: 'inline-flex', padding: '5px 10px', borderRadius: 999, background: BRAND_BG, border: `1px solid ${BRAND_BORDER}`, color: BRAND, fontSize: 11, fontWeight: 900 }}>
            simulation-grade
          </span>
          <span style={{ display: 'inline-flex', padding: '5px 10px', borderRadius: 999, background: 'rgba(217,119,6,0.08)', border: '1px solid rgba(217,119,6,0.18)', color: '#B45309', fontSize: 11, fontWeight: 900 }}>
            не production-ready
          </span>
        </div>

        <h1 style={{ margin: 0, color: T, fontSize: 'clamp(26px,7vw,42px)', lineHeight: 1.06, letterSpacing: '-0.04em', fontWeight: 950 }}>
          Дорогой контур исполнения зерновой сделки
        </h1>

        <p style={{ margin: 0, color: M, fontSize: 14, lineHeight: 1.6, maxWidth: 720 }}>
          Проверочный sandbox-контур: полная цепочка сделки от лота до выплаты. Не подключён к боевым системам.
        </p>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <Link
            href='/platform-v7/demo'
            style={{ textDecoration: 'none', minHeight: 44, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '10px 16px', borderRadius: 14, background: BRAND, color: '#fff', fontSize: 14, fontWeight: 900 }}
          >
            Пройти сделку за 3 минуты
          </Link>
          <Link
            href='/platform-v7/deals/DL-9106/clean'
            style={{ textDecoration: 'none', minHeight: 44, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '10px 16px', borderRadius: 14, background: '#fff', border: `1px solid ${B}`, color: T, fontSize: 14, fontWeight: 850 }}
          >
            Открыть Deal 360
          </Link>
        </div>
      </section>

      <section
        data-testid='platform-command-center-spine'
        style={{ background: S, border: `1px solid ${B}`, borderRadius: 24, padding: 18, display: 'grid', gap: 14 }}
      >
        <div style={{ fontSize: 11, color: BRAND, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          Позвоночник исполнения
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: 10 }}>
          {spineAnchors.map((anchor) => (
            <div key={anchor.key} style={{ background: BRAND_BG, border: `1px solid ${BRAND_BORDER}`, borderRadius: 14, padding: 12 }}>
              <div style={{ fontSize: 10, color: M, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{anchor.key}</div>
              <div style={{ marginTop: 4, fontSize: 15, fontWeight: 900, color: BRAND, fontFamily: 'JetBrains Mono, monospace' }}>{anchor.value}</div>
            </div>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 8 }}>
          {fiveSecondAnswers.map((answer) => (
            <div key={answer} style={{ background: 'var(--pc-bg-elevated, #F8FAFB)', border: `1px solid ${B}`, borderRadius: 12, padding: '10px 12px', fontSize: 13, fontWeight: 700, color: T }}>
              {answer}
            </div>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(130px,1fr))', gap: 8 }}>
          {roleLinks.map((role) => (
            <Link
              key={role.label}
              href={role.href}
              style={{ textDecoration: 'none', background: 'var(--pc-bg-elevated, #F8FAFB)', border: `1px solid ${B}`, borderRadius: 14, padding: '10px 12px', color: T, fontSize: 13, fontWeight: 900 }}
            >
              {role.label}
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
