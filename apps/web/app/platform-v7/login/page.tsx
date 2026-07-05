'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Banknote,
  BriefcaseBusiness,
  Building2,
  ClipboardCheck,
  Crown,
  FlaskConical,
  Landmark,
  Mail,
  Scale,
  ShieldCheck,
  Truck,
  UserRound,
  Wheat,
  type LucideIcon,
} from 'lucide-react';
import { BRAND_LOGO_DATA_URI } from '@/components/v7r/brand-logo-asset';
import { PLATFORM_V7_ACTIVE_ROLE_KEY, platformV7RoleHome } from '@/components/platform-v7/PlatformV7SingleEntryGuard';
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
  ru: {
    brand: 'Прозрачная Цена',
    kicker: 'Единый вход',
    title: 'Вход в рабочую платформу',
    lead: 'Введите корпоративные данные для доступа к рабочему контуру.',
    chooseWorkspace: 'Выберите один рабочий кабинет',
    login: 'Логин',
    loginPh: 'Введите логин',
    password: 'Пароль / код доступа',
    passwordPh: 'Введите пароль или код',
    forgot: 'Забыли пароль?',
    company: 'Организация',
    optional: 'необязательно',
    companyPh: 'Компания / ИНН',
    submit: 'Войти как',
    register: 'Зарегистрироваться',
    choose: 'Выберите рабочий кабинет.',
    fill: 'Заполните логин и пароль / код доступа.',
    back: 'Вернуться на главную',
  },
  en: {
    brand: 'Transparent Price',
    kicker: 'Single entry',
    title: 'Sign in to the workspace',
    lead: 'Enter corporate access data to open the working circuit.',
    chooseWorkspace: 'Choose one workspace',
    login: 'Login',
    loginPh: 'Enter login',
    password: 'Password / access code',
    passwordPh: 'Enter password or code',
    forgot: 'Forgot password?',
    company: 'Organisation',
    optional: 'optional',
    companyPh: 'Company / TIN',
    submit: 'Sign in as',
    register: 'Register',
    choose: 'Select a workspace.',
    fill: 'Enter login and password / access code.',
    back: 'Back to home',
  },
  zh: {
    brand: '透明价格',
    kicker: '统一入口',
    title: '进入工作平台',
    lead: '请输入企业访问数据以进入工作闭环。',
    chooseWorkspace: '选择一个工作区',
    login: '登录名',
    loginPh: '输入登录名',
    password: '密码 / 访问码',
    passwordPh: '输入密码或访问码',
    forgot: '忘记密码？',
    company: '组织',
    optional: '可选',
    companyPh: '公司 / 税号',
    submit: '以此身份登录：',
    register: '注册',
    choose: '请选择工作区。',
    fill: '请输入登录名和密码 / 访问码。',
    back: '返回首页',
  },
} as const;

function readLanguage(): Lang {
  const value = typeof window === 'undefined' ? null : window.localStorage.getItem(LANGUAGE_KEY);
  return value === 'en' || value === 'zh' ? value : 'ru';
}

function roleName(role: Workspace, lang: Lang) { return lang === 'en' ? role.en : lang === 'zh' ? role.zh : role.ru; }
function roleSub(role: Workspace, lang: Lang) { return lang === 'en' ? role.enSub : lang === 'zh' ? role.zhSub : role.ruSub; }
function isRole(value: string | null): value is PlatformRole { return workspaces.some((item) => item.role === value); }
function readEntryRole(): PlatformRole | null {
  const role = new URLSearchParams(window.location.search).get('role') ?? window.sessionStorage?.getItem(PENDING_ROLE_KEY);
  return isRole(role) ? role : null;
}
function markEntrySeen() {
  const secure = globalThis.location?.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${ENTRY_COOKIE}=true; Path=/; Max-Age=14400; SameSite=Lax${secure}`;
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
    window.addEventListener('storage', update);
    return () => window.removeEventListener('storage', update);
  }, []);

  React.useEffect(() => {
    const role = readEntryRole();
    if (!role) return;
    setRole(role);
    setEntryRole(role);
    window.sessionStorage?.setItem(PENDING_ROLE_KEY, role);
  }, [setRole]);

  async function openWorkspace(role: PlatformRole) {
    globalThis.sessionStorage?.setItem(PLATFORM_V7_ACTIVE_ROLE_KEY, role);
    globalThis.sessionStorage?.removeItem(PENDING_ROLE_KEY);
    markEntrySeen();
    setRole(role);
    try {
      await fetch('/api/platform-v7/cabinet-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role, company: company.trim() || null }),
        keepalive: true,
      });
    } catch {}
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
    <main className="pc-login-page-v2" data-login-lang={lang} data-p7-no-translate="true">
      <style>{css}</style>
      <header className="pc-login-v2-header">
        <Link className="pc-login-v2-brand" href="/platform-v7" aria-label={t.back}>
          <span className="pc-login-v2-logo" aria-hidden="true"><img src={BRAND_LOGO_DATA_URI} alt="" draggable={false} /></span>
          <strong>{t.brand}</strong>
        </Link>
        <Link className="pc-login-v2-back" href="/platform-v7" aria-label={t.back} title={t.back}>
          <ArrowLeft size={24} strokeWidth={2.45} />
        </Link>
      </header>

      <section className="pc-login-v2-card">
        <span className="pc-login-v2-kicker">{t.kicker}</span>
        <h1>{t.title}</h1>
        <p className="pc-login-v2-lead">{t.lead}</p>

        <section className="pc-login-v2-workspaces" aria-label={t.chooseWorkspace}>
          <h2>{t.chooseWorkspace}</h2>
          <div className="pc-login-v2-grid">
            {workspaces.map((item) => {
              const Icon = item.Icon;
              const active = selectedRole === item.role;
              return (
                <button
                  key={item.role}
                  type="button"
                  className={active ? 'active' : ''}
                  onClick={() => { setDirectRole(item.role); setError(''); }}
                >
                  <Icon size={27} strokeWidth={2.25} />
                  <b>{roleName(item, lang)}</b>
                  <small>{roleSub(item, lang)}</small>
                </button>
              );
            })}
          </div>
        </section>

        <form className="pc-login-v2-form" onSubmit={onSubmit}>
          <label><span>{t.login}</span><input value={login} onChange={(event) => setLogin(event.target.value)} type="email" autoComplete="username" placeholder={t.loginPh} /></label>
          <label><span>{t.password}</span><input value={accessCode} onChange={(event) => setAccessCode(event.target.value)} type="password" autoComplete="current-password" placeholder={t.passwordPh} /></label>
          <Link className="pc-login-v2-forgot" href="/platform-v7/contact"><Mail size={18} />{t.forgot}</Link>
          <label><span>{t.company} <em>{t.optional}</em></span><input value={company} onChange={(event) => setCompany(event.target.value)} type="text" autoComplete="organization" placeholder={t.companyPh} /></label>
          {error ? <p className="pc-login-v2-error" role="alert">{error}</p> : null}
          <button className="pc-login-v2-submit" type="submit">{selected ? `${t.submit} ${roleName(selected, lang)}` : t.submit}</button>
          <Link href={registerHref} className="pc-login-v2-register">{t.register}</Link>
        </form>
      </section>
    </main>
  );
}

const css = `
.pc-login-page-v2{min-height:100svh;padding:96px 28px calc(170px + env(safe-area-inset-bottom,0px));background:linear-gradient(180deg,#fbfcf9 0%,#f2f7f0 58%,#fff 100%);color:#071611;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif}.pc-login-page-v2 *{box-sizing:border-box}.pc-login-v2-header{position:fixed;top:0;left:0;right:0;z-index:4000;height:72px;min-height:72px;padding:10px 28px;display:flex;align-items:center;justify-content:space-between;gap:12px;background:rgba(255,255,255,.985);border-bottom:1px solid rgba(7,22,17,.08);box-shadow:0 10px 24px rgba(7,22,17,.07);backdrop-filter:blur(18px)}.pc-login-v2-brand{display:inline-flex;align-items:center;gap:14px;min-width:0;color:#071611;text-decoration:none}.pc-login-v2-logo{display:inline-flex;align-items:center;justify-content:center;width:56px;height:56px;min-width:56px;border-radius:16px;background:rgba(0,122,47,.08);overflow:hidden}.pc-login-v2-logo img{display:block;width:32px;height:32px;object-fit:contain}.pc-login-v2-brand strong{display:block;font-size:20px;line-height:1.05;font-weight:950;letter-spacing:-.035em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.pc-login-v2-back{display:inline-flex;align-items:center;justify-content:center;width:54px;height:54px;min-width:54px;border-radius:23px;background:#fff;color:#071611;border:1px solid rgba(7,22,17,.12);box-shadow:0 8px 20px rgba(7,22,17,.06);text-decoration:none}.pc-login-v2-card{max-width:980px;margin:0 auto;padding:34px;border-radius:34px;background:rgba(255,255,255,.91);border:1px solid rgba(7,22,17,.08);box-shadow:0 24px 70px rgba(7,22,17,.11)}.pc-login-v2-kicker{display:inline-flex;align-items:center;min-height:34px;padding:0 15px;border-radius:999px;background:rgba(0,122,47,.09);color:#087a3b;font-size:13px;font-weight:950;text-transform:uppercase;letter-spacing:.12em}.pc-login-v2-card h1{max-width:760px;margin:24px 0 16px;font-size:clamp(48px,7vw,82px);line-height:.96;letter-spacing:-.067em;font-weight:950}.pc-login-v2-lead{max-width:760px;margin:0 0 24px;color:#4d5d56;font-size:23px;line-height:1.35;font-weight:720}.pc-login-v2-workspaces{padding:22px;border-radius:28px;background:rgba(255,255,255,.68);border:1px solid rgba(7,22,17,.08);box-shadow:0 12px 34px rgba(7,22,17,.045)}.pc-login-v2-workspaces h2{margin:0 0 16px;color:#3d4d47;font-size:22px;line-height:1.1;font-weight:950;letter-spacing:-.025em}.pc-login-v2-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}.pc-login-v2-grid button{min-height:126px;border-radius:24px;border:1px solid rgba(0,122,47,.16);background:rgba(255,255,255,.88);color:#087a3b;display:grid;place-items:center;gap:6px;padding:15px;cursor:pointer;box-shadow:0 10px 28px rgba(7,22,17,.035)}.pc-login-v2-grid button.active{background:rgba(0,122,47,.09);border-color:rgba(0,122,47,.40);box-shadow:0 14px 34px rgba(0,122,47,.08)}.pc-login-v2-grid b{color:#071611;font-size:21px;line-height:1.1;font-weight:950}.pc-login-v2-grid small{color:#5f6d67;font-size:13px;font-weight:820}.pc-login-v2-form{display:grid;gap:12px;margin-top:22px}.pc-login-v2-form label{display:grid;gap:7px}.pc-login-v2-form label span{font-size:13px;font-weight:900;color:#24322d}.pc-login-v2-form label em{font-style:normal;color:#7a8781;font-weight:750}.pc-login-v2-form input{height:54px;border-radius:17px;border:1px solid rgba(7,22,17,.1);background:#fff;padding:0 15px;font-size:16px;color:#071611}.pc-login-v2-forgot{width:max-content;display:inline-flex;align-items:center;gap:8px;color:#087a3b;text-decoration:none;font-size:14px;font-weight:900}.pc-login-v2-error{margin:0;padding:12px 14px;border-radius:16px;background:rgba(168,33,33,.08);border:1px solid rgba(168,33,33,.16);color:#8a1f1f;font-weight:850}.pc-login-v2-submit,.pc-login-v2-register{min-height:56px;border-radius:18px;display:inline-flex;align-items:center;justify-content:center;text-align:center;text-decoration:none;font-size:16px;font-weight:950}.pc-login-v2-submit{border:0;background:#087a3b;color:#fff;box-shadow:0 18px 42px rgba(0,122,47,.22)}.pc-login-v2-register{border:1px solid rgba(0,122,47,.16);background:rgba(0,122,47,.07);color:#087a3b}@media(max-width:720px){.pc-login-page-v2{padding:96px 28px calc(170px + env(safe-area-inset-bottom,0px))}.pc-login-v2-header{height:72px;min-height:72px;padding:10px 28px}.pc-login-v2-brand{max-width:calc(100vw - 176px)}.pc-login-v2-card{padding:34px;border-radius:34px}.pc-login-v2-card h1{font-size:clamp(50px,11vw,64px);line-height:.98}.pc-login-v2-lead{font-size:23px}.pc-login-v2-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.pc-login-v2-grid button{min-height:118px}.pc-login-v2-grid small{display:none}}@media(max-width:380px){.pc-login-page-v2{padding-left:16px;padding-right:16px}.pc-login-v2-header{padding:9px 16px}.pc-login-v2-brand{max-width:calc(100vw - 150px);gap:10px}.pc-login-v2-logo{width:48px;height:48px;min-width:48px}.pc-login-v2-back{width:48px;height:48px;min-width:48px}.pc-login-v2-card{padding:26px 20px}.pc-login-v2-card h1{font-size:44px}.pc-login-v2-lead{font-size:19px}.pc-login-v2-workspaces{padding:16px}.pc-login-v2-grid button{min-height:104px}.pc-login-v2-grid b{font-size:18px}}
`;
