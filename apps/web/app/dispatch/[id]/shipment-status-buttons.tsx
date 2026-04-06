'use client';

import { useState } from 'react';
import { applyCsrfHeader } from '../../../lib/csrf';

const STATUSES = [
  { code: 'DRIVER_CONFIRMED', label: 'Подтвердить рейс' },
  { code: 'AT_LOADING', label: 'На погрузке' },
  { code: 'LOADED', label: 'Погружен' },
  { code: 'IN_TRANSIT', label: 'В пути' },
  { code: 'AT_UNLOADING', label: 'На разгрузке' },
  { code: 'UNLOADED', label: 'Разгружен' },
  { code: 'CONFIRMED', label: 'Подтвердить' },
] as const;

export function ShipmentStatusButtons({ shipmentId }: { shipmentId: string }) {
  const [busy, setBusy] = useState<string | null>(null);

  async function transition(nextState: string) {
    setBusy(nextState);
    try {
      await fetch(`/api/proxy/logistics/shipments/${shipmentId}/transition`, {
        method: 'PATCH',
        headers: Object.fromEntries(applyCsrfHeader({ 'Content-Type': 'application/json' })),
        body: JSON.stringify({ nextState }),
      });
      window.location.reload();
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="inline-flex" style={{ gap: 8, flexWrap: 'wrap' }}>
      {STATUSES.map((item) => (
        <button key={item.code} className="secondary-link" disabled={busy !== null} onClick={() => transition(item.code)}>
          {busy === item.code ? '...' : item.label}
        </button>
      ))}
    </div>
  );
}
