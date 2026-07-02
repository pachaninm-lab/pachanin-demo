'use client';

import { useState } from 'react';

interface CreditScore {
  orgName: string;
  inn: string;
  score: number;
  grade: 'AAA' | 'AA' | 'A' | 'BBB' | 'BB' | 'B' | 'CCC';
  maxLimitRub: number;
  usedLimitRub: number;
  overdueCount: number;
  creditAgeMonths: number;
  lastUpdated: string;
  factors: { name: string; impact: 'positive' | 'negative' | 'neutral'; desc: string }[];
  bureaus: { name: string; score: number; reportedAt: string }[];
}

const GRADE_CONFIG: Record<CreditScore['grade'], { label: string; color: string; bg: string }> = {
  AAA: { label: 'AAA · Наивысший',   color: '#065F46', bg: '#D1FAE5' },
  AA:  { label: 'AA · Высокий',      color: '#0A7A5F', bg: '#ECFDF5' },
  A:   { label: 'A · Хороший',       color: '#059669', bg: '#F0FDF4' },
  BBB: { label: 'BBB · Удовл.',      color: '#D97706', bg: '#FFFBEB' },
  BB:  { label: 'BB · Средний',      color: '#B45309', bg: '#FEF3C7' },
  B:   { label: 'B · Ниже среднего', color: '#EA580C', bg: '#FFF7ED' },
  CCC: { label: 'CCC · Высокий риск', color: '#DC2626', bg: '#FEF2F2' },
};

const DEMO_SCORES: CreditScore[] = [
  {
    orgName: 'ООО «АгроТрейд Юг»',
    inn: '6164065090',
    score: 842,
    grade: 'AA',
    maxLimitRub: 50_000_000,
    usedLimitRub: 18_500_000,
    overdueCount: 0,
    creditAgeMonths: 84,
    lastUpdated: '2024-03-01T00:00:00Z',
    factors: [
      { name: 'История платежей', impact: 'positive', desc: '100% оплата в срок за 84 месяца' },
      { name: 'Использование лимита', impact: 'positive', desc: '37% — оптимальная загрузка' },
      { name: 'Возраст кредитной истории', impact: 'positive', desc: '7 лет — зрелая история' },
      { name: 'Количество запросов', impact: 'neutral', desc: '2 запроса за последние 90 дней' },
      { name: 'Диверсификация кредиторов', impact: 'positive', desc: '3 банка + факторинг' },
    ],
    bureaus: [
      { name: 'НБКИ', score: 848, reportedAt: '2024-02-28' },
      { name: 'ОКБ', score: 836, reportedAt: '2024-02-25' },
      { name: 'Эквифакс', score: 841, reportedAt: '2024-03-01' },
    ],
  },
  {
    orgName: 'АО «МаслоПресс»',
    inn: '7701234567',
    score: 612,
    grade: 'BBB',
    maxLimitRub: 20_000_000,
    usedLimitRub: 14_200_000,
    overdueCount: 2,
    creditAgeMonths: 36,
    lastUpdated: '2024-03-05T00:00:00Z',
    factors: [
      { name: 'История платежей', impact: 'negative', desc: '2 просрочки до 30 дней за год' },
      { name: 'Использование лимита', impact: 'negative', desc: '71% — высокая загрузка лимита' },
      { name: 'Возраст кредитной истории', impact: 'neutral', desc: '3 года — умеренная история' },
      { name: 'Количество запросов', impact: 'neutral', desc: '1 запрос за последние 90 дней' },
      { name: 'Диверсификация кредиторов', impact: 'positive', desc: '2 банка' },
    ],
    bureaus: [
      { name: 'НБКИ', score: 618, reportedAt: '2024-03-04' },
      { name: 'ОКБ', score: 605, reportedAt: '2024-03-02' },
    ],
  },
];

const lbl: React.CSSProperties = { fontSize: 10, fontWeight: 900, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.06em' };

function fmt(rub: number) {
  if (rub >= 1_000_000) return `${(rub / 1_000_000).toFixed(1)} млн ₽`;
  return `${rub.toLocaleString('ru-RU')} ₽`;
}

function ScoreMeter({ score }: { score: number }) {
  const pct = ((score - 300) / 550) * 100;
  const color = score >= 800 ? '#0A7A5F' : score >= 650 ? '#D97706' : '#DC2626';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <div style={{ fontSize: 28, fontWeight: 900, color, lineHeight: 1 }}>{score}</div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 9, color: '#94A3B8', marginBottom: 3 }}>300 → 850</div>
        <div style={{ height: 8, borderRadius: 4, background: '#E4E6EA', overflow: 'hidden' }}>
          <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 4, transition: 'width 0.5s' }} />
        </div>
      </div>
    </div>
  );
}

export function CreditBureauPanel() {
  const [selectedInn, setSelectedInn] = useState(DEMO_SCORES[0].inn);
  const data = DEMO_SCORES.find((s) => s.inn === selectedInn) ?? DEMO_SCORES[0];
  const grade = GRADE_CONFIG[data.grade];
  const usedPct = Math.round((data.usedLimitRub / data.maxLimitRub) * 100);

  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      {/* Selector */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {DEMO_SCORES.map((s) => (
          <button key={s.inn} onClick={() => setSelectedInn(s.inn)} style={{ padding: '5px 14px', borderRadius: 8, border: selectedInn === s.inn ? 'none' : '1px solid #E4E6EA', background: selectedInn === s.inn ? '#0F1419' : '#F8FAFB', color: selectedInn === s.inn ? '#fff' : '#64748B', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
            {s.orgName}
          </button>
        ))}
      </div>

      {/* Score card */}
      <div style={{ padding: '14px 16px', borderRadius: 14, background: grade.bg, border: `1px solid ${grade.color}33` }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 10 }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 900, color: '#0F1419' }}>{data.orgName}</div>
            <div style={{ fontSize: 10, color: '#64748B', marginTop: 2 }}>ИНН {data.inn} · Обновлено {new Date(data.lastUpdated).toLocaleDateString('ru-RU')}</div>
            <span style={{ marginTop: 8, display: 'inline-block', fontSize: 12, fontWeight: 800, padding: '4px 12px', borderRadius: 999, background: grade.color + '20', color: grade.color }}>
              {grade.label}
            </span>
          </div>
          <ScoreMeter score={data.score} />
        </div>

        {/* Limits */}
        <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: 8 }}>
          {[
            { label: 'Кредитный лимит', value: fmt(data.maxLimitRub) },
            { label: 'Использовано', value: fmt(data.usedLimitRub) },
            { label: 'Загрузка лимита', value: `${usedPct}%` },
            { label: 'Просрочки', value: data.overdueCount === 0 ? '✓ Нет' : `${data.overdueCount} ед.` },
          ].map((s) => (
            <div key={s.label} style={{ padding: '8px 10px', borderRadius: 8, background: 'rgba(255,255,255,0.7)', border: '1px solid rgba(255,255,255,0.9)' }}>
              <div style={lbl}>{s.label}</div>
              <div style={{ fontSize: 13, fontWeight: 800, color: '#0F1419', marginTop: 2 }}>{s.value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Limit bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 10 }}>
        <span style={{ color: '#64748B', minWidth: 70 }}>Использование</span>
        <div style={{ flex: 1, height: 8, borderRadius: 4, background: '#E4E6EA', overflow: 'hidden' }}>
          <div style={{ width: `${usedPct}%`, height: '100%', background: usedPct > 70 ? '#DC2626' : usedPct > 50 ? '#D97706' : '#0A7A5F', borderRadius: 4 }} />
        </div>
        <span style={{ fontWeight: 700, minWidth: 36, color: usedPct > 70 ? '#DC2626' : '#0F1419' }}>{usedPct}%</span>
      </div>

      {/* Factors */}
      <div>
        <div style={{ ...lbl, marginBottom: 6 }}>Факторы скоринга</div>
        <div style={{ display: 'grid', gap: 6 }}>
          {data.factors.map((f) => (
            <div key={f.name} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', padding: '8px 10px', borderRadius: 8, background: '#F8FAFB', border: '1px solid #E4E6EA' }}>
              <span style={{ fontSize: 14, flexShrink: 0 }}>{f.impact === 'positive' ? '✅' : f.impact === 'negative' ? '❌' : '➖'}</span>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#0F1419' }}>{f.name}</div>
                <div style={{ fontSize: 10, color: '#64748B', marginTop: 1 }}>{f.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Bureau data */}
      <div>
        <div style={{ ...lbl, marginBottom: 6 }}>Данные бюро</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: 6 }}>
          {data.bureaus.map((b) => (
            <div key={b.name} style={{ padding: '10px 12px', borderRadius: 10, border: '1px solid #E4E6EA', background: '#fff' }}>
              <div style={lbl}>{b.name}</div>
              <div style={{ fontSize: 18, fontWeight: 900, color: '#0F1419', marginTop: 4 }}>{b.score}</div>
              <div style={{ fontSize: 9, color: '#94A3B8', marginTop: 2 }}>{b.reportedAt}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ fontSize: 9, color: '#94A3B8', padding: '4px 8px', borderRadius: 6, background: '#F8FAFB', border: '1px solid #E4E6EA' }}>
        БКИ: НБКИ · ОКБ · Эквифакс · Скоринг 300–850 · Обновление при запросе или еженедельно · Интеграция требует договора с БКИ · Демо-данные.
      </div>
    </div>
  );
}
