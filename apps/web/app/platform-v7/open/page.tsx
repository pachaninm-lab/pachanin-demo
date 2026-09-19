'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, Banknote, BriefcaseBusiness, Building2, ClipboardCheck, Crown, FlaskConical, Landmark, Mail, Scale, ShieldCheck, Truck, UserRound, Wheat, type LucideIcon } from 'lucide-react';
import { BrandMark } from '@/components/v7r/BrandMark';
import { PLATFORM_V7_ACTIVE_ROLE_KEY, platformV7RoleHome } from '@/components/platform-v7/PlatformV7SingleEntryGuard';
import type { PlatformRole } from '@/stores/usePlatformV7RStore';

const ENTRY_COOKIE = 'pc_v7_entry_seen';
const TTL_SECONDS = 60 * 60 * 4;
const PUBLIC_NEXT_PATHS = new Set(['/platform-v7/demo', '/platform-v7/contact', '/platform-v7/request', '/platform-v7/register']);

type RoleItem = { role: PlatformRole; title: string; note: string; Icon: LucideIcon };

const roles: RoleItem[] = [
  { role: 'operator', title: 'Оператор', note: 'Контроль сделок', Icon: BriefcaseBusiness },
  { role: 'buyer', title: 'Покупатель', note: 'Поставка и оплата', Icon: UserRound },
  { role: 'seller', title: 'Продавец', note: 'Партии и расчёт', Icon: Wheat },
  { role: 'logistics', title: 'Логистика', note: 'Рейсы и маршрут', Icon: Truck },
  { role: 'driver', title: 'Водитель', note: 'Точки рейса', Icon: ClipboardCheck },
  { role: 'elevator', title: 'Элеватор', note: 'Приёмка и вес', Icon: Building2 },
  { role: 'lab', title: 'Лаборатория', note: 'Качество', Icon: FlaskConical },
  { role: 'surveyor', title: 'Сюрвейер', note: 'Факты осмотра', Icon: ShieldCheck },
  { role: 'bank', title: 'Банк', note: 'Основание оплаты', Icon: Landmark },
  { role: 'compliance', title: 'Комплаенс', note: 'Правила и риски', Icon: Banknote },
  { role: 'arbitrator', title: 'Арбитр', note: 'Спор и решение', Icon: Scale },
  { role: 'executive', title: 'Руководитель', note: 'Сводка и контроль', Icon: Crown },
];

function isRole(value: string | null): value is PlatformRole {
  return roles.some((item) => item.role === value);
}

function normalizePath(value: string | null) {
  return value?.split('?')[0].replace(/\/$/, '') ?? null;
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

export default function PlatformV7OpenPage() {
  const router = useRouter();
  const params = useSearchParams();
  const initialRole = isRole(params.get('role')) ? params.get('role') as PlatformRole : 'buyer';
  const cardRef = React.useRef<HTMLElement | null>(null);
  const [role, setRole] = React.useState<PlatformRole>(initialRole);
  const [login, setLogin] = React.useState('');
  const [code, setCode] = React.useState('');
  const [company, setCompany] = React.useState('');
  const [error, setError] = React.useState('');
  const [pending, setPending] = React.useState(false);
  const [recoveryOpen, setRecoveryOpen] = React.useState(false);
  const [recoveryContact, setRecoveryContact] = React.useState('');
  const [recoveryComment, setRecoveryComment] = React.useState('');
  const [recoveryStatus, setRecoveryStatus] = React.useState('');
  const [recoveryPending, setRecoveryPending] = React.useState(false);
  const nextParam = params.get('next');
  const canSubmit = Boolean(login.trim() && code.trim() && !pending);

  React.useEffect(() => {
    const cleanNext = normalizePath(nextParam);
    if (cleanNext && PUBLIC_NEXT_PATHS.has(cleanNext)) {
      router.replace(nextParam || cleanNext);
      return;
    }
    window.scrollTo(0, 0);
    if (cardRef.current) cardRef.current.scrollTop = 0;
  }, [nextParam, router]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setError('');
    if (!login.trim() || !code.trim()) {
      setError('Введите логин и пароль или код доступа вручную.');
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
        setError(reason === 'login_mismatch' ? 'Логин не совпадает с разрешённым доступом.' : reason === 'password_mismatch' ? 'Пароль или код доступа не совпал.' : `Сервер отклонил вход: ${reason || response.status}.`);
        return;
      }
      markEntry(role);
      const safeNext = typeof nextParam === 'string' && nextParam.startsWith('/platform-v7') && !nextParam.includes('/login') && !nextParam.includes('/open') ? nextParam : null;
      router.replace(safeNext ?? platformV7RoleHome(role));
    } catch {
      setError('Сервер входа недоступен. Обновите страницу и повторите вход.');
    } finally {
      setPending(false);
    }
  }

  async function submitRecovery() {
    if (recoveryPending) return;
    if (!recoveryContact.trim()) {
      setRecoveryStatus('Укажите телефон или электронную почту для ответа.');
      return;
    }
    setRecoveryPending(true);
    setRecoveryStatus('Отправляем запрос…');
    try {
      await fetch('/api/auth/platform-v7-password-recovery', {
        method: 'POST',
        cache: 'no-store',
        headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', Pragma: 'no-cache' },
        body: JSON.stringify({ role: roleTitle(role), login: login.trim(), company: company.trim(), contact: recoveryContact.trim(), comment: recoveryComment.trim() }),
      });
      setRecoveryStatus('Запрос принят. Если доступ зарегистрирован, мы обработаем восстановление и свяжемся по указанному контакту.');
    } catch {
      setRecoveryStatus('Запрос принят. Если доступ зарегистрирован, мы обработаем восстановление и свяжемся по указанному контакту.');
    } finally {
      setRecoveryPending(false);
    }
  }

  return (
    <main className='pc-open-v2' style={{ paddingTop: 0 }}>
      <style>{css}</style>
      <header className='open-header' aria-label='Навигация входа' style={{ position: 'relative', top: 'auto', left: 'auto', right: 'auto', flex: '0 0 var(--open-header-height)' }}>
        <Link href='/platform-v7' className='open-brand' aria-label='Прозрачная Цена — на главную'>
          <BrandMark size={40} />
          <span><strong>Прозрачная Цена</strong><small>Единый вход в контур сделки</small></span>
        </Link>
        <Link href='/platform-v7' className='open-back' aria-label='На главную'><ArrowLeft size={22} /></Link>
      </header>

      <section ref={cardRef} className='open-card' aria-label='Вход в рабочий контур' style={{ marginTop: 0, paddingTop: 30 }}>
        <form onSubmit={submit} autoComplete='off' noValidate>
          <section className='role-panel' aria-label='Рабочая роль'>
            <div className='role-panel-head'><span>Рабочее место</span><strong>{roleTitle(role)}</strong></div>
            <div className='roles'>
              {roles.map(({ role: value, title, note, Icon }) => (
                <button key={value} type='button' className={role === value ? 'active' : ''} aria-pressed={role === value} aria-label={`Выбрать роль: ${title}`} onClick={() => { setRole(value); setError(''); }}>
                  <Icon size={18} />
                  <span><b>{title}</b><small>{note}</small></span>
                </button>
              ))}
            </div>
          </section>

          <section className='fields' aria-label='Данные входа'>
            <label htmlFor='pc-open-login'><span>Логин</span><input id='pc-open-login' value={login} onChange={(e) => { setLogin(e.target.value); setError(''); }} inputMode='email' autoCapitalize='none' autoCorrect='off' spellCheck={false} autoComplete='off' placeholder='Введите логин' /></label>
            <label htmlFor='pc-open-code'><span>Пароль / код доступа</span><input id='pc-open-code' value={code} onChange={(e) => { setCode(e.target.value); setError(''); }} type='password' autoCapitalize='none' autoCorrect='off' spellCheck={false} autoComplete='new-password' placeholder='Введите пароль или код' /></label>
            <button type='button' className='forgot-under-password' onClick={() => { setRecoveryOpen((value) => !value); setRecoveryStatus(''); }}><Mail size={16} /><span>Забыли пароль?</span></button>
            <label htmlFor='pc-open-company'><span>Организация <em>необязательно</em></span><input id='pc-open-company' value={company} onChange={(e) => setCompany(e.target.value)} autoCorrect='off' spellCheck={false} autoComplete='off' placeholder='Компания / ИНН' /></label>
          </section>

          {recoveryOpen ? <section className='recovery-card' aria-label='Восстановление доступа'>
            <div className='recovery-head'><strong>Восстановление доступа</strong><button type='button' onClick={() => setRecoveryOpen(false)}>Скрыть</button></div>
            <label htmlFor='pc-recovery-contact'><span>Контакт для ответа</span><input id='pc-recovery-contact' value={recoveryContact} onChange={(e) => { setRecoveryContact(e.target.value); setRecoveryStatus(''); }} placeholder='Телефон или электронная почта' autoComplete='off' /></label>
            <label htmlFor='pc-recovery-comment'><span>Комментарий <em>необязательно</em></span><textarea id='pc-recovery-comment' value={recoveryComment} onChange={(e) => setRecoveryComment(e.target.value)} placeholder='Что нужно восстановить или уточнить' /></label>
            {recoveryStatus ? <div className='recovery-status'>{recoveryStatus}</div> : null}
            <button type='button' className='recovery-submit' disabled={recoveryPending} onClick={submitRecovery}>{recoveryPending ? 'Отправляем…' : 'Отправить запрос'}</button>
          </section> : null}

          {error ? <div className='error' role='alert'>{error}</div> : null}
          <button className='submit' disabled={!canSubmit}>{pending ? 'Проверяем доступ…' : `Войти как ${roleTitle(role).toLowerCase()}`}</button>
          <Link href='/platform-v7/register' className='register-cta'>Зарегистрироваться</Link>
        </form>
      </section>
    </main>
  );
}

const css = `
.pc-open-v2{--open-green:#06412e;--open-green-2:#087a32;--open-line:rgba(0,122,47,.18);--open-muted:#67736d;--open-header-height:64px;min-height:100dvh;padding:calc(var(--open-header-height) + 14px) max(12px,env(safe-area-inset-right)) calc(220px + env(safe-area-inset-bottom)) max(12px,env(safe-area-inset-left));overflow-x:hidden;background:radial-gradient(circle at 86% 10%,rgba(0,122,47,.10),transparent 30%),radial-gradient(circle at 10% 34%,rgba(181,132,43,.08),transparent 26%),linear-gradient(180deg,#fbfcf9 0%,#f3f7f1 54%,#fff 100%);color:#071611;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.pc-open-v2 *{box-sizing:border-box}.pc-open-v2 a{color:inherit;text-decoration:none}.open-header{position:fixed;top:0;left:0;right:0;z-index:1400;height:var(--open-header-height);min-height:var(--open-header-height);padding:12px 72px 12px 18px;display:flex;align-items:center;background:rgba(255,255,255,.985);border-bottom:1px solid rgba(6,26,22,.08);box-shadow:0 12px 30px rgba(7,22,17,.08);backdrop-filter:blur(18px)}.open-brand{height:40px;width:100%;min-width:0;display:inline-flex;align-items:center;gap:12px}.open-brand svg,.open-brand img{width:40px;height:40px;flex:0 0 auto;display:block}.open-brand span{min-width:0;display:grid;gap:3px}.open-brand strong{font-size:18px;line-height:1.05;font-weight:950;letter-spacing:-.03em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.open-brand small{font-size:12px;line-height:1.05;font-weight:800;color:#66736e;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.open-back{position:absolute;right:18px;top:12px;width:46px;height:46px;display:grid;place-items:center;border-radius:17px;border:1px solid rgba(7,22,17,.10);background:#fff;box-shadow:0 8px 18px rgba(7,22,17,.05)}.open-card{height:calc(100dvh - var(--open-header-height));overflow:auto;-webkit-overflow-scrolling:touch;display:grid;align-content:start;padding:30px clamp(14px,3.6vw,32px) calc(120px + env(safe-area-inset-bottom));border:1px solid rgba(7,22,17,.09);border-radius:28px 28px 0 0;background:rgba(255,255,255,.93);box-shadow:0 -12px 34px rgba(7,22,17,.08)}.open-card form{display:grid;gap:16px;max-width:980px;width:100%;margin:0 auto}.role-panel{display:grid;gap:14px}.role-panel-head{display:flex;align-items:center;justify-content:space-between;gap:10px;color:#40514a;font-weight:950}.role-panel-head span{font-size:15px}.role-panel-head strong{padding:8px 14px;border-radius:999px;background:rgba(0,122,47,.08);color:#06412e;font-size:15px}.roles{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.roles button{min-height:84px;border:1px solid rgba(0,122,47,.18);border-radius:20px;background:#fff;color:#071611;display:grid;grid-template-columns:1fr;place-items:center;gap:5px;padding:10px;font-family:inherit;box-shadow:0 8px 20px rgba(7,22,17,.035)}.roles button svg{color:#087a32}.roles button b{display:block;font-size:18px;line-height:1.05;font-weight:950;letter-spacing:-.04em}.roles button small{display:block;margin-top:3px;color:#6b7771;font-size:12px;font-weight:850}.roles button.active{background:#06412e;color:#fff;border-color:#06412e}.roles button.active svg,.roles button.active small{color:#fff}.fields{display:grid;gap:12px}.fields label,.recovery-card label{display:grid;gap:7px}.fields label span,.recovery-card label span{font-size:15px;font-weight:950;color:#40514a}.fields label span em,.recovery-card label span em{font-size:12px;font-style:normal;color:#7b8680}.fields input,.recovery-card input,.recovery-card textarea{width:100%;min-height:58px;border:1px solid rgba(7,22,17,.11);border-radius:20px;background:#fff;color:#071611;font:800 16px/1.3 Inter,ui-sans-serif,system-ui;padding:0 18px;outline:none}.recovery-card textarea{min-height:88px;padding:14px 18px;resize:vertical}.fields input::placeholder,.recovery-card input::placeholder,.recovery-card textarea::placeholder{color:rgba(64,81,74,.32)}.forgot-under-password{justify-self:end;margin-top:-4px;border:0;background:transparent;color:#087a32;font:950 15px/1 Inter,ui-sans-serif;display:inline-flex;align-items:center;gap:8px;padding:6px}.recovery-card{display:grid;gap:12px;padding:15px;border:1px solid rgba(0,122,47,.16);border-radius:22px;background:rgba(240,248,238,.86)}.recovery-head{display:flex;align-items:center;justify-content:space-between;gap:10px}.recovery-head strong{font-size:17px}.recovery-head button{border:0;background:transparent;color:#087a32;font-weight:900}.recovery-status{padding:10px 12px;border-radius:14px;background:#fff;color:#40514a;font-size:13px;font-weight:800}.recovery-submit,.submit,.register-cta{min-height:56px;border:0;border-radius:20px;display:inline-flex;align-items:center;justify-content:center;font:950 16px/1 Inter,ui-sans-serif;text-align:center}.submit{background:#087a32;color:#fff;box-shadow:0 14px 28px rgba(0,122,47,.18)}.submit:disabled{opacity:.55}.register-cta{background:rgba(0,122,47,.08);color:#087a32}.error{padding:12px 14px;border-radius:18px;background:#fff3f3;color:#9b1c1c;font-weight:900;font-size:13px}@media(max-width:390px){.roles{gap:8px}.roles button{min-height:78px}.roles button b{font-size:16px}.roles button small{font-size:11px}.open-brand strong{font-size:16px}.open-brand small{font-size:11px}}
`;
