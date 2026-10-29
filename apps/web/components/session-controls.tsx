'use client';

import { useRouter } from 'next/navigation';
import { clearClientSessionState } from '@/lib/client-session-cleanup';

export function SessionControls() {
  const router = useRouter();

  async function logout() {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } finally {
      // В finally, а не после await: сессия должна быть убрана с устройства и
      // тогда, когда запрос не дошёл.
      clearClientSessionState();
    }
    router.push('/login');
    router.refresh();
  }

  return (
    <div className="cta-stack">
      <button className="button secondary" onClick={() => router.refresh()}>Обновить сессию</button>
      <button className="button secondary" onClick={logout}>Выйти</button>
    </div>
  );
}
