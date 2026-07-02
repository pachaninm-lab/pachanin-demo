'use client';

import { useState } from 'react';

type DeclarationStatus = 'draft' | 'submitted' | 'under_review' | 'cleared' | 'rejected' | 'held';

interface CustomsDeclaration {
  id: string;
  gtdNumber: string;
  dealId: string;
  culture: string;
  volumeTons: number;
  destinationCountry: string;
  incoterms: string;
  declaredValueRub: number;
  dutyRub: number;
  vatRub: number;
  status: DeclarationStatus;
  submittedAt: string;
  clearedAt: string | null;
  inspector: string | null;
  comments: string[];
}

const STATUS_CONFIG: Record<DeclarationStatus, { label: string; bg: string; color: string }> = {
  draft:        { label: 'Черновик',         bg: '#F1F5F9', color: '#64748B' },
  submitted:    { label: 'Подана',           bg: '#DBEAFE', color: '#1E40AF' },
  under_review: { label: 'На проверке',      bg: '#FEF3C7', color: '#92400E' },
  cleared:      { label: 'Оформлена',        bg: '#D1FAE5', color: '#065F46' },
  rejected:     { label: 'Отказ',           bg: '#FEE2E2', color: '#991B1B' },
  held:         { label: 'Задержана',        bg: '#FFF7ED', color: '#B45309' },
};

const DEMO_DECLARATIONS: CustomsDeclaration[] = [
  {
    id: 'gtd-001',
    gtdNumber: '10317100/150124/3002156',
    dealId: 'DL-9095',
    culture: 'Пшеница 3 кл',
    volumeTons: 4320,
    destinationCountry: 'Турция',
    incoterms: 'FOB',
    declaredValueRub: 62_640_000,
    dutyRub: 0,
    vatRub: 0,
    status: 'cleared',
    submittedAt: '2024-01-15T08:00:00Z',
    clearedAt: '2024-01-15T17:30:00Z',
    inspector: 'Таможенный пост Новороссийск · Центральный',
    comments: ['Фитосанитарный сертификат № ФС-77-2024-0089 предоставлен', 'СДИЗ верифицирован через ФГИС Зерно', 'Оформление 9 ч 30 мин'],
  },
  {
    id: 'gtd-002',
    gtdNumber: '10317100/120324/3008421',
    dealId: 'DL-9110',
    culture: 'Кукуруза',
    volumeTons: 1840,
    destinationCountry: 'Египет',
    incoterms: 'CFR',
    declaredValueRub: 23_552_000,
    dutyRub: 0,
    vatRub: 0,
    status: 'under_review',
    submittedAt: '2024-03-12T09:00:00Z',
    clearedAt: null,
    inspector: 'Таможенный пост Азовский',
    comments: ['Запрошено дополнительное фитосанитарное освидетельствование', 'Ожидание протокола Россельхознадзора'],
  },
  {
    id: 'gtd-003',
    gtdNumber: '10317100/030224/3004892',
    dealId: 'DL-9102',
    culture: 'Ячмень 2 кл',
    volumeTons: 2160,
    destinationCountry: 'Иран',
    incoterms: 'DAP',
    declaredValueRub: 18_576_000,
    dutyRub: 0,
    vatRub: 0,
    status: 'held',
    submittedAt: '2024-02-03T10:00:00Z',
    clearedAt: null,
    inspector: 'Таможенный пост Астраханский',
    comments: ['Задержана: расхождение по весу в ж/д накладной', 'Требуется акт пересчёта вагонов ГУ-12'],
  },
];

const PHYTO_CODES = [
  { code: 'НЗП 1.2', desc: 'Пшеничная нематода (Anguina tritici) — отсутствует' },
  { code: 'НЗП 3.1', desc: 'Зерновки долгоносика (Sitophilus granarius) — не обнаружено' },
  { code: 'ЕОКЗР A1', desc: 'Вредители карантинного списка — не обнаружены' },
  { code: 'ТР ТС 015/2011', desc: 'Безопасность зерна — соответствует' },
];

const lbl: React.CSSProperties = { fontSize: 10, fontWeight: 900, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.06em' };

function fmt(rub: number) {
  if (rub >= 1_000_000) return `${(rub / 1_000_000).toFixed(2)} млн ₽`;
  return rub === 0 ? '0 ₽ (ставка 0%)' : `${rub.toLocaleString('ru-RU')} ₽`;
}

export function FtsCustomsPanel() {
  const [selected, setSelected] = useState<string | null>(null);
  const decl = DEMO_DECLARATIONS.find((d) => d.id === selected);

  const stats = {
    total: DEMO_DECLARATIONS.length,
    cleared: DEMO_DECLARATIONS.filter((d) => d.status === 'cleared').length,
    review: DEMO_DECLARATIONS.filter((d) => d.status === 'under_review' || d.status === 'held').length,
    totalVolume: DEMO_DECLARATIONS.reduce((s, d) => s + d.volumeTons, 0),
  };

  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      {/* Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(110px,1fr))', gap: 8 }}>
        {[
          { label: 'ГТД всего', value: stats.total, color: '#0F1419' },
          { label: 'Оформлено', value: stats.cleared, color: '#0A7A5F' },
          { label: 'На проверке', value: stats.review, color: stats.review > 0 ? '#D97706' : '#0A7A5F' },
          { label: 'Объём (т)', value: stats.totalVolume.toLocaleString('ru-RU'), color: '#0F1419' },
        ].map((s) => (
          <div key={s.label} style={{ padding: '10px 12px', borderRadius: 10, background: '#F8FAFB', border: '1px solid #E4E6EA' }}>
            <div style={lbl}>{s.label}</div>
            <div style={{ fontSize: 18, fontWeight: 900, color: s.color, marginTop: 4 }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Declaration list */}
      <div style={{ display: 'grid', gap: 8 }}>
        {DEMO_DECLARATIONS.map((d) => {
          const cfg = STATUS_CONFIG[d.status];
          const isSelected = selected === d.id;
          return (
            <div key={d.id} style={{ borderRadius: 12, border: `1px solid ${isSelected ? '#2563EB' : '#E4E6EA'}`, background: isSelected ? '#EFF6FF' : '#F8FAFB', overflow: 'hidden' }}>
              <button
                onClick={() => setSelected(isSelected ? null : d.id)}
                style={{ width: '100%', padding: '12px 14px', display: 'flex', gap: 10, alignItems: 'flex-start', flexWrap: 'wrap', background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left' }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    <code style={{ fontSize: 11, fontFamily: 'monospace', color: '#0F1419', fontWeight: 700 }}>{d.gtdNumber}</code>
                    <span style={{ fontSize: 9, fontWeight: 800, padding: '2px 7px', borderRadius: 999, background: cfg.bg, color: cfg.color }}>{cfg.label}</span>
                    <a href={`/platform-v7/deals/${d.dealId}/clean`} onClick={(e) => e.stopPropagation()} style={{ fontSize: 9, color: '#0A7A5F', fontFamily: 'monospace', textDecoration: 'none', fontWeight: 700 }}>{d.dealId}</a>
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#0F1419', marginTop: 4 }}>{d.culture} · {d.volumeTons.toLocaleString('ru-RU')} т · {d.destinationCountry} · {d.incoterms}</div>
                  <div style={{ fontSize: 10, color: '#64748B', marginTop: 2 }}>Задекларированная стоимость: {fmt(d.declaredValueRub)}</div>
                </div>
                <div style={{ fontSize: 10, color: '#94A3B8', textAlign: 'right', flexShrink: 0 }}>
                  {new Date(d.submittedAt).toLocaleDateString('ru-RU')}
                </div>
              </button>

              {isSelected && (
                <div style={{ borderTop: '1px solid #E4E6EA', padding: '12px 14px', background: '#fff', display: 'grid', gap: 10 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 8 }}>
                    {[
                      { label: 'Таможенная пошлина', value: fmt(d.dutyRub) },
                      { label: 'НДС при экспорте', value: fmt(d.vatRub) },
                      { label: 'Инспектор', value: d.inspector ?? '—' },
                      { label: 'Оформление', value: d.clearedAt ? new Date(d.clearedAt).toLocaleString('ru-RU') : 'В процессе' },
                    ].map((s) => (
                      <div key={s.label}>
                        <div style={lbl}>{s.label}</div>
                        <div style={{ fontSize: 12, fontWeight: 700, color: '#0F1419', marginTop: 2 }}>{s.value}</div>
                      </div>
                    ))}
                  </div>
                  {d.comments.length > 0 && (
                    <div>
                      <div style={{ ...lbl, marginBottom: 4 }}>Комментарии таможни</div>
                      {d.comments.map((c, i) => (
                        <div key={i} style={{ fontSize: 11, color: '#374151', padding: '4px 0', borderBottom: i < d.comments.length - 1 ? '1px solid #F1F5F9' : 'none' }}>
                          · {c}
                        </div>
                      ))}
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button style={{ fontSize: 10, padding: '4px 10px', borderRadius: 6, border: '1px solid #E4E6EA', background: '#fff', cursor: 'pointer', color: '#374151', fontWeight: 700 }}>
                      ГТД PDF
                    </button>
                    <button style={{ fontSize: 10, padding: '4px 10px', borderRadius: 6, border: '1px solid #E4E6EA', background: '#fff', cursor: 'pointer', color: '#374151', fontWeight: 700 }}>
                      ДТ XML
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Phytosanitary checklist */}
      <div style={{ padding: '12px 14px', borderRadius: 12, background: '#F0FDF4', border: '1px solid #BBF7D0' }}>
        <div style={{ ...lbl, marginBottom: 6 }}>Фитосанитарные требования (типовые)</div>
        <div style={{ display: 'grid', gap: 4 }}>
          {PHYTO_CODES.map((p) => (
            <div key={p.code} style={{ display: 'flex', gap: 8, fontSize: 11, alignItems: 'flex-start' }}>
              <span style={{ color: '#0A7A5F', fontWeight: 900, flexShrink: 0 }}>✓</span>
              <span><b style={{ color: '#0F1419' }}>{p.code}</b> · <span style={{ color: '#475569' }}>{p.desc}</span></span>
            </div>
          ))}
        </div>
      </div>

      <div style={{ fontSize: 9, color: '#94A3B8', padding: '4px 8px', borderRadius: 6, background: '#F8FAFB', border: '1px solid #E4E6EA' }}>
        ФТС РФ · ЕАИС «Декларант» · НДС 0% при экспорте (ст. 164 НК РФ) · Пошлина 0% при соблюдении квоты · Интеграция требует API ФТС · Демо-данные.
      </div>
    </div>
  );
}
