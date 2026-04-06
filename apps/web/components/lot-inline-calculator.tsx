'use client';

import { useMemo } from 'react';

export function LotInlineCalculator({ volume, price, logistics, qualityDelta = 0 }: { volume: number; price: number; logistics: number; qualityDelta?: number }) {
  const netback = useMemo(() => volume * (price - logistics + qualityDelta), [volume, price, logistics, qualityDelta]);
  return (
    <div className="detail-meta">
      <span className="mini-chip">gross {(volume * price).toLocaleString('ru-RU')} ₽</span>
      <span className="mini-chip">netback {netback.toLocaleString('ru-RU')} ₽</span>
      <span className="mini-chip">логистика {logistics.toLocaleString('ru-RU')} ₽/т</span>
    </div>
  );
}
