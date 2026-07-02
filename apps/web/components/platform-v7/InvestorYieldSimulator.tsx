'use client';

import { useState, useCallback } from 'react';

interface SimParams {
  gmvMonthlyMlnRub: number;
  commissionPct: number;
  dealAvgDays: number;
  churnPct: number;
  orgCount: number;
  dealAvgMlnRub: number;
}

const DEFAULT_PARAMS: SimParams = {
  gmvMonthlyMlnRub: 118,
  commissionPct: 1.8,
  dealAvgDays: 8.3,
  churnPct: 5,
  orgCount: 31,
  dealAvgMlnRub: 3.8,
};

const SCENARIOS = [
  { label: 'Пилот (год 1)', gmv: 500, orgs: 500, commission: 1.8 },
  { label: 'Рост (год 2)', gmv: 10_000, orgs: 5000, commission: 1.5 },
  { label: 'Федеральный (год 3)', gmv: 100_000, orgs: 50_000, commission: 1.2 },
];

function fmt(v: number, decimals = 2): string {
  if (v >= 1_000) return `${(v / 1_000).toFixed(decimals)} млрд ₽`;
  if (v >= 1) return `${v.toFixed(decimals)} млн ₽`;
  return `${(v * 1000).toFixed(0) } тыс. ₽`;
}

const OPEX_MONTHLY_MLN = 4.2; // платформа: команда + инфра + лицензии (оценка пилот-фазы)

function calcMetrics(p: SimParams) {
  const annualGmv = p.gmvMonthlyMlnRub * 12;
  const annualRevenue = annualGmv * (p.commissionPct / 100);
  const dealsPerMonth = p.gmvMonthlyMlnRub / p.dealAvgMlnRub;
  const growthAdj = 1 - p.churnPct / 100;
  const retainedRevenue = annualRevenue * growthAdj;
  const monthlyRevenue = p.gmvMonthlyMlnRub * (p.commissionPct / 100);
  const monthlyProfit = monthlyRevenue - OPEX_MONTHLY_MLN;
  const runwayMonths = monthlyProfit < 0 ? Math.round(18 / (-monthlyProfit / OPEX_MONTHLY_MLN + 0.01)) : Infinity;
  const breakEvenGmv = (OPEX_MONTHLY_MLN / (p.commissionPct / 100));
  const revenuePerOrg = p.orgCount > 0 ? (annualRevenue / p.orgCount) : 0;
  return { annualGmv, annualRevenue, dealsPerMonth, retainedRevenue, monthlyRevenue, monthlyProfit, runwayMonths, breakEvenGmv, revenuePerOrg };
}

function exportPilotReport(p: SimParams, m: ReturnType<typeof calcMetrics>) {
  const date = new Date().toLocaleDateString('ru-RU');
  const lines = [
    `Пилотный финансовый отчёт «Прозрачная Цена»`,
    `Дата: ${date}`,
    ``,
    `=== Параметры модели ===`,
    `GMV в месяц: ${p.gmvMonthlyMlnRub} млн ₽`,
    `Комиссия платформы: ${p.commissionPct}%`,
    `Ср. чек сделки: ${p.dealAvgMlnRub} млн ₽`,
    `Кол-во организаций: ${p.orgCount}`,
    `Отток/мес: ${p.churnPct}%`,
    ``,
    `=== Результаты ===`,
    `GMV / год: ${m.annualGmv.toFixed(1)} млн ₽`,
    `Выручка / год: ${m.annualRevenue.toFixed(2)} млн ₽`,
    `Выручка / мес: ${m.monthlyRevenue.toFixed(2)} млн ₽`,
    `OPEX / мес (оценка): ${OPEX_MONTHLY_MLN} млн ₽`,
    `Прибыль / мес: ${m.monthlyProfit.toFixed(2)} млн ₽`,
    `Сделок / мес: ${m.dealsPerMonth.toFixed(0)}`,
    `Выручка на орг / год: ${m.revenuePerOrg.toFixed(2)} млн ₽`,
    `Break-even GMV / мес: ${m.breakEvenGmv.toFixed(1)} млн ₽`,
    m.runwayMonths === Infinity ? `Статус: прибыльно` : `Runway (при текущем OPEX): ~${m.runwayMonths} мес`,
    ``,
    `Выручка с поправкой на отток: ${m.retainedRevenue.toFixed(2)} млн ₽/год`,
    ``,
    `Примечание: расчёт модельный. Фактические показатели зависят от live-интеграций и пилотных сделок.`,
  ];
  const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `pilot-report-${date.replace(/\./g, '-')}.txt`;
  a.click();
  URL.revokeObjectURL(url);
}

interface RangeInputProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  format: (v: number) => string;
  onChange: (v: number) => void;
}

function RangeInput({ label, value, min, max, step, format, onChange }: RangeInputProps) {
  return (
    <div style={{ display: 'grid', gap: '0.25rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <span style={{ fontSize: '10px', color: 'var(--pc-text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</span>
        <span style={{ fontSize: 'var(--text-sm)', fontWeight: 800, color: 'var(--p7-color-brand)' }}>{format(value)}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ width: '100%', accentColor: 'var(--p7-color-brand, #0A7A5F)', cursor: 'pointer' }}
      />
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', color: 'var(--pc-text-muted)' }}>
        <span>{format(min)}</span>
        <span>{format(max)}</span>
      </div>
    </div>
  );
}

export function InvestorYieldSimulator() {
  const [params, setParams] = useState<SimParams>(DEFAULT_PARAMS);
  const [activeScenario, setActiveScenario] = useState<number | null>(null);
  const [exporting, setExporting] = useState(false);

  function applyScenario(idx: number) {
    const s = SCENARIOS[idx];
    setParams((prev) => ({ ...prev, gmvMonthlyMlnRub: s.gmv, orgCount: s.orgs, commissionPct: s.commission }));
    setActiveScenario(idx);
  }

  function updateParam<K extends keyof SimParams>(key: K, value: SimParams[K]) {
    setParams((prev) => ({ ...prev, [key]: value }));
    setActiveScenario(null);
  }

  const m = calcMetrics(params);

  const handleExport = useCallback(async () => {
    setExporting(true);
    await new Promise((r) => setTimeout(r, 300));
    exportPilotReport(params, calcMetrics(params));
    setExporting(false);
  }, [params]);

  const profitable = m.monthlyProfit >= 0;
  const kpis = [
    { label: 'GMV / год',            value: fmt(m.annualGmv),         note: 'целевой оборот на платформе', tone: 'info' as const },
    { label: 'Выручка / год',        value: fmt(m.annualRevenue),      note: `комиссия ${params.commissionPct}%`, tone: 'success' as const },
    { label: 'Выручка / мес',        value: fmt(m.monthlyRevenue),     note: 'до вычета OPEX', tone: 'info' as const },
    { label: 'Прибыль / мес',        value: fmt(Math.abs(m.monthlyProfit)), note: profitable ? 'прибыльно' : `убыток (OPEX ${OPEX_MONTHLY_MLN} млн ₽/мес)`, tone: profitable ? 'success' as const : 'danger' as const },
    { label: 'Сделок / месяц',       value: m.dealsPerMonth.toFixed(0), note: `ср. чек ${params.dealAvgMlnRub} млн ₽`, tone: 'neutral' as const },
    { label: 'Break-even GMV',       value: `${m.breakEvenGmv.toFixed(0)} млн`, note: 'min GMV/мес для безубытка', tone: 'neutral' as const },
    { label: 'Выручка / орг / год',  value: fmt(m.revenuePerOrg),     note: `${params.orgCount} организаций`, tone: 'info' as const },
    { label: 'Выручка с удержанием', value: fmt(m.retainedRevenue),   note: `отток ${params.churnPct}%/мес`, tone: params.churnPct > 10 ? 'danger' as const : 'success' as const },
  ];

  const TONE_COLOR: Record<string, string> = {
    info: 'var(--status-info-text, #2563EB)',
    success: 'var(--status-active-text, #059669)',
    danger: 'var(--status-error-text, #DC2626)',
    neutral: 'var(--pc-text-muted)',
  };

  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      {/* Scenario presets */}
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        {SCENARIOS.map((s, i) => (
          <button
            key={i}
            onClick={() => applyScenario(i)}
            style={{
              padding: '0.375rem 0.875rem', borderRadius: '8px', fontSize: '10px', fontWeight: 700, cursor: 'pointer',
              background: activeScenario === i ? 'var(--p7-color-brand)' : 'var(--p7-color-surface-muted)',
              color: activeScenario === i ? '#fff' : 'var(--pc-text-muted)',
              border: `1px solid ${activeScenario === i ? 'var(--p7-color-brand)' : 'var(--p7-color-border)'}`,
            }}
          >
            {s.label}
          </button>
        ))}
        <button
          onClick={() => { setParams(DEFAULT_PARAMS); setActiveScenario(null); }}
          style={{ padding: '0.375rem 0.875rem', borderRadius: '8px', fontSize: '10px', fontWeight: 700, cursor: 'pointer', background: 'transparent', color: 'var(--pc-text-muted)', border: '1px solid var(--p7-color-border)' }}
        >
          Сбросить
        </button>
        <button
          onClick={handleExport}
          disabled={exporting}
          style={{ padding: '0.375rem 0.875rem', borderRadius: '8px', fontSize: '10px', fontWeight: 700, cursor: 'pointer', background: 'var(--p7-color-brand, #0A7A5F)', color: '#fff', border: 'none', opacity: exporting ? 0.7 : 1 }}
        >
          {exporting ? 'Экспорт…' : '↓ Пилотный отчёт'}
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
        {/* Sliders */}
        <div style={{ display: 'grid', gap: '0.875rem', padding: '0.875rem', background: 'var(--p7-color-surface-muted)', borderRadius: '12px', border: '1px solid var(--p7-color-border)' }}>
          <div style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--pc-text-primary)' }}>Параметры модели</div>
          <RangeInput
            label="GMV в месяц"
            value={params.gmvMonthlyMlnRub}
            min={10} max={100_000} step={10}
            format={(v) => v >= 1000 ? `${(v / 1000).toFixed(1)} млрд ₽` : `${v} млн ₽`}
            onChange={(v) => updateParam('gmvMonthlyMlnRub', v)}
          />
          <RangeInput
            label="Комиссия платформы"
            value={params.commissionPct}
            min={0.5} max={5} step={0.1}
            format={(v) => `${v.toFixed(1)}%`}
            onChange={(v) => updateParam('commissionPct', v)}
          />
          <RangeInput
            label="Ср. чек сделки"
            value={params.dealAvgMlnRub}
            min={0.5} max={50} step={0.5}
            format={(v) => `${v} млн ₽`}
            onChange={(v) => updateParam('dealAvgMlnRub', v)}
          />
          <RangeInput
            label="Отток организаций/мес"
            value={params.churnPct}
            min={0} max={30} step={1}
            format={(v) => `${v}%`}
            onChange={(v) => updateParam('churnPct', v)}
          />
        </div>

        {/* KPI grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.5rem', alignContent: 'start' }}>
          {kpis.map((kpi) => (
            <div key={kpi.label} style={{ padding: '0.75rem', borderRadius: '10px', background: 'var(--p7-color-surface)', border: '1px solid var(--p7-color-border)', display: 'grid', gap: '0.25rem' }}>
              <div style={{ fontSize: '9px', color: 'var(--pc-text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{kpi.label}</div>
              <div style={{ fontSize: '1.125rem', fontWeight: 800, color: TONE_COLOR[kpi.tone], fontFamily: 'var(--font-mono)', lineHeight: 1.1 }}>{kpi.value}</div>
              <div style={{ fontSize: '9px', color: 'var(--pc-text-muted)', lineHeight: 1.4 }}>{kpi.note}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Break-even progress */}
      <div style={{ padding: '0.75rem', borderRadius: '10px', background: 'var(--p7-color-surface-muted)', border: '1px solid var(--p7-color-border)', display: 'grid', gap: '0.375rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', fontWeight: 700, color: 'var(--pc-text-muted)' }}>
          <span>Загрузка до break-even</span>
          <span style={{ color: profitable ? '#059669' : '#D97706' }}>
            {profitable ? 'Прибыльно ✓' : `${Math.min(100, Math.round((m.monthlyRevenue / OPEX_MONTHLY_MLN) * 100))}% от порога`}
          </span>
        </div>
        <div style={{ height: 6, borderRadius: 3, background: '#E4E6EA', overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${Math.min(100, (m.monthlyRevenue / OPEX_MONTHLY_MLN) * 100)}%`, background: profitable ? '#059669' : '#D97706', transition: 'width .4s ease', borderRadius: 3 }} />
        </div>
        <div style={{ fontSize: '9px', color: 'var(--pc-text-muted)' }}>
          Текущая выручка: {fmt(m.monthlyRevenue)}/мес · Break-even: {fmt(OPEX_MONTHLY_MLN)}/мес
          {!profitable && m.runwayMonths !== Infinity && ` · Runway при 18 млн ₽ инвестиций: ~${m.runwayMonths} мес`}
        </div>
      </div>

      <div style={{ fontSize: '10px', color: 'var(--pc-text-muted)', lineHeight: 1.5, padding: '0.5rem 0.75rem', borderRadius: '8px', background: 'var(--p7-color-surface-muted)', border: '1px solid var(--p7-color-border)' }}>
        Расчёт основан на модельных данных сценария. OPEX-оценка: команда + инфра + лицензии. Реальные показатели зависят от live-интеграций и фактических сделок. Кнопка «Пилотный отчёт» выгружает .txt с параметрами.
      </div>
    </div>
  );
}
