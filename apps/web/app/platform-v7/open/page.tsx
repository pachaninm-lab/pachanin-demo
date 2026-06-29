'use client';

import * as React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Building2, ClipboardCheck, FlaskConical, Landmark, Scale, ShieldCheck, Truck, UserRound, Wheat } from 'lucide-react';
import { PLATFORM_V7_ACTIVE_ROLE_KEY, platformV7RoleHome } from '@/components/platform-v7/PlatformV7SingleEntryGuard';
import type { PlatformRole } from '@/stores/usePlatformV7RStore';

const ENTRY_COOKIE = 'pc_v7_entry_seen';
const TTL_SECONDS = 60 * 60 * 4;

const roles: Array<{ role: PlatformRole; title: string; Icon: React.ElementType }> = [
  { role: 'buyer', title: 'Покупатель', Icon: UserRound },
  { role: 'seller', title: 'Продавец', Icon: Wheat },
  { role: 'logistics', title: 'Логистика', Icon: Truck },
  { role: 'driver', title: 'Водитель', Icon: ClipboardCheck },
  { role: 'elevator', title: 'Элеватор', Icon: Building2 },
  { role: 'lab', title: 'Лаборатория', Icon: FlaskConical },
  { role: 'surveyor', title: 'Сюрвейер', Icon: ShieldCheck },
  { role: 'bank', title: 'Банк', Icon: Landmark },
  { role: 'arbitrator', title: 'Арбитр', Icon: Scale },
];

function isRole(value: string | null): value is PlatformRole {
  return roles.some((item) => item.role === value) || value === 'operator' || value === 'compliance' || value === 'executive';
}

function markEntry(role: PlatformRole) {
  const secure = globalThis.location?.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${ENTRY_COOKIE}=true; Path=/; Max-Age=${TTL_SECONDS}; SameSite=Lax${secure}`;
  document.cookie = `pc-role=${role}; Path=/; Max-Age=${TTL_SECONDS}; SameSite=Lax${secure}`;
  window.sessionStorage.setItem(PLATFORM_V7_ACTIVE_ROLE_KEY, role);
}

export default function PlatformV7OpenPage() {
  const router = useRouter();
  const params = useSearchParams();
  const initialRole = isRole(params.get('role')) ? params.get('role') as PlatformRole : 'seller';
  const [role, setRole] = React.useState<PlatformRole>(initialRole);
  const [login, setLogin] = React.useState('');
  const [code, setCode] = React.useState('');
  const [error, setError] = React.useState('');
  const [pending, setPending] = React.useState(false);
  const next = params.get('next') || platformV7RoleHome(initialRole);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setError('');
    if (!login.trim() || !code.trim()) {
      setError('Введи логин и код вручную.');
      return;
    }
    setPending(true);
    try {
      const response = await fetch(`/api/platform-v7/cabinet-lock-login?ts=${Date.now()}&origin=open-access`, {
        method: 'POST',
        cache: 'no-store',
        headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', Pragma: 'no-cache' },
        body: JSON.stringify({ login: login.trim(), password: code.trim(), role, company: '' }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(`Сервер отклонил вход: ${payload?.reason || response.status}.`);
        return;
      }
      markEntry(role);
      router.replace(next.startsWith('/platform-v7') ? next : platformV7RoleHome(role));
    } catch {
      setError('Сервер входа недоступен.');
    } finally {
      setPending(false);
    }
  }

  return (
    <main className='pc-clean-login'>
      <style>{css}</style>
      <section className='card'>
        <span className='eyebrow'>чистый вход</span>
        <h1>Вход в кабинет</h1>
        <p>Введите доступ вручную.</p>
        <form onSubmit={submit} autoComplete='off'>
          <div className='roles'>
            {roles.map(({ role: value, title, Icon }) => (
              <button key={value} type='button' className={role === value ? 'active' : ''} onClick={() => setRole(value)}>
                <Icon size={19} />
                <b>{title}</b>
              </button>
            ))}
          </div>
          <label>
            <span>Логин</span>
            <input value={login} onChange={(e) => setLogin(e.target.value)} inputMode='email' autoCapitalize='none' autoCorrect='off' spellCheck={false} autoComplete='off' placeholder='Введи логин' />
          </label>
          <label>
            <span>Код</span>
            <input value={code} onChange={(e) => setCode(e.target.value)} type='password' inputMode='numeric' autoCapitalize='none' autoCorrect='off' spellCheck={false} autoComplete='new-password' placeholder='Введи код' />
          </label>
          {error ? <div className='error'>{error}</div> : null}
          <button className='submit' disabled={pending}>{pending ? 'Проверяю…' : 'Войти'}</button>
        </form>
      </section>
    </main>
  );
}

const css = `
.pc-clean-login{min-height:100vh;padding:24px;background:#f7faf5;color:#06150f;font-family:Inter,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.card{max-width:760px;margin:0 auto;padding:24px;border:1px solid rgba(7,22,17,.1);border-radius:28px;background:#fff;box-shadow:0 18px 48px rgba(7,22,17,.08)}.eyebrow{display:inline-flex;width:fit-content;padding:8px 12px;border-radius:999px;background:#eaf7ef;color:#087a32;font-weight:950;font-size:12px;text-transform:uppercase;letter-spacing:.05em}h1{margin:18px 0 8px;font-size:44px;line-height:.95;letter-spacing:-.06em}p{margin:0 0 18px;color:#51615a;font-weight:750;line-height:1.45}form{display:grid;gap:14px}.roles{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.roles button{min-height:62px;border-radius:18px;border:1px solid rgba(0,122,47,.18);background:#f7fbf8;color:#06150f;font-weight:950;display:grid;grid-template-columns:auto 1fr;gap:8px;align-items:center;padding:0 14px;text-align:left}.roles button svg{color:#087a32}.roles button.active{background:#06150f;color:#fff}.roles button.active svg{color:#fff}label{display:grid;gap:7px}label span{font-size:13px;font-weight:900;color:#43534c}input{height:54px;border-radius:16px;border:1px solid rgba(7,22,17,.16);padding:0 14px;font-size:16px;font-weight:850;background:#fff;color:#06150f}input:focus{outline:none;border-color:#087a32;box-shadow:0 0 0 4px rgba(8,122,50,.12)}.error{padding:12px 14px;border-radius:14px;background:#fff1e8;color:#8a3a00;font-weight:900}.submit{height:58px;border:0;border-radius:18px;background:#087a32;color:#fff;font-size:16px;font-weight:950;box-shadow:0 14px 28px rgba(8,122,50,.22)}.submit:disabled{opacity:.65}@media(max-width:560px){.pc-clean-login{padding:14px}.card{padding:18px;border-radius:24px}h1{font-size:38px}.roles{grid-template-columns:1fr 1fr}.roles button{grid-template-columns:1fr;justify-items:center;text-align:center;padding:8px}}
`;
