'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Check,
  Copy,
  Download,
  Eye,
  EyeOff,
  LoaderCircle,
  LockKeyhole,
  ShieldCheck,
} from 'lucide-react';
import { GEKTA_PATHS, type GektaLocale } from '@/lib/gekta/content';

type Mode = 'register' | 'login';
type Phase = 'form' | 'verifying-email' | 'email-sent' | 'mfa' | 'backup-codes';
type ApiPayload = {
  ok?: boolean;
  accepted?: boolean;
  code?: string;
  enrollmentRequired?: boolean;
  expiresAt?: string;
  setupSecret?: string;
  otpAuthUri?: string;
  backupCodes?: string[];
  redirectTo?: string;
};

const COPY = {
  ru: {
    back: 'Вернуться в Гекту',
    eyebrow: 'Личный аккаунт Гекты',
    title: 'Продолжай работу без потери истории',
    lead: 'Создай личный аккаунт, подтверди email и включи двухфакторную защиту. Организация, ИНН и роль в «Прозрачной Цене» не требуются.',
    registerTab: 'Регистрация',
    loginTab: 'Вход',
    fullName: 'Имя и фамилия',
    phone: 'Телефон',
    phoneHint: 'Номер сохраняется как заявленный. SMS-подтверждение сейчас не выполняется.',
    email: 'Email',
    password: 'Пароль',
    passwordHint: '12–128 символов, минимум три группы: строчные, прописные, цифры, спецсимволы.',
    showPassword: 'Показать пароль',
    hidePassword: 'Скрыть пароль',
    termsPrefix: 'Я принимаю',
    terms: 'условия использования Гекты',
    privacyPrefix: 'Я даю отдельное согласие на обработку персональных данных по',
    privacy: 'политике конфиденциальности',
    create: 'Создать аккаунт',
    signIn: 'Войти',
    working: 'Проверяю…',
    emailSentTitle: 'Проверь почту',
    emailSentBody: 'Если адрес можно зарегистрировать, письмо с одноразовой ссылкой уже отправлено. Ссылка действует 30 минут.',
    emailSentNote: 'Письма нет? Проверь папку «Спам» и правильность адреса. Повторный запрос ограничен для защиты от злоупотреблений.',
    resend: 'Отправить письмо ещё раз',
    resent: 'Повторный запрос принят',
    toLogin: 'Перейти ко входу',
    verifying: 'Подтверждаю email…',
    mfaTitle: 'Защити аккаунт',
    mfaSetup: 'Добавь ключ в приложение-аутентификатор, затем введи шестизначный код. Секрет показывается только на этом шаге.',
    mfaReturn: 'Введи код из приложения-аутентификатора или один из сохранённых резервных кодов.',
    setupKey: 'Ключ настройки',
    openAuthenticator: 'Открыть в приложении-аутентификаторе',
    copyKey: 'Копировать ключ',
    copied: 'Скопировано',
    mfaCode: 'Код подтверждения',
    mfaPlaceholder: '123456 или XXXX-XXXX-XXXX',
    verify: 'Подтвердить и войти',
    expired: 'Начать вход заново',
    backupTitle: 'Сохрани резервные коды',
    backupBody: 'Каждый код работает один раз. Они больше не будут показаны: сохрани их отдельно от пароля и устройства с аутентификатором.',
    copyCodes: 'Копировать коды',
    downloadCodes: 'Скачать .txt',
    saved: 'Я сохранил(а) резервные коды в безопасном месте',
    continue: 'Продолжить в Гекту',
    securityTitle: 'Что защищено',
    securityItems: [
      'Пароль хешируется и не возвращается в интерфейс.',
      'Email-ссылка одноразовая и удаляется из адресной строки до подтверждения.',
      'Токены сессии хранятся в httpOnly cookie, а MFA обязательна.',
    ],
    invalid: 'Проверь заполнение полей и повтори попытку.',
    invalidCredentials: 'Email или пароль неверны.',
    invalidMfa: 'Код неверен или уже использован. Проверь время на устройстве и попробуй снова.',
    invalidLink: 'Ссылка подтверждения недействительна или уже использована. Начни регистрацию заново.',
    rateLimited: 'Слишком много попыток. Подожди немного и повтори.',
    unavailable: 'Сервис временно недоступен. Данные не потеряны — повтори попытку позже.',
  },
  en: {
    back: 'Back to Gekta', eyebrow: 'Personal Gekta account', title: 'Keep working without losing your history',
    lead: 'Create a personal account, confirm your email and enable two-factor protection. No organisation, tax ID or Transparent Price role is required.',
    registerTab: 'Register', loginTab: 'Sign in', fullName: 'Full name', phone: 'Phone',
    phoneHint: 'The number is stored as declared. SMS verification is not performed at this stage.', email: 'Email', password: 'Password',
    passwordHint: '12–128 characters and at least three groups: lowercase, uppercase, digits, symbols.', showPassword: 'Show password', hidePassword: 'Hide password',
    termsPrefix: 'I accept the', terms: 'Gekta terms of use', privacyPrefix: 'I separately consent to personal-data processing under the', privacy: 'privacy policy',
    create: 'Create account', signIn: 'Sign in', working: 'Checking…', emailSentTitle: 'Check your email',
    emailSentBody: 'If the address can be registered, an email with a single-use link has been sent. The link is valid for 30 minutes.',
    emailSentNote: 'No email? Check spam and the address. Repeated requests are limited to prevent abuse.', resend: 'Send the email again', resent: 'Repeat request accepted', toLogin: 'Go to sign in',
    verifying: 'Confirming email…', mfaTitle: 'Protect your account',
    mfaSetup: 'Add the key to an authenticator app, then enter its six-digit code. The secret is shown only at this step.',
    mfaReturn: 'Enter the code from your authenticator app or one of your saved recovery codes.', setupKey: 'Setup key',
    openAuthenticator: 'Open in authenticator app', copyKey: 'Copy key', copied: 'Copied', mfaCode: 'Verification code',
    mfaPlaceholder: '123456 or XXXX-XXXX-XXXX', verify: 'Verify and sign in', expired: 'Start sign in again',
    backupTitle: 'Save your recovery codes', backupBody: 'Each code works once. They will not be shown again; keep them away from your password and authenticator device.',
    copyCodes: 'Copy codes', downloadCodes: 'Download .txt', saved: 'I have saved the recovery codes somewhere safe', continue: 'Continue to Gekta',
    securityTitle: 'What is protected', securityItems: ['The password is hashed and never returned to the interface.', 'The email link is single-use and removed from the address before confirmation.', 'Session tokens stay in httpOnly cookies and MFA is mandatory.'],
    invalid: 'Check the fields and try again.', invalidCredentials: 'The email or password is incorrect.', invalidMfa: 'The code is invalid or already used. Check your device time and try again.',
    invalidLink: 'The confirmation link is invalid or already used. Start registration again.', rateLimited: 'Too many attempts. Wait a little and try again.', unavailable: 'The service is temporarily unavailable. Try again later.',
  },
  zh: {
    back: '返回 Gekta', eyebrow: 'Gekta 个人账户', title: '继续工作，不丢失历史记录',
    lead: '创建个人账户、确认邮箱并启用双重验证。无需组织、税号或“透明价格”角色。', registerTab: '注册', loginTab: '登录', fullName: '姓名', phone: '电话',
    phoneHint: '号码仅作为声明信息保存，目前不进行短信验证。', email: '邮箱', password: '密码', passwordHint: '12–128 个字符，且至少包含小写、大写、数字、符号中的三类。',
    showPassword: '显示密码', hidePassword: '隐藏密码', termsPrefix: '我接受', terms: 'Gekta 使用条款', privacyPrefix: '我另行同意根据', privacy: '隐私政策',
    create: '创建账户', signIn: '登录', working: '正在检查…', emailSentTitle: '请检查邮箱', emailSentBody: '如果该地址可以注册，一次性链接已经发送。链接有效期为 30 分钟。',
    emailSentNote: '没有收到？请检查垃圾邮件和邮箱地址。为防滥用，重复请求会受限。', resend: '重新发送邮件', resent: '重复请求已接受', toLogin: '前往登录', verifying: '正在确认邮箱…', mfaTitle: '保护账户',
    mfaSetup: '将密钥添加到身份验证器应用，然后输入六位代码。密钥只在此步骤显示。', mfaReturn: '输入身份验证器中的代码或已保存的恢复代码。', setupKey: '设置密钥',
    openAuthenticator: '在身份验证器中打开', copyKey: '复制密钥', copied: '已复制', mfaCode: '验证码', mfaPlaceholder: '123456 或 XXXX-XXXX-XXXX', verify: '确认并登录',
    expired: '重新开始登录', backupTitle: '保存恢复代码', backupBody: '每个代码只能使用一次，之后不会再次显示。请与密码和身份验证设备分开保存。', copyCodes: '复制代码',
    downloadCodes: '下载 .txt', saved: '我已将恢复代码保存在安全位置', continue: '继续使用 Gekta', securityTitle: '保护内容',
    securityItems: ['密码会被哈希处理，不会返回界面。', '邮箱链接仅能使用一次，并在确认前从地址中移除。', '会话令牌保存在 httpOnly Cookie 中，并强制使用 MFA。'],
    invalid: '请检查各字段后重试。', invalidCredentials: '邮箱或密码不正确。', invalidMfa: '代码无效或已使用。请检查设备时间后重试。', invalidLink: '确认链接无效或已使用，请重新注册。',
    rateLimited: '尝试次数过多，请稍后重试。', unavailable: '服务暂时不可用，请稍后重试。',
  },
} as const;

function csrfToken() {
  const row = document.cookie.split('; ').find((item) => item.startsWith('pc_csrf_token='));
  return row ? decodeURIComponent(row.slice(row.indexOf('=') + 1)) : '';
}

async function authRequest(path: string, body: Record<string, unknown>): Promise<{ response: Response; payload: ApiPayload }> {
  const response = await fetch(`/api/gekta/auth/${path}`, {
    method: 'POST',
    credentials: 'same-origin',
    cache: 'no-store',
    headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken() },
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => ({})) as ApiPayload;
  return { response, payload };
}

function localeQuery(locale: GektaLocale, mode?: Mode) {
  const query = new URLSearchParams();
  if (locale !== 'ru') query.set('lang', locale);
  if (mode === 'login') query.set('mode', 'login');
  const value = query.toString();
  return value ? `?${value}` : '';
}

function nextLocale(locale: GektaLocale): GektaLocale {
  return locale === 'ru' ? 'en' : locale === 'en' ? 'zh' : 'ru';
}

export function GektaRegistrationClient({ locale, initialMode, confirmEmail, invalidEmailLink }: {
  locale: GektaLocale;
  initialMode: Mode;
  confirmEmail: boolean;
  invalidEmailLink: boolean;
}) {
  const ui = COPY[locale];
  const [mode, setMode] = React.useState<Mode>(initialMode);
  const [phase, setPhase] = React.useState<Phase>(confirmEmail ? 'verifying-email' : 'form');
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState(invalidEmailLink ? ui.invalidLink : '');
  const [passwordVisible, setPasswordVisible] = React.useState(false);
  const [mfa, setMfa] = React.useState<{ enrollmentRequired: boolean; setupSecret: string; otpAuthUri: string }>({ enrollmentRequired: false, setupSecret: '', otpAuthUri: '' });
  const [backupCodes, setBackupCodes] = React.useState<string[]>([]);
  const [codesSaved, setCodesSaved] = React.useState(false);
  const [copied, setCopied] = React.useState<'key' | 'codes' | ''>('');
  const [registrationEmail, setRegistrationEmail] = React.useState('');
  const [resendDone, setResendDone] = React.useState(false);
  const emailVerificationStarted = React.useRef(false);

  const errorFor = React.useCallback((code: string | undefined) => {
    if (code === 'INVALID_CREDENTIALS') return ui.invalidCredentials;
    if (code === 'MFA_CODE_INVALID' || code === 'MFA_CHALLENGE_EXPIRED') return ui.invalidMfa;
    if (code === 'EMAIL_LINK_INVALID') return ui.invalidLink;
    if (code === 'RATE_LIMITED') return ui.rateLimited;
    if (code?.includes('UNAVAILABLE') || code === 'AUTH_SERVICE_INVALID_RESPONSE') return ui.unavailable;
    return ui.invalid;
  }, [ui]);

  const beginMfa = React.useCallback((payload: ApiPayload) => {
    setMfa({
      enrollmentRequired: payload.enrollmentRequired === true,
      setupSecret: String(payload.setupSecret || ''),
      otpAuthUri: String(payload.otpAuthUri || ''),
    });
    setPhase('mfa');
    setError('');
  }, []);

  React.useEffect(() => {
    if (!confirmEmail || emailVerificationStarted.current) return;
    emailVerificationStarted.current = true;
    setPending(true);
    void authRequest('email/verify', {}).then(({ response, payload }) => {
      if (!response.ok || !payload.ok) {
        setError(errorFor(payload.code));
        setPhase('form');
        return;
      }
      beginMfa(payload);
    }).catch(() => {
      setError(ui.unavailable);
      setPhase('form');
    }).finally(() => setPending(false));
  }, [beginMfa, confirmEmail, errorFor, ui.unavailable]);

  const switchMode = (next: Mode) => {
    setMode(next);
    setPhase('form');
    setError('');
    setRegistrationEmail('');
    setResendDone(false);
    window.history.replaceState(null, '', `/gekta/register${localeQuery(locale, next)}`);
  };

  const register = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPending(true);
    setError('');
    const data = new FormData(event.currentTarget);
    try {
      const { response, payload } = await authRequest('register', {
        fullName: data.get('fullName'),
        phone: data.get('phone'),
        email: data.get('email'),
        password: data.get('password'),
        acceptedServiceTerms: data.get('acceptedServiceTerms') === 'on',
        acceptedPersonalData: data.get('acceptedPersonalData') === 'on',
        locale,
      });
      if (!response.ok || !payload.accepted) setError(errorFor(payload.code));
      else {
        setRegistrationEmail(String(data.get('email') || '').trim().toLowerCase());
        setResendDone(false);
        setPhase('email-sent');
      }
    } catch {
      setError(ui.unavailable);
    } finally {
      setPending(false);
    }
  };

  const resendEmail = async () => {
    if (!registrationEmail || pending || resendDone) return;
    setPending(true);
    setError('');
    try {
      const { response, payload } = await authRequest('register/email/resend', {
        email: registrationEmail,
        locale,
      });
      if (!response.ok || !payload.accepted) setError(errorFor(payload.code));
      else setResendDone(true);
    } catch {
      setError(ui.unavailable);
    } finally {
      setPending(false);
    }
  };

  const login = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPending(true);
    setError('');
    const data = new FormData(event.currentTarget);
    try {
      const { response, payload } = await authRequest('login', {
        email: data.get('email'),
        password: data.get('password'),
      });
      if (!response.ok || !payload.ok) setError(errorFor(payload.code));
      else beginMfa(payload);
    } catch {
      setError(ui.unavailable);
    } finally {
      setPending(false);
    }
  };

  const verifyMfa = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPending(true);
    setError('');
    const data = new FormData(event.currentTarget);
    try {
      const { response, payload } = await authRequest('mfa/verify', { code: data.get('code') });
      if (!response.ok || !payload.ok) {
        setError(errorFor(payload.code));
        return;
      }
      const codes = Array.isArray(payload.backupCodes) ? payload.backupCodes : [];
      if (codes.length) {
        setBackupCodes(codes);
        setPhase('backup-codes');
      } else {
        window.location.assign(payload.redirectTo || '/gekta?chat=new');
      }
    } catch {
      setError(ui.unavailable);
    } finally {
      setPending(false);
    }
  };

  const copyText = async (value: string, kind: 'key' | 'codes') => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(kind);
      window.setTimeout(() => setCopied(''), 1_500);
    } catch {
      setCopied('');
    }
  };

  const downloadCodes = () => {
    const blob = new Blob([`Gekta recovery codes\n\n${backupCodes.join('\n')}\n`], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'gekta-recovery-codes.txt';
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const inputClass = 'mt-1 min-h-12 w-full rounded-xl border border-slate-300 bg-white px-4 text-base text-slate-950 outline-none transition focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/15';
  const primaryClass = 'inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-emerald-800 px-5 text-base font-semibold text-white transition hover:bg-emerald-900 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700';
  const secondaryClass = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700';

  return (
    <main className='min-h-screen overflow-x-clip bg-[#f6f5ef] px-3 py-4 text-slate-950 sm:px-6 sm:py-8' data-gekta-registration='true'>
      <div className='mx-auto w-full max-w-6xl'>
        <div className='flex min-h-11 items-center justify-between gap-3'>
          <Link href={GEKTA_PATHS[locale]} className='inline-flex min-h-11 items-center gap-2 rounded-xl px-2 text-sm font-semibold text-slate-700 hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700'>
            <ArrowLeft className='h-4 w-4' aria-hidden='true' />{ui.back}
          </Link>
          <Link href={`/gekta/register${localeQuery(nextLocale(locale), mode)}`} className='inline-flex min-h-11 items-center rounded-xl px-3 text-sm font-semibold text-slate-700 hover:bg-white' aria-label='Change language'>
            {nextLocale(locale).toUpperCase()}
          </Link>
        </div>

        <div className='mt-4 grid overflow-hidden rounded-[28px] border border-emerald-950/10 bg-white shadow-[0_24px_80px_rgba(15,23,42,0.08)] lg:grid-cols-[0.9fr_1.1fr]'>
          <aside className='bg-emerald-950 p-6 text-white sm:p-10 lg:p-12'>
            <div className='grid h-12 w-12 place-items-center rounded-2xl bg-emerald-700 text-xl font-black' aria-hidden='true'>G</div>
            <p className='mt-8 text-xs font-bold uppercase tracking-[0.18em] text-emerald-200'>{ui.eyebrow}</p>
            <h1 className='mt-3 max-w-md text-3xl font-semibold leading-tight sm:text-4xl'>{ui.title}</h1>
            <p className='mt-5 max-w-lg text-sm leading-7 text-emerald-50/80'>{ui.lead}</p>
            <div className='mt-8 rounded-2xl border border-white/15 bg-white/5 p-5'>
              <div className='flex items-center gap-2 text-sm font-semibold'><ShieldCheck className='h-5 w-5 text-emerald-300' aria-hidden='true' />{ui.securityTitle}</div>
              <ul className='mt-3 space-y-3 text-sm leading-6 text-emerald-50/75'>
                {ui.securityItems.map((item) => <li key={item} className='flex gap-2'><Check className='mt-1 h-4 w-4 shrink-0 text-emerald-300' aria-hidden='true' /><span>{item}</span></li>)}
              </ul>
            </div>
          </aside>

          <section className='p-5 sm:p-10 lg:p-12' aria-live='polite'>
            {phase === 'form' ? (
              <>
                <div className='grid grid-cols-2 rounded-xl bg-slate-100 p-1' role='tablist' aria-label={`${ui.registerTab} / ${ui.loginTab}`}>
                  {(['register', 'login'] as const).map((value) => (
                    <button key={value} type='button' role='tab' aria-selected={mode === value} onClick={() => switchMode(value)} className={`min-h-11 rounded-lg px-3 text-sm font-semibold ${mode === value ? 'bg-white text-emerald-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}>
                      {value === 'register' ? ui.registerTab : ui.loginTab}
                    </button>
                  ))}
                </div>

                {mode === 'register' ? (
                  <form className='mt-7 space-y-5' onSubmit={register} noValidate={false}>
                    <label className='block text-sm font-medium text-slate-800'>{ui.fullName}<input className={inputClass} name='fullName' autoComplete='name' required minLength={2} maxLength={120} /></label>
                    <label className='block text-sm font-medium text-slate-800'>{ui.phone}<input className={inputClass} name='phone' type='tel' inputMode='tel' autoComplete='tel' required maxLength={32} placeholder='+7 900 000-00-00' /><span className='mt-1 block text-xs leading-5 text-slate-500'>{ui.phoneHint}</span></label>
                    <label className='block text-sm font-medium text-slate-800'>{ui.email}<input className={inputClass} name='email' type='email' inputMode='email' autoComplete='email' required maxLength={254} /></label>
                    <PasswordField inputClass={inputClass} visible={passwordVisible} onVisible={setPasswordVisible} labels={{ password: ui.password, show: ui.showPassword, hide: ui.hidePassword, hint: ui.passwordHint }} autoComplete='new-password' />
                    <Consent name='acceptedServiceTerms' prefix={ui.termsPrefix} linkLabel={ui.terms} href='/legal/usloviya-ispolzovaniya-gekta' />
                    <Consent name='acceptedPersonalData' prefix={ui.privacyPrefix} linkLabel={ui.privacy} href='/legal/politika-konfidencialnosti' />
                    {error ? <p className='rounded-xl bg-rose-50 px-4 py-3 text-sm leading-6 text-rose-800' role='alert'>{error}</p> : null}
                    <button className={primaryClass} type='submit' disabled={pending}>{pending ? <><LoaderCircle className='h-5 w-5 animate-spin' aria-hidden='true' />{ui.working}</> : ui.create}</button>
                  </form>
                ) : (
                  <form className='mt-7 space-y-5' onSubmit={login}>
                    <label className='block text-sm font-medium text-slate-800'>{ui.email}<input className={inputClass} name='email' type='email' inputMode='email' autoComplete='email' required maxLength={254} /></label>
                    <PasswordField inputClass={inputClass} visible={passwordVisible} onVisible={setPasswordVisible} labels={{ password: ui.password, show: ui.showPassword, hide: ui.hidePassword, hint: '' }} autoComplete='current-password' />
                    {error ? <p className='rounded-xl bg-rose-50 px-4 py-3 text-sm leading-6 text-rose-800' role='alert'>{error}</p> : null}
                    <button className={primaryClass} type='submit' disabled={pending}>{pending ? <><LoaderCircle className='h-5 w-5 animate-spin' aria-hidden='true' />{ui.working}</> : ui.signIn}</button>
                  </form>
                )}
              </>
            ) : null}

            {phase === 'verifying-email' ? <Status icon={<LoaderCircle className='h-7 w-7 animate-spin' />} title={ui.verifying} body={ui.emailSentNote} /> : null}
            {phase === 'email-sent' ? (
              <Status icon={<Check className='h-7 w-7' />} title={ui.emailSentTitle} body={ui.emailSentBody} note={ui.emailSentNote}>
                {error ? <p className='mb-4 rounded-xl bg-rose-50 px-4 py-3 text-sm leading-6 text-rose-800' role='alert'>{error}</p> : null}
                <div className='flex flex-wrap gap-2'>
                  <button type='button' className={secondaryClass} disabled={pending || resendDone || !registrationEmail} onClick={() => void resendEmail()}>
                    {pending ? <LoaderCircle className='h-4 w-4 animate-spin' aria-hidden='true' /> : null}
                    {resendDone ? ui.resent : ui.resend}
                  </button>
                  <button type='button' className={secondaryClass} onClick={() => switchMode('login')}>{ui.toLogin}</button>
                </div>
              </Status>
            ) : null}

            {phase === 'mfa' ? (
              <form className='space-y-5' onSubmit={verifyMfa}>
                <Status icon={<LockKeyhole className='h-7 w-7' />} title={ui.mfaTitle} body={mfa.enrollmentRequired ? ui.mfaSetup : ui.mfaReturn} />
                {mfa.enrollmentRequired ? (
                  <div className='rounded-2xl border border-emerald-900/15 bg-emerald-50 p-4'>
                    <p className='text-xs font-semibold uppercase tracking-wide text-emerald-900'>{ui.setupKey}</p>
                    <code className='mt-2 block break-all rounded-lg bg-white p-3 text-sm text-slate-900'>{mfa.setupSecret}</code>
                    <div className='mt-3 flex flex-wrap gap-2'>
                      <button type='button' className={secondaryClass} onClick={() => void copyText(mfa.setupSecret, 'key')}><Copy className='h-4 w-4' aria-hidden='true' />{copied === 'key' ? ui.copied : ui.copyKey}</button>
                      {mfa.otpAuthUri ? <a className={secondaryClass} href={mfa.otpAuthUri}>{ui.openAuthenticator}</a> : null}
                    </div>
                  </div>
                ) : null}
                <label className='block text-sm font-medium text-slate-800'>{ui.mfaCode}<input className={`${inputClass} font-mono tracking-[0.12em]`} name='code' autoComplete='one-time-code' inputMode='text' required maxLength={20} placeholder={ui.mfaPlaceholder} /></label>
                {error ? <p className='rounded-xl bg-rose-50 px-4 py-3 text-sm leading-6 text-rose-800' role='alert'>{error}</p> : null}
                <button className={primaryClass} type='submit' disabled={pending}>{pending ? <><LoaderCircle className='h-5 w-5 animate-spin' aria-hidden='true' />{ui.working}</> : ui.verify}</button>
                <button type='button' className='min-h-11 w-full rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-50' onClick={() => switchMode('login')}>{ui.expired}</button>
              </form>
            ) : null}

            {phase === 'backup-codes' ? (
              <div className='space-y-5'>
                <Status icon={<ShieldCheck className='h-7 w-7' />} title={ui.backupTitle} body={ui.backupBody} />
                <div className='grid grid-cols-1 gap-2 rounded-2xl border border-amber-300 bg-amber-50 p-4 font-mono text-sm sm:grid-cols-2'>
                  {backupCodes.map((code) => <code key={code} className='rounded-lg bg-white px-3 py-2 text-center text-slate-900'>{code}</code>)}
                </div>
                <div className='flex flex-wrap gap-2'>
                  <button type='button' className={secondaryClass} onClick={() => void copyText(backupCodes.join('\n'), 'codes')}><Copy className='h-4 w-4' aria-hidden='true' />{copied === 'codes' ? ui.copied : ui.copyCodes}</button>
                  <button type='button' className={secondaryClass} onClick={downloadCodes}><Download className='h-4 w-4' aria-hidden='true' />{ui.downloadCodes}</button>
                </div>
                <label className='flex min-h-11 items-start gap-3 rounded-xl border border-slate-200 p-3 text-sm leading-6 text-slate-700'><input type='checkbox' className='mt-1 h-5 w-5 shrink-0 accent-emerald-800' checked={codesSaved} onChange={(event) => setCodesSaved(event.target.checked)} /><span>{ui.saved}</span></label>
                <button type='button' className={primaryClass} disabled={!codesSaved} onClick={() => window.location.assign('/gekta?chat=new')}>{ui.continue}</button>
              </div>
            ) : null}
          </section>
        </div>
      </div>
    </main>
  );
}

function PasswordField({ inputClass, visible, onVisible, labels, autoComplete }: {
  inputClass: string;
  visible: boolean;
  onVisible: (value: boolean) => void;
  labels: { password: string; show: string; hide: string; hint: string };
  autoComplete: 'new-password' | 'current-password';
}) {
  return (
    <label className='block text-sm font-medium text-slate-800'>
      {labels.password}
      <span className='relative mt-1 block'>
        <input className={`${inputClass} mt-0 pr-14`} name='password' type={visible ? 'text' : 'password'} autoComplete={autoComplete} required minLength={autoComplete === 'new-password' ? 12 : 1} maxLength={128} />
        <button type='button' aria-label={visible ? labels.hide : labels.show} onClick={() => onVisible(!visible)} className='absolute inset-y-0 right-0 grid min-h-11 w-12 place-items-center rounded-xl text-slate-500 hover:text-slate-800'>
          {visible ? <EyeOff className='h-5 w-5' aria-hidden='true' /> : <Eye className='h-5 w-5' aria-hidden='true' />}
        </button>
      </span>
      {labels.hint ? <span className='mt-1 block text-xs leading-5 text-slate-500'>{labels.hint}</span> : null}
    </label>
  );
}

function Consent({ name, prefix, linkLabel, href }: { name: string; prefix: string; linkLabel: string; href: string }) {
  return (
    <label className='flex min-h-11 items-start gap-3 text-sm leading-6 text-slate-700'>
      <input className='mt-1 h-5 w-5 shrink-0 accent-emerald-800' name={name} type='checkbox' required />
      <span>{prefix} <Link className='font-semibold text-emerald-800 underline underline-offset-2' href={href} target='_blank' rel='noreferrer'>{linkLabel}</Link>.</span>
    </label>
  );
}

function Status({ icon, title, body, note, children }: { icon: React.ReactNode; title: string; body: string; note?: string; children?: React.ReactNode }) {
  return (
    <div className='py-4'>
      <div className='grid h-14 w-14 place-items-center rounded-2xl bg-emerald-100 text-emerald-800' aria-hidden='true'>{icon}</div>
      <h2 className='mt-5 text-2xl font-semibold text-slate-950'>{title}</h2>
      <p className='mt-3 text-sm leading-7 text-slate-700'>{body}</p>
      {note ? <p className='mt-3 text-xs leading-6 text-slate-500'>{note}</p> : null}
      {children ? <div className='mt-6'>{children}</div> : null}
    </div>
  );
}
