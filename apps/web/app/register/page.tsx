'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { AppShell } from '../../components/app-shell';
import { api, ApiError, isNetworkError } from '../../lib/api-client';

export default function RegisterPage() {
  const router = useRouter();
  const [company, setCompany] = useState('');
  const [inn, setInn] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    if (!company.trim() || !inn.trim() || !email.trim() || !password) return;
    setError(null);
    setLoading(true);
    try {
      await api.post('/auth/register', {
        companyName: company.trim(),
        inn: inn.trim(),
        email: email.trim(),
        password,
      });
      router.push('/onboarding');
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === 409) {
        setError('Компания с таким ИНН или email уже зарегистрирована.');
      } else if (cause instanceof ApiError && cause.status === 400) {
        setError('Проверьте правильность введённых данных.');
      } else if (isNetworkError(cause)) {
        setError('Нет соединения с сервером. Проверьте интернет.');
      } else {
        setError('Не удалось создать профиль. Попробуйте позже.');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <AppShell title="Регистрация" subtitle="Создание профиля компании и первого пользователя">
      <form onSubmit={handleRegister}>
        <div className="card max-w-xl">
          {error && (
            <div className="soft-box" style={{ background: 'var(--color-red-soft, #fef2f2)', color: '#991b1b', marginBottom: 16 }}>
              {error}
            </div>
          )}
          <label className="field-label" htmlFor="company">Компания</label>
          <input
            id="company"
            className="input"
            value={company}
            onChange={(e) => setCompany(e.target.value)}
            placeholder="ООО Агро ..."
            required
            disabled={loading}
          />
          <label className="field-label" htmlFor="inn" style={{ marginTop: 12 }}>ИНН</label>
          <input
            id="inn"
            className="input"
            value={inn}
            onChange={(e) => setInn(e.target.value)}
            placeholder="6829..."
            pattern="\d{10}|\d{12}"
            title="10 или 12 цифр"
            required
            disabled={loading}
          />
          <label className="field-label" htmlFor="email" style={{ marginTop: 12 }}>Email</label>
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
            placeholder="Минимум 8 символов"
            minLength={8}
            autoComplete="new-password"
            required
            disabled={loading}
          />
          <div style={{ marginTop: 16, display: 'flex', gap: 12, alignItems: 'center' }}>
            <button
              className="primary-button"
              type="submit"
              disabled={loading || !company || !inn || !email || !password}
            >
              {loading ? 'Создаю профиль…' : 'Создать профиль'}
            </button>
            <Link href="/login" className="secondary-link">Уже есть аккаунт</Link>
          </div>
        </div>
      </form>
    </AppShell>
  );
}
