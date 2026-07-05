'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Banknote, BriefcaseBusiness, Building2, ClipboardCheck, Crown, FlaskConical, Landmark, Languages, LogOut, Mail, Scale, ShieldCheck, Truck, UserRound, Wheat, type LucideIcon } from 'lucide-react';
import { PLATFORM_V7_ACTIVE_ROLE_KEY, platformV7RoleHome } from '@/components/platform-v7/PlatformV7SingleEntryGuard';
import { BrandMark } from '@/components/v7r/BrandMark';
import { usePlatformV7RStore, type PlatformRole } from '@/stores/usePlatformV7RStore';

type Lang = 'ru' | 'en' | 'zh';
type Workspace = { role: PlatformRole; Icon: LucideIcon; ru: string; en: string; zh: string; ruSub: string; enSub: string; zhSub: string };
const ENTRY_COOKIE = 'pc_v7_entry_seen';
const PENDING_ROLE_KEY = 'pc_v7_pending_role';
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
  ru: { brand: 'Прозрачная Цена', subbrand: 'Единый вход в контур сделки', workplace: 'Рабочее место', login: 'Логин', loginPh: 'Введите логин', password: 'Пароль / код доступа', passwordPh: 'Введите пароль или код', forgot: 'Забыли пароль?', company: 'Организация', optional: 'необязательно', companyPh: 'Компания / ИНН', submit: 'Войти как', register: 'Зарегистрироваться', choose: 'Выберите рабочее место.', fill: 'Заполните логин и пароль / код доступа.', exit: 'Выход', lang: 'Язык' },
  en: { brand: 'Transparent Price', subbrand: 'Single entry to the deal circuit', workplace: 'Workspace', login: 'Login', loginPh: 'Enter login', password: 'Password / access code', passwordPh: 'Enter password or code', forgot: 'Forgot password?', company: 'Organisation', optional: 'optional', companyPh: 'Company / TIN', submit: 'Sign in as', register: 'Register', choose: 'Select a workspace.', fill: 'Enter login and password / access code.', exit: 'Exit', lang: 'Language' },
  zh: { brand: '透明价格', subbrand: '进入交易闭环的统一入口', workplace: '工作区', login: '登录名', loginPh: '输入登录名', password: '密码 / 访问码', passwordPh: '输入密码或访问码', forgot: '忘记密码？', company: '组织', optional: '可选', companyPh: '公司 / 税号', submit: '以此身份登录：', register: '注册', choose: '请选择工作区。', fill: '请输入登录名和密码 / 访问码。', exit: '退出', lang: '语言' },
} as const;

function readLanguage(): Lang { const value = typeof window === 'undefined' ? null : window.localStorage.getItem(LANGUAGE_KEY); return value === 'en' || value === 'zh' ? value : 'ru'; }
function roleName(role: Workspace, lang: Lang) { return lang === 'en' ? role.en : lang === 'zh' ? role.zh : role.ru; }
function roleSub(role: Workspace, lang: Lang) { return lang === 'en' ? role.enSub : lang === 'zh' ? role.zhSub : role.ruSub; }
function isRole(value: string | null): value is PlatformRole { return workspaces.some((item) => item.role === value); }
function readEntryRole(): PlatformRole | null { const role = new URLSearchParams(window.location.search).get('role') ?? window.sessionStorage?.getItem(PENDING_ROLE_KEY); return isRole(role) ? role : null; }
function markEntrySeen() { const secure = globalThis.location?.protocol === 'https:' ? '; Secure' : ''; document.cookie = `${ENTRY_COOKIE}=true; Path=/; Max-Age=14400; SameSite=Lax${secure}`; }

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

  React.useEffect(() => { setLang(readLanguage()); }, []);
  React.useEffect(() => {
    const role = readEntryRole();
    if (!role) return;
    setRole(role);
    setEntryRole(role);
    window.sessionStorage?.setItem(PENDING_ROLE_KEY, role);
  }, [setRole]);

  function cycleLanguage() {
    const next: Lang = lang === 'ru' ? 'en' : lang === 'en' ? 'zh' : 'ru';
    window.localStorage.setItem(LANGUAGE_KEY, next);
    setLang(next);
  }

  async function openWorkspace(role: PlatformRole) {
    globalThis.sessionStorage?.setItem(PLATFORM_V7_ACTIVE_ROLE_KEY, role);
    globalThis.sessionStorage?.removeItem(PENDING_ROLE_KEY);
    markEntrySeen();
    setRole(role);
    try { await fetch('/api/platform-v7/cabinet-session', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ role, company: company.trim() || null }), keepalive: true }); } catch {}
    router.replace(platformV7RoleHome(role));
  }

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const role = entryRole ?? directRole;
    if (!role) return setError(copy[lang].choose);
    if (!login.trim() || !accessCode.trim()) return setError(copy[lang].fill);
    setError('');
    void openWorkspace(role);
  }

  const t = copy[lang];
  const selectedRole = entryRole ?? directRole;
  const selected = selectedRole ? workspaces.find((item) => item.role === selectedRole) ?? null : null;
  const registerHref = selectedRole ? `/platform-v7/register?role=${selectedRole}` : '/platform-v7/register';

  return (
    <main className='pc-v7-login-single' data-login-lang={lang} data-p7-no-translate='true'>
      <style>{css}</style>
      <header className='login-header' aria-label='Вход в платформу'>
        <Link className='login-brand' href='/platform-v7' aria-label={t.brand}>
          <span className='login-logo' aria-hidden='true'><BrandMark size={42} /></span>
          <span><b>{t.brand}</b><small>{t.subbrand}</small></span>
        </Link>
        <nav className='login-actions' aria-label='Действия входа'>
          <button className='login-header-button login-lang' type='button' onClick={cycleLanguage} aria-label={t.lang} title={t.lang}><Languages size={20} strokeWidth={2.25} /><span>{lang.toUpperCase()}</span></button>
          <Link className='login-header-button login-exit' href='/platform-v7' aria-label={t.exit} title={t.exit}><LogOut size={20} strokeWidth={2.25} /><span>{t.exit}</span></Link>
        </nav>
      </header>
      <section className='login-card'>
        <div className='login-work-title'><h1>{t.workplace}</h1>{selected ? <span>{roleName(selected, lang)}</span> : null}</div>
        <section className='login-grid' aria-label={t.workplace}>{workspaces.map((item) => { const Icon = item.Icon; const active = selectedRole === item.role; return <button key={item.role} type='button' className={active ? 'active' : ''} onClick={() => { setDirectRole(item.role); setError(''); }}><Icon size={24} strokeWidth={2.25} /><b>{roleName(item, lang)}</b><small>{roleSub(item, lang)}</small></button>; })}</section>
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

const css = `.pc-v7-login-single{min-height:100vh;padding:12px clamp(10px,2.2vw,34px) 22px;background:linear-gradient(180deg,#f8fbf7 0%,#eef6ed 58%,#fff 100%);color:#071611;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;overflow-x:hidden}.pc-v7-login-single *{box-sizing:border-box}.login-header{position:sticky!important;top:max(6px,env(safe-area-inset-top))!important;z-index:80!important;max-width:980px;margin:0 auto 14px;display:grid!important;grid-template-columns:minmax(0,1fr) auto!important;align-items:center!important;gap:10px!important;min-height:64px!important;padding:10px 12px!important;border-radius:24px;background:rgba(255,255,255,.94);border:1px solid rgba(7,22,17,.08);box-shadow:0 16px 38px rgba(7,22,17,.07);backdrop-filter:blur(18px);visibility:visible!important;opacity:1!important;transform:none!important}.login-brand{display:flex!important;align-items:center!important;gap:11px!important;color:#071611;text-decoration:none;min-width:0;overflow:hidden}.login-logo{width:42px!important;height:42px!important;min-width:42px!important;border-radius:14px;display:grid!important;place-items:center!important;overflow:visible}.login-brand b{display:block;font-size:22px;line-height:1;font-weight:950;letter-spacing:-.045em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.login-brand small{display:block;margin-top:4px;color:#5b6963;font-size:12.5px;font-weight:850;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.login-actions{display:inline-flex!important;align-items:center!important;justify-content:flex-end!important;gap:8px!important;min-width:max-content}.login-header-button{width:44px!important;min-width:44px!important;max-width:44px!important;height:44px!important;min-height:44px!important;max-height:44px!important;border-radius:15px!important;border:1px solid rgba(7,22,17,.10)!important;background:#fff;color:#071611;display:inline-flex!important;align-items:center!important;justify-content:center!important;gap:0!important;padding:0!important;text-decoration:none;font-size:0!important;font-weight:950;box-shadow:0 8px 20px rgba(7,22,17,.05);cursor:pointer;visibility:visible!important;opacity:1!important}.login-header-button span{display:none!important}.login-header-button svg{width:20px!important;height:20px!important;min-width:20px!important;max-width:20px!important}.login-lang{color:#087a3b!important;background:rgba(0,122,47,.07)!important;border-color:rgba(0,122,47,.18)!important}.login-exit{color:#071611!important;background:rgba(255,255,255,.92)!important;border-color:rgba(185,28,28,.18)!important}.login-card{max-width:980px;margin:0 auto;padding:28px;border-radius:34px;background:rgba(255,255,255,.9);border:1px solid rgba(7,22,17,.08);box-shadow:0 24px 70px rgba(7,22,17,.11)}.login-work-title{display:flex;align-items:end;justify-content:space-between;gap:12px;margin-bottom:18px}.login-work-title h1{margin:0;font-size:clamp(38px,6vw,72px);line-height:.95;letter-spacing:-.065em;font-weight:950}.login-work-title span{color:#087a3b;font-weight:950}.login-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin-bottom:20px}.login-grid button{min-height:132px;border-radius:24px;border:1px solid rgba(0,122,47,.16);background:rgba(255,255,255,.88);color:#087a3b;display:grid;place-items:center;gap:6px;padding:16px;cursor:pointer}.login-grid button.active{background:#087a3b;border-color:#087a3b;color:#fff}.login-grid button.active b,.login-grid button.active small{color:#fff}.login-grid b{color:#071611;font-size:23px;line-height:1.1;font-weight:950}.login-grid small{color:#5f6d67;font-size:14px;font-weight:850}.login-form{display:grid;gap:12px}.login-form label{display:grid;gap:7px}.login-form label span{font-size:13px;font-weight:900;color:#24322d}.login-form label em{font-style:normal;color:#7a8781;font-weight:750}.login-form input{height:52px;border-radius:17px;border:1px solid rgba(7,22,17,.1);background:#fff;padding:0 15px;font-size:15px;color:#071611}.forgot-link{width:max-content;display:inline-flex;align-items:center;gap:8px;color:#087a3b;text-decoration:none;font-weight:900}.submit-button,.register-button{min-height:54px;border-radius:18px;border:0;display:flex;align-items:center;justify-content:center;text-decoration:none;font-size:15px;font-weight:950}.submit-button{background:#087a3b;color:#fff}.register-button{background:rgba(0,122,47,.08);color:#087a3b}.login-error{margin:0;padding:12px 14px;border-radius:15px;background:rgba(156,47,47,.08);color:#8a1f1f;font-weight:850}.pc-v7-login-single[data-login-lang='zh']{font-family:-apple-system,BlinkMacSystemFont,'PingFang SC','Noto Sans SC','Microsoft YaHei','Segoe UI',sans-serif}.pc-v7-login-single[data-login-lang='zh'] *{letter-spacing:0!important;word-break:keep-all;overflow-wrap:anywhere}@media(max-width:720px){.pc-v7-login-single{padding:10px 12px 18px}.login-header{top:max(6px,env(safe-area-inset-top))!important;min-height:60px!important;padding:8px 10px!important;border-radius:20px!important;margin-bottom:12px!important}.login-logo{width:40px!important;height:40px!important;min-width:40px!important}.login-brand{gap:9px!important}.login-brand b{font-size:19px!important}.login-brand small{display:none!important}.login-actions{gap:7px!important}.login-header-button{width:42px!important;min-width:42px!important;max-width:42px!important;height:42px!important;min-height:42px!important;max-height:42px!important;border-radius:14px!important}.login-card{padding:20px;border-radius:28px}.login-work-title{display:grid;align-items:start}.login-work-title h1{font-size:42px;line-height:1}.login-grid{grid-template-columns:1fr;gap:10px}.login-grid button{min-height:104px;border-radius:22px}.login-grid b{font-size:22px}.pc-v7-login-single[data-login-lang='zh'] .login-work-title h1{font-size:38px}.pc-v7-login-single[data-login-lang='zh'] .login-grid b{font-size:24px}}@media(max-width:374px){.pc-v7-login-single{padding-inline:8px}.login-header{padding:7px 8px!important;border-radius:18px!important}.login-logo{width:36px!important;height:36px!important;min-width:36px!important}.login-brand b{font-size:17px!important}.login-header-button{width:38px!important;min-width:38px!important;max-width:38px!important;height:38px!important;min-height:38px!important;max-height:38px!important;border-radius:13px!important}.login-work-title h1{font-size:36px}}`;
