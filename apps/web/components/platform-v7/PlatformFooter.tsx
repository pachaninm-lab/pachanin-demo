'use client';

const PARTNERS = [
  { id: 'fgis',     label: 'ФГИС «Зерно»',        tagline: 'Минсельхоз РФ',        color: '#1B5E20' },
  { id: 'sber',     label: 'СберБизнес',            tagline: 'Банк-партнёр',          color: '#087A3B' },
  { id: 'rshb',     label: 'Россельхозбанк',        tagline: 'Агрофинансирование',    color: '#00833E' },
  { id: 'diadok',   label: 'Диадок',                tagline: 'ЭДО Контур',            color: '#2D3F9E' },
  { id: 'gis_epd',  label: 'ГИС ЭПД',              tagline: 'Эл. путевые листы',     color: '#344054' },
  { id: 'cryptopro',label: 'КриптоПро',             tagline: 'УКЭП / КЭП',           color: '#0B3D91' },
  { id: 'spark',    label: 'СПАРК',                 tagline: 'Верификация контрагентов', color: '#6D1A7A' },
  { id: 'rosreestr',label: 'Росреестр',             tagline: 'Имущество / зем. фонд', color: '#B71C1C' },
];

const COMPLIANCE = [
  '152-ФЗ — обработка персональных данных',
  '63-ФЗ — электронная подпись',
  '259-ФЗ — цифровые финансовые активы',
  'ГОСТ Р ИСО/МЭК 27001 — информационная безопасность',
];

export function PlatformFooter() {
  return (
    <footer
      data-demo="true"
      aria-label="Партнёры и соответствие"
      style={{
        borderTop: '1px solid var(--p7-color-border, #E4E6EA)',
        background: 'var(--p7-color-surface-muted, #F8FAFB)',
        padding: '2rem 1.5rem 3rem',
        marginTop: '2rem',
      }}
    >
      <div style={{ maxWidth: 1200, margin: '0 auto', display: 'grid', gap: '1.75rem' }}>
        {/* Partner logos */}
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--pc-text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.75rem' }}>
            Интеграции и партнёры
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.625rem' }}>
            {PARTNERS.map((p) => (
              <div
                key={p.id}
                title={p.tagline}
                aria-label={`${p.label} — ${p.tagline}`}
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  padding: '0.5rem 0.875rem',
                  borderRadius: 10,
                  background: '#fff',
                  border: '1px solid var(--p7-color-border, #E4E6EA)',
                  minWidth: 100,
                  gap: '0.25rem',
                  userSelect: 'none',
                }}
              >
                <span style={{ fontSize: 11, fontWeight: 900, color: p.color, letterSpacing: '-0.01em', lineHeight: 1.1 }}>{p.label}</span>
                <span style={{ fontSize: 9, color: 'var(--pc-text-muted)', fontWeight: 600 }}>{p.tagline}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Compliance */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
          {COMPLIANCE.map((item) => (
            <span key={item} style={{
              fontSize: 9, fontWeight: 700, color: 'var(--pc-text-muted)',
              background: 'rgba(10,122,95,0.06)', border: '1px solid rgba(10,122,95,0.12)',
              borderRadius: 999, padding: '2px 8px',
            }}>
              {item}
            </span>
          ))}
        </div>

        {/* Bottom row */}
        <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem', paddingTop: '0.75rem', borderTop: '1px solid var(--p7-color-border, #E4E6EA)' }}>
          <span style={{ fontSize: 10, color: 'var(--pc-text-muted)' }}>
            © 2024–2026 ООО «Прозрачная Цена» · Pilot контур · Данные демонстрационные
          </span>
          <span style={{ fontSize: 10, color: 'var(--pc-text-muted)' }}>
            v10.0 · GrainFlow Federal Platform
          </span>
        </div>
      </div>
    </footer>
  );
}
