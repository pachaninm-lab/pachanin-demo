import type { Metadata } from 'next';

export function generateMetadata({ params }: { params: { inn: string } }): Metadata {
  return {
    title: `Контрагент ИНН ${params.inn}`,
    description: 'Профиль контрагента в контуре сделки: готовность проверок, документов, истории и внешних интеграций.',
  };
}

const lbl: React.CSSProperties = { fontSize: 10, fontWeight: 900, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.06em' };

const READINESS = [
  {
    title: 'Профиль связан со сделкой',
    status: 'Платформа',
    text: 'Карточка контрагента должна помогать участнику сделки понять роль, документы, блокеры и следующий шаг.',
    color: '#065F46',
    bg: '#D1FAE5',
  },
  {
    title: 'История сделок',
    status: 'Доработка',
    text: 'История должна строиться только из фактических сделок активного контура, без статичных примеров и рейтингов.',
    color: '#1E40AF',
    bg: '#DBEAFE',
  },
  {
    title: 'Отзывы и рейтинг',
    status: 'Доработка',
    text: 'Отзывы допустимы только после подтверждённой сделки и понятного правила модерации.',
    color: '#1E40AF',
    bg: '#DBEAFE',
  },
  {
    title: 'Внешние проверки',
    status: 'Интеграция позже',
    text: 'Внешние источники временно не подключены и не показываются как подтверждённые.',
    color: '#92400E',
    bg: '#FEF3C7',
  },
];

export default function CounterpartyProfilePage({ params }: { params: { inn: string } }) {
  const platform = READINESS.filter((item) => item.status === 'Платформа').length;
  const planned = READINESS.filter((item) => item.status === 'Доработка').length;
  const integrations = READINESS.filter((item) => item.status === 'Интеграция позже').length;

  return (
    <main style={{ display: 'grid', gap: 16, padding: '4px 0 24px', maxWidth: 860, margin: '0 auto' }}>
      <section style={{ background: 'var(--p7-color-surface, #0E1A18)', border: '1px solid var(--p7-color-border, #24342F)', borderRadius: 16, padding: '1.5rem', display: 'grid', gap: '1rem' }}>
        <div>
          <div className="caption" style={{ marginBottom: '0.25rem' }}>Контрагент</div>
          <h1 className="heading-3" style={{ margin: 0 }}>Профиль контрагента</h1>
          <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem', fontSize: 'var(--text-sm)', color: 'var(--pc-text-muted)' }}>
            <span className="mono">ИНН {params.inn}</span>
            <span>настоящая платформа временно без интеграций</span>
          </div>
        </div>
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(130px,1fr))', gap: 8 }}>
        {[
          { label: 'Контуров', value: READINESS.length, color: '#0F1419' },
          { label: 'Платформа', value: platform, color: '#065F46' },
          { label: 'Доработка', value: planned, color: '#1E40AF' },
          { label: 'Интеграции', value: integrations, color: integrations > 0 ? '#92400E' : '#065F46' },
        ].map((s) => (
          <div key={s.label} style={{ padding: '10px 12px', borderRadius: 10, background: '#F8FAFB', border: '1px solid #E4E6EA' }}>
            <div style={lbl}>{s.label}</div>
            <div style={{ fontSize: 22, fontWeight: 900, color: s.color, marginTop: 4 }}>{s.value}</div>
          </div>
        ))}
      </section>

      <section style={{ padding: '8px 12px', borderRadius: 8, background: '#EFF6FF', border: '1px solid #BFDBFE', fontSize: 10, color: '#1E40AF', fontWeight: 760, lineHeight: 1.55 }}>
        Карточка контрагента не должна имитировать подтверждённые внешние проверки, рейтинг, отзывы или историю сделок. Такие данные показываются только из фактического контура сделки и подтверждённых интеграций.
      </section>

      <section style={{ display: 'grid', gap: 8 }}>
        {READINESS.map((item) => (
          <div key={item.title} style={{ padding: '12px 14px', borderRadius: 12, border: '1px solid #E4E6EA', background: '#F8FAFB' }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ fontSize: 8, fontWeight: 800, padding: '2px 6px', borderRadius: 4, background: item.bg, color: item.color }}>{item.status}</span>
              <span style={{ fontSize: 12, fontWeight: 800, color: '#0F1419', flex: 1 }}>{item.title}</span>
            </div>
            <div style={{ fontSize: 10, color: '#64748B', marginTop: 4 }}>{item.text}</div>
          </div>
        ))}
      </section>

      <section style={{ fontSize: 9, color: '#94A3B8', padding: '4px 8px', borderRadius: 6, background: '#F8FAFB', border: '1px solid #E4E6EA' }}>
        Профиль контрагента должен усиливать исполнение сделки; внешние интеграции временно не подключены.
      </section>
    </main>
  );
}
