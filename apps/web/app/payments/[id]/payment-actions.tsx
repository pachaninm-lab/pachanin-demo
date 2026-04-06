'use client';

import { useState } from 'react';
import { applyCsrfHeader } from '../../../lib/csrf';

export function PaymentActions({ id }: { id: string }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function perform(path: string) {
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch(path, {
        method: 'POST',
        headers: Object.fromEntries(applyCsrfHeader({ 'Content-Type': 'application/json' })),
        body: JSON.stringify({}),
      });
      const payload = await response.json().catch(() => ({}));
      setMessage(payload?.message || 'Операция выполнена.');
      window.location.reload();
    } catch {
      setMessage('Платёжный контур недоступен.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="inline-flex" style={{ gap: 8, flexWrap: 'wrap' }}>
      <button className="primary-link" disabled={busy} onClick={() => perform(`/api/payments/${id}/reserve`)}>Зарезервировать</button>
      <button className="secondary-link" disabled={busy} onClick={() => perform(`/api/payments/${id}/hold`)}>Поставить hold</button>
      <button className="secondary-link" disabled={busy} onClick={() => perform(`/api/payments/${id}/release`)}>Release</button>
      {message ? <div className="muted tiny" style={{ width: '100%', marginTop: 8 }}>{message}</div> : null}
    </div>
  );
}
