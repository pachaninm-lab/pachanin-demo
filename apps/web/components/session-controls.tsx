'use client';

import { useRouter } from 'next/navigation';

export function SessionControls() {
  const router = useRouter();

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
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
