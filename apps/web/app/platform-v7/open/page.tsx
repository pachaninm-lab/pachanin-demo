'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowLeft,
  Banknote,
  BriefcaseBusiness,
  Building2,
  ClipboardCheck,
  Crown,
  FlaskConical,
  Landmark,
  LockKeyhole,
  Mail,
  Scale,
  ShieldCheck,
  Truck,
  UserRound,
  Wheat,
  type LucideIcon,
} from 'lucide-react';
import { BrandMark } from '@/components/v7r/BrandMark';
import { PLATFORM_V7_ACTIVE_ROLE_KEY, platformV7RoleHome } from '@/components/platform-v7/PlatformV7SingleEntryGuard';
import type { PlatformRole } from '@/stores/usePlatformV7RStore';

const ENTRY_COOKIE = 'pc_v7_entry_seen';
const TTL_SECONDS = 60 * 60 * 4;
const RECOVERY_EMAIL = 'pachaninm@gmail.com';

type RoleItem = { role: PlatformRole; title: string; note: string; Icon: LucideIcon };

const roles: RoleItem[] = [
  { role: 'operator', title: 'Оператор', note: 'Сделки и блокеры', Icon: BriefcaseBusiness },
  { role: 'buyer', title: 'Покупатель', note: 'Поставка и оплата', Icon: UserRound },
  { role: 'seller', title: 'Продавец', note: 'Партия и расчёт', Icon: Wheat },
  { role: 'logistics', title: 'Логистика', note: 'Рейсы и маршрут', Icon: Truck },
  { role: 'driver', title: 'Водитель', note: 'Точки рейса', Icon: ClipboardCheck },
  { role: 'elevator', title: 'Элеватор', note: 'Приёмка и вес', Icon: Building2 },
  { role: 'lab', title: 'Лаборатория', note: 'Качество', Icon: FlaskConical },
  { role: 'surveyor', title: 'Сюрвейер', note: 'Факты и осмотр', Icon: ShieldCheck },
  { role: 'bank', title: 'Банк', note: 'Основание оплаты', Icon: Landmark },
  { role: 'compliance', title: 'Комплаенс', note: 'Правила и риски', Icon: Banknote },
  { role: 'arbitrator', title: 'Арбитр', note: 'Спор и решение', Icon: Scale },
  { role: 'executive', title: 'Руководитель', note: 'Сводка и контроль', Icon: Crown },
];

function isRole(value: string | null): value is PlatformRole {
  return roles.some((item) => item.role === value);
}

function markEntry(role: PlatformRole) {
  const secure = globalThis.location?.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${ENTRY_COOKIE}=true; Path=/; Max-Age=${TTL_SECONDS}; SameSite=Lax${secure}`;
  document.cookie = `pc-role=${role}; Path=/; Max-Age=${TTL_SECONDS}; SameSite=Lax${secure}`;
  window.sessionStorage.setItem(PLATFORM_V7_ACTIVE_ROLE_KEY, role);
}

function roleTitle(role: PlatformRole) {
  return roles.find((item) => item.role === role)?.title ?? 'Рабочее место';
}

function recoveryMailHref(role: PlatformRole, login: string, company: string) {
  const subject = encodeURIComponent('Запрос восстановления доступа — Прозрачная Цена');
  const body = encodeURIComponent([
    'Запрос восстановления доступа к платформе «Прозрачная Цена».',
    '',
    `Роль: ${roleTitle(role)}`,
    `Логин: ${login.trim() || 'не указан'}`,
    `Организация / ИНН: ${company.trim() || 'не указано'}`,
    `Время запроса: ${new Date().toLocaleString('ru-RU')}`,
    '',
    'Прошу проверить доступ и выдать новый пароль / код доступа.',
    'Пароль в письме не указываю.',
  ].join('\n'));
  return `mailto:${RECOVERY_EMAIL}?subject=${subject}&body=${body}`;
}

export default function PlatformV7OpenPage() {
  const router = useRouter();
  const params = useSearchParams();
  const initialRole = isRole(params.get('role')) ? params.get('role') as PlatformRole : 'buyer';
  const [role, setRole] = React.useState<PlatformRole>(initialRole);
  const [login, setLogin] = React.useState('');
  const [code, setCode] = React.useState('');
  const [company, setCompany] = React.useState('');
  const [error, setError] = React.useState('');
  const [pending, setPending] = React.useState(false);
  const next = params.get('next') || platformV7RoleHome(initialRole);
  const canSubmit = Boolean(login.trim() && code.trim() && !pending);
  const forgotHref = recoveryMailHref(role, login, company);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setError('');
    if (!login.trim() || !code.trim()) {
      setError('Введите логин и пароль / код доступа вручную.');
      return;
    }
    setPending(true);
    try {
      const response = await fetch(`/api/auth/platform-v7-cabinet-login?ts=${Date.now()}&origin=open-access`, {
        method: 'POST',
        cache: 'no-store',
        headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', Pragma: 'no-cache' },
        body: JSON.stringify({ login: login.trim(), password: code.trim(), role, company: company.trim() }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        const reason = payload?.reason;
        setError(reason === 'login_mismatch' ? 'Логин не совпадает с разрешённым доступом.' : reason === 'password_mismatch' ? 'Пароль / код доступа не совпал.' : `Сервер отклонил вход: ${reason || response.status}.`);
        return;
      }
      markEntry(role);
      router.replace(next.startsWith('/platform-v7') ? next : platformV7RoleHome(role));
    } catch {
      setError('Сервер входа недоступен. Обновите страницу и повторите вход.');
    } finally {
      setPending(false);
    }
  }

  return (
    <main className='pc-clean-login'>
      <style>{css}</style>

      <header className='clean-login-header' aria-label='Навигация входа'>
        <Link href='/platform-v7' className='header-brand' aria-label='Прозрачная Цена — на главную'>
          <BrandMark size={38} />
          <span><strong>Прозрачная Цена</strong><small>Единый вход в рабочий контур</small></span>
        </Link>
        <div className='header-actions'>
          <Link href='/platform-v7' className='header-back'><ArrowLeft size={17} /> На главную</Link>
          <Link href='/platform-v7/register' className='header-register'>Регистрация</Link>
        </div>
      </header>

      <section className='card' aria-labelledby='login-title'>
        <div className='hero-copy'>
          <span className='eyebrow'><LockKeyhole size={15} /> Единый защищённый вход</span>
          <h1 id='login-title'>Вход в рабочий контур</h1>
          <p>Выберите роль участника сделки и введите доступ вручную. Личные кабинеты закрыты от прямого перехода.</p>
        </div>

        <form onSubmit={submit} autoComplete='off' noValidate>
          <section className='role-panel' aria-label='Рабочая роль'>
            <div className='role-panel-head'>
              <span>Рабочее место</span>
              <strong>{roleTitle(role)}</strong>
            </div>
            <div className='roles'>
              {roles.map(({ role: value, title, note, Icon }) => (
                <button key={value} type='button' className={role === value ? 'active' : ''} aria-pressed={role === value} onClick={() => { setRole(value); setError(''); }}>
                  <Icon size={19} />
                  <span><b>{title}</b><small>{note}</small></span>
                </button>
              ))}
            </div>
          </section>

          <div className='fields'>
            <label htmlFor='pc-open-login'>
              <span>Логин</span>
              <input id='pc-open-login' name='pc-open-login-manual' value={login} onChange={(e) => { setLogin(e.target.value); setError(''); }} inputMode='email' autoCapitalize='none' autoCorrect='off' spellCheck={false} autoComplete='off' placeholder='Введите логин' />
            </label>
            <label htmlFor='pc-open-code'>
              <span className='field-row'><span>Пароль / код доступа</span><a className='forgot-link' href={forgotHref}><Mail size={14} /> Забыли пароль?</a></span>
              <input id='pc-open-code' name='pc-open-code-manual' value={code} onChange={(e) => { setCode(e.target.value); setError(''); }} className='secret-input' type='text' inputMode='numeric' autoCapitalize='none' autoCorrect='off' spellCheck={false} autoComplete='off' placeholder='Введите пароль или код' />
            </label>
            <label htmlFor='pc-open-company'>
              <span>Организация <em>необязательно</em></span>
              <input id='pc-open-company' name='pc-open-company-manual' value={company} onChange={(e) => setCompany(e.target.value)} autoCorrect='off' spellCheck={false} autoComplete='off' placeholder='Компания / ИНН' />
            </label>
          </div>

          <div className='recover-note'>
            <Mail size={17} />
            <span>Если доступ потерян, запрос восстановления будет подготовлен на {RECOVERY_EMAIL}. Новый пароль на странице не показывается.</span>
          </div>

          {error ? <div className='error' role='alert'>{error}</div> : null}
          <button className='submit' disabled={!canSubmit}>{pending ? 'Проверяем доступ…' : `Войти как ${roleTitle(role).toLowerCase()}`}</button>
        </form>
      </section>
    </main>
  );
}

const css = `
.pc-clean-login{min-height:100dvh;padding:calc(76px + env(safe-area-inset-top)) clamp(14px,3vw,28px) max(18px,env(safe-area-inset-bottom));background:radial-gradient(circle at 88% 8%,rgba(0,122,47,.10),transparent 30%),linear-gradient(180deg,#fbfcf9 0%,#f3f7f1 58%,#fff 100%);color:#06150f;font-family:Inter,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.pc-clean-login *{box-sizing:border-box}.pc-clean-login a{color:inherit;text-decoration:none}.clean-login-header{position:fixed;top:0;left:0;right:0;z-index:1500;display:flex;align-items:center;justify-content:space-between;gap:14px;min-height:calc(66px + env(safe-area-inset-top));padding:calc(10px + env(safe-area-inset-top)) clamp(14px,3vw,28px) 10px;background:rgba(255,255,255,.97);border-bottom:1px solid rgba(7,22,17,.08);box-shadow:0 12px 30px rgba(7,22,17,.08);-webkit-backdrop-filter:blur(18px);backdrop-filter:blur(18px)}.header-brand{display:inline-flex;align-items:center;gap:11px;min-width:0}.header-brand span{display:grid;gap:2px;min-width:0}.header-brand strong{font-size:18px;line-height:1.05;font-weight:950;letter-spacing:-.035em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.header-brand small{color:#66736e;font-size:11px;font-weight:800;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.header-actions{display:flex;align-items:center;justify-content:flex-end;gap:8px;flex:0 0 auto}.header-back,.header-register{min-height:42px;display:inline-flex;align-items:center;justify-content:center;gap:8px;border-radius:15px;border:1px solid rgba(7,22,17,.10);padding:0 14px;font-size:13px;font-weight:950;background:#fff}.header-register{background:rgba(0,122,47,.08);border-color:rgba(0,122,47,.18);color:#087a32}.card{max-width:900px;margin:0 auto;padding:clamp(18px,3vw,28px);border:1px solid rgba(7,22,17,.1);border-radius:30px;background:rgba(255,255,255,.94);box-shadow:0 20px 56px rgba(7,22,17,.08);backdrop-filter:blur(16px)}.hero-copy{display:grid;gap:12px;margin-bottom:20px}.eyebrow{display:inline-flex;align-items:center;gap:8px;width:fit-content;padding:8px 12px;border-radius:999px;background:#eaf7ef;color:#087a32;font-weight:950;font-size:12px;text-transform:uppercase;letter-spacing:.05em}h1{margin:0;font-size:clamp(42px,7vw,72px);line-height:.94;letter-spacing:-.07em;font-weight:950}p{margin:0;color:#51615a;font-weight:760;font-size:clamp(16px,2vw,20px);line-height:1.45;max-width:690px}form{display:grid;gap:16px}.role-panel{display:grid;gap:12px}.role-panel-head{display:flex;align-items:center;justify-content:space-between;gap:12px;color:#43534c}.role-panel-head span{font-size:13px;font-weight:950}.role-panel-head strong{font-size:13px;font-weight:950;color:#087a32;background:rgba(0,122,47,.08);border-radius:999px;padding:7px 11px}.roles{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}.roles button{min-height:70px;border-radius:18px;border:1px solid rgba(0,122,47,.18);background:#f7fbf8;color:#06150f;font-weight:950;display:grid;grid-template-columns:auto minmax(0,1fr);gap:10px;align-items:center;padding:10px 12px;text-align:left;cursor:pointer}.roles button svg{color:#087a32}.roles button span{min-width:0;display:grid;gap:2px}.roles button b{font-size:14px;line-height:1.1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.roles button small{color:#66736e;font-size:11px;font-weight:800;line-height:1.2;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.roles button.active{background:#06150f;color:#fff;border-color:#06150f;box-shadow:0 14px 28px rgba(7,22,17,.16)}.roles button.active svg,.roles button.active small{color:#fff}.fields{display:grid;grid-template-columns:1fr 1fr;gap:12px}.fields label:last-child{grid-column:1/-1}label{display:grid;gap:7px}label span{font-size:13px;font-weight:950;color:#43534c}label em{font-style:normal;color:#87918c;font-weight:850}.field-row{display:flex;align-items:center;justify-content:space-between;gap:10px}.forgot-link{display:inline-flex;align-items:center;justify-content:center;gap:6px;color:#087a32;font-size:12px;font-weight:950;white-space:nowrap}input{height:56px;border-radius:17px;border:1px solid rgba(7,22,17,.16);padding:0 15px;font-size:16px;font-weight:850;background:#fff;color:#06150f}input:focus{outline:none;border-color:#087a32;box-shadow:0 0 0 4px rgba(8,122,50,.12)}.secret-input{-webkit-text-security:disc;text-security:disc}.recover-note{display:flex;align-items:flex-start;gap:10px;border-radius:17px;border:1px solid rgba(0,122,47,.12);background:rgba(0,122,47,.06);padding:12px 14px;color:#345047;font-size:13px;font-weight:820;line-height:1.42}.recover-note svg{color:#087a32;flex:0 0 auto;margin-top:1px}.error{padding:12px 14px;border-radius:15px;background:#fff1e8;color:#8a3a00;font-weight:900;line-height:1.35}.submit{height:60px;border:0;border-radius:19px;background:#087a32;color:#fff;font-size:17px;font-weight:950;box-shadow:0 14px 28px rgba(8,122,50,.22);cursor:pointer}.submit:disabled{opacity:.55;cursor:not-allowed;box-shadow:none}@media(max-width:720px){.pc-clean-login{padding:calc(66px + env(safe-area-inset-top)) 10px max(16px,env(safe-area-inset-bottom))}.clean-login-header{min-height:calc(58px + env(safe-area-inset-top));padding:calc(8px + env(safe-area-inset-top)) 12px 8px}.header-brand small{display:none}.header-brand strong{font-size:17px}.header-actions{gap:6px}.header-back{min-width:44px;padding:0 12px}.header-back svg{margin:0}.header-back{font-size:0}.header-back svg{font-size:initial}.header-register{display:none}.card{padding:20px 14px;border-radius:26px}h1{font-size:clamp(38px,12vw,56px)}p{font-size:16px}.roles{grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}.roles button{min-height:74px;grid-template-columns:1fr;justify-items:center;text-align:center;padding:10px 8px}.roles button b{font-size:13px}.roles button small{font-size:10.5px}.fields{grid-template-columns:1fr}.field-row{align-items:flex-start}.forgot-link{font-size:11.5px}input{height:54px}.submit{height:58px}}@media(max-width:380px){.card{padding:18px 12px}.roles button{min-height:68px}.roles button small{display:none}.eyebrow{font-size:10.5px}h1{font-size:37px}.recover-note{font-size:12px}.forgot-link span{display:none}}
`;
