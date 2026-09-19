'use client';

import { useState } from 'react';
import { RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer, Tooltip } from 'recharts';

interface ScoringFactor {
  name: string;
  shortName: string;
  weight: number;
  score: number;
  description: string;
}

interface CounterpartyScore {
  inn: string;
  orgName: string;
  totalScore: number;
  tier: 'A' | 'B' | 'C' | 'D';
  factors: ScoringFactor[];
  dealCount: number;
  avgVolumeMlnRub: number;
  avgCloseTimeDays: number;
  disputeRate: number;
  onTimePct: number;
  modelVersion: string;
}

const DEMO_SCORES: CounterpartyScore[] = [
  {
    inn: '6829012345',
    orgName: 'ООО «АгроТамбов»',
    totalScore: 84,
    tier: 'A',
    dealCount: 47,
    avgVolumeMlnRub: 12.4,
    avgCloseTimeDays: 8.2,
    disputeRate: 2.1,
    onTimePct: 96,
    modelVersion: 'v2.3.1-lgbm',
    factors: [
      { name: 'История сделок', shortName: 'История', weight: 0.30, score: 90, description: '47 сделок, 96% закрыты без спора' },
      { name: 'Финансовая устойчивость', shortName: 'Финансы', weight: 0.25, score: 82, description: 'СПАРК: устойчивое, задолженности нет' },
      { name: 'Объём торговли', shortName: 'Объём', weight: 0.20, score: 78, description: 'Ср. GMV 12.4 млн ₽/сделку' },
      { name: 'Репутация', shortName: 'Репутация', weight: 0.15, score: 88, description: '4.7/5.0 (32 отзыва)' },
      { name: 'Возраст организации', shortName: 'Возраст', weight: 0.10, score: 75, description: 'Зарегистрирована 8 лет назад' },
    ],
  },
  {
    inn: '7701234567',
    orgName: 'АО «МаслоПресс»',
    totalScore: 61,
    tier: 'B',
    dealCount: 12,
    avgVolumeMlnRub: 8.6,
    avgCloseTimeDays: 14.5,
    disputeRate: 8.3,
    onTimePct: 75,
    modelVersion: 'v2.3.1-lgbm',
    factors: [
      { name: 'История сделок', shortName: 'История', weight: 0.30, score: 55, description: '12 сделок, 1 спор открыт' },
      { name: 'Финансовая устойчивость', shortName: 'Финансы', weight: 0.25, score: 70, description: 'СПАРК: удовлетворительное' },
      { name: 'Объём торговли', shortName: 'Объём', weight: 0.20, score: 62, description: 'Ср. GMV 8.6 млн ₽/сделку' },
      { name: 'Репутация', shortName: 'Репутация', weight: 0.15, score: 58, description: '3.9/5.0 (8 отзывов)' },
      { name: 'Возраст организации', shortName: 'Возраст', weight: 0.10, score: 65, description: 'Зарегистрирована 3 года назад' },
    ],
  },
];

const TIER_CONFIG: Record<string, { label: string; bg: string; color: string; border: string }> = {
  A: { label: 'Tier A · Надёжный', bg: '#F0FDF4', color: '#0A7A5F', border: '#BBF7D0' },
  B: { label: 'Tier B · Средний', bg: '#FFFBEB', color: '#D97706', border: '#FDE68A' },
  C: { label: 'Tier C · Осторожно', bg: '#FFF7ED', color: '#EA580C', border: '#FDBA74' },
  D: { label: 'Tier D · Высокий риск', bg: '#FFF1F1', color: '#DC2626', border: '#FECACA' },
};

function ScoreGauge({ score }: { score: number }) {
  const color = score >= 80 ? '#0A7A5F' : score >= 60 ? '#D97706' : score >= 40 ? '#EA580C' : '#DC2626';
  const circumference = 2 * Math.PI * 45;
  const offset = circumference * (1 - score / 100);
  return (
    <div style={{ position: 'relative', width: 120, height: 120, flexShrink: 0 }}>
      <svg width="120" height="120" viewBox="0 0 120 120" style={{ transform: 'rotate(-90deg)' }}>
        <circle cx="60" cy="60" r="45" fill="none" stroke="#E4E6EA" strokeWidth="10" />
        <circle
          cx="60" cy="60" r="45" fill="none" stroke={color} strokeWidth="10"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.6s ease' }}
        />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontSize: 28, fontWeight: 900, color, lineHeight: 1 }}>{score}</span>
        <span style={{ fontSize: 10, color: '#94A3B8', fontWeight: 700 }}>/ 100</span>
      </div>
    </div>
  );
}

const lbl: React.CSSProperties = { fontSize: 10, fontWeight: 900, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.06em' };

export function CounterpartyScoringWidget() {
  const [selectedInn, setSelectedInn] = useState(DEMO_SCORES[0].inn);
  const score = DEMO_SCORES.find((s) => s.inn === selectedInn) ?? DEMO_SCORES[0];
  const tier = TIER_CONFIG[score.tier];

  const radarData = score.factors.map((f) => ({
    subject: f.shortName,
    value: f.score,
    fullMark: 100,
  }));

  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      {/* Selector */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {DEMO_SCORES.map((s) => (
          <button
            key={s.inn}
            onClick={() => setSelectedInn(s.inn)}
            style={{
              padding: '5px 12px', borderRadius: 999, fontSize: 11, fontWeight: 700, cursor: 'pointer',
              border: selectedInn === s.inn ? 'none' : '1px solid #E4E6EA',
              background: selectedInn === s.inn ? '#0F1419' : 'transparent',
              color: selectedInn === s.inn ? '#fff' : '#64748B',
            }}
          >
            {s.orgName}
          </button>
        ))}
      </div>

      {/* Header */}
      <div style={{ padding: '14px 16px', borderRadius: 16, background: tier.bg, border: `1px solid ${tier.border}`, display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <ScoreGauge score={score.totalScore} />
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ fontSize: 16, fontWeight: 900, color: '#0F1419' }}>{score.orgName}</div>
          <div style={{ fontSize: 11, color: '#64748B', marginBottom: 8 }}>ИНН {score.inn}</div>
          <span style={{ fontSize: 11, fontWeight: 800, padding: '4px 10px', borderRadius: 999, background: tier.color + '18', color: tier.color, border: `1px solid ${tier.border}` }}>
            {tier.label}
          </span>
          <div style={{ marginTop: 10, display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(110px,1fr))', gap: 8 }}>
            {[
              { l: 'Сделок', v: score.dealCount },
              { l: 'Ср. GMV', v: `${score.avgVolumeMlnRub} млн ₽` },
              { l: 'Ср. закрытие', v: `${score.avgCloseTimeDays} дн.` },
              { l: 'Вовремя', v: `${score.onTimePct}%` },
              { l: 'Споры', v: `${score.disputeRate}%` },
            ].map((s) => (
              <div key={s.l} style={{ padding: '6px 10px', borderRadius: 8, background: 'rgba(255,255,255,0.6)', border: '1px solid rgba(255,255,255,0.8)' }}>
                <div style={lbl}>{s.l}</div>
                <div style={{ fontSize: 12, fontWeight: 800, color: '#0F1419', marginTop: 2 }}>{s.v}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Factors + Radar */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 16, alignItems: 'start' }}>
        <div style={{ display: 'grid', gap: 8 }}>
          <div style={lbl}>Факторы скоринга</div>
          {score.factors.map((f) => {
            const fColor = f.score >= 80 ? '#0A7A5F' : f.score >= 60 ? '#D97706' : '#DC2626';
            return (
              <div key={f.name} style={{ padding: '8px 12px', borderRadius: 10, border: '1px solid #E4E6EA', background: '#F8FAFB' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#0F1419' }}>{f.name}</div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span style={{ fontSize: 9, color: '#94A3B8' }}>вес {(f.weight * 100).toFixed(0)}%</span>
                    <span style={{ fontSize: 13, fontWeight: 900, color: fColor }}>{f.score}</span>
                  </div>
                </div>
                <div style={{ height: 4, borderRadius: 2, background: '#E4E6EA', overflow: 'hidden' }}>
                  <div style={{ width: `${f.score}%`, height: '100%', background: fColor, borderRadius: 2, transition: 'width 0.5s ease' }} />
                </div>
                <div style={{ fontSize: 10, color: '#94A3B8', marginTop: 4 }}>{f.description}</div>
              </div>
            );
          })}
        </div>

        <div style={{ width: 180 }}>
          <div style={{ ...lbl, marginBottom: 8 }}>Радар</div>
          <ResponsiveContainer width={180} height={180}>
            <RadarChart data={radarData}>
              <PolarGrid stroke="#E4E6EA" />
              <PolarAngleAxis dataKey="subject" tick={{ fontSize: 9, fill: '#94A3B8' }} />
              <Radar dataKey="value" stroke="#2563EB" fill="#2563EB" fillOpacity={0.15} strokeWidth={2} />
              <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} formatter={(v: number) => [v, 'Скор']} />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div style={{ fontSize: 9, color: '#94A3B8', padding: '4px 8px', borderRadius: 6, background: '#F8FAFB', border: '1px solid #E4E6EA' }}>
        Модель: LightGBM {score.modelVersion} · Данные: история сделок платформы + СПАРК + отзывы · Обновление: еженедельно · Демо-значения.
      </div>
    </div>
  );
}
