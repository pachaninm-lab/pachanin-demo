'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRightFromLine, Banknote, BriefcaseBusiness, Building2, ClipboardCheck, Crown, FlaskConical, Landmark, Scale, ShieldCheck, Truck, UserRound, Wheat, type LucideIcon } from 'lucide-react';
import { PLATFORM_V7_ACTIVE_ROLE_KEY, platformV7RoleHome } from '@/components/platform-v7/PlatformV7SingleEntryGuard';
import { BrandMark } from '@/components/v7r/BrandMark';
import { usePlatformV7RStore, type PlatformRole } from '@/stores/usePlatformV7RStore';

type Item = { role: PlatformRole; Icon: LucideIcon; label: string };
const ENTRY_COOKIE = 'pc_v7_entry_seen';
const items: Item[] = [
  { role: 'operator', Icon: BriefcaseBusiness, label: 'Оператор' }, { role: 'buyer', Icon: UserRound, label: 'Покупатель' },
  { role: 'seller', Icon: Wheat, label: 'Продавец' }, { role: 'logistics', Icon: Truck, label: 'Логистика' },
  { role: 'driver', Icon: ClipboardCheck, label: 'Водитель' }, { role: 'elevator', Icon: Building2, label: 'Элеватор' },
  { role: 'lab', Icon: FlaskConical, label: 'Лаборатория' }, { role: 'surveyor', Icon: ShieldCheck, label: 'Сюрвейер' },
  { role: 'bank', Icon: Landmark, label: 'Банк' }, { role: 'compliance', Icon: Banknote, label: 'Комплаенс' },
  { role: 'arbitrator', Icon: Scale, label: 'Арбитр' }, { role: 'executive', Icon: Crown, label: 'Руководитель' },
];

function markEntrySeen() {
  const secure = globalThis.location?.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${ENTRY_COOKIE}=true; Path=/; Max-Age=14400; SameSite=Lax${secure}`;
}

export function LoginLegacyOverlay() {
  const router = useRouter();
  const setStoreRole = usePlatformV7RStore((state) => state.setRole);
  const [role, setRole] = React.useState<PlatformRole>('operator');
  const [login, setLogin] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [company, setCompany] = React.useState('');
  const [error, setError] = React.useState('');

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!login.trim() || !password.trim() || !company.trim()) return setError('Заполни логин, пароль и организацию. Кабинет открывается только после формы входа.');
    setError('');
    sessionStorage.setItem(PLATFORM_V7_ACTIVE_ROLE_KEY, role);
    markEntrySeen();
    setStoreRole(role);
    try { await fetch('/api/platform-v7/cabinet-session', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ role, company: company.trim() }), keepalive: true }); } catch {}
    router.replace(platformV7RoleHome(role));
  }

  return (
    <main className='p7-login-old' data-p7-no-translate='true'>
      <style>{css}</style>
      <header>
        <Link href='/platform-v7' className='brand' aria-label='Прозрачная Цена'><BrandMark size={38} /><b>Прозрачная Цена</b></Link>
        <Link href='/platform-v7' className='exit' aria-label='Назад'><ArrowRightFromLine size={26}/></Link>
      </header>
      <section className='card'>
        <span className='kicker'>ЕДИНЫЙ ВХОД</span>
        <h1>Вход в рабочую платформу</h1>
        <p>Введите корпоративные данные для доступа к рабочему контуру.</p>
        <section className='roles' aria-label='Выберите один рабочий кабинет'>
          <h2>Выберите один рабочий кабинет</h2>
          <div>{items.map((item)=>{const Icon=item.Icon;const active=item.role===role;return <button key={item.role} type='button' className={active?'active':''} onClick={()=>{setRole(item.role);setError('')}}><Icon size={28}/><b>{item.label}</b></button>})}</div>
        </section>
        <form onSubmit={submit}>
          <label><span>Логин</span><input value={login} onChange={(e)=>setLogin(e.target.value)} type='email' autoComplete='username'/></label>
          <label><span>Пароль</span><input value={password} onChange={(e)=>setPassword(e.target.value)} type='password' autoComplete='current-password'/></label>
          <label><span>Организация</span><input value={company} onChange={(e)=>setCompany(e.target.value)} placeholder='Компания / ИНН' autoComplete='organization'/></label>
          {error?<p className='error'>{error}</p>:null}
          <button className='enter'>Войти в кабинет</button>
        </form>
      </section>
    </main>
  );
}

const css = `.p7-login-old{min-height:100svh;background:linear-gradient(180deg,#fff 0,#eef6ed 230px,#fff 100%);color:#071611;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;padding-bottom:42px}.p7-login-old *{box-sizing:border-box}.p7-login-old a{text-decoration:none;color:inherit}.p7-login-old header{height:86px;background:#fff;display:flex;align-items:center;justify-content:space-between;padding:0 clamp(18px,4vw,48px);box-shadow:0 10px 34px rgba(7,22,17,.06)}.brand{display:inline-flex;align-items:center;gap:11px;min-width:0}.brand b{font-size:24px;font-weight:950;letter-spacing:-.04em;white-space:nowrap}.exit{width:58px;height:58px;border-radius:20px;display:grid;place-items:center;background:#fff4f4;color:#b91c1c;border:1px solid rgba(185,28,28,.18)}.card{width:min(100% - 28px,760px);margin:62px auto 0;padding:30px;border-radius:34px;background:rgba(255,255,255,.95);border:1px solid rgba(7,22,17,.08);box-shadow:0 24px 70px rgba(7,22,17,.11)}.kicker{display:inline-flex;padding:10px 16px;border-radius:999px;background:rgba(0,122,47,.1);color:#087a3b;font-size:15px;font-weight:950;letter-spacing:.08em}.card h1{max-width:640px;margin:26px 0 16px;font-size:clamp(48px,8vw,74px);line-height:.94;letter-spacing:-.07em;font-weight:950}.card>p{max-width:620px;margin:0 0 28px;color:#5b6963;font-size:clamp(21px,3.8vw,28px);line-height:1.38;font-weight:780}.roles{padding:24px;border:1px solid rgba(7,22,17,.08);border-radius:26px;background:#fff}.roles h2{margin:0 0 16px;color:#5b6963;font-size:20px;line-height:1.15;font-weight:950}.roles div{display:grid;grid-template-columns:1fr 1fr;gap:13px}.roles button{min-height:112px;border-radius:22px;border:1px solid rgba(0,122,47,.18);background:#fff;color:#087a3b;display:grid;place-items:center;gap:8px;padding:13px}.roles button.active{background:#03130d;color:#fff;border-color:#03130d}.roles b{color:#071611;font-size:21px;line-height:1.05;font-weight:950}.roles button.active b{color:#fff}form{display:grid;gap:15px;margin-top:24px}label{display:grid;gap:8px}label span{font-size:20px;color:#5b6963;font-weight:950}input{height:72px;border-radius:21px;border:1px solid rgba(7,22,17,.12);background:#fff;padding:0 22px;font-size:24px;font-weight:900;color:#071611}.error{margin:0;padding:16px 18px;border-radius:18px;background:#fff3e8;color:#92400e;font-size:18px;line-height:1.28;font-weight:900}.enter{min-height:72px;border:0;border-radius:22px;background:#088437;color:#fff;font-size:25px;font-weight:950}@media(max-width:560px){.p7-login-old header{height:78px;padding:0 16px}.brand{gap:8px}.brand b{font-size:21px}.exit{width:54px;height:54px}.card{width:calc(100% - 28px);margin-top:42px;padding:22px;border-radius:30px}.card h1{font-size:45px}.card>p{font-size:20px}.roles{padding:16px}.roles div{gap:10px}.roles button{min-height:92px;border-radius:20px}.roles b{font-size:19px}input{height:64px;font-size:21px}.enter{min-height:66px;font-size:23px}}`;
