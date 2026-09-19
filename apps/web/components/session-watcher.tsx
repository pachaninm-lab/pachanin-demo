'use client';

import { useEffect, useState } from 'react';
import { startSessionWatcher, subscribeSessionState, type SessionState } from '../lib/auth-session';

export function SessionWatcher() {
  const [state, setState] = useState<SessionState | null>(null);

  useEffect(() => {
    startSessionWatcher();
    const unsub = subscribeSessionState(setState);
    return unsub;
  }, []);

  if (!state || state.status === 'active' || state.status === 'unauthenticated') return null;

  if (state.status === 'expiring_soon') {
    return (
      <div
        role="alert"
        style={{
          position: 'fixed', bottom: 80, right: 20, zIndex: 9999,
          background: '#92400e', color: '#fef3c7',
          padding: '12px 18px', borderRadius: 10,
          fontSize: 13, fontWeight: 600,
          boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
          maxWidth: 320,
        }}
      >
        ⏱ Сессия истекает через {state.minutesLeft} мин.
        <button
          onClick={() => fetch('/api/auth/refresh', { method: 'POST', credentials: 'same-origin' })}
          style={{ marginLeft: 10, textDecoration: 'underline', background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', fontWeight: 700 }}
        >
          Продлить
        </button>
      </div>
    );
  }

  if (state.status === 'expired') {
    return (
      <div
        role="alert"
        style={{
          position: 'fixed', inset: 0, zIndex: 10000,
          background: 'rgba(0,0,0,0.75)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        <div style={{ background: '#fff', borderRadius: 14, padding: 32, maxWidth: 380, width: '90%', textAlign: 'center' }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>🔒</div>
          <h2 style={{ margin: '0 0 8px', fontWeight: 800 }}>Сессия истекла</h2>
          <p style={{ color: '#6b7280', margin: '0 0 20px', fontSize: 14 }}>
            Войдите снова, чтобы продолжить работу. Несохранённые данные могут быть потеряны.
          </p>
          <a
            href={`/login?returnTo=${encodeURIComponent(typeof window !== 'undefined' ? window.location.pathname : '/')}&reason=session_expired`}
            style={{ display: 'block', padding: '12px 24px', background: '#0A5C36', color: '#fff', borderRadius: 8, textDecoration: 'none', fontWeight: 700 }}
          >
            Войти снова
          </a>
        </div>
      </div>
    );
  }

  return null;
}
