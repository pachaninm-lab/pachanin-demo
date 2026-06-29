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
  const [recoveryOpen, setRecoveryOpen] = React.useState(false);
  const [recoveryContact, setRecoveryContact] = React.useState('');
  const [recoveryComment, setRecoveryComment] = React.useState('');
  const [recoveryStatus, setRecoveryStatus] = React.useState('');
  const [recoveryPending, setRecoveryPending] = React.useState(false);
  const next = params.get('next') || platformV7RoleHome(initialRole);
  const canSubmit = Boolean(login.trim() && code.trim() && !pending);

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

  async function submitRecovery() {
    if (recoveryPending) return;
    if (!recoveryContact.trim()) {
      setRecoveryStatus('Укажите телефон или email для ответа.');
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
    <main className='pc-open-v2'>
      <style>{css}</style>
      <header className='open-header' aria-label='Навигация входа'>
        <Link href='/platform-v7' className='open-brand' aria-label='Прозрачная Цена — на главную'>
          <BrandMark size={42} />
          <span><strong>Прозрачная Цена</strong><small>Единый вход в контур сделки</small></span>
        </Link>
        <Link href='/platform-v7' className='open-back' aria-label='На главную'><ArrowLeft size={22} /></Link>
      </header>

      <section className='open-card' aria-label='Вход в рабочий контур'>
        <form onSubmit={submit} autoComplete='off' noValidate>
          <section className='role-panel' aria-label='Рабочая роль'>
            <div className='role-panel-head'><span>Рабочее место</span><strong>{roleTitle(role)}</strong></div>
            <div className='roles'>
              {roles.map(({ role: value, title, note, Icon }) => (
                <button key={value} type='button' className={role === value ? 'active' : ''} aria-pressed={role === value} onClick={() => { setRole(value); setError(''); }}>
                  <Icon size={18} />
                  <span><b>{title}</b><small>{note}</small></span>
                </button>
              ))}
            </div>
          </section>

          <section className='fields' aria-label='Данные входа'>
            <label htmlFor='pc-open-login'><span>Логин</span><input id='pc-open-login' value={login} onChange={(e) => { setLogin(e.target.value); setError(''); }} inputMode='email' autoCapitalize='none' autoCorrect='off' spellCheck={false} autoComplete='off' placeholder='Введите логин' /></label>
            <label htmlFor='pc-open-code'><span>Пароль / код доступа</span><input id='pc-open-code' value={code} onChange={(e) => { setCode(e.target.value); setError(''); }} type='text' inputMode='numeric' autoCapitalize='none' autoCorrect='off' spellCheck={false} autoComplete='off' placeholder='Введите пароль или код' /></label>
            <button type='button' className='forgot-under-password' onClick={() => { setRecoveryOpen((value) => !value); setRecoveryStatus(''); }}><Mail size={16} /><span>Забыли пароль?</span></button>
            <label htmlFor='pc-open-company'><span>Организация <em>необязательно</em></span><input id='pc-open-company' value={company} onChange={(e) => setCompany(e.target.value)} autoCorrect='off' spellCheck={false} autoComplete='off' placeholder='Компания / ИНН' /></label>
          </section>

          {recoveryOpen ? <section className='recovery-card' aria-label='Восстановление доступа'>
            <div className='recovery-head'><strong>Восстановление доступа</strong><button type='button' onClick={() => setRecoveryOpen(false)}>Скрыть</button></div>
            <label htmlFor='pc-recovery-contact'><span>Контакт для ответа</span><input id='pc-recovery-contact' value={recoveryContact} onChange={(e) => { setRecoveryContact(e.target.value); setRecoveryStatus(''); }} placeholder='Телефон или email для связи' autoComplete='off' /></label>
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
.pc-open-v2{min-height:100dvh;padding:84px 8px 150px;background:radial-gradient(circle at 86% 10%,rgba(0,122,47,.10),transparent 30%),radial-gradient(circle at 10% 34%,rgba(181,132,43,.08),transparent 26%),linear-gradient(180deg,#fbfcf9 0%,#f3f7f1 54%,#fff 100%);color:#071611;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.pc-open-v2 *{box-sizing:border-box}.pc-open-v2 a{color:inherit;text-decoration:none}.open-header{position:fixed;top:0;left:0;right:0;z-index:1400;min-height:70px;height:70px;padding:12px 72px 12px 18px;display:flex;align-items:center;background:rgba(255,255,255,.98);border-bottom:1px solid rgba(6,26,22,.08);box-shadow:0 12px 30px rgba(7,22,17,.08);backdrop-filter:blur(18px);-webkit-backdrop-filter:blur(18px)}.open-brand{height:46px;display:inline-flex;align-items:center;gap:12px;min-width:0;width:100%}.open-brand svg,.open-brand img{width:42px;height:42px;flex:0 0 auto;display:block}.open-brand span{display:grid;gap:3px;min-width:0}.open-brand strong{font-size:18px;line-height:1.05;font-weight:950;letter-spacing:-.03em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.open-brand small{font-size:12px;line-height:1.05;font-weight:650;color:#66736e;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.open-back{position:absolute;right:18px;top:14px;width:42px;height:42px;display:flex;align-items:center;justify-content:center;border-radius:15px;border:1px solid rgba(7,22,17,.10);background:rgba(255,255,255,.86);box-shadow:0 7px 18px rgba(7,22,17,.055)}.open-card{max-width:900px;margin:0 auto;padding:12px;border:1px solid rgba(7,22,17,.08);border-radius:24px;background:rgba(255,255,255,.965);box-shadow:0 18px 46px rgba(7,22,17,.07)}form{display:grid;gap:14px}.role-panel{display:grid;gap:11px}.role-panel-head{display:flex;align-items:center;justify-content:space-between;gap:10px;color:#43534c}.role-panel-head span,.role-panel-head strong{font-size:13px;font-weight:950}.role-panel-head strong{color:#06412e;background:rgba(0,122,47,.08);border-radius:999px;padding:7px 12px}.roles{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.roles button{min-height:78px;padding:10px 8px;display:grid;place-items:center;gap:6px;border:1px solid rgba(0,122,47,.18);border-radius:21px;background:rgba(255,255,255,.82);color:#071611;cursor:pointer;box-shadow:0 8px 18px rgba(7,22,17,.04)}.roles button.active{background:#06412e;color:#fff;border-color:#06412e;box-shadow:0 12px 26px rgba(6,65,46,.22)}.roles button svg{color:#087a32}.roles button.active svg{color:#dff5e8}.roles button span{display:grid;gap:2px;text-align:center}.roles button b{font-size:17px;line-height:1.07;font-weight:950;letter-spacing:-.035em}.roles button small{font-size:12px;line-height:1.12;font-weight:850;color:#68756f}.roles button.active small{color:rgba(255,255,255,.78)}.fields,.recovery-card{display:grid;gap:12px}.fields label,.recovery-card label{display:grid;gap:8px}.fields label>span,.recovery-card label>span{color:#3a4c43;font-size:14px;font-weight:950}.fields em,.recovery-card em{color:#8a9690;font-style:normal}input,textarea{width:100%;border:1px solid rgba(7,22,17,.15);border-radius:20px;background:#fff;color:#101b16;font:900 16px/1.2 Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;outline:none}input{min-height:54px;padding:0 16px}textarea{min-height:104px;padding:14px 16px;resize:vertical}input::placeholder,textarea::placeholder{font-size:12px;font-weight:650;color:rgba(58,76,67,.28)}.forgot-under-password{justify-self:end;margin-top:-4px;display:inline-flex;align-items:center;gap:7px;border:0;background:transparent;color:#087a32;font-size:14px;font-weight:950;cursor:pointer}.recovery-card{padding:14px;border:1px solid rgba(0,122,47,.16);border-radius:24px;background:rgba(0,122,47,.04)}.recovery-head{display:flex;align-items:center;justify-content:space-between}.recovery-head strong{font-size:18px;font-weight:950}.recovery-head button{border:0;background:transparent;color:#087a32;font-size:13px;font-weight:950}.recovery-status{padding:10px 12px;border-radius:15px;background:#fff;color:#43534c;font-size:13px;font-weight:850}.recovery-submit,.submit,.register-cta{min-height:54px;border-radius:20px;display:flex;align-items:center;justify-content:center;text-align:center;font-size:16px;font-weight:950}.recovery-submit{border:0;background:#06412e;color:#fff}.submit{border:0;background:#76b88d;color:#fff}.submit:disabled,.recovery-submit:disabled{opacity:.58}.register-cta{border:1px solid rgba(0,122,47,.18);background:#fff;color:#087a32}.error{padding:12px 14px;border-radius:17px;border:1px solid rgba(185,28,28,.18);background:#fff1f1;color:#991b1b;font-size:14px;font-weight:900}@media(min-width:721px){.pc-open-v2{padding:86px 14px 160px}.open-header{padding:12px 110px 12px 56px}.open-back{right:56px}.open-card{padding:16px}.roles{gap:12px}.roles button{min-height:92px}.roles button b{font-size:19px}.roles button small{font-size:13px}}
`;
