'use client';

import { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[pc:global-error]', error.message, error.digest);
  }, [error]);

  const is401 = error.message?.includes('401') || error.message?.includes('Unauthorized');
  const isNetwork = error.message?.includes('fetch') || error.message?.includes('network');

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ maxWidth: 480, width: '100%' }}>
        <div style={{ fontSize: 32, marginBottom: 16 }}>⚠</div>
        <h1 style={{ fontWeight: 800, fontSize: 22, margin: '0 0 8px' }}>
          {is401 ? 'Сессия истекла' : isNetwork ? 'Нет соединения' : 'Ошибка страницы'}
        </h1>
        <p style={{ color: '#6b7280', marginBottom: 24 }}>
          {is401
            ? 'Войдите снова, чтобы продолжить.'
            : isNetwork
            ? 'Платформа временно недоступна. Проверьте соединение и попробуйте снова.'
            : 'Произошла критическая ошибка. Команда уведомлена.'}
        </p>
        <div style={{ display: 'flex', gap: 12 }}>
          {is401 ? (
            <a href="/login" style={{ padding: '10px 20px', background: '#0A5C36', color: '#fff', borderRadius: 8, textDecoration: 'none', fontWeight: 600 }}>
              Войти снова
            </a>
          ) : (
            <button onClick={reset} style={{ padding: '10px 20px', background: '#0A5C36', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>
              Попробовать снова
            </button>
          )}
          <a href="/" style={{ padding: '10px 20px', border: '1px solid #d1d5db', borderRadius: 8, textDecoration: 'none', color: '#374151', fontWeight: 600 }}>
            На главную
          </a>
        </div>
        {process.env.NODE_ENV !== 'production' && error.digest && (
          <p style={{ marginTop: 16, fontSize: 11, color: '#9ca3af' }}>digest: {error.digest}</p>
        )}
      </div>
    </div>
  );
}
