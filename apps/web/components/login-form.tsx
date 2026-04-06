'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      if (!response.ok) {
        setError('Не удалось войти');
        return;
      }
      router.push('/cabinet');
      router.refresh();
    } catch {
      setError('Не удалось войти');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="section-card" onSubmit={onSubmit}>
      <div className="section-title">Вход</div>
      <div className="muted small" style={{ marginTop: 8 }}>Войти в role-first кабинет и продолжить работу по своей роли.</div>
      <div className="form-grid" style={{ marginTop: 12 }}>
        <label className="field"><span>Email</span><input value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" /></label>
        <label className="field"><span>Пароль</span><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" /></label>
      </div>
      <div className="cta-stack" style={{ marginTop: 14 }}>
        <button className="button primary" type="submit" disabled={busy || !email.trim() || !password.trim()}>{busy ? 'Вход...' : 'Войти'}</button>
        <Link href="/register" className="secondary-link">Регистрация</Link>
      </div>
      {error ? <div className="highlight-red" style={{ marginTop: 12 }}>{error}</div> : null}
    </form>
  );
}
