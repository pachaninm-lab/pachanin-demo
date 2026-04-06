'use client';
import { useEffect, useState } from 'react';

export function OfflineBanner() {
  const [online, setOnline] = useState(true);
  const [pending, setPending] = useState(0);

  useEffect(() => {
    setOnline(navigator.onLine);
    const onOnline = () => { setOnline(true); setPending(0); };
    const onOffline = () => setOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => { window.removeEventListener('online', onOnline); window.removeEventListener('offline', onOffline); };
  }, []);

  if (online && pending === 0) return null;

  return (
    <div className={`fixed bottom-0 left-0 right-0 z-50 px-4 py-2 text-center text-sm font-medium ${online ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'}`}>
      {!online ? (
        <span>📡 Нет подключения к интернету. Данные сохраняются локально и будут отправлены при восстановлении связи.</span>
      ) : pending > 0 ? (
        <span>🔄 Синхронизация: {pending} действий в очереди...</span>
      ) : null}
    </div>
  );
}
