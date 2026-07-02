'use client';

import { useState } from 'react';

export type GrainCulture = 'wheat_3' | 'wheat_4' | 'barley' | 'corn' | 'sunflower' | 'rapeseed' | 'soy';

export interface GostIndicator {
  id: string;
  label: string;
  unit: string;
  limitType: 'max' | 'min' | 'range';
  limitMin?: number;
  limitMax?: number;
  gostRef: string;
}

export interface GostQualityResult {
  culture: GrainCulture;
  sampleId: string;
  values: Record<string, number | null>;
  status: 'ok' | 'deviation' | 'reject';
  deviations: string[];
  timestamp: string;
}

const CULTURE_LABELS: Record<GrainCulture, string> = {
  wheat_3: 'Пшеница 3 кл. (ГОСТ 9353)',
  wheat_4: 'Пшеница 4 кл. (ГОСТ 9353)',
  barley: 'Ячмень (ГОСТ 5060)',
  corn: 'Кукуруза (ГОСТ 13634)',
  sunflower: 'Подсолнечник (ГОСТ 22391)',
  rapeseed: 'Рапс (ГОСТ 10583)',
  soy: 'Соя (ГОСТ 17109)',
};

const GOST_INDICATORS: Record<GrainCulture, GostIndicator[]> = {
  wheat_3: [
    { id: 'moisture', label: 'Влажность', unit: '%', limitType: 'max', limitMax: 14, gostRef: 'ГОСТ 9353-2016 п.5.1' },
    { id: 'gluten', label: 'Клейковина', unit: '%', limitType: 'min', limitMin: 23, gostRef: 'ГОСТ 9353-2016 п.5.3' },
    { id: 'weed_impurity', label: 'Сорная примесь', unit: '%', limitType: 'max', limitMax: 2, gostRef: 'ГОСТ 9353-2016 п.5.4' },
    { id: 'grain_impurity', label: 'Зерновая примесь', unit: '%', limitType: 'max', limitMax: 5, gostRef: 'ГОСТ 9353-2016 п.5.4' },
    { id: 'falling_number', label: 'Число падения (ЧП)', unit: 'с', limitType: 'min', limitMin: 150, gostRef: 'ГОСТ 9353-2016 п.5.5' },
    { id: 'specific_weight', label: 'Натура', unit: 'г/л', limitType: 'min', limitMin: 730, gostRef: 'ГОСТ 9353-2016 п.5.6' },
    { id: 'protein', label: 'Белок', unit: '%', limitType: 'min', limitMin: 12, gostRef: 'ГОСТ Р 54478-2011' },
  ],
  wheat_4: [
    { id: 'moisture', label: 'Влажность', unit: '%', limitType: 'max', limitMax: 14, gostRef: 'ГОСТ 9353-2016 п.5.1' },
    { id: 'gluten', label: 'Клейковина', unit: '%', limitType: 'min', limitMin: 18, gostRef: 'ГОСТ 9353-2016 п.5.3' },
    { id: 'weed_impurity', label: 'Сорная примесь', unit: '%', limitType: 'max', limitMax: 2, gostRef: 'ГОСТ 9353-2016 п.5.4' },
    { id: 'grain_impurity', label: 'Зерновая примесь', unit: '%', limitType: 'max', limitMax: 5, gostRef: 'ГОСТ 9353-2016 п.5.4' },
    { id: 'falling_number', label: 'Число падения (ЧП)', unit: 'с', limitType: 'min', limitMin: 80, gostRef: 'ГОСТ 9353-2016 п.5.5' },
    { id: 'specific_weight', label: 'Натура', unit: 'г/л', limitType: 'min', limitMin: 710, gostRef: 'ГОСТ 9353-2016 п.5.6' },
    { id: 'protein', label: 'Белок', unit: '%', limitType: 'min', limitMin: 10.5, gostRef: 'ГОСТ Р 54478-2011' },
  ],
  barley: [
    { id: 'moisture', label: 'Влажность', unit: '%', limitType: 'max', limitMax: 14, gostRef: 'ГОСТ 5060-2021 п.5.1' },
    { id: 'weed_impurity', label: 'Сорная примесь', unit: '%', limitType: 'max', limitMax: 2, gostRef: 'ГОСТ 5060-2021 п.5.2' },
    { id: 'grain_impurity', label: 'Зерновая примесь', unit: '%', limitType: 'max', limitMax: 4, gostRef: 'ГОСТ 5060-2021 п.5.2' },
    { id: 'specific_weight', label: 'Натура', unit: 'г/л', limitType: 'min', limitMin: 570, gostRef: 'ГОСТ 5060-2021 п.5.3' },
    { id: 'protein', label: 'Белок', unit: '%', limitType: 'min', limitMin: 8, gostRef: 'ГОСТ Р 54478-2011' },
  ],
  corn: [
    { id: 'moisture', label: 'Влажность', unit: '%', limitType: 'max', limitMax: 14, gostRef: 'ГОСТ 13634-90 п.2.1' },
    { id: 'weed_impurity', label: 'Сорная примесь', unit: '%', limitType: 'max', limitMax: 2, gostRef: 'ГОСТ 13634-90 п.2.1' },
    { id: 'grain_impurity', label: 'Зерновая примесь', unit: '%', limitType: 'max', limitMax: 5, gostRef: 'ГОСТ 13634-90 п.2.1' },
    { id: 'specific_weight', label: 'Натура', unit: 'г/л', limitType: 'min', limitMin: 660, gostRef: 'ГОСТ 13634-90 п.2.1' },
  ],
  sunflower: [
    { id: 'moisture', label: 'Влажность', unit: '%', limitType: 'max', limitMax: 8, gostRef: 'ГОСТ 22391-2015 п.5.1' },
    { id: 'weed_impurity', label: 'Сорная примесь', unit: '%', limitType: 'max', limitMax: 3, gostRef: 'ГОСТ 22391-2015 п.5.2' },
    { id: 'oil', label: 'Масличность', unit: '%', limitType: 'min', limitMin: 42, gostRef: 'ГОСТ 22391-2015 п.5.3' },
    { id: 'acid_number', label: 'Кислотное число масла', unit: 'мг КОН/г', limitType: 'max', limitMax: 3, gostRef: 'ГОСТ 22391-2015 п.5.4' },
  ],
  rapeseed: [
    { id: 'moisture', label: 'Влажность', unit: '%', limitType: 'max', limitMax: 12, gostRef: 'ГОСТ 10583-76 п.2.1' },
    { id: 'weed_impurity', label: 'Сорная примесь', unit: '%', limitType: 'max', limitMax: 3, gostRef: 'ГОСТ 10583-76 п.2.1' },
    { id: 'oil', label: 'Масличность', unit: '%', limitType: 'min', limitMin: 40, gostRef: 'ГОСТ 10583-76 п.2.2' },
    { id: 'glucosinolates', label: 'Глюкозинолаты', unit: 'мкмоль/г', limitType: 'max', limitMax: 25, gostRef: 'ГОСТ Р 52179' },
  ],
  soy: [
    { id: 'moisture', label: 'Влажность', unit: '%', limitType: 'max', limitMax: 14, gostRef: 'ГОСТ 17109-2013 п.5.1' },
    { id: 'weed_impurity', label: 'Сорная примесь', unit: '%', limitType: 'max', limitMax: 3, gostRef: 'ГОСТ 17109-2013 п.5.2' },
    { id: 'protein', label: 'Белок', unit: '%', limitType: 'min', limitMin: 33, gostRef: 'ГОСТ 17109-2013 п.5.3' },
    { id: 'oil', label: 'Масличность', unit: '%', limitType: 'min', limitMin: 17, gostRef: 'ГОСТ 17109-2013 п.5.4' },
  ],
};

function checkDeviation(indicator: GostIndicator, value: number): string | null {
  if (indicator.limitType === 'max' && indicator.limitMax !== undefined && value > indicator.limitMax) {
    return `${indicator.label}: ${value} ${indicator.unit} > допуск ${indicator.limitMax} ${indicator.unit}`;
  }
  if (indicator.limitType === 'min' && indicator.limitMin !== undefined && value < indicator.limitMin) {
    return `${indicator.label}: ${value} ${indicator.unit} < норма ${indicator.limitMin} ${indicator.unit}`;
  }
  return null;
}

function getValueStatus(indicator: GostIndicator, value: number | null): 'ok' | 'warn' | 'error' | 'empty' {
  if (value === null) return 'empty';
  const dev = checkDeviation(indicator, value);
  if (!dev) return 'ok';
  const ratio = indicator.limitType === 'max' && indicator.limitMax
    ? value / indicator.limitMax
    : indicator.limitMin ? indicator.limitMin / value : 1;
  return ratio > 1.2 ? 'error' : 'warn';
}

const STATUS_COLOR = {
  ok: 'var(--status-active-text, #059669)',
  warn: 'var(--status-warning-text, #D97706)',
  error: 'var(--status-error-text, #DC2626)',
  empty: 'var(--pc-text-muted, #64748B)',
};

const STATUS_BG = {
  ok: 'var(--status-active-bg, rgba(5,150,105,0.08))',
  warn: 'var(--status-warning-bg, rgba(217,119,6,0.08))',
  error: 'var(--status-error-bg, rgba(220,38,38,0.08))',
  empty: 'transparent',
};

interface Props {
  defaultCulture?: GrainCulture;
  sampleId?: string;
  onResult?: (result: GostQualityResult) => void;
  compact?: boolean;
}

export function GostQualityForm({ defaultCulture = 'wheat_3', sampleId = 'SAMPLE-001', onResult, compact = false }: Props) {
  const [culture, setCulture] = useState<GrainCulture>(defaultCulture);
  const [values, setValues] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [result, setResult] = useState<GostQualityResult | null>(null);

  const indicators = GOST_INDICATORS[culture];

  function handleSubmit() {
    const parsed: Record<string, number | null> = {};
    const deviations: string[] = [];

    for (const ind of indicators) {
      const raw = values[ind.id];
      const val = raw !== undefined && raw !== '' ? parseFloat(raw.replace(',', '.')) : null;
      parsed[ind.id] = val;
      if (val !== null) {
        const dev = checkDeviation(ind, val);
        if (dev) deviations.push(dev);
      }
    }

    const allFilled = indicators.every((ind) => parsed[ind.id] !== null);
    const status: GostQualityResult['status'] = !allFilled ? 'deviation' : deviations.length === 0 ? 'ok' : 'reject';

    const res: GostQualityResult = {
      culture,
      sampleId,
      values: parsed,
      status: deviations.length > 0 ? (deviations.length > 2 ? 'reject' : 'deviation') : 'ok',
      deviations,
      timestamp: new Date().toISOString(),
    };

    setResult(res);
    setSubmitted(true);
    onResult?.(res);
  }

  const filledCount = indicators.filter((ind) => values[ind.id] !== undefined && values[ind.id] !== '').length;

  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      {/* Culture selector */}
      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--pc-text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Культура</span>
        <select
          value={culture}
          onChange={(e) => { setCulture(e.target.value as GrainCulture); setSubmitted(false); setResult(null); setValues({}); }}
          style={{
            fontSize: 'var(--text-sm)', fontWeight: 600,
            padding: '0.375rem 0.75rem', borderRadius: '8px',
            border: '1px solid var(--p7-color-border, #24342F)',
            background: 'var(--p7-color-surface-muted, #111A18)',
            color: 'var(--pc-text-primary)',
            cursor: 'pointer',
          }}
        >
          {(Object.entries(CULTURE_LABELS) as [GrainCulture, string][]).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--pc-text-muted)' }}>
          Проба: <span className="mono">{sampleId}</span>
        </span>
      </div>

      {/* Indicators grid */}
      <div style={{ display: 'grid', gridTemplateColumns: compact ? '1fr' : 'repeat(auto-fill, minmax(280px, 1fr))', gap: '0.5rem' }}>
        {indicators.map((ind) => {
          const rawVal = values[ind.id];
          const numVal = rawVal !== undefined && rawVal !== '' ? parseFloat(rawVal.replace(',', '.')) : null;
          const st = submitted ? getValueStatus(ind, numVal) : (numVal !== null ? getValueStatus(ind, numVal) : 'empty');

          return (
            <div
              key={ind.id}
              style={{
                padding: '0.75rem',
                borderRadius: '10px',
                background: STATUS_BG[st],
                border: `1px solid ${st !== 'empty' ? STATUS_COLOR[st] + '33' : 'var(--p7-color-border, #24342F)'}`,
                display: 'grid',
                gap: '0.375rem',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
                <div>
                  <div style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--pc-text-primary)' }}>{ind.label}</div>
                  <div style={{ fontSize: '10px', color: 'var(--pc-text-muted)', marginTop: '1px' }}>{ind.gostRef}</div>
                </div>
                <div style={{ fontSize: '10px', color: STATUS_COLOR[st === 'empty' ? 'empty' : st], fontWeight: 700, whiteSpace: 'nowrap', flexShrink: 0 }}>
                  {ind.limitType === 'max' ? `≤ ${ind.limitMax}` : ind.limitType === 'min' ? `≥ ${ind.limitMin}` : `${ind.limitMin}–${ind.limitMax}`} {ind.unit}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <input
                  type="number"
                  step="0.1"
                  value={rawVal ?? ''}
                  onChange={(e) => setValues((prev) => ({ ...prev, [ind.id]: e.target.value }))}
                  placeholder="0.0"
                  style={{
                    flex: 1, minWidth: 0,
                    padding: '0.375rem 0.5rem',
                    borderRadius: '6px',
                    border: `1px solid ${st !== 'empty' ? STATUS_COLOR[st] + '66' : 'var(--p7-color-border)'}`,
                    background: 'var(--p7-color-surface, #0E1A18)',
                    color: 'var(--pc-text-primary)',
                    fontSize: 'var(--text-sm)',
                    fontFamily: 'var(--font-mono)',
                    fontWeight: 600,
                  }}
                />
                <span style={{ fontSize: 'var(--text-xs)', color: STATUS_COLOR[st], fontWeight: 600, flexShrink: 0 }}>
                  {st === 'ok' && '✓'} {st === 'warn' && '⚠'} {st === 'error' && '✗'} {ind.unit}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Progress + Submit */}
      <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: '140px' }}>
          <div style={{ height: '4px', borderRadius: '2px', background: 'var(--p7-color-border)', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${(filledCount / indicators.length) * 100}%`, background: 'var(--status-active-text)', borderRadius: '2px', transition: 'width 0.3s' }} />
          </div>
          <div style={{ fontSize: '10px', color: 'var(--pc-text-muted)', marginTop: '0.25rem' }}>
            {filledCount} из {indicators.length} показателей заполнено
          </div>
        </div>
        <button
          onClick={handleSubmit}
          disabled={filledCount === 0}
          style={{
            padding: '0.5rem 1.25rem',
            borderRadius: '8px',
            border: 'none',
            background: filledCount === 0 ? 'var(--p7-color-border)' : 'var(--p7-color-brand, #0A7A5F)',
            color: filledCount === 0 ? 'var(--pc-text-muted)' : '#fff',
            fontSize: 'var(--text-sm)',
            fontWeight: 700,
            cursor: filledCount === 0 ? 'not-allowed' : 'pointer',
            minHeight: '44px',
          }}
        >
          Сформировать протокол
        </button>
      </div>

      {/* Result */}
      {result && (
        <div style={{
          padding: '1rem',
          borderRadius: '12px',
          background: result.status === 'ok' ? 'var(--status-active-bg)' : result.status === 'deviation' ? 'var(--status-warning-bg)' : 'var(--status-error-bg)',
          border: `1px solid ${result.status === 'ok' ? 'var(--status-active-text)' : result.status === 'deviation' ? 'var(--status-warning-text)' : 'var(--status-error-text)'}33`,
          display: 'grid',
          gap: '0.5rem',
        }}>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <span style={{ fontSize: '1.25rem' }}>
              {result.status === 'ok' ? '✅' : result.status === 'deviation' ? '⚠️' : '❌'}
            </span>
            <div>
              <div style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--pc-text-primary)' }}>
                {result.status === 'ok' ? 'Качество соответствует ГОСТ — допуск выдан' : result.status === 'deviation' ? 'Отклонение — допуск с протоколом' : 'Отказ в допуске — ГОСТ не пройден'}
              </div>
              <div style={{ fontSize: '10px', color: 'var(--pc-text-muted)' }}>
                {CULTURE_LABELS[result.culture]} · {new Date(result.timestamp).toLocaleTimeString('ru-RU')}
              </div>
            </div>
          </div>
          {result.deviations.length > 0 && (
            <div style={{ display: 'grid', gap: '0.25rem' }}>
              {result.deviations.map((d, i) => (
                <div key={i} style={{ fontSize: 'var(--text-xs)', color: 'var(--status-error-text)', paddingLeft: '0.5rem', borderLeft: '2px solid var(--status-error-text)' }}>
                  {d}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
