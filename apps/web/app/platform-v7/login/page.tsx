'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Banknote, BriefcaseBusiness, Building2, ClipboardCheck, Crown, FlaskConical, Landmark, Scale, ShieldCheck, Truck, UserRound, Wheat, type LucideIcon } from 'lucide-react';
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

// Читает роль из публичного выбора. Важно: публичный выбор роли не открывает кабинет.
// роль фиксируется на сессию только после входа через форму.
function readRoleFromPublicEntry(): PlatformRole | null {
  if (typeof window === 'undefined') return null;
  const requestedRole = new URLSearchParams(window.location.search).get('role');
  if (isPlatformRole(requestedRole)) return requestedRole;
  const storedRole = window.sessionStorage?.getItem(PLATFORM_V7_PENDING_ROLE_KEY) ?? null;
  return isPlatformRole(storedRole) ? storedRole : null;
}

const MAX_ATTEMPTS = 5;
const COOLDOWN_SEC = 30;

export default function LoginPage() {
  const router = useRouter();
  const setRole = usePlatformV7RStore((state) => state.setRole);
  const setStoreRole = setRole;
  const [login, setLogin] = React.useState('');
  const [accessCode, setAccessCode] = React.useState('');
  const [company, setCompany] = React.useState('');
  const [entryRole, setEntryRole] = React.useState<PlatformRole | null>(null);
  const [directRole, setDirectRole] = React.useState<PlatformRole | null>(null);
  const [roleFromEntry, setRoleFromEntry] = React.useState(false);
  const [error, setError] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [showPassword, setShowPassword] = React.useState(false);
  const [attempts, setAttempts] = React.useState(0);
  const [cooldownLeft, setCooldownLeft] = React.useState(0);

  React.useEffect(() => {
    if (cooldownLeft <= 0) return;
    const t = setInterval(() => setCooldownLeft((p) => Math.max(0, p - 1)), 1000);
    return () => clearInterval(t);
  }, [cooldownLeft]);

  React.useEffect(() => {
    const publicEntryRole = readRoleFromPublicEntry();
    if (!publicEntryRole) return;
    // публичный выбор роли не открывает кабинет
    setRole(publicEntryRole);
    setRoleFromEntry(true);
    setEntryRole(publicEntryRole);
    window.sessionStorage?.setItem(PLATFORM_V7_PENDING_ROLE_KEY, publicEntryRole);
  }, [setRole]);

  async function openWorkspace(nextRole: PlatformRole) {
    setLoading(true);
    globalThis.sessionStorage?.setItem(PLATFORM_V7_ACTIVE_ROLE_KEY, nextRole);
    void roleFromEntry;
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
    if (cooldownLeft > 0) {
      setError(`Слишком много попыток. Подождите ${cooldownLeft} сек.`);
      return;
    }
    const nextRole = entryRole ?? directRole;
    if (!nextRole) {
      setError('Выберите рабочее место.');
      return;
    }
    if (!login.trim() || !accessCode.trim() || !company.trim()) {
      const next = attempts + 1;
      setAttempts(next);
      if (next >= MAX_ATTEMPTS) {
        setCooldownLeft(COOLDOWN_SEC);
        setError(`Заблокировано на ${COOLDOWN_SEC} сек после ${MAX_ATTEMPTS} неудачных попыток.`);
      } else {
        setError(`Заполни логин, пароль и организацию. Попытка ${next}/${MAX_ATTEMPTS}.`);
      }
      return;
    }
    setError('');
    setAttempts(0);
    void openWorkspace(nextRole);
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
          <span>единый вход в контур исполнения сделки</span>
        </header>

        <section className='login-main' aria-label='Форма входа'>
          <div className='login-copy'>
            <span>Единый вход</span>
            <h1>Вход в рабочую платформу</h1>
            <p>Введите корпоративные данные для доступа к рабочему контуру.</p>
          </div>

          <form className='login-form' onSubmit={onSubmit}>
            {!entryRole ? (
              <section className='login-workspace-picker' aria-label='Рабочее место'>
                <span>Выберите один рабочий кабинет</span>
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
              <section className='login-workspace-heading' aria-label='Рабочее место'><span>Выберите один рабочий кабинет</span><strong>{selected.title}</strong></section>
            ) : null}
            <label><span>Логин</span><input value={login} onChange={(event) => setLogin(event.target.value)} type='email' autoComplete='username' placeholder='имя@компания.рф' disabled={loading} /></label>
            <label>
              <span>Пароль</span>
              <div style={{ position: 'relative' }}>
                <input value={accessCode} onChange={(event) => setAccessCode(event.target.value)} type={showPassword ? 'text' : 'password'} autoComplete='current-password' placeholder='Введите пароль' style={{ paddingRight: 44 }} disabled={loading} />
                <button type='button' onClick={() => setShowPassword((p) => !p)} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#46534e', fontSize: 12, fontWeight: 700, padding: '2px 4px' }} aria-label={showPassword ? 'Скрыть' : 'Показать'}>
                  {showPassword ? '○' : '●'}
                </button>
              </div>
            </label>
            <label><span>Организация</span><input value={company} onChange={(event) => setCompany(event.target.value)} type='text' autoComplete='organization' placeholder='Компания / ИНН' disabled={loading} /></label>
            {attempts >= 3 && attempts < MAX_ATTEMPTS && !cooldownLeft && (
              <p style={{ margin: 0, padding: '8px 12px', borderRadius: 12, background: '#FFF7ED', border: '1px solid #FED7AA', fontSize: 12, color: '#92400E', fontWeight: 700 }}>
                Осталось попыток: {MAX_ATTEMPTS - attempts}. После {MAX_ATTEMPTS} — блокировка {COOLDOWN_SEC} сек.
              </p>
            )}
            {error ? <p className='login-error' role='alert'>{error}</p> : null}
            <div className='login-actions'>
              <button type='submit' disabled={loading || cooldownLeft > 0} style={{ opacity: loading || cooldownLeft > 0 ? 0.7 : 1 }}>
                {loading ? 'Открываем кабинет…' : cooldownLeft > 0 ? `Подождите ${cooldownLeft} сек` : 'Войти в кабинет'}
              </button>
              <Link href={registerHref} className='login-register'>Зарегистрироваться</Link>
            </div>
          </form>
        </section>

        <aside className='login-side' aria-label='Контур доступа'>
          <h2>Корпоративный доступ</h2>
          <ul>
            <li>рабочее место фиксируется при входе</li>
            <li>права доступа применяются по профилю</li>
            <li>операции доступны только в рамках роли</li>
            <li>регистрация оформляется отдельной заявкой</li>
          </ul>
        </aside>
      </section>
    </main>
  );
}

const css = `
.pc-v7-login-single{min-height:100vh;padding:clamp(16px,3vw,42px);background:radial-gradient(circle at 82% 8%,rgba(0,122,47,.12),transparent 30%),linear-gradient(180deg,#f8fbf7 0%,#eef5ec 54%,#fff 100%);color:#071611;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.pc-v7-login-single *{box-sizing:border-box}.login-shell{max-width:1240px;margin:0 auto;display:grid;grid-template-columns:minmax(0,1fr) 360px;gap:18px}.login-top{grid-column:1/-1;display:flex;align-items:center;justify-content:space-between;gap:12px}.login-top a{color:#071611;font-size:18px;font-weight:950;letter-spacing:-.035em;text-decoration:none}.login-top span{color:#66736e;font-size:13px;font-weight:800}.login-main,.login-side{border:1px solid rgba(7,22,17,.08);background:rgba(255,255,255,.88);box-shadow:0 22px 60px rgba(7,22,17,.08);backdrop-filter:blur(18px)}.login-main{display:grid;grid-template-columns:minmax(0,.9fr) minmax(340px,460px);gap:22px;min-height:660px;padding:clamp(22px,4vw,54px);border-radius:34px}.login-copy{align-self:center;display:grid;gap:16px;max-width:540px}.login-copy span{width:fit-content;padding:8px 12px;border-radius:999px;background:rgba(0,122,47,.08);color:#007a2f;font-size:11px;font-weight:950;letter-spacing:.08em;text-transform:uppercase}.login-copy h1{margin:0;font-size:clamp(42px,5.8vw,78px);line-height:.94;letter-spacing:-.07em;font-weight:950}.login-copy p{margin:0;color:#4f5d57;font-size:clamp(16px,1.55vw,21px);line-height:1.42;font-weight:650}.login-form{align-self:center;display:grid;gap:13px;padding:18px;border-radius:26px;border:1px solid rgba(7,22,17,.08);background:#fff;box-shadow:0 18px 40px rgba(7,22,17,.075)}.login-form label{display:grid;gap:7px}.login-form label span,.login-workspace-heading span,.login-workspace-picker>span{color:#46534e;font-size:12px;font-weight:900}.login-form input{width:100%;height:50px;border-radius:15px;border:1px solid rgba(7,22,17,.13);background:#f8faf7;color:#071611;padding:0 14px;font-size:15px;font-weight:760;outline:none}.login-form input:focus{border-color:#007a2f;box-shadow:0 0 0 4px rgba(0,122,47,.11);background:#fff}.login-workspace-heading{display:grid;gap:5px;padding:14px 16px;border-radius:18px;background:linear-gradient(135deg,rgba(0,122,47,.08),rgba(0,122,47,.025));border:1px solid rgba(0,122,47,.13)}.login-workspace-heading strong{font-size:22px;line-height:1.05;font-weight:950;color:#071611}.login-workspace-picker{display:grid;gap:9px}.login-workspace-picker div{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}.login-workspace-picker button{min-width:0;min-height:64px;border-radius:18px;border:1px solid rgba(0,122,47,.13);background:linear-gradient(180deg,#fff,#f4faf6);color:#071611;display:grid;grid-template-columns:auto minmax(0,1fr);align-items:center;gap:9px;padding:0 11px;text-align:left;box-shadow:0 8px 20px rgba(7,22,17,.055);cursor:pointer}.login-workspace-picker button svg{color:#007a2f}.login-workspace-picker button b{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:13px;font-weight:950;letter-spacing:-.025em}.login-workspace-picker button.active{background:#071611;color:#fff;border-color:#071611;box-shadow:0 14px 28px rgba(7,22,17,.18)}.login-workspace-picker button.active svg{color:#fff}.login-error{margin:0;padding:10px 12px;border-radius:14px;background:#fff4e8;color:#8a3d00;font-size:13px;line-height:1.35;font-weight:850}.login-actions{display:grid;grid-template-columns:1fr;gap:10px}.login-actions button{height:54px;border-radius:17px;font-size:15px;font-weight:950;border:0;background:#007a2f;color:#fff;cursor:pointer;box-shadow:0 16px 34px rgba(0,122,47,.24)}.login-register{height:54px;border-radius:17px;font-size:15px;font-weight:950;display:inline-flex;align-items:center;justify-content:center;text-decoration:none;background:#f3faf5;color:#007a2f;border:1px solid rgba(0,122,47,.2)}.login-side{align-self:stretch;display:grid;align-content:start;gap:16px;padding:24px;border-radius:30px}.login-side h2{margin:0;color:#071611;font-size:30px;line-height:1.02;letter-spacing:-.055em;font-weight:950}.login-side ul{display:grid;gap:10px;margin:0;padding:0;list-style:none}.login-side li{padding:12px;border-radius:16px;background:rgba(7,22,17,.035);color:#26342e;font-size:14px;font-weight:800}@media(max-width:980px){.login-shell{grid-template-columns:1fr}.login-main{grid-template-columns:1fr;min-height:auto}.login-side{display:none}}@media(max-width:520px){.pc-v7-login-single{padding:14px}.login-top{align-items:flex-start;display:grid}.login-main{padding:18px;border-radius:26px}.login-copy h1{font-size:39px}.login-form{padding:14px;border-radius:22px}.login-form input{height:48px}.login-actions button,.login-register{height:52px}.login-workspace-picker div{grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.login-workspace-picker button{min-height:62px;grid-template-columns:1fr;justify-items:center;text-align:center;padding:8px 6px}.login-workspace-picker button b{font-size:12px}}
`;
