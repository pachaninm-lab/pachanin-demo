'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Banknote, BriefcaseBusiness, Building2, ClipboardCheck, Crown, FlaskConical, Landmark, Mail, Scale, ShieldCheck, Truck, UserRound, Wheat, type LucideIcon } from 'lucide-react';
import { PLATFORM_V7_ACTIVE_ROLE_KEY, platformV7RoleHome } from '@/components/platform-v7/PlatformV7SingleEntryGuard';
import { usePlatformV7RStore, type PlatformRole } from '@/stores/usePlatformV7RStore';

type Lang = 'ru' | 'en' | 'zh';
type Workspace = { role: PlatformRole; Icon: LucideIcon; ru: string; en: string; zh: string; ruSub: string; enSub: string; zhSub: string };

const PLATFORM_V7_ENTRY_COOKIE = 'pc_v7_entry_seen';
const PLATFORM_V7_ENTRY_TTL_SECONDS = 60 * 60 * 4;
const PLATFORM_V7_PENDING_ROLE_KEY = 'pc_v7_pending_role';
const LANGUAGE_KEY = 'pc-v7-language';

const workspaces: Workspace[] = [
  { role: 'operator', Icon: BriefcaseBusiness, ru: 'Оператор', en: 'Operator', zh: '运营方', ruSub: 'Контроль сделок', enSub: 'Deal control', zhSub: '交易控制' },
  { role: 'buyer', Icon: UserRound, ru: 'Покупатель', en: 'Buyer', zh: '买方', ruSub: 'Поставка и оплата', enSub: 'Delivery and payment', zhSub: '交付与付款' },
  { role: 'seller', Icon: Wheat, ru: 'Продавец', en: 'Seller', zh: '卖方', ruSub: 'Партии и расчёт', enSub: 'Lots and settlement', zhSub: '批次与结算' },
  { role: 'logistics', Icon: Truck, ru: 'Логистика', en: 'Logistics', zh: '物流', ruSub: 'Рейсы и маршрут', enSub: 'Trips and routes', zhSub: '运输与路线' },
  { role: 'driver', Icon: ClipboardCheck, ru: 'Водитель', en: 'Driver', zh: '司机', ruSub: 'Точки рейса', enSub: 'Trip points', zhSub: '运输节点' },
  { role: 'elevator', Icon: Building2, ru: 'Элеватор', en: 'Elevator', zh: '粮仓', ruSub: 'Приёмка и вес', enSub: 'Acceptance and weight', zhSub: '验收与重量' },
  { role: 'lab', Icon: FlaskConical, ru: 'Лаборатория', en: 'Laboratory', zh: '实验室', ruSub: 'Качество', enSub: 'Quality', zhSub: '质量' },
  { role: 'surveyor', Icon: ShieldCheck, ru: 'Сюрвейер', en: 'Surveyor', zh: '检验员', ruSub: 'Факты осмотра', enSub: 'Inspection facts', zhSub: '检查事实' },
  { role: 'bank', Icon: Landmark, ru: 'Банк', en: 'Bank', zh: '银行', ruSub: 'Основание оплаты', enSub: 'Payment basis', zhSub: '付款依据' },
  { role: 'compliance', Icon: Banknote, ru: 'Комплаенс', en: 'Compliance', zh: '合规', ruSub: 'Правила и риски', enSub: 'Rules and risks', zhSub: '规则与风险' },
  { role: 'arbitrator', Icon: Scale, ru: 'Арбитр', en: 'Arbitrator', zh: '仲裁员', ruSub: 'Спор и решение', enSub: 'Dispute and decision', zhSub: '争议与决定' },
  { role: 'executive', Icon: Crown, ru: 'Руководитель', en: 'Executive', zh: '管理层', ruSub: 'Сводка и контроль', enSub: 'Summary and control', zhSub: '汇总与控制' },
];

const copy = {
  ru: {
    brand: 'Прозрачная Цена', subbrand: 'Единый вход в контур сделки', workplace: 'Рабочее место', login: 'Логин', loginPh: 'Введите логин', password: 'Пароль / код доступа', passwordPh: 'Введите пароль или код', forgot: 'Забыли пароль?', company: 'Организация', optional: 'необязательно', companyPh: 'Компания / ИНН', submit: 'Войти как', register: 'Зарегистрироваться', choose: 'Выберите рабочее место.', fill: 'Заполните логин и пароль / код доступа.', back: 'Назад', signAs: 'Войти как',
  },
  en: {
    brand: 'Transparent Price', subbrand: 'Single entry to the deal circuit', workplace: 'Workspace', login: 'Login', loginPh: 'Enter login', password: 'Password / access code', passwordPh: 'Enter password or code', forgot: 'Forgot password?', company: 'Organisation', optional: 'optional', companyPh: 'Company / TIN', submit: 'Sign in as', register: 'Register', choose: 'Select a workspace.', fill: 'Enter login and password / access code.', back: 'Back', signAs: 'Sign in as',
  },
  zh: {
    brand: '透明价格', subbrand: '进入交易闭环的统一入口', workplace: '工作区', login: '登录名', loginPh: '输入登录名', password: '密码 / 访问码', passwordPh: '输入密码或访问码', forgot: '忘记密码？', company: '组织', optional: '可选', companyPh: '公司 / 税号', submit: '以此身份登录：', register: '注册', choose: '请选择工作区。', fill: '请输入登录名和密码 / 访问码。', back: '返回', signAs: '以此身份登录：',
  },
} as const;

function markEntrySeen() {
  if (typeof document === 'undefined') return;
  const secure = globalThis.location?.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${PLATFORM_V7_ENTRY_COOKIE}=true; Path=/; Max-Age=${PLATFORM_V7_ENTRY_TTL_SECONDS}; SameSite=Lax${secure}`;
}

function roleName(role: Workspace, lang: Lang) {
  return lang === 'en' ? role.en : lang === 'zh' ? role.zh : role.ru;
}

function roleSub(role: Workspace, lang: Lang) {
  return lang === 'en' ? role.enSub : lang === 'zh' ? role.zhSub : role.ruSub;
}

function isPlatformRole(value: string | null): value is PlatformRole {
  return workspaces.some((item) => item.role === value);
}

function readRoleFromPublicEntry(): PlatformRole | null {
  if (typeof window === 'undefined') return null;
  const requestedRole = new URLSearchParams(window.location.search).get('role');
  if (isPlatformRole(requestedRole)) return requestedRole;
  const storedRole = window.sessionStorage?.getItem(PLATFORM_V7_PENDING_ROLE_KEY) ?? null;
  return isPlatformRole(storedRole) ? storedRole : null;
}

function readLanguage(): Lang {
  if (typeof window === 'undefined') return 'ru';
  const value = window.localStorage.getItem(LANGUAGE_KEY);
  return value === 'en' || value === 'zh' ? value : 'ru';
}

export default function LoginPage() {
  const router = useRouter();
  const setRole = usePlatformV7RStore((state) => state.setRole);
  const [lang, setLang] = React.useState<Lang>('ru');
  const [login, setLogin] = React.useState('');
  const [accessCode, setAccessCode] = React.useState('');
  const [company, setCompany] = React.useState('');
  const [entryRole, setEntryRole] = React.useState<PlatformRole | null>(null);
  const [directRole, setDirectRole] = React.useState<PlatformRole | null>(null);
  const [error, setError] = React.useState('');

  React.useEffect(() => {
    const update = () => setLang(readLanguage());
    update();
    const interval = window.setInterval(update, 500);
    window.addEventListener('storage', update);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener('storage', update);
    };
  }, []);

  React.useEffect(() => {
    const publicEntryRole = readRoleFromPublicEntry();
    if (!publicEntryRole) return;
    setRole(publicEntryRole);
    setEntryRole(publicEntryRole);
    window.sessionStorage?.setItem(PLATFORM_V7_PENDING_ROLE_KEY, publicEntryRole);
  }, [setRole]);

  async function openWorkspace(nextRole: PlatformRole) {
    globalThis.sessionStorage?.setItem(PLATFORM_V7_ACTIVE_ROLE_KEY, nextRole);
    globalThis.sessionStorage?.removeItem(PLATFORM_V7_PENDING_ROLE_KEY);
    markEntrySeen();
    setRole(nextRole);
    try {
      await fetch('/api/platform-v7/cabinet-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: nextRole, company: company.trim() || null }),
        keepalive: true,
      });
    } catch {}
    router.replace(platformV7RoleHome(nextRole));
  }

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextRole = entryRole ?? directRole;
    if (!nextRole) {
      setError(copy[lang].choose);
      return;
    }
    if (!login.trim() || !accessCode.trim()) {
      setError(copy[lang].fill);
      return;
    }
    setError('');
    void openWorkspace(nextRole);
  }

  const t = copy[lang];
  const selectedRole = entryRole ?? directRole;
  const selected = selectedRole ? workspaces.find((item) => item.role === selectedRole) ?? null : null;
  const registerHref = selectedRole ? `/platform-v7/register?role=${selectedRole}` : '/platform-v7/register';

  return (
    <main className='pc-v7-login-single' data-login-lang={lang}>
      <style>{css}</style>
      <header className='login-header'>
        <Link className='login-brand' href='/platform-v7'>
          <span className='login-logo' aria-hidden='true'>▰</span>
          <span><b>{t.brand}</b><small>{t.subbrand}</small></span>
        </Link>
        <Link className='login-back' href='/platform-v7' aria-label={t.back}><ArrowLeft size={25} /></Link>
      </header>

      <section className='login-card'>
        <div className='login-work-title'>
          <h1>{t.workplace}</h1>
          {selected ? <span>{roleName(selected, lang)}</span> : null}
        </div>

        <section className='login-grid' aria-label={t.workplace}>
          {workspaces.map((item) => {
            const Icon = item.Icon;
            const active = selectedRole === item.role;
            return (
              <button key={item.role} type='button' className={active ? 'active' : ''} onClick={() => { setDirectRole(item.role); setError(''); }}>
                <Icon size={24} strokeWidth={2.25} />
                <b>{roleName(item, lang)}</b>
                <small>{roleSub(item, lang)}</small>
              </button>
            );
          })}
        </section>

        <form className='login-form' onSubmit={onSubmit}>
          <label><span>{t.login}</span><input value={login} onChange={(event) => setLogin(event.target.value)} type='email' autoComplete='username' placeholder={t.loginPh} /></label>
          <label><span>{t.password}</span><input value={accessCode} onChange={(event) => setAccessCode(event.target.value)} type='password' autoComplete='current-password' placeholder={t.passwordPh} /></label>
          <Link className='forgot-link' href='/platform-v7/contact'><Mail size={18} />{t.forgot}</Link>
          <label><span>{t.company} <em>{t.optional}</em></span><input value={company} onChange={(event) => setCompany(event.target.value)} type='text' autoComplete='organization' placeholder={t.companyPh} /></label>
          {error ? <p className='login-error' role='alert'>{error}</p> : null}
          <button className='submit-button' type='submit'>{selected ? `${t.submit} ${roleName(selected, lang)}` : t.submit}</button>
          <Link href={registerHref} className='register-button'>{t.register}</Link>
        </form>
      </section>
    </main>
  );
}

const css = `
.pc-v7-login-single{min-height:100vh;padding:clamp(18px,3vw,44px);background:radial-gradient(circle at 84% 5%,rgba(0,122,47,.13),transparent 30%),linear-gradient(180deg,#f8fbf7 0%,#eef6ed 58%,#fff 100%);color:#071611;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.pc-v7-login-single *{box-sizing:border-box}.login-header{max-width:980px;margin:0 auto 18px;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:18px 22px;background:rgba(255,255,255,.92);border:1px solid rgba(7,22,17,.08);box-shadow:0 18px 46px rgba(7,22,17,.07)}.login-brand{display:flex;align-items:center;gap:14px;color:#071611;text-decoration:none;min-width:0}.login-logo{width:48px;height:48px;border-radius:12px;display:grid;place-items:center;background:#0a3024;color:#cfe8d8;font-weight:950;box-shadow:inset 0 0 0 2px rgba(255,255,255,.25)}.login-brand b{display:block;font-size:24px;line-height:1;font-weight:950;letter-spacing:-.055em}.login-brand small{display:block;margin-top:5px;color:#5b6963;font-size:14px;font-weight:850}.login-back{width:58px;height:58px;border-radius:18px;display:grid;place-items:center;background:#fff;color:#071611;border:1px solid rgba(7,22,17,.1);box-shadow:0 10px 26px rgba(7,22,17,.06)}.login-card{max-width:980px;margin:0 auto;border-radius:34px;background:rgba(255,255,255,.9);border:1px solid rgba(7,22,17,.08);box-shadow:0 24px 70px rgba(7,22,17,.09);padding:clamp(20px,4vw,42px)}.login-work-title{display:flex;align-items:center;justify-content:space-between;gap:14px;margin-bottom:24px}.login-work-title h1{margin:0;color:#26342e;font-size:clamp(24px,4vw,34px);font-weight:950;letter-spacing:-.05em}.login-work-title span{padding:12px 20px;border-radius:999px;background:rgba(0,122,47,.08);color:#004d2c;font-size:22px;font-weight:950}.login-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px;margin-bottom:24px}.login-grid button{min-width:0;min-height:142px;border-radius:26px;border:1px solid rgba(0,122,47,.18);background:linear-gradient(180deg,#fff,#f7fbf8);display:grid;place-items:center;text-align:center;align-content:center;gap:8px;color:#071611;box-shadow:0 10px 28px rgba(7,22,17,.045);cursor:pointer}.login-grid button svg{color:#007a2f}.login-grid button b{font-size:28px;line-height:1;font-weight:950;letter-spacing:-.055em}.login-grid button small{max-width:94%;color:#66736e;font-size:18px;line-height:1.08;font-weight:900}.login-grid button.active{background:#004d2c;color:#fff;border-color:#004d2c;box-shadow:0 18px 38px rgba(0,77,44,.22)}.login-grid button.active svg,.login-grid button.active small{color:#fff}.login-form{display:grid;gap:18px}.login-form label{display:grid;gap:8px}.login-form label span{color:#35453f;font-size:23px;line-height:1.1;font-weight:950}.login-form label em{font-style:normal;color:#79857f;font-size:16px;font-weight:850}.login-form input{width:100%;height:74px;border-radius:24px;border:1px solid rgba(7,22,17,.13);background:#fff;color:#071611;padding:0 28px;font-size:24px;font-weight:850;outline:none;box-shadow:0 8px 18px rgba(7,22,17,.035)}.login-form input::placeholder{color:#c1c8c4}.login-form input:focus{border-color:#007a2f;box-shadow:0 0 0 4px rgba(0,122,47,.11);background:#fff}.forgot-link{justify-self:end;display:inline-flex;align-items:center;gap:8px;color:#007a2f;text-decoration:none;font-size:22px;font-weight:950}.login-error{margin:0;padding:13px 16px;border-radius:18px;background:#fff4e8;color:#8a3d00;font-size:16px;line-height:1.35;font-weight:900}.submit-button,.register-button{height:78px;border-radius:24px;font-size:24px;font-weight:950;display:flex;align-items:center;justify-content:center;text-decoration:none}.submit-button{border:0;background:#007a2f;color:#fff;box-shadow:0 18px 38px rgba(0,122,47,.24);cursor:pointer}.register-button{background:#f3faf5;color:#071611;border:1px solid rgba(0,122,47,.14)}@media(max-width:620px){.pc-v7-login-single{padding:14px}.login-header{padding:14px 16px;margin-bottom:14px}.login-logo{width:44px;height:44px}.login-brand b{font-size:23px}.login-brand small{font-size:13px}.login-back{width:52px;height:52px}.login-card{border-radius:30px;padding:22px}.login-work-title{margin-bottom:18px}.login-work-title span{font-size:20px;padding:10px 18px}.login-grid{gap:12px}.login-grid button{min-height:124px;border-radius:22px}.login-grid button b{font-size:25px}.login-grid button small{font-size:17px}.login-form label span{font-size:22px}.login-form input{height:70px;border-radius:22px;font-size:22px;padding:0 22px}.submit-button,.register-button{height:72px;border-radius:22px;font-size:22px}}@media(max-width:380px){.login-grid button b{font-size:22px}.login-grid button small{font-size:15px}.login-form input{font-size:20px}.submit-button,.register-button{font-size:20px}}
`;
