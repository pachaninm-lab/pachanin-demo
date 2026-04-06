'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState, Suspense } from 'react';
import { AppShell } from '../../components/app-shell';
import { api, ApiError, isNetworkError } from '../../lib/api-client';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTo = searchParams.get('returnTo') || '/cabinet';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !password) return;
    setError(null);
    setLoading(true);
    try {
      await api.post('/auth/login', { email: email.trim(), password });
      router.push(decodeURIComponent(returnTo));
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === 401) {
        setError('Неверный email или пароль. Проверьте данные и попробуйте снова.');
      } else if (isNetworkError(cause)) {
        setError('Нет соединения с сервером. Проверьте интернет.');
      } else {
        setError('Не удалось войти. Попробуйте позже.');
      }
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
          placeholder="name@company.ru"
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
          placeholder="••••••••"
          autoComplete="current-password"
          required
          disabled={loading}
        />
        <div className="row" style={{ marginTop: 16, gap: 12 }}>
          <button className="primary-button" type="submit" disabled={loading || !email || !password}>
            {loading ? 'Вхожу…' : 'Войти'}
          </button>
          <Link href="/register" className="secondary-link">Регистрация</Link>
        </div>
        <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--color-border, #e5e7eb)', textAlign: 'center' }}>
          <Link href="/demo" style={{ fontSize: 13, color: '#6366f1', fontWeight: 600, textDecoration: 'none' }}>
            Посмотреть демо →
          </Link>
          <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>Войдите под любой ролью без регистрации</div>
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
