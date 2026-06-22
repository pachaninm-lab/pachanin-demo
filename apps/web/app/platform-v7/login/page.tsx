'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { PLATFORM_V7_ACTIVE_ROLE_KEY, platformV7RoleHome } from '@/components/platform-v7/PlatformV7SingleEntryGuard';
import { usePlatformV7RStore, type PlatformRole } from '@/stores/usePlatformV7RStore';

// Backend roles (FARMER, BUYER, …) → platform-v7 cabinet roles.
const ROLE_MAP: Record<string, PlatformRole> = {
  FARMER: 'seller',
  BUYER: 'buyer',
  LOGISTICIAN: 'logistics',
  DRIVER: 'driver',
  LAB: 'lab',
  ELEVATOR: 'elevator',
  ACCOUNTING: 'bank',
  EXECUTIVE: 'executive',
  SUPPORT_MANAGER: 'operator',
  ADMIN: 'operator',
};

function toPlatformRole(backendRole?: string): PlatformRole {
  return ROLE_MAP[backendRole ?? ''] ?? 'seller';
}

// Seeded accounts (shared demo password) — one-click real sign-in, still
// validated against the backend (bcrypt + JWT), not a fake role pick.
const ACCOUNTS: Array<{ title: string; email: string }> = [
  { title: 'Продавец', email: 'farmer@demo.ru' },
  { title: 'Покупатель', email: 'buyer@demo.ru' },
  { title: 'Логистика', email: 'logistician@demo.ru' },
  { title: 'Водитель', email: 'driver@demo.ru' },
  { title: 'Элеватор', email: 'elevator@demo.ru' },
  { title: 'Лаборатория', email: 'lab@demo.ru' },
  { title: 'Банк / расчёты', email: 'accounting@demo.ru' },
  { title: 'Оператор', email: 'operator@demo.ru' },
  { title: 'Руководитель', email: 'executive@demo.ru' },
  { title: 'Администратор', email: 'admin@demo.ru' },
];

const DEMO_PASSWORD = 'demo1234';

export default function LoginPage() {
  const router = useRouter();
  const setRole = usePlatformV7RStore((state) => state.setRole);
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const signIn = React.useCallback(
    async (loginEmail: string, loginPassword: string) => {
      if (loading) return;
      setLoading(true);
      setError(null);
      try {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: loginEmail, password: loginPassword }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || data.ok === false) {
          setError(data.message || 'Не удалось войти. Проверьте email и пароль.');
          return;
        }
        const platformRole = toPlatformRole(data.user?.role);
        globalThis.sessionStorage?.setItem(PLATFORM_V7_ACTIVE_ROLE_KEY, platformRole);
        setRole(platformRole);
        router.replace(platformV7RoleHome(platformRole));
      } catch {
        setError('Сеть недоступна. Повторите попытку.');
      } finally {
        setLoading(false);
      }
    },
    [loading, router, setRole],
  );

  return (
    <main className='pc-v7-login-single'>
      <style>{css}</style>
      <section className='login-head'>
        <span>Вход в кабинет</span>
        <h1>Войдите по учётным данным</h1>
        <p>Вход проверяется на стороне платформы. Роль и компания берутся из вашей учётной записи, а не выбираются вручную.</p>
      </section>

      <form
        className='login-form'
        onSubmit={(e) => {
          e.preventDefault();
          void signIn(email.trim(), password);
        }}
      >
        <label className='login-field'>
          <span>Email</span>
          <input
            type='email'
            autoComplete='username'
            inputMode='email'
            placeholder='you@company.ru'
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </label>
        <label className='login-field'>
          <span>Пароль</span>
          <input
            type='password'
            autoComplete='current-password'
            placeholder='••••••••'
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </label>
        {error ? <div className='login-error' role='alert'>{error}</div> : null}
        <button type='submit' className='login-submit' disabled={loading}>
          {loading ? 'Вход…' : 'Войти'}
        </button>
        <Link href='/platform-v7/register' className='login-secondary'>Создать доступ</Link>
      </form>

      <section className='login-accounts' aria-label='Демо-доступы'>
        <div className='login-accounts-head'>
          <strong>Демо-доступы</strong>
          <small>Один клик — реальный вход (пароль {DEMO_PASSWORD})</small>
        </div>
        <div className='login-accounts-grid'>
          {ACCOUNTS.map((account) => (
            <button
              key={account.email}
              type='button'
              className='login-account'
              disabled={loading}
              onClick={() => void signIn(account.email, DEMO_PASSWORD)}
            >
              <strong>{account.title}</strong>
              <small>{account.email}</small>
            </button>
          ))}
        </div>
      </section>

      <Link href='/platform-v7' className='login-back'>Вернуться на главную</Link>
    </main>
  );
}

const css = `
.pc-v7-login-single{min-height:100vh;padding:28px clamp(16px,4vw,58px) 48px;background:linear-gradient(180deg,#fbfcf9 0%,#f2f8f1 100%);color:#071611;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
.login-head{display:grid;gap:12px;max-width:760px;margin:0 auto 22px;text-align:center}
.login-head span{justify-self:center;width:fit-content;padding:8px 12px;border-radius:999px;background:rgba(0,122,47,.08);color:#007a2f;font-size:12px;font-weight:900;letter-spacing:.04em;text-transform:uppercase}
.login-head h1{margin:0;font-size:clamp(30px,5vw,52px);line-height:1;letter-spacing:-.05em;font-weight:950}
.login-head p{margin:0 auto;max-width:620px;color:#586660;font-size:clamp(15px,1.8vw,18px);line-height:1.45;font-weight:600}
.login-form{display:grid;gap:14px;max-width:420px;margin:0 auto;padding:22px;border-radius:24px;border:1px solid rgba(7,22,17,.08);background:rgba(255,255,255,.86);box-shadow:0 16px 38px rgba(7,22,17,.07)}
.login-field{display:grid;gap:6px}
.login-field span{color:#3e4a45;font-size:13px;font-weight:800}
.login-field input{min-height:48px;padding:0 14px;border-radius:14px;border:1px solid rgba(7,22,17,.16);background:#fff;color:#071611;font-size:15px;font-weight:600;outline:none}
.login-field input:focus{border-color:#007a2f;box-shadow:0 0 0 3px rgba(0,122,47,.14)}
.login-error{padding:10px 12px;border-radius:12px;background:rgba(220,38,38,.08);border:1px solid rgba(220,38,38,.2);color:#b42318;font-size:13px;font-weight:700}
.login-submit{min-height:50px;border:none;border-radius:15px;background:#007a2f;color:#fff;font-size:15px;font-weight:900;cursor:pointer;box-shadow:0 14px 28px rgba(0,122,47,.22)}
.login-submit:disabled{opacity:.6;cursor:progress}
.login-secondary{justify-self:center;color:#007a2f;font-size:13px;font-weight:850;text-decoration:none}
.login-accounts{max-width:760px;margin:26px auto 0}
.login-accounts-head{display:flex;align-items:baseline;justify-content:space-between;gap:10px;margin-bottom:12px;flex-wrap:wrap}
.login-accounts-head strong{font-size:14px;font-weight:900;color:#173027}
.login-accounts-head small{color:#66736e;font-size:12px;font-weight:700}
.login-accounts-grid{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:10px}
.login-account{display:grid;gap:3px;align-content:start;text-align:left;padding:12px;border-radius:16px;border:1px solid rgba(7,22,17,.08);background:rgba(255,255,255,.82);cursor:pointer;transition:border-color .15s ease,transform .15s ease}
.login-account:hover:not(:disabled){border-color:rgba(0,122,47,.28);transform:translateY(-2px)}
.login-account:disabled{opacity:.6;cursor:progress}
.login-account strong{color:#071611;font-size:13.5px;font-weight:900}
.login-account small{color:#5d6862;font-size:11.5px;font-weight:650}
.login-back{display:flex;justify-content:center;width:fit-content;margin:24px auto 0;color:#66736e;font-size:13px;font-weight:850;text-decoration:none}
@media(max-width:880px){.login-accounts-grid{grid-template-columns:repeat(3,minmax(0,1fr))}}
@media(max-width:520px){.pc-v7-login-single{padding:22px 16px 36px}.login-accounts-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
`;
