'use client';

import * as React from 'react';
import Link from 'next/link';
import { useLocale } from 'next-intl';
import { useRouter } from 'next/navigation';
import { ArrowLeft, CheckCircle2, Eye, EyeOff, LockKeyhole, Mail, ShieldCheck } from 'lucide-react';
import { PublicSiteHeader } from '@/components/platform-v7/PublicSiteHeader';
import { PLATFORM_V7_ACTIVE_ROLE_KEY, platformV7RoleHome } from '@/components/platform-v7/PlatformV7SingleEntryGuard';
import { usePlatformV7RStore, type PlatformRole } from '@/stores/usePlatformV7RStore';
import styles from './login.module.css';

type Lang = 'ru' | 'en' | 'zh';
const ENTRY_COOKIE = 'pc_v7_entry_seen';

const copy = {
  ru: {
    brandTagline: 'Единый вход в контур сделки',
    publicHeader: 'Вход в платформу',
    home: 'Прозрачная Цена — на главную',
    title: 'Войти',
    lead: 'Роль, организация и полномочия определяются системой после проверки учётной записи.',
    email: 'Рабочий email',
    password: 'Пароль',
    emailPlaceholder: 'name@company.ru',
    passwordPlaceholder: 'Введите пароль',
    submit: 'Войти',
    loading: 'Проверяем доступ…',
    forgot: 'Восстановить доступ',
    register: 'Создать учётную запись',
    back: 'Назад',
    showPassword: 'Показать пароль',
    hidePassword: 'Скрыть пароль',
    required: 'Укажи рабочий email и пароль.',
    unavailable: 'Не удалось войти. Проверь данные или восстанови доступ.',
    facts: ['Один аккаунт', 'Права только с сервера', 'Защищённая сессия'],
    note: 'После входа система откроет рабочее пространство, назначенное организации. Роль нельзя выбрать или изменить через URL.',
  },
  en: {
    brandTagline: 'Single entry to deal execution',
    publicHeader: 'Platform sign in',
    home: 'Transparent Price — home',
    title: 'Sign in',
    lead: 'The system resolves the role, organisation and permissions after the account is verified.',
    email: 'Work email',
    password: 'Password',
    emailPlaceholder: 'name@company.com',
    passwordPlaceholder: 'Enter password',
    submit: 'Sign in',
    loading: 'Verifying access…',
    forgot: 'Restore access',
    register: 'Create account',
    back: 'Back',
    showPassword: 'Show password',
    hidePassword: 'Hide password',
    required: 'Enter your work email and password.',
    unavailable: 'Sign-in failed. Check the details or restore access.',
    facts: ['One account', 'Server-side permissions', 'Protected session'],
    note: 'After sign-in, the system opens the workspace assigned to the organisation. A role cannot be selected or changed through the URL.',
  },
  zh: {
    brandTagline: '统一进入交易执行闭环',
    publicHeader: '登录平台',
    home: '透明价格 — 首页',
    title: '登录',
    lead: '系统在验证账户后确定角色、组织和权限。',
    email: '工作邮箱',
    password: '密码',
    emailPlaceholder: 'name@company.cn',
    passwordPlaceholder: '输入密码',
    submit: '登录',
    loading: '正在验证访问权限…',
    forgot: '恢复访问权限',
    register: '创建账户',
    back: '返回',
    showPassword: '显示密码',
    hidePassword: '隐藏密码',
    required: '请输入工作邮箱和密码。',
    unavailable: '无法登录。请检查信息或恢复访问权限。',
    facts: ['一个账户', '服务器权限控制', '受保护会话'],
    note: '登录后，系统会打开分配给该组织的工作空间。不能通过网址选择或更改角色。',
  },
} as const;

function normalizeLanguage(value: string): Lang {
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
  const lang = normalizeLanguage(useLocale());
  const setRole = usePlatformV7RStore((state) => state.setRole);
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [showPassword, setShowPassword] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState('');
  const errorRef = React.useRef<HTMLParagraphElement>(null);

  React.useEffect(() => {
    if (error) errorRef.current?.focus();
  }, [error]);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;

    const normalizedEmail = email.trim();
    if (!normalizedEmail || !password) {
      setError(copy[lang].required);
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: normalizedEmail, password }),
        cache: 'no-store',
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload?.ok) {
        throw new Error(copy[lang].unavailable);
      }

      const role = surfaceRole(payload?.user?.role ?? payload?.role);
      const sessionBody = payload?.demo === true ? { role } : {};
      const sessionResponse = await fetch('/api/platform-v7/cabinet-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sessionBody),
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
    } catch {
      setError(copy[lang].unavailable);
    } finally {
      setSubmitting(false);
    }
  }

  const t = copy[lang];
  const errorId = error ? 'pc-login-error' : undefined;

  return (
    <main className={styles.page}>
      <PublicSiteHeader
        ariaLabel={t.publicHeader}
        homeAriaLabel={t.home}
        tagline={t.brandTagline}
        actions={(
          <Link className='pc-site-action' href='/platform-v7' aria-label={t.back} title={t.back}>
            <ArrowLeft size={20} aria-hidden='true' />
            <span>{t.back}</span>
          </Link>
        )}
      />

      <section className={styles.layout} aria-labelledby='pc-login-title'>
        <aside className={styles.context} aria-label={t.brandTagline}>
          <span className={styles.eyebrow}><ShieldCheck size={17} aria-hidden='true' /> B2B Deal Execution</span>
          <h1 id='pc-login-title'>{t.title}</h1>
          <p>{t.lead}</p>
          <div className={styles.facts}>
            {t.facts.map((fact) => <span key={fact}><CheckCircle2 size={17} aria-hidden='true' />{fact}</span>)}
          </div>
        </aside>

        <form className={styles.card} onSubmit={onSubmit} noValidate aria-describedby={errorId}>
          <label>
            <span>{t.email}</span>
            <div className={styles.field}>
              <Mail size={19} aria-hidden='true' />
              <input
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                type='email'
                inputMode='email'
                autoComplete='username'
                autoCapitalize='none'
                spellCheck={false}
                placeholder={t.emailPlaceholder}
                disabled={submitting}
                aria-invalid={Boolean(error)}
                aria-describedby={errorId}
              />
            </div>
          </label>
          <label>
            <span>{t.password}</span>
            <div className={styles.field}>
              <LockKeyhole size={19} aria-hidden='true' />
              <input
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                type={showPassword ? 'text' : 'password'}
                autoComplete='current-password'
                placeholder={t.passwordPlaceholder}
                disabled={submitting}
                aria-invalid={Boolean(error)}
                aria-describedby={errorId}
              />
              <button
                type='button'
                onClick={() => setShowPassword((value) => !value)}
                aria-label={showPassword ? t.hidePassword : t.showPassword}
                title={showPassword ? t.hidePassword : t.showPassword}
              >
                {showPassword ? <EyeOff size={19} aria-hidden='true' /> : <Eye size={19} aria-hidden='true' />}
              </button>
            </div>
          </label>

          <div className={styles.links}>
            <Link href='/platform-v7/contact'>{t.forgot}</Link>
            <Link href='/platform-v7/register'>{t.register}</Link>
          </div>

          {error ? <p ref={errorRef} id='pc-login-error' className={styles.error} role='alert' aria-live='assertive' tabIndex={-1}>{error}</p> : null}
          <button className={styles.submit} type='submit' disabled={submitting} aria-busy={submitting}>
            {submitting ? t.loading : t.submit}
          </button>
          <p className={styles.note}>{t.note}</p>
        </form>
      </section>
    </main>
  );
}
