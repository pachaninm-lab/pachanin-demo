'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, CheckCircle2, Eye, EyeOff, LockKeyhole, Mail, ShieldCheck, Wheat } from 'lucide-react';
import { PLATFORM_V7_ACTIVE_ROLE_KEY, platformV7RoleHome } from '@/components/platform-v7/PlatformV7SingleEntryGuard';
import { usePlatformV7RStore, type PlatformRole } from '@/stores/usePlatformV7RStore';

type Lang = 'ru' | 'en' | 'zh';
const ENTRY_COOKIE = 'pc_v7_entry_seen';
const LANGUAGE_KEY = 'pc-v7-language';

const copy = {
  ru: {
    brand: 'Прозрачная Цена',
    subbrand: 'Единый вход в контур сделки',
    title: 'Войти в систему',
    lead: 'Роль, организация и полномочия определяются сервером после проверки учётной записи.',
    email: 'Рабочий email',
    password: 'Пароль',
    emailPlaceholder: 'name@company.ru',
    passwordPlaceholder: 'Введите пароль',
    submit: 'Войти',
    loading: 'Проверяем доступ…',
    forgot: 'Восстановить доступ',
    register: 'Создать учётную запись',
    back: 'Назад',
    required: 'Введи email и пароль.',
    unavailable: 'Не удалось подтвердить доступ. Проверь данные или повтори позже.',
    facts: ['Один аккаунт', 'Права только с сервера', 'Защищённая сессия'],
  },
  en: {
    brand: 'Transparent Price',
    subbrand: 'Single entry to the deal execution circuit',
    title: 'Sign in',
    lead: 'Role, organisation and permissions are resolved by the server after account verification.',
    email: 'Work email',
    password: 'Password',
    emailPlaceholder: 'name@company.com',
    passwordPlaceholder: 'Enter password',
    submit: 'Sign in',
    loading: 'Verifying access…',
    forgot: 'Restore access',
    register: 'Create account',
    back: 'Back',
    required: 'Enter email and password.',
    unavailable: 'Access could not be verified. Check the credentials or try again later.',
    facts: ['One account', 'Server-side permissions', 'Protected session'],
  },
  zh: {
    brand: '透明价格',
    subbrand: '统一进入交易执行闭环',
    title: '登录系统',
    lead: '服务器在验证账户后确定角色、组织和权限。',
    email: '工作邮箱',
    password: '密码',
    emailPlaceholder: 'name@company.cn',
    passwordPlaceholder: '输入密码',
    submit: '登录',
    loading: '正在验证访问权限…',
    forgot: '恢复访问权限',
    register: '创建账户',
    back: '返回',
    required: '请输入邮箱和密码。',
    unavailable: '无法验证访问权限。请检查凭据或稍后重试。',
    facts: ['一个账户', '服务器权限控制', '受保护会话'],
  },
} as const;

function readLanguage(): Lang {
  if (typeof window === 'undefined') return 'ru';
  const value = window.localStorage.getItem(LANGUAGE_KEY);
  return value === 'en' || value === 'zh' ? value : 'ru';
}

function surfaceRole(role: string | undefined): PlatformRole {
  const normalized = String(role ?? '').toUpperCase();
  if (normalized === 'BUYER') return 'buyer';
  if (normalized === 'FARMER' || normalized === 'SELLER') return 'seller';
  if (normalized === 'LOGISTICIAN' || normalized === 'LOGISTICS') return 'logistics';
  if (normalized === 'DRIVER') return 'driver';
  if (normalized === 'ELEVATOR') return 'elevator';
  if (normalized === 'LAB') return 'lab';
  if (normalized === 'SURVEYOR') return 'surveyor';
  if (normalized === 'ACCOUNTING' || normalized === 'BANK') return 'bank';
  if (normalized === 'COMPLIANCE_OFFICER' || normalized === 'COMPLIANCE') return 'compliance';
  if (normalized === 'ARBITRATOR') return 'arbitrator';
  if (normalized === 'EXECUTIVE') return 'executive';
  return 'operator';
}

function markEntrySeen() {
  const secure = globalThis.location?.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${ENTRY_COOKIE}=true; Path=/; Max-Age=14400; SameSite=Lax${secure}`;
}

export default function LoginPage() {
  const router = useRouter();
  const setRole = usePlatformV7RStore((state) => state.setRole);
  const [lang, setLang] = React.useState<Lang>('ru');
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [showPassword, setShowPassword] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState('');

  React.useEffect(() => {
    const update = () => setLang(readLanguage());
    update();
    window.addEventListener('storage', update);
    return () => window.removeEventListener('storage', update);
  }, []);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!email.trim() || !password) {
      setError(copy[lang].required);
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password }),
        cache: 'no-store',
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.message || copy[lang].unavailable);
      }

      const role = surfaceRole(payload?.user?.role ?? payload?.role);
      const sessionResponse = await fetch('/api/platform-v7/cabinet-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
        cache: 'no-store',
      });
      if (!sessionResponse.ok) {
        throw new Error(copy[lang].unavailable);
      }

      markEntrySeen();
      globalThis.sessionStorage?.setItem(PLATFORM_V7_ACTIVE_ROLE_KEY, role);
      setRole(role);
      router.replace(platformV7RoleHome(role));
      router.refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : copy[lang].unavailable);
    } finally {
      setSubmitting(false);
    }
  }

  const t = copy[lang];

  return (
    <main className='pc-login'>
      <header className='pc-login-header'>
        <Link className='pc-login-brand' href='/platform-v7'>
          <span className='pc-login-logo' aria-hidden='true'><Wheat size={24} strokeWidth={2.35} /></span>
          <span><b>{t.brand}</b><small>{t.subbrand}</small></span>
        </Link>
        <Link className='pc-login-back' href='/platform-v7' aria-label={t.back}><ArrowLeft size={21} /></Link>
      </header>

      <section className='pc-login-layout'>
        <aside className='pc-login-context' aria-label={t.subbrand}>
          <span className='pc-login-eyebrow'><ShieldCheck size={17} /> B2B Deal Execution</span>
          <h1>{t.title}</h1>
          <p>{t.lead}</p>
          <div className='pc-login-facts'>
            {t.facts.map((fact) => <span key={fact}><CheckCircle2 size={17} />{fact}</span>)}
          </div>
        </aside>

        <form className='pc-login-card' onSubmit={onSubmit} noValidate>
          <label>
            <span>{t.email}</span>
            <div className='pc-login-field'><Mail size={19} /><input value={email} onChange={(event) => setEmail(event.target.value)} type='email' inputMode='email' autoComplete='username' placeholder={t.emailPlaceholder} disabled={submitting} /></div>
          </label>
          <label>
            <span>{t.password}</span>
            <div className='pc-login-field'><LockKeyhole size={19} /><input value={password} onChange={(event) => setPassword(event.target.value)} type={showPassword ? 'text' : 'password'} autoComplete='current-password' placeholder={t.passwordPlaceholder} disabled={submitting} /><button type='button' onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? 'Hide password' : 'Show password'}>{showPassword ? <EyeOff size={19} /> : <Eye size={19} />}</button></div>
          </label>

          <div className='pc-login-links'>
            <Link href='/platform-v7/contact'>{t.forgot}</Link>
            <Link href='/platform-v7/register'>{t.register}</Link>
          </div>

          {error ? <p className='pc-login-error' role='alert'>{error}</p> : null}
          <button className='pc-login-submit' type='submit' disabled={submitting}>{submitting ? t.loading : t.submit}</button>
          <p className='pc-login-note'>После входа система откроет рабочее место, назначенное твоей организации. Роль нельзя выбрать или изменить через URL.</p>
        </form>
      </section>

      <style jsx>{`
        .pc-login{min-height:100dvh;padding:clamp(14px,3vw,40px);background:radial-gradient(circle at 8% 0%,rgba(20,124,74,.12),transparent 34%),linear-gradient(180deg,#f7faf7 0%,#eef5ef 58%,#f8faf8 100%);color:#102019;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.pc-login *{box-sizing:border-box}.pc-login-header{max-width:1120px;margin:0 auto 22px;display:flex;align-items:center;justify-content:space-between;gap:12px}.pc-login-brand{display:flex;align-items:center;gap:12px;color:inherit;text-decoration:none;min-width:0}.pc-login-logo{width:46px;height:46px;display:grid;place-items:center;border-radius:15px;background:#e2f1e7;color:#087a3b;border:1px solid rgba(8,122,59,.13)}.pc-login-brand b{display:block;font-size:20px;line-height:1.05;letter-spacing:-.035em}.pc-login-brand small{display:block;margin-top:4px;color:#63726b;font-size:12px;font-weight:700}.pc-login-back{width:44px;height:44px;display:grid;place-items:center;border-radius:14px;background:rgba(255,255,255,.85);border:1px solid rgba(16,32,25,.1);color:#102019}.pc-login-layout{max-width:1120px;margin:0 auto;display:grid;grid-template-columns:minmax(0,1.08fr) minmax(360px,.92fr);gap:clamp(20px,4vw,62px);align-items:center;min-height:calc(100dvh - 140px)}.pc-login-context{padding:clamp(10px,4vw,42px)}.pc-login-eyebrow{display:inline-flex;align-items:center;gap:8px;color:#087a3b;font-size:13px;font-weight:900;letter-spacing:.04em;text-transform:uppercase}.pc-login-context h1{margin:18px 0 16px;font-size:clamp(46px,7vw,84px);line-height:.94;letter-spacing:-.07em;max-width:720px}.pc-login-context p{margin:0;max-width:650px;font-size:clamp(17px,2vw,22px);line-height:1.48;color:#54645c;font-weight:620}.pc-login-facts{display:flex;flex-wrap:wrap;gap:10px;margin-top:30px}.pc-login-facts span{display:inline-flex;align-items:center;gap:8px;padding:10px 13px;border-radius:999px;background:rgba(255,255,255,.78);border:1px solid rgba(8,122,59,.13);color:#244038;font-size:13px;font-weight:800}.pc-login-facts svg{color:#087a3b}.pc-login-card{display:grid;gap:17px;padding:clamp(22px,4vw,38px);border-radius:30px;background:rgba(255,255,255,.94);border:1px solid rgba(16,32,25,.1);box-shadow:0 28px 80px rgba(27,66,45,.13)}.pc-login-card label{display:grid;gap:8px}.pc-login-card label>span{font-size:13px;font-weight:900;color:#31423a}.pc-login-field{height:56px;display:flex;align-items:center;gap:10px;padding:0 15px;border-radius:17px;background:#f9fbf9;border:1px solid rgba(16,32,25,.12);transition:border-color .15s,box-shadow .15s}.pc-login-field:focus-within{border-color:rgba(8,122,59,.58);box-shadow:0 0 0 4px rgba(8,122,59,.1)}.pc-login-field>svg{color:#708078;flex:0 0 auto}.pc-login-field input{width:100%;height:100%;border:0;outline:0;background:transparent;color:#102019;font:inherit;font-size:16px}.pc-login-field button{width:38px;height:38px;border:0;background:transparent;color:#607068;display:grid;place-items:center;cursor:pointer}.pc-login-links{display:flex;align-items:center;justify-content:space-between;gap:14px;flex-wrap:wrap}.pc-login-links a{color:#087a3b;text-decoration:none;font-size:13px;font-weight:850}.pc-login-error{margin:0;padding:12px 14px;border-radius:14px;background:#fff1f1;border:1px solid #f2c5c5;color:#9b2525;font-size:13px;font-weight:800}.pc-login-submit{height:56px;border:0;border-radius:17px;background:#087a3b;color:#fff;font-size:16px;font-weight:950;cursor:pointer;box-shadow:0 14px 32px rgba(8,122,59,.24)}.pc-login-submit:disabled{opacity:.62;cursor:wait}.pc-login-note{margin:0;text-align:center;color:#718078;font-size:12px;line-height:1.45;font-weight:650}@media(max-width:820px){.pc-login{padding:calc(env(safe-area-inset-top) + 12px) 14px calc(env(safe-area-inset-bottom) + 22px)}.pc-login-layout{grid-template-columns:1fr;gap:16px;align-items:start}.pc-login-context{padding:18px 4px 4px}.pc-login-context h1{font-size:clamp(42px,13vw,66px)}.pc-login-context p{font-size:16px}.pc-login-facts{margin-top:20px}.pc-login-card{border-radius:24px;padding:22px}.pc-login-brand small{display:none}}@media(max-width:420px){.pc-login-facts{display:grid;grid-template-columns:1fr}.pc-login-facts span{border-radius:14px}.pc-login-links{align-items:flex-start;flex-direction:column}.pc-login-card{padding:19px}.pc-login-field,.pc-login-submit{height:54px}}
      `}</style>
    </main>
  );
}
