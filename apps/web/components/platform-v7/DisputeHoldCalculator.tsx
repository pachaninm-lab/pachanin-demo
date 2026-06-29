'use client';

import { useState } from 'react';

interface Props {
  totalKopecks: number;
  disputeType: 'QUALITY' | 'WEIGHT' | 'TIMING' | 'FRAUD' | 'OTHER';
  claimKopecks?: number;
}

const DISPUTE_TYPE_LABEL: Record<Props['disputeType'], string> = {
  QUALITY:  'Расхождение качества',
  WEIGHT:   'Расхождение веса',
  TIMING:   'Нарушение срока',
  FRAUD:    'Мошенничество',
  OTHER:    'Иное',
};

const ARBITRATION_FEE_RATE = 0.01; // 1% от суммы спора
const MIN_ARBITRATION_FEE_KOPECKS = 5_000_00; // 5 000 ₽ минимум
const MAX_ARBITRATION_FEE_KOPECKS = 100_000_00; // 100 000 ₽ максимум

function formatRub(kopecks: number): string {
  return new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 }).format(kopecks / 100);
}

export function DisputeHoldCalculator({ totalKopecks, disputeType, claimKopecks }: Props) {
  const [splitPct, setSplitPct] = useState(50);
  const [includeArbitration, setIncludeArbitration] = useState(true);

  const claim = claimKopecks ?? totalKopecks;
  const buyerGets = Math.round(claim * (splitPct / 100));
  const sellerGets = claim - buyerGets;

  const rawArbitrationFee = Math.round(claim * ARBITRATION_FEE_RATE);
  const arbitrationFee = Math.max(
    MIN_ARBITRATION_FEE_KOPECKS,
    Math.min(MAX_ARBITRATION_FEE_KOPECKS, rawArbitrationFee),
  );

  const netBuyer = includeArbitration ? Math.max(0, buyerGets - Math.round(arbitrationFee / 2)) : buyerGets;
  const netSeller = includeArbitration ? Math.max(0, sellerGets - Math.round(arbitrationFee / 2)) : sellerGets;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
        <span className="caption">Тип спора:</span>
        <span style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--status-dispute-text)' }}>
          {DISPUTE_TYPE_LABEL[disputeType]}
        </span>
        <span style={{ marginLeft: 'auto', fontSize: 'var(--text-sm)', color: 'var(--pc-text-muted)' }}>
          Сумма сделки: {formatRub(totalKopecks)}
        </span>
      </div>

      {/* Split slider */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <label htmlFor="split-slider" style={{ fontSize: 'var(--text-sm)', color: 'var(--pc-text-secondary)' }}>
            Доля возврата покупателю: <strong>{splitPct}%</strong>
          </label>
          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--pc-text-muted)' }}>
            продавцу: {100 - splitPct}%
          </span>
        </div>
        <input
          id="split-slider"
          type="range"
          min={0}
          max={100}
          step={5}
          value={splitPct}
          onChange={(e) => setSplitPct(Number(e.target.value))}
          style={{ width: '100%', accentColor: 'var(--p7-color-brand)' }}
          aria-label={`Доля возврата покупателю: ${splitPct}%`}
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-xs)', color: 'var(--pc-text-muted)' }}>
          <span>0% — только продавцу</span>
          <span>100% — только покупателю</span>
        </div>
      </div>

      {/* Arbitration fee toggle */}
      <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: 'var(--text-sm)', color: 'var(--pc-text-secondary)' }}>
        <input
          type="checkbox"
          checked={includeArbitration}
          onChange={(e) => setIncludeArbitration(e.target.checked)}
          style={{ accentColor: 'var(--p7-color-brand)' }}
        />
        Включить арбитражный сбор ({formatRub(arbitrationFee)}, пополам)
      </label>

      {/* Result */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginTop: '0.25rem' }}>
        <div style={{ padding: '0.875rem', borderRadius: '10px', background: 'var(--p7-color-success-soft)', border: '1px solid var(--status-active-border)' }}>
          <div className="caption" style={{ color: 'var(--status-active-text)', marginBottom: '0.25rem' }}>Покупатель получает</div>
          <div style={{ fontSize: 'var(--text-xl)', fontWeight: 700, color: 'var(--status-active-text)' }}>
            {formatRub(netBuyer)}
          </div>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--pc-text-muted)', marginTop: '0.25rem' }}>
            {splitPct}% от {formatRub(claim)}
            {includeArbitration && ' − сбор ½'}
          </div>
        </div>

        <div style={{ padding: '0.875rem', borderRadius: '10px', background: 'var(--p7-color-surface-muted)', border: '1px solid var(--p7-color-border)' }}>
          <div className="caption" style={{ color: 'var(--pc-text-muted)', marginBottom: '0.25rem' }}>Продавец получает</div>
          <div style={{ fontSize: 'var(--text-xl)', fontWeight: 700, color: 'var(--pc-text-secondary)' }}>
            {formatRub(netSeller)}
          </div>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--pc-text-muted)', marginTop: '0.25rem' }}>
            {100 - splitPct}% от {formatRub(claim)}
            {includeArbitration && ' − сбор ½'}
          </div>
        </div>
      </div>

      {includeArbitration && (
        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--pc-text-muted)', padding: '0.5rem 0.75rem', background: 'var(--p7-color-surface-muted)', borderRadius: '8px' }}>
          Арбитражный сбор: {formatRub(arbitrationFee)} (1% от суммы, мин {formatRub(MIN_ARBITRATION_FEE_KOPECKS)}, макс {formatRub(MAX_ARBITRATION_FEE_KOPECKS)}) — распределяется поровну.
        </div>
      )}
    </div>
  );
}
