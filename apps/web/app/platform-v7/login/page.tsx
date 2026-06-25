'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { PLATFORM_V7_ACTIVE_ROLE_KEY, platformV7RoleHome } from '@/components/platform-v7/PlatformV7SingleEntryGuard';
import { usePlatformV7RStore, type PlatformRole } from '@/stores/usePlatformV7RStore';

type Workspace = { role: PlatformRole; title: string; scope: string };

const PLATFORM_V7_ENTRY_COOKIE = 'pc_v7_entry_seen';
const PLATFORM_V7_ENTRY_TTL_SECONDS = 60 * 60 * 4;
const PLATFORM_V7_PENDING_ROLE_KEY = 'pc_v7_pending_role';

const workspaces: Workspace[] = [
  { role: 'operator', title: 'Оператор', scope: 'Сделки, блокеры, SLA, ручные действия' },
  { role: 'buyer', title: 'Покупатель', scope: 'Закупка, качество, документы, деньги' },
  { role: 'seller', title: 'Продавец', scope: 'Партия, отгрузка, документы, расчёт' },
  { role: 'logistics', title: 'Логистика', scope: 'Рейсы, маршрут, водитель, отклонения' },
  { role: 'driver', title: 'Водитель', scope: 'Рейс, прибытие, фото, полевые события' },
  { role: 'elevator', title: 'Элеватор', scope: 'Вес, разгрузка, приёмка, складской след' },
  { role: 'lab', title: 'Лаборатория', scope: 'Проба, протокол, качество' },
  { role: 'surveyor', title: 'Сюрвейер', scope: 'Осмотр, факты, доказательства' },
  { role: 'bank', title: 'Банк', scope: 'Основание платежа, удержание, проверка' },
  { role: 'compliance', title: 'Комплаенс', scope: 'Допуск, полномочия, стоп-факторы' },
  { role: 'arbitrator', title: 'Арбитр', scope: 'Спор, доказательства, решение' },
  { role: 'executive', title: 'Руководитель', scope: 'Деньги под риском, управленческий срез' },
];

function markEntrySeen() {
  if (typeof document === 'undefined') return;
  const secure = globalThis.location?.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${PLATFORM_V7_ENTRY_COOKIE}=true; Path=/; Max-Age=${PLATFORM_V7_ENTRY_TTL_SECONDS}; SameSite=Lax${secure}`;
}

function isPlatformRole(value: string | null): value is PlatformRole {
  return workspaces.some((item) => item.role === value);
}

function readLockedRole(): PlatformRole | null {
  if (typeof window === 'undefined') return null;
  const requestedRole = new URLSearchParams(window.location.search).get('role');
  if (isPlatformRole(requestedRole)) return requestedRole;
  const storedRole = window.sessionStorage?.getItem(PLATFORM_V7_PENDING_ROLE_KEY) ?? null;
  return isPlatformRole(storedRole) ? storedRole : null;
}

export default function LoginPage() {
  const router = useRouter();
  const setStoreRole = usePlatformV7RStore((state) => state.setRole);
  const [login, setLogin] = React.useState('');
  const [accessCode, setAccessCode] = React.useState('');
  const [company, setCompany] = React.useState('');
  const [lockedRole, setLockedRole] = React.useState<PlatformRole | null>(null);
  const [error, setError] = React.useState('');

  React.useEffect(() => {
    const nextRole = readLockedRole();
    if (!nextRole) return;
    setLockedRole(nextRole);
    window.sessionStorage?.setItem(PLATFORM_V7_PENDING_ROLE_KEY, nextRole);
  }, []);

  async function openWorkspace(nextRole: PlatformRole) {
    globalThis.sessionStorage?.setItem(PLATFORM_V7_ACTIVE_ROLE_KEY, nextRole);
    globalThis.sessionStorage?.removeItem(PLATFORM_V7_PENDING_ROLE_KEY);
    markEntrySeen();
    setStoreRole(nextRole);
    try {
      await fetch('/api/platform-v7/cabinet-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: nextRole }),
        keepalive: true,
      });
    } catch {}
    router.replace(platformV7RoleHome(nextRole));
  }

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!lockedRole) {
      setError('Сначала выбери рабочее место на главной странице. На входе роль повторно не выбирается.');
      return;
    }
    if (!login.trim() || !accessCode.trim() || !company.trim()) {
      setError('Заполни логин, пароль и организацию. Кабинет открывается только после формы входа.');
      return;
    }
    setError('');
    void openWorkspace(lockedRole);
  }

  const selected = lockedRole ? workspaces.find((item) => item.role === lockedRole) ?? null : null;
  const registerHref = lockedRole ? `/platform-v7/register?role=${lockedRole}` : '/platform-v7/register';

  return (
    <main className='pc-v7-login-single'>
      <style>{css}</style>
      <section className='login-shell'>
        <header className='login-top'>
          <Link href='/platform-v7'>Прозрачная Цена</Link>
          <span>единый вход в контур исполнения сделки</span>
        </header>

        <section className='login-main' aria-label='Форма входа'>
          <div className='login-copy'>
            <span>единый вход</span>
            <h1>Вход в рабочую платформу</h1>
            <p>{selected ? 'Рабочее место уже выбрано на главной странице. Здесь только логин, пароль и организация.' : 'Сначала выбери рабочее место на главной странице. На входе роль повторно не выбирается.'}</p>
          </div>

          <form className='login-form' onSubmit={onSubmit}>
            <label><span>Логин</span><input value={login} onChange={(event) => setLogin(event.target.value)} type='email' autoComplete='username' placeholder='name@company.ru' /></label>
            <label><span>Пароль</span><input value={accessCode} onChange={(event) => setAccessCode(event.target.value)} type='password' autoComplete='current-password' placeholder='Введите пароль' /></label>
            <label><span>Организация</span><input value={company} onChange={(event) => setCompany(event.target.value)} type='text' autoComplete='organization' placeholder='Компания / ИНН' /></label>
            {selected ? (
              <article className='login-selected' aria-label='Выбранное рабочее место'>
                <em>выбрано на главной</em>
                <strong>{selected.title}</strong>
                <small>{selected.scope}</small>
              </article>
            ) : (
              <article className='login-selected login-selected-missing' aria-label='Рабочее место не выбрано'>
                <em>роль не выбрана</em>
                <strong>Сначала выбери кабинет на главной</strong>
                <small>Это защищает от повторного выбора и случайного входа в чужой ЛК.</small>
              </article>
            )}
            {error ? <p className='login-error' role='alert'>{error}</p> : null}
            <div className='login-actions'>
              <button type='submit'>Войти в кабинет</button>
              <Link href={registerHref} className='login-register'>Зарегистрироваться</Link>
            </div>
          </form>
        </section>

        <aside className='login-side' aria-label='Контур доступа'>
          <h2>Один вход вместо разбросанных кабинетов</h2>
          <ul>
            <li>роль выбирается один раз на главной</li>
            <li>на входе рабочее место не меняется</li>
            <li>чужие кабинеты закрываются guard-контуром</li>
            <li>регистрация идёт отдельной заявкой</li>
          </ul>
        </aside>
      </section>
    </main>
  );
}

const css = `
.pc-v7-login-single{min-height:100vh;padding:clamp(16px,3vw,42px);background:radial-gradient(circle at 82% 8%,rgba(0,122,47,.12),transparent 30%),linear-gradient(180deg,#f8fbf7 0%,#eef5ec 54%,#fff 100%);color:#071611;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.pc-v7-login-single *{box-sizing:border-box}.login-shell{max-width:1240px;margin:0 auto;display:grid;grid-template-columns:minmax(0,1fr) 360px;gap:18px}.login-top{grid-column:1/-1;display:flex;align-items:center;justify-content:space-between;gap:12px}.login-top a{color:#071611;font-size:18px;font-weight:950;letter-spacing:-.035em;text-decoration:none}.login-top span{color:#66736e;font-size:13px;font-weight:800}.login-main,.login-side{border:1px solid rgba(7,22,17,.08);background:rgba(255,255,255,.88);box-shadow:0 22px 60px rgba(7,22,17,.08);backdrop-filter:blur(18px)}.login-main{display:grid;grid-template-columns:minmax(0,.9fr) minmax(340px,460px);gap:22px;min-height:660px;padding:clamp(22px,4vw,54px);border-radius:34px}.login-copy{align-self:center;display:grid;gap:16px;max-width:540px}.login-copy span{width:fit-content;padding:8px 12px;border-radius:999px;background:rgba(0,122,47,.08);color:#007a2f;font-size:11px;font-weight:950;letter-spacing:.08em;text-transform:uppercase}.login-copy h1{margin:0;font-size:clamp(42px,5.8vw,78px);line-height:.94;letter-spacing:-.07em;font-weight:950}.login-copy p{margin:0;color:#4f5d57;font-size:clamp(16px,1.55vw,21px);line-height:1.42;font-weight:650}.login-form{align-self:center;display:grid;gap:13px;padding:18px;border-radius:26px;border:1px solid rgba(7,22,17,.08);background:#fff;box-shadow:0 18px 40px rgba(7,22,17,.075)}.login-form label{display:grid;gap:7px}.login-form label span{color:#46534e;font-size:12px;font-weight:900}.login-form input{width:100%;height:50px;border-radius:15px;border:1px solid rgba(7,22,17,.13);background:#f8faf7;color:#071611;padding:0 14px;font-size:15px;font-weight:760;outline:none}.login-form input:focus{border-color:#007a2f;box-shadow:0 0 0 4px rgba(0,122,47,.11);background:#fff}.login-selected{display:grid;gap:4px;padding:12px 14px;border-radius:18px;background:linear-gradient(135deg,rgba(0,122,47,.08),rgba(0,122,47,.025));border:1px solid rgba(0,122,47,.13)}.login-selected-missing{background:linear-gradient(135deg,rgba(180,83,9,.08),rgba(255,255,255,.9));border-color:rgba(180,83,9,.18)}.login-selected em{width:fit-content;padding:5px 8px;border-radius:999px;background:rgba(0,122,47,.1);color:#007a2f;font-size:10px;font-style:normal;font-weight:950;letter-spacing:.06em;text-transform:uppercase}.login-selected-missing em{background:rgba(180,83,9,.1);color:#b45309}.login-selected strong{font-size:16px;font-weight:950;color:#071611}.login-selected small{font-size:13px;line-height:1.35;font-weight:700;color:#52615a}.login-error{margin:0;padding:10px 12px;border-radius:14px;background:#fff4e8;color:#8a3d00;font-size:13px;line-height:1.35;font-weight:850}.login-actions{display:grid;grid-template-columns:1fr;gap:10px}.login-form button,.login-register{height:54px;border-radius:17px;font-size:15px;font-weight:950}.login-form button{border:0;background:#007a2f;color:#fff;cursor:pointer;box-shadow:0 16px 34px rgba(0,122,47,.24)}.login-register{display:inline-flex;align-items:center;justify-content:center;text-decoration:none;background:#f3faf5;color:#007a2f;border:1px solid rgba(0,122,47,.2)}.login-side{align-self:stretch;display:grid;align-content:start;gap:16px;padding:24px;border-radius:30px}.login-side h2{margin:0;color:#071611;font-size:30px;line-height:1.02;letter-spacing:-.055em;font-weight:950}.login-side ul{display:grid;gap:10px;margin:0;padding:0;list-style:none}.login-side li{padding:12px;border-radius:16px;background:rgba(7,22,17,.035);color:#26342e;font-size:14px;font-weight:800}@media(max-width:980px){.login-shell{grid-template-columns:1fr}.login-main{grid-template-columns:1fr;min-height:auto}.login-side{display:none}}@media(max-width:520px){.pc-v7-login-single{padding:14px}.login-top{align-items:flex-start;display:grid}.login-main{padding:18px;border-radius:26px}.login-copy h1{font-size:39px}.login-form{padding:14px;border-radius:22px}.login-form input{height:48px}.login-form button,.login-register{height:52px}}
`;
