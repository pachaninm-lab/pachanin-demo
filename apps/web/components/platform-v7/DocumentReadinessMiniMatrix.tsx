type DocState = 'ready' | 'missing' | 'review' | 'pending';

type MiniRow = {
  name: string;
  state: DocState;
  responsible: string;
  nextStep: string;
};

type RoleContext = 'seller' | 'buyer' | 'bank';

const STATE_LABEL: Record<DocState, string> = {
  ready: 'Готово',
  missing: 'Не хватает',
  review: 'На проверке',
  pending: 'Ожидает подтверждения',
};

function stateTone(state: DocState) {
  if (state === 'ready') return { bg: 'rgba(10,122,95,0.08)', border: 'rgba(10,122,95,0.18)', color: '#0A7A5F' };
  if (state === 'missing') return { bg: 'rgba(220,38,38,0.08)', border: 'rgba(220,38,38,0.18)', color: '#B91C1C' };
  if (state === 'review') return { bg: 'rgba(217,119,6,0.08)', border: 'rgba(217,119,6,0.18)', color: '#B45309' };
  return { bg: 'rgba(37,99,235,0.08)', border: 'rgba(37,99,235,0.18)', color: '#1D4ED8' };
}

const ROWS_BY_ROLE: Record<RoleContext, MiniRow[]> = {
  seller: [
    { name: 'СДИЗ', state: 'review', responsible: 'продавец / ФГИС «Зерно»', nextStep: 'закрыть СДИЗ в ФГИС «Зерно»' },
    { name: 'ЭТрН', state: 'missing', responsible: 'логистика / водитель', nextStep: 'закрыть рейс и транспортный пакет' },
    { name: 'Акт приёмки', state: 'missing', responsible: 'элеватор / покупатель', nextStep: 'подтвердить вес и приёмку' },
    { name: 'Лабораторный протокол', state: 'missing', responsible: 'лаборатория', nextStep: 'загрузить лабораторный протокол качества' },
  ],
  buyer: [
    { name: 'Банковское подтверждение резерва', state: 'pending', responsible: 'покупатель / банк', nextStep: 'ожидает банковского подтверждения' },
    { name: 'ЭДО', state: 'review', responsible: 'стороны сделки', nextStep: 'дособрать подписи' },
    { name: 'Акт приёмки', state: 'missing', responsible: 'элеватор / покупатель', nextStep: 'подтвердить приёмку и вес' },
    { name: 'Лабораторный протокол', state: 'missing', responsible: 'лаборатория', nextStep: 'ожидать протокола качества' },
  ],
  bank: [
    { name: 'СДИЗ', state: 'review', responsible: 'продавец / оператор', nextStep: 'ожидать закрытия СДИЗ продавцом' },
    { name: 'ЭТрН', state: 'missing', responsible: 'логистика', nextStep: 'ожидать закрытия рейса' },
    { name: 'Акт приёмки', state: 'missing', responsible: 'элеватор', nextStep: 'ожидать акта приёмки' },
    { name: 'Основание для банковского события', state: 'pending', responsible: 'банк / оператор', nextStep: 'ручная сверка оператором' },
  ],
};

const ROLE_LABEL: Record<RoleContext, string> = {
  seller: 'продавец',
  buyer: 'покупатель',
  bank: 'банк',
};

export function DocumentReadinessMiniMatrix({ role }: { role: RoleContext }) {
  const rows = ROWS_BY_ROLE[role];
  const pendingCount = rows.filter((r) => r.state !== 'ready').length;

  return (
    <section
      data-testid="platform-v7-readiness-mini-matrix"
      style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 16, display: 'grid', gap: 12 }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: 11, color: '#64748B', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            пилотный контур · документы
          </div>
          <div style={{ marginTop: 4, fontSize: 15, fontWeight: 950, color: '#0F1419', lineHeight: 1.2 }}>
            Готовность документов — {ROLE_LABEL[role]}
          </div>
        </div>
        <span
          data-testid="platform-v7-readiness-mini-matrix-summary"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            padding: '5px 10px',
            borderRadius: 999,
            border: pendingCount ? '1px solid rgba(217,119,6,0.18)' : '1px solid rgba(10,122,95,0.18)',
            background: pendingCount ? 'rgba(217,119,6,0.08)' : 'rgba(10,122,95,0.08)',
            color: pendingCount ? '#B45309' : '#0A7A5F',
            fontSize: 11,
            fontWeight: 900,
          }}
        >
          {pendingCount ? `${pendingCount} не готово` : 'Пакет закрыт'}
        </span>
      </div>

      <div style={{ display: 'grid', gap: 6 }}>
        {rows.map((row) => {
          const tone = stateTone(row.state);
          return (
            <div
              key={row.name}
              data-testid="platform-v7-readiness-mini-matrix-row"
              style={{
                display: 'grid',
                gridTemplateColumns: 'minmax(120px, 1fr) auto minmax(120px, 1fr) minmax(140px, 1fr)',
                gap: 8,
                alignItems: 'center',
                background: '#F8FAFB',
                border: '1px solid #EEF1F4',
                borderRadius: 10,
                padding: '8px 10px',
              }}
            >
              <div style={{ fontSize: 13, fontWeight: 900, color: '#0F1419', minWidth: 0 }}>{row.name}</div>
              <span
                style={{
                  whiteSpace: 'nowrap',
                  display: 'inline-flex',
                  alignItems: 'center',
                  padding: '4px 8px',
                  borderRadius: 999,
                  background: tone.bg,
                  border: `1px solid ${tone.border}`,
                  color: tone.color,
                  fontSize: 11,
                  fontWeight: 900,
                }}
              >
                {STATE_LABEL[row.state]}
              </span>
              <div style={{ fontSize: 12, color: '#475569', lineHeight: 1.35 }}>
                <span style={{ fontSize: 10, color: '#94A3B8', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block' }}>ответственный</span>
                {row.responsible}
              </div>
              <div style={{ fontSize: 12, color: '#334155', lineHeight: 1.35, fontWeight: 750 }}>
                <span style={{ fontSize: 10, color: '#94A3B8', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block' }}>следующий шаг</span>
                {row.nextStep}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
