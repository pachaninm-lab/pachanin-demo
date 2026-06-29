'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Banknote,
  BriefcaseBusiness,
  Building2,
  ClipboardCheck,
  Crown,
  FlaskConical,
  Landmark,
  Scale,
  ShieldCheck,
  Truck,
  UserRound,
  Wheat,
  type LucideIcon,
} from 'lucide-react';
import { PLATFORM_V7_ACTIVE_ROLE_KEY, platformV7RoleHome } from '@/components/platform-v7/PlatformV7SingleEntryGuard';
import { usePlatformV7RStore, type PlatformRole } from '@/stores/usePlatformV7RStore';

type Workspace = { role: PlatformRole; title: string; Icon: LucideIcon };

const PLATFORM_V7_ENTRY_COOKIE = 'pc_v7_entry_seen';
const PLATFORM_V7_ENTRY_TTL_SECONDS = 60 * 60 * 4;
const PLATFORM_V7_PENDING_ROLE_KEY = 'pc_v7_pending_role';

const workspaces: Workspace[] = [
  { role: 'operator', title: 'Оператор', Icon: BriefcaseBusiness },
  { role: 'buyer', title: 'Покупатель', Icon: UserRound },
  { role: 'seller', title: 'Продавец', Icon: Wheat },
  { role: 'logistics', title: 'Логистика', Icon: Truck },
  { role: 'driver', title: 'Водитель', Icon: ClipboardCheck },
  { role: 'elevator', title: 'Элеватор', Icon: Building2 },
  { role: 'lab', title: 'Лаборатория', Icon: FlaskConical },
  { role: 'surveyor', title: 'Сюрвейер', Icon: ShieldCheck },
  { role: 'bank', title: 'Банк', Icon: Landmark },
  { role: 'compliance', title: 'Комплаенс', Icon: Banknote },
  { role: 'arbitrator', title: 'Арбитр', Icon: Scale },
  { role: 'executive', title: 'Руководитель', Icon: Crown },
];

function markEntrySeen() {
  if (typeof document === 'undefined') return;
  const secure = globalThis.location?.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${PLATFORM_V7_ENTRY_COOKIE}=true; Path=/; Max-Age=${PLATFORM_V7_ENTRY_TTL_SECONDS}; SameSite=Lax${secure}`;
}

function isPlatformRole(value: string | null): value is PlatformRole {
  return workspaces.some((item) => item.role === value);
}

function normalizeInternalNext(value: string | null, fallbackRole: PlatformRole): string {
  if (!value) return platformV7RoleHome(fallbackRole);
  try {
    const decoded = decodeURIComponent(value);
    if (decoded.startsWith('/platform-v7') && !decoded.startsWith('/platform-v7/login')) return decoded;
  } catch {}
  return platformV7RoleHome(fallbackRole);
}

function readInitialRole(): PlatformRole | null {
  if (typeof window === 'undefined') return null;
  const params = new URLSearchParams(window.location.search);
  const requestedRole = params.get('role') || params.get('as');
  if (isPlatformRole(requestedRole)) return requestedRole;
  const storedRole = window.sessionStorage?.getItem(PLATFORM_V7_PENDING_ROLE_KEY) ?? null;
  return isPlatformRole(storedRole) ? storedRole : null;
}

function readNextHref(role: PlatformRole): string {
  if (typeof window === 'undefined') return platformV7RoleHome(role);
  const params = new URLSearchParams(window.location.search);
  return normalizeInternalNext(params.get('next') || params.get('redirect'), role);
}

export default function LoginPage() {
  const router = useRouter();
  const setStoreRole = usePlatformV7RStore((state) => state.setRole);
  const [login, setLogin] = React.useState('');
  const [accessCode, setAccessCode] = React.useState('');
  const [company, setCompany] = React.useState('');
  const [entryRole, setEntryRole] = React.useState<PlatformRole | null>(null);
  const [directRole, setDirectRole] = React.useState<PlatformRole | null>(null);
  const [error, setError] = React.useState('');
  const [pending, setPending] = React.useState(false);
  const [formNonce, setFormNonce] = React.useState('pc-login');
  const [inputsUnlocked, setInputsUnlocked] = React.useState(false);
  const userStartedInputRef = React.useRef(false);

  React.useEffect(() => {
    const nextRole = readInitialRole();
    if (nextRole) {
      setEntryRole(nextRole);
      window.sessionStorage?.setItem(PLATFORM_V7_PENDING_ROLE_KEY, nextRole);
    }

    const nonce = `pc-login-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
    setFormNonce(nonce);
    setInputsUnlocked(false);
    userStartedInputRef.current = false;
    setLogin('');
    setAccessCode('');
    setCompany('');

    const clear = () => {
      if (userStartedInputRef.current) return;
      setLogin('');
      setAccessCode('');
      setCompany('');
    };

    const timers = [100, 300, 700, 1200, 2000, 3200].map((ms) => window.setTimeout(clear, ms));
    const interval = window.setInterval(clear, 250);
    const stopInterval = window.setTimeout(() => window.clearInterval(interval), 5000);

    return () => {
      timers.forEach((timer) => window.clearTimeout(timer));
      window.clearTimeout(stopInterval);
      window.clearInterval(interval);
    };
  }, []);

  function unlockManualInput() {
    userStartedInputRef.current = true;
    setInputsUnlocked(true);
    setError('');
  }

  async function openWorkspace(nextRole: PlatformRole) {
    globalThis.sessionStorage?.setItem(PLATFORM_V7_ACTIVE_ROLE_KEY, nextRole);
    globalThis.sessionStorage?.removeItem(PLATFORM_V7_PENDING_ROLE_KEY);
    markEntrySeen();
    setStoreRole(nextRole);
    router.replace(readNextHref(nextRole));
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const nextRole = entryRole ?? directRole;
    if (!nextRole) {
      setError('Выберите рабочее место.');
      return;
    }
    if (!login.trim() || !accessCode.trim()) {
      setError('Введите логин и пароль вручную.');
      return;
    }

    setPending(true);
    setError('');
    try {
      const response = await fetch(`/api/platform-v7/cabinet-lock-login?ts=${Date.now()}&v=hard-gate`, {
        method: 'POST',
        cache: 'no-store',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store',
          Pragma: 'no-cache',
        },
        body: JSON.stringify({ login: login.trim(), password: accessCode.trim(), role: nextRole, company: company.trim() }),
      });
      if (!response.ok) {
        setError(response.status === 401 ? 'Неверный логин или пароль.' : 'Доступ временно не выдан. Проверь опубликованный деплой.');
        return;
      }
      await openWorkspace(nextRole);
    } catch {
      setError('Не удалось проверить доступ. Обнови страницу и повтори вход.');
    } finally {
      setPending(false);
    }
  }

  const selectedRole = entryRole ?? directRole;
  const selected = selectedRole ? workspaces.find((item) => item.role === selectedRole) ?? null : null;
  const registerHref = selectedRole ? `/platform-v7/register?role=${selectedRole}` : '/platform-v7/register';

  return (
    <main className='pc-v7-login-single'>
      <style>{css}</style>
      <section className='login-shell'>
        <header className='login-top'>
          <Link href='/platform-v7'>Прозрачная Цена</Link>
          <span>закрытый вход в рабочий контур</span>
        </header>

        <section className='login-main' aria-label='Форма входа'>
          <div className='login-copy'>
            <span>единый вход</span>
            <h1>Вход в рабочую платформу</h1>
            <p>Личные кабинеты закрыты. Вход выполняется только через форму платформы.</p>
          </div>

          <form className='login-form' onSubmit={onSubmit} autoComplete='off' data-form-nonce={formNonce}>
            <div className='login-autofill-trap' aria-hidden='true'>
              <input type='text' name='username' autoComplete='username' tabIndex={-1} />
              <input type='password' name='password' autoComplete='current-password' tabIndex={-1} />
              <input type='text' name='organization' autoComplete='organization' tabIndex={-1} />
            </div>

            {!entryRole ? (
              <section className='login-workspace-picker' aria-label='Рабочее место'>
                <span>Рабочее место</span>
                <div>
                  {workspaces.map((item) => {
                    const Icon = item.Icon;
                    return (
                      <button key={item.role} type='button' className={directRole === item.role ? 'active' : ''} onClick={() => { setDirectRole(item.role); setError(''); }}>
                        <Icon size={20} strokeWidth={2.35} />
                        <b>{item.title}</b>
                      </button>
                    );
                  })}
                </div>
              </section>
            ) : selected ? (
              <section className='login-workspace-heading' aria-label='Рабочее место'>
                <span>Рабочее место</span>
                <strong>{selected.title}</strong>
              </section>
            ) : null}

            <label>
              <span>Логин</span>
              <input
                key={`login-${formNonce}`}
                name={`pc_manual_identity_${formNonce}`}
                value={login}
                onPointerDown={unlockManualInput}
                onFocus={unlockManualInput}
                onChange={(event) => { unlockManualInput(); setLogin(event.target.value); }}
                type='text'
                autoComplete='new-password'
                autoCapitalize='none'
                autoCorrect='off'
                spellCheck={false}
                inputMode='email'
                readOnly={!inputsUnlocked}
                data-lpignore='true'
                data-1p-ignore='true'
                data-form-type='other'
                placeholder='Введите логин вручную'
              />
            </label>
            <label>
              <span>Пароль</span>
              <input
                key={`password-${formNonce}`}
                name={`pc_manual_code_${formNonce}`}
                value={accessCode}
                onPointerDown={unlockManualInput}
                onFocus={unlockManualInput}
                onChange={(event) => { unlockManualInput(); setAccessCode(event.target.value); }}
                type='password'
                autoComplete='one-time-code'
                autoCapitalize='none'
                autoCorrect='off'
                spellCheck={false}
                inputMode='numeric'
                readOnly={!inputsUnlocked}
                data-lpignore='true'
                data-1p-ignore='true'
                data-form-type='other'
                placeholder='Введите пароль вручную'
              />
            </label>
            <label>
              <span>Организация <em>необязательно</em></span>
              <input
                key={`company-${formNonce}`}
                name={`pc_manual_company_${formNonce}`}
                value={company}
                onPointerDown={unlockManualInput}
                onFocus={unlockManualInput}
                onChange={(event) => { unlockManualInput(); setCompany(event.target.value); }}
                type='text'
                autoComplete='off'
                autoCorrect='off'
                spellCheck={false}
                readOnly={!inputsUnlocked}
                data-lpignore='true'
                data-1p-ignore='true'
                data-form-type='other'
                placeholder='Компания / ИНН'
              />
            </label>
            {error ? <p className='login-error' role='alert'>{error}</p> : null}
            <div className='login-actions'>
              <button type='submit' disabled={pending}>{pending ? 'Проверяем доступ…' : 'Войти в кабинет'}</button>
              <Link href={registerHref} className='login-register'>Зарегистрироваться</Link>
            </div>
          </form>
        </section>
      </section>
    </main>
  );
}

const css = `
.pc-v7-login-single{min-height:100vh;padding:clamp(14px,3vw,42px);background:radial-gradient(circle at 82% 8%,rgba(0,122,47,.12),transparent 30%),linear-gradient(180deg,#f8fbf7 0%,#eef5ec 54%,#fff 100%);color:#071611;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.pc-v7-login-single *{box-sizing:border-box}.login-shell{max-width:1180px;margin:0 auto;display:grid;gap:18px}.login-top{display:flex;align-items:center;justify-content:space-between;gap:12px}.login-top a{color:#071611;font-size:20px;font-weight:950;letter-spacing:-.035em;text-decoration:none}.login-top span{color:#66736e;font-size:13px;font-weight:850}.login-main{display:grid;grid-template-columns:minmax(0,.9fr) minmax(340px,460px);gap:22px;min-height:680px;padding:clamp(22px,4vw,54px);border-radius:34px;border:1px solid rgba(7,22,17,.08);background:rgba(255,255,255,.9);box-shadow:0 22px 60px rgba(7,22,17,.08);backdrop-filter:blur(18px)}.login-copy{align-self:center;display:grid;gap:16px;max-width:560px}.login-copy span{width:fit-content;padding:8px 12px;border-radius:999px;background:rgba(0,122,47,.08);color:#007a2f;font-size:11px;font-weight:950;letter-spacing:.08em;text-transform:uppercase}.login-copy h1{margin:0;font-size:clamp(42px,5.8vw,78px);line-height:.94;letter-spacing:-.07em;font-weight:950}.login-copy p{margin:0;color:#4f5d57;font-size:clamp(16px,1.55vw,21px);line-height:1.42;font-weight:700}.login-form{align-self:center;display:grid;gap:13px;padding:18px;border-radius:26px;border:1px solid rgba(7,22,17,.08);background:#fff;box-shadow:0 18px 40px rgba(7,22,17,.075);position:relative}.login-autofill-trap{position:absolute;left:-10000px;top:auto;width:1px;height:1px;overflow:hidden;opacity:0;pointer-events:none}.login-form label{display:grid;gap:7px}.login-form label span,.login-workspace-heading span,.login-workspace-picker>span{color:#46534e;font-size:12px;font-weight:900}.login-form label em{color:#89948f;font-style:normal;font-weight:750}.login-form input{width:100%;height:50px;border-radius:15px;border:1px solid rgba(7,22,17,.13);background:#f8faf7;color:#071611;padding:0 14px;font-size:15px;font-weight:760;outline:none}.login-form input:focus{border-color:#007a2f;box-shadow:0 0 0 4px rgba(0,122,47,.11);background:#fff}.login-workspace-heading{display:grid;gap:5px;padding:14px 16px;border-radius:18px;background:linear-gradient(135deg,rgba(0,122,47,.08),rgba(0,122,47,.025));border:1px solid rgba(0,122,47,.13)}.login-workspace-heading strong{font-size:24px;line-height:1.05;font-weight:950;color:#071611}.login-workspace-picker{display:grid;gap:9px}.login-workspace-picker div{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}.login-workspace-picker button{min-width:0;min-height:64px;border-radius:18px;border:1px solid rgba(0,122,47,.13);background:linear-gradient(180deg,#fff,#f4faf6);color:#071611;display:grid;grid-template-columns:auto minmax(0,1fr);align-items:center;gap:9px;padding:0 11px;text-align:left;box-shadow:0 8px 20px rgba(7,22,17,.055);cursor:pointer}.login-workspace-picker button svg{color:#007a2f}.login-workspace-picker button b{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:13px;font-weight:950;letter-spacing:-.025em}.login-workspace-picker button.active{background:#071611;color:#fff;border-color:#071611;box-shadow:0 14px 28px rgba(7,22,17,.18)}.login-workspace-picker button.active svg{color:#fff}.login-error{margin:0;padding:10px 12px;border-radius:14px;background:#fff4e8;color:#8a3d00;font-size:13px;line-height:1.35;font-weight:850}.login-actions{display:grid;grid-template-columns:1fr;gap:10px}.login-actions button{height:54px;border-radius:17px;font-size:15px;font-weight:950;border:0;background:#007a2f;color:#fff;cursor:pointer;box-shadow:0 16px 34px rgba(0,122,47,.24)}.login-actions button:disabled{opacity:.65;cursor:wait}.login-register{height:54px;border-radius:17px;font-size:15px;font-weight:950;display:inline-flex;align-items:center;justify-content:center;text-decoration:none;background:#f3faf5;color:#007a2f;border:1px solid rgba(0,122,47,.2)}@media(max-width:860px){.login-main{grid-template-columns:1fr;min-height:auto}.login-copy{align-self:auto}.login-copy h1{font-size:clamp(38px,12vw,64px)}}@media(max-width:520px){.pc-v7-login-single{padding:14px}.login-top{align-items:flex-start;display:grid}.login-main{padding:18px;border-radius:26px}.login-copy h1{font-size:39px}.login-form{padding:14px;border-radius:22px}.login-form input{height:48px}.login-actions button,.login-register{height:52px}.login-workspace-picker div{grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.login-workspace-picker button{min-height:62px;grid-template-columns:1fr;justify-items:center;text-align:center;padding:8px}.login-workspace-picker button b{font-size:12px}.login-copy p{font-size:16px}}
`;
