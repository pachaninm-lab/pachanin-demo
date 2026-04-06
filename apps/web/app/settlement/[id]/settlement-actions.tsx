'use client';

import { useState } from 'react';
import { applyCsrfHeader } from '../../../lib/csrf';

export function SettlementActions({ id }: { id: string }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function run(path: string, payload?: Record<string, unknown>) {
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch(path, {
        method: 'POST',
        headers: Object.fromEntries(applyCsrfHeader({ 'Content-Type': 'application/json' })),
        body: JSON.stringify(payload || {}),
      });
      const result = await response.json().catch(() => ({}));
      setMessage(result?.message || 'Операция выполнена.');
      window.location.reload();
    } catch {
      setMessage('Операция недоступна.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="inline-flex" style={{ gap: 8, flexWrap: 'wrap' }}>
      <button className="primary-link" disabled={busy} onClick={() => run(`/api/settlement/${id}/confirm`)}>Подтвердить worksheet</button>
      <button className="secondary-link" disabled={busy} onClick={() => run(`/api/settlement/${id}/release`)}>Выпустить деньги</button>
      {message ? <div className="muted tiny" style={{ width: '100%', marginTop: 8 }}>{message}</div> : null}
    </div>
  );
}
