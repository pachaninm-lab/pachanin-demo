'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useState, Suspense } from 'react';
import { AppShell } from '../../components/app-shell';

function LoginForm() {
  const searchParams = useSearchParams();
  const returnTo = searchParams.get('returnTo') || '/cabinet';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    const trimmedEmail = email.trim();
    if (!trimmedEmail) return;
    setError(null);
    setLoading(true);

    // Demo emails — use GET /api/auth/demo (sets cookies + redirect in ONE response, iOS Safari safe)
    const isDemo = trimmedEmail.toLowerCase().endsWith('@demo.ru') || trimmedEmail.toLowerCase().endsWith('@demo.test');
    if (isDemo) {
      window.location.href = `/api/auth/demo?email=${encodeURIComponent(trimmedEmail)}&to=${encodeURIComponent(returnTo)}`;
      return;
    }

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: trimmedEmail, password }),
      });
      const data = await res.json();
      if (data.ok) {
        window.location.href = decodeURIComponent(returnTo);
      } else if (res.status === 401) {
        setError('Неверный email или пароль.');
      } else {
        setError(data.message || 'Не удалось войти. Попробуйте позже.');
      }
    } catch {
      setError('Нет соединения с сервером.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleLogin}>
      <div className="card max-w-xl">
        {searchParams.get('reason') === 'session_expired' && (
          <div className="soft-box" style={{ background: 'var(--color-amber-soft, #fef3c7)', marginBottom: 16 }}>
            Сессия истекла — войдите снова, чтобы продолжить работу.
          </div>
        )}
        {error && (
          <div className="soft-box" style={{ background: 'var(--color-red-soft, #fef2f2)', color: '#991b1b', marginBottom: 16 }}>
            {error}
          </div>
        )}
        <label className="field-label" htmlFor="email">Email</label>
        <input
          id="email"
          className="input"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="farmer@demo.ru"
          autoComplete="username"
          required
          disabled={loading}
        />
        <label className="field-label" htmlFor="password" style={{ marginTop: 12 }}>Пароль</label>
        <input
          id="password"
          className="input"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="любой или пустой в демо"
          autoComplete="current-password"
          disabled={loading}
        />
        <div className="row" style={{ marginTop: 16, gap: 12 }}>
          <button className="primary-button" type="submit" disabled={loading || !email}>
            {loading ? 'Вхожу…' : 'Войти'}
          </button>
          <Link href="/register" className="secondary-link">Регистрация</Link>
        </div>
        <div style={{ marginTop: 24, paddingTop: 20, borderTop: '1px solid var(--border)', textAlign: 'center' }}>
          <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 600 }}>
            Или войдите в демо без пароля
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'center' }}>
            {[
              { email: 'farmer@demo.ru', label: '🌾 Фермер' },
              { email: 'buyer@demo.ru',  label: '🏢 Покупатель' },
              { email: 'operator@demo.ru', label: '⚙️ Оператор' },
            ].map((r) => (
              <a
                key={r.email}
                href={`/api/auth/demo?email=${r.email}&to=${encodeURIComponent(returnTo)}`}
                style={{
                  padding: '6px 12px', borderRadius: 8,
                  background: 'rgba(56,189,248,0.08)',
                  border: '1px solid rgba(56,189,248,0.2)',
                  color: '#38bdf8', textDecoration: 'none',
                  fontSize: 13, fontWeight: 600,
                }}
              >
                {r.label}
              </a>
            ))}
          </div>
          <a href="/demo" style={{ display: 'inline-block', marginTop: 10, fontSize: 12, color: 'var(--text-3)', textDecoration: 'none' }}>
            Все 10 ролей →
          </a>
        </div>
      </div>
    </form>
  );
}

export default function LoginPage() {
  return (
    <AppShell title="Вход" subtitle="Авторизация в рабочий контур">
      <Suspense fallback={<div className="card max-w-xl">Загрузка…</div>}>
        <LoginForm />
      </Suspense>
    </AppShell>
  );
}
