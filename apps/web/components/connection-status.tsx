'use client';

import { useEffect, useState } from 'react';

export function ConnectionStatus() {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    const sync = () => setOnline(window.navigator.onLine);
    sync();
    window.addEventListener('online', sync);
    window.addEventListener('offline', sync);
    return () => {
      window.removeEventListener('online', sync);
      window.removeEventListener('offline', sync);
    };
  }, []);

  return (
    <div className={online ? 'highlight-green' : 'highlight-red'}>
      {online ? 'Сеть доступна' : 'Нет сети'}
    </div>
  );
}
