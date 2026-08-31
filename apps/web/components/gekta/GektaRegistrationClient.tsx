'use client';

import * as React from 'react';
import Link from 'next/link';
import { Check, Copy, KeyRound, LoaderCircle, MailCheck, ShieldCheck } from 'lucide-react';
import { GEKTA_PATHS, type GektaLocale } from '@/lib/gekta/content';

type Mode = 'register' | 'login';
type Step = 'form' | 'email' | 'verify' | 'mfa' | 'backup';

type MfaPresentation = {
  enrollmentRequired: boolean;
  setupSecret: string | null;
  otpAuthUri: string | null;
};

const UI = {
  ru: {
    back: 'Вернуться в Гекту', title: 'Аккаунт Гекты', lead: 'Продолжайте диалоги, сохраняйте историю и проекты. После защиты аккаунта начнётся 30-дневный пробный период.', register: 'Регистрация', login: 'Вход', name: 'Имя', namePlaceholder: 'Иван Агроном', phone: 'Телефон', phonePlaceholder: '+7 900 000-00-00', phoneHint: 'Укажите номер для связи. SMS не отправляется; номер сохраняется как неподтверждённый.', email: 'Email', password: 'Пароль', passwordHint: '12–128 символов, минимум три класса: строчные, заглавные, цифры, спецсимволы.', termsPrefix: 'Принимаю', terms: 'условия использования Гекты', privacyPrefix: 'Даю отдельное согласие на', privacy: 'обработку персональных данных', create: 'Создать аккаунт', creating: 'Создаём…', enter: 'Войти', entering: 'Входим…', genericError: 'Не удалось завершить запрос. Проверьте данные и повторите.', unavailable: 'Сервис регистрации временно недоступен. Попробуйте позже.', invalidLogin: 'Не удалось войти. Проверьте email и пароль.', emailTitle: 'Проверьте почту', emailBody: 'Если адрес можно использовать, мы отправили одноразовую ссылку подтверждения. Такой ответ не раскрывает, существует ли аккаунт.', resend: 'Отправить ссылку ещё раз', resending: 'Отправляем…', resendDone: 'Запрос принят. Проверьте входящие и папку «Спам».', useLogin: 'Уже подтвердили email? Войти', verifyTitle: 'Подтвердите email', verifyBody: 'Ссылка проверена сервером. Нажмите кнопку, чтобы одноразово подтвердить адрес и перейти к обязательной MFA.', verifyAction: 'Подтвердить email', verifying: 'Проверяем одноразовую ссылку…', verifyInvalid: 'Ссылка недействительна, уже использована или истекла. Начните вход — он продолжит настройку MFA.', mfaTitle: 'Защитите аккаунт', mfaLoginTitle: 'Введите второй фактор', mfaBody: 'Добавьте секрет в приложение-аутентификатор и введите текущий шестизначный код.', mfaLoginBody: 'Введите код приложения-аутентификатора или одноразовый резервный код.', secret: 'Секрет настройки', openAuthenticator: 'Открыть в приложении-аутентификаторе', code: 'Код MFA', confirm: 'Подтвердить и начать пробный период', confirming: 'Проверяем…', mfaInvalid: 'Код не подошёл. Проверьте время на устройстве и повторите.', backupTitle: 'Сохраните резервные коды', backupBody: 'Каждый код работает один раз. Они больше не будут показаны после ухода с этой страницы.', copy: 'Скопировать коды', copied: 'Скопировано', saved: 'Я сохранил резервные коды в безопасном месте', continue: 'Перейти в Гекту', trial: 'Пробный доступ выдаётся сервером один раз на аккаунт и действует 30 дней.', languages: { ru: 'RU', en: 'EN', zh: '中文' },
  },
  en: {
    back: 'Back to Gekta', title: 'Gekta account', lead: 'Continue conversations and keep history and projects. Your 30-day trial starts after the account is protected.', register: 'Register', login: 'Sign in', name: 'Name', namePlaceholder: 'Alex Agronomist', phone: 'Phone', phonePlaceholder: '+44 7700 900000', phoneHint: 'Enter a contact number. No SMS is sent; the number remains unverified.', email: 'Email', password: 'Password', passwordHint: '12–128 characters and at least three classes: lowercase, uppercase, digits, symbols.', termsPrefix: 'I accept the', terms: 'Gekta terms of use', privacyPrefix: 'I separately consent to', privacy: 'personal-data processing', create: 'Create account', creating: 'Creating…', enter: 'Sign in', entering: 'Signing in…', genericError: 'The request could not be completed. Check the details and retry.', unavailable: 'Registration is temporarily unavailable. Try again later.', invalidLogin: 'Sign-in failed. Check the email and password.', emailTitle: 'Check your email', emailBody: 'If the address can be used, we sent a single-use confirmation link. This response does not reveal whether an account exists.', resend: 'Send the link again', resending: 'Sending…', resendDone: 'Request accepted. Check your inbox and spam folder.', useLogin: 'Email already confirmed? Sign in', verifyTitle: 'Confirm your email', verifyBody: 'The server accepted the link. Press the button to confirm the address once and continue to mandatory MFA.', verifyAction: 'Confirm email', verifying: 'Checking the single-use link…', verifyInvalid: 'The link is invalid, used or expired. Start sign-in to continue MFA setup.', mfaTitle: 'Protect your account', mfaLoginTitle: 'Enter the second factor', mfaBody: 'Add the secret to an authenticator app, then enter its current six-digit code.', mfaLoginBody: 'Enter the authenticator code or a one-time backup code.', secret: 'Setup secret', openAuthenticator: 'Open in an authenticator app', code: 'MFA code', confirm: 'Confirm and start trial', confirming: 'Checking…', mfaInvalid: 'The code was not accepted. Check the device time and retry.', backupTitle: 'Save your backup codes', backupBody: 'Each code works once. They will not be shown again after you leave this page.', copy: 'Copy codes', copied: 'Copied', saved: 'I saved the backup codes somewhere safe', continue: 'Open Gekta', trial: 'The server grants one 30-day trial per account.', languages: { ru: 'RU', en: 'EN', zh: '中文' },
  },
  zh: {
    back: '返回 Gekta', title: 'Gekta 账户', lead: '继续对话并保存历史记录和项目。账户保护完成后将开始30天试用。', register: '注册', login: '登录', name: '姓名', namePlaceholder: '农业专家', phone: '电话', phonePlaceholder: '+86 138 0000 0000', phoneHint: '请输入联系电话。不会发送短信；该号码将保持未验证状态。', email: '电子邮箱', password: '密码', passwordHint: '12–128个字符，至少包含三类：小写、大写、数字、符号。', termsPrefix: '我接受', terms: 'Gekta 使用条款', privacyPrefix: '我单独同意', privacy: '个人数据处理', create: '创建账户', creating: '正在创建…', enter: '登录', entering: '正在登录…', genericError: '无法完成请求。请检查信息后重试。', unavailable: '注册服务暂时不可用，请稍后重试。', invalidLogin: '登录失败，请检查电子邮箱和密码。', emailTitle: '请检查邮箱', emailBody: '如果该地址可用，我们会发送一次性确认链接。此回复不会透露账户是否存在。', resend: '再次发送链接', resending: '正在发送…', resendDone: '请求已接受，请检查收件箱和垃圾邮件。', useLogin: '已确认邮箱？登录', verifyTitle: '确认电子邮箱', verifyBody: '服务器已接受该链接。请按按钮一次性确认地址，然后继续强制双重验证。', verifyAction: '确认电子邮箱', verifying: '正在检查一次性链接…', verifyInvalid: '链接无效、已使用或已过期。请登录以继续设置双重验证。', mfaTitle: '保护账户', mfaLoginTitle: '输入第二重验证', mfaBody: '将密钥添加到身份验证器应用，然后输入当前六位代码。', mfaLoginBody: '输入身份验证器代码或一次性备用代码。', secret: '设置密钥', openAuthenticator: '在身份验证器应用中打开', code: 'MFA 代码', confirm: '确认并开始试用', confirming: '正在检查…', mfaInvalid: '代码未通过。请检查设备时间后重试。', backupTitle: '保存备用代码', backupBody: '每个代码只能使用一次。离开此页面后将不再显示。', copy: '复制代码', copied: '已复制', saved: '我已将备用代码保存在安全位置', continue: '进入 Gekta', trial: '服务器为每个账户仅提供一次30天试用。', languages: { ru: 'RU', en: 'EN', zh: '中文' },
  },
} as const;

function csrfToken(): string {
  const row = document.cookie.split('; ').find((entry) => entry.startsWith('pc_csrf_token='));
  return row ? decodeURIComponent(row.slice(row.indexOf('=') + 1)) : '';
}

async function post(path: string, body: Record<string, unknown>) {
  return fetch(path, {
    method: 'POST',
    credentials: 'same-origin',
    cache: 'no-store',
    headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrfToken() },
    body: JSON.stringify(body),
  });
}

function localeHref(locale: GektaLocale, confirmation: 'email' | 'invalid' | null) {
  const query = new URLSearchParams({ lang: locale });
  if (confirmation) query.set('confirm', confirmation);
  return `/gekta/register?${query.toString()}`;
}

export function GektaRegistrationClient({ initialLocale, initialEmailConfirmation }: {
  initialLocale: GektaLocale;
  initialEmailConfirmation: 'email' | 'invalid' | null;
}) {
  const ui = UI[initialLocale];
  const [mode, setMode] = React.useState<Mode>('register');
  const [step, setStep] = React.useState<Step>('form');
  const [fullName, setFullName] = React.useState('');
  const [phone, setPhone] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [terms, setTerms] = React.useState(false);
  const [privacy, setPrivacy] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState('');
  const [notice, setNotice] = React.useState('');
  const [mfa, setMfa] = React.useState<MfaPresentation | null>(null);
  const [code, setCode] = React.useState('');
  const [backupCodes, setBackupCodes] = React.useState<string[]>([]);
  const [backupSaved, setBackupSaved] = React.useState(false);
  const [copied, setCopied] = React.useState(false);
  const started = React.useRef(false);

  const showMfa = React.useCallback((payload: Record<string, unknown>) => {
    setMfa({ enrollmentRequired: payload.enrollmentRequired === true, setupSecret: typeof payload.setupSecret === 'string' ? payload.setupSecret : null, otpAuthUri: typeof payload.otpAuthUri === 'string' ? payload.otpAuthUri : null });
    setStep('mfa'); setError('');
  }, []);

  React.useEffect(() => {
    if (started.current) return;
    started.current = true;
    if (initialEmailConfirmation === 'email') { setStep('verify'); return; }
    if (initialEmailConfirmation === 'invalid') { setMode('login'); setStep('form'); setError(ui.verifyInvalid); return; }
    void fetch('/api/gekta/auth/mfa', { cache: 'no-store', credentials: 'same-origin' }).then(async (response) => { if (!response.ok) return; showMfa(await response.json() as Record<string, unknown>); }).catch(() => undefined);
  }, [initialEmailConfirmation, showMfa, ui.verifyInvalid]);

  const confirmEmail = async () => {
    if (busy) return; setBusy(true); setError('');
    try {
      const response = await post('/api/gekta/auth/email/verify', {});
      const payload = await response.json().catch(() => ({})) as Record<string, unknown>;
      if (!response.ok) throw new Error(response.status >= 500 ? 'unavailable' : 'invalid');
      const params = new URLSearchParams(window.location.search); params.delete('confirm'); window.history.replaceState(window.history.state, '', `${window.location.pathname}${params.size ? `?${params.toString()}` : ''}`); showMfa(payload);
    } catch (reason) { setError(reason instanceof Error && reason.message === 'unavailable' ? ui.unavailable : ui.verifyInvalid); } finally { setBusy(false); }
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); if (busy) return; setBusy(true); setError(''); setNotice('');
    try {
      const response = mode === 'register' ? await post('/api/gekta/auth/register', { fullName, phone, email, password, acceptedServiceTerms: terms, acceptedPersonalData: privacy, locale: initialLocale }) : await post('/api/gekta/auth/login', { email, password });
      const payload = await response.json().catch(() => ({})) as Record<string, unknown>;
      if (!response.ok) { if (response.status >= 500) throw new Error('unavailable'); throw new Error(mode === 'login' ? 'invalid_login' : 'invalid'); }
      if (mode === 'register') { setStep('email'); setPassword(''); } else { showMfa(payload); setPassword(''); }
    } catch (reason) { const name = reason instanceof Error ? reason.message : 'invalid'; setError(name === 'unavailable' ? ui.unavailable : name === 'invalid_login' ? ui.invalidLogin : ui.genericError); } finally { setBusy(false); }
  };

  const resend = async () => {
    if (busy || !email) return; setBusy(true); setError(''); setNotice('');
    try { const response = await post('/api/gekta/auth/register/resend', { email, locale: initialLocale }); if (!response.ok) throw new Error(response.status >= 500 ? 'unavailable' : 'invalid'); setNotice(ui.resendDone); } catch (reason) { setError(reason instanceof Error && reason.message === 'unavailable' ? ui.unavailable : ui.genericError); } finally { setBusy(false); }
  };

  const verifyMfa = async (event: React.FormEvent) => {
    event.preventDefault(); if (busy || !code.trim()) return; setBusy(true); setError('');
    try {
      const response = await post('/api/gekta/auth/mfa', { code: code.trim() });
      const payload = await response.json().catch(() => ({})) as { backupCodes?: unknown };
      if (!response.ok) throw new Error(response.status >= 500 ? 'unavailable' : 'invalid');
      const codes = Array.isArray(payload.backupCodes) ? payload.backupCodes.filter((item): item is string => typeof item === 'string') : [];
      if (codes.length) { setBackupCodes(codes); setStep('backup'); } else { window.location.assign(GEKTA_PATHS[initialLocale]); }
    } catch (reason) { setError(reason instanceof Error && reason.message === 'unavailable' ? ui.unavailable : ui.mfaInvalid); } finally { setBusy(false); }
  };

  const switchMode = (next: Mode) => { setMode(next); setStep('form'); setError(''); setNotice(''); };
  const fieldClass = 'mt-2 min-h-12 w-full rounded-xl border border-slate-300 bg-white px-4 font-normal text-slate-950 outline-none placeholder:font-normal placeholder:text-slate-400 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100';

  return (
    <main className='min-h-screen bg-[#f6f5ef] px-4 py-6 text-slate-950 sm:py-10'>
      <div className='mx-auto max-w-xl'>
        <div className='flex items-center justify-between gap-4'>
          <Link href={GEKTA_PATHS[initialLocale]} className='inline-flex min-h-11 items-center gap-2 rounded-xl px-2 text-sm font-semibold text-emerald-900 hover:bg-white'><span aria-hidden='true'>←</span>{ui.back}</Link>
          <nav className='flex gap-1' aria-label='Language'>{(['ru', 'en', 'zh'] as const).map((locale) => <Link key={locale} href={localeHref(locale, initialEmailConfirmation)} aria-current={locale === initialLocale ? 'page' : undefined} className={`grid min-h-11 min-w-11 place-items-center rounded-xl px-2 text-xs font-bold ${locale === initialLocale ? 'bg-emerald-800 text-white' : 'text-slate-600 hover:bg-white'}`}>{ui.languages[locale]}</Link>)}</nav>
        </div>

        <section className='mt-5 overflow-hidden rounded-3xl border border-emerald-950/10 bg-white shadow-[0_20px_70px_rgba(15,23,42,0.08)]'>
          <header data-gekta-registration-hero='true' className='border-b border-emerald-950/15 bg-emerald-950 bg-gradient-to-br from-emerald-950 to-emerald-800 px-6 py-7 text-white sm:px-8' style={{ backgroundColor: '#064e3b' }}>
            <div className='flex items-center gap-3'><span className='grid h-11 w-11 place-items-center rounded-2xl bg-white text-xl font-black text-emerald-900'>G</span><div><p className='text-xs font-bold tracking-[0.18em] text-emerald-100'>GEKTA</p><h1 className='text-2xl font-bold text-white'>{ui.title}</h1></div></div>
            <p className='mt-4 max-w-lg text-sm leading-6 text-emerald-50'>{ui.lead}</p>
          </header>

          <div className='p-6 sm:p-8'>
            {busy && step === 'mfa' && !mfa ? <div className='py-10 text-center' role='status'><LoaderCircle className='mx-auto h-7 w-7 animate-spin text-emerald-700' /><p className='mt-3 text-sm text-slate-600'>{ui.verifying}</p></div> : null}
            {step === 'form' ? <><div className='grid grid-cols-2 gap-2 rounded-2xl bg-slate-100 p-1' role='tablist'>{(['register', 'login'] as const).map((value) => <button key={value} type='button' role='tab' aria-selected={mode === value} onClick={() => switchMode(value)} className={`min-h-11 rounded-xl px-4 text-sm font-semibold ${mode === value ? 'bg-white text-emerald-900 shadow-sm' : 'text-slate-600'}`}>{value === 'register' ? ui.register : ui.login}</button>)}</div>
              <form className='mt-6 space-y-4' onSubmit={submit}>
                {mode === 'register' ? <><label className='block text-sm font-semibold text-slate-800'>{ui.name}<input required minLength={2} maxLength={120} autoComplete='name' value={fullName} onChange={(event) => setFullName(event.target.value)} placeholder={ui.namePlaceholder} className={fieldClass} /></label><label className='block text-sm font-semibold text-slate-800'>{ui.phone}<input required type='tel' minLength={8} maxLength={32} autoComplete='tel' value={phone} onChange={(event) => setPhone(event.target.value)} placeholder={ui.phonePlaceholder} className={fieldClass} /><span className='mt-2 block text-xs font-normal leading-5 text-slate-500'>{ui.phoneHint}</span></label></> : null}
                <label className='block text-sm font-semibold text-slate-800'>{ui.email}<input required type='email' maxLength={254} autoComplete='email' value={email} onChange={(event) => setEmail(event.target.value)} className={fieldClass} /></label>
                <label className='block text-sm font-semibold text-slate-800'>{ui.password}<input required type='password' minLength={mode === 'register' ? 12 : 1} maxLength={128} autoComplete={mode === 'register' ? 'new-password' : 'current-password'} value={password} onChange={(event) => setPassword(event.target.value)} className={fieldClass} />{mode === 'register' ? <span className='mt-2 block text-xs font-normal leading-5 text-slate-500'>{ui.passwordHint}</span> : null}</label>
                {mode === 'register' ? <div className='space-y-3 pt-1'><label className='flex items-start gap-3 text-sm leading-6 text-slate-700'><input required type='checkbox' checked={terms} onChange={(event) => setTerms(event.target.checked)} className='mt-1 h-5 w-5 shrink-0 accent-emerald-700' /><span>{ui.termsPrefix} <Link target='_blank' href='/legal/usloviya-ispolzovaniya-gekta' className='font-semibold text-emerald-800 underline'>{ui.terms}</Link>.</span></label><label className='flex items-start gap-3 text-sm leading-6 text-slate-700'><input required type='checkbox' checked={privacy} onChange={(event) => setPrivacy(event.target.checked)} className='mt-1 h-5 w-5 shrink-0 accent-emerald-700' /><span>{ui.privacyPrefix} <Link target='_blank' href='/legal/politika-konfidencialnosti' className='font-semibold text-emerald-800 underline'>{ui.privacy}</Link>.</span></label></div> : null}
                {error ? <p className='rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-800' role='alert'>{error}</p> : null}
                <button disabled={busy} className='flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-emerald-800 px-5 text-sm font-bold text-white hover:bg-emerald-900 disabled:cursor-wait disabled:opacity-60'>{busy ? <LoaderCircle className='h-5 w-5 animate-spin' /> : <ShieldCheck className='h-5 w-5' />}{busy ? mode === 'register' ? ui.creating : ui.entering : mode === 'register' ? ui.create : ui.enter}</button>
              </form></> : null}
            {step === 'email' ? <div className='py-3 text-center'><MailCheck className='mx-auto h-12 w-12 text-emerald-700' /><h2 className='mt-4 text-xl font-bold'>{ui.emailTitle}</h2><p className='mt-3 text-sm leading-6 text-slate-600'>{ui.emailBody}</p>{notice ? <p className='mt-4 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-900' role='status'>{notice}</p> : null}{error ? <p className='mt-4 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-800' role='alert'>{error}</p> : null}<button type='button' onClick={() => void resend()} disabled={busy} className='mt-6 min-h-11 w-full rounded-xl border border-emerald-700 px-4 text-sm font-bold text-emerald-800 disabled:opacity-60'>{busy ? ui.resending : ui.resend}</button><button type='button' onClick={() => switchMode('login')} className='mt-3 min-h-11 w-full rounded-xl px-4 text-sm font-semibold text-slate-600 hover:bg-slate-50'>{ui.useLogin}</button></div> : null}
            {step === 'verify' ? <div className='py-3 text-center'><MailCheck className='mx-auto h-12 w-12 text-emerald-700' /><h2 className='mt-4 text-xl font-bold'>{ui.verifyTitle}</h2><p className='mt-3 text-sm leading-6 text-slate-600'>{ui.verifyBody}</p>{error ? <p className='mt-4 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-800' role='alert'>{error}</p> : null}<button type='button' onClick={() => void confirmEmail()} disabled={busy} className='mt-6 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-emerald-800 px-5 text-sm font-bold text-white disabled:opacity-60'>{busy ? <LoaderCircle className='h-5 w-5 animate-spin' /> : <MailCheck className='h-5 w-5' />}{busy ? ui.verifying : ui.verifyAction}</button></div> : null}
            {step === 'mfa' && mfa ? <form onSubmit={verifyMfa} className='py-2'><KeyRound className='h-11 w-11 text-emerald-700' /><h2 className='mt-4 text-xl font-bold'>{mfa.enrollmentRequired ? ui.mfaTitle : ui.mfaLoginTitle}</h2><p className='mt-2 text-sm leading-6 text-slate-600'>{mfa.enrollmentRequired ? ui.mfaBody : ui.mfaLoginBody}</p>{mfa.enrollmentRequired && mfa.setupSecret ? <div className='mt-5 rounded-2xl border border-emerald-900/15 bg-emerald-50 p-4'><p className='text-xs font-bold uppercase tracking-wide text-emerald-900'>{ui.secret}</p><code className='mt-2 block break-all rounded-lg bg-white px-3 py-3 text-sm font-bold text-slate-900'>{mfa.setupSecret}</code>{mfa.otpAuthUri ? <a href={mfa.otpAuthUri} className='mt-3 inline-flex min-h-11 items-center text-sm font-semibold text-emerald-800 underline'>{ui.openAuthenticator}</a> : null}</div> : null}<label className='mt-5 block text-sm font-semibold text-slate-800'>{ui.code}<input required autoFocus inputMode={mfa.enrollmentRequired ? 'numeric' : 'text'} autoComplete='one-time-code' maxLength={128} value={code} onChange={(event) => setCode(event.target.value)} className={`${fieldClass} text-center font-mono text-lg tracking-[0.18em]`} /></label>{error ? <p className='mt-4 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-800' role='alert'>{error}</p> : null}<button disabled={busy} className='mt-5 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-emerald-800 px-5 text-sm font-bold text-white disabled:opacity-60'>{busy ? <LoaderCircle className='h-5 w-5 animate-spin' /> : <Check className='h-5 w-5' />}{busy ? ui.confirming : ui.confirm}</button><p className='mt-4 text-center text-xs leading-5 text-slate-500'>{ui.trial}</p></form> : null}
            {step === 'backup' ? <div className='py-2'><ShieldCheck className='h-11 w-11 text-emerald-700' /><h2 className='mt-4 text-xl font-bold'>{ui.backupTitle}</h2><p className='mt-2 text-sm leading-6 text-slate-600'>{ui.backupBody}</p><ul className='mt-5 grid list-none grid-cols-2 gap-2 rounded-2xl bg-slate-950 p-4 text-center font-mono text-sm font-bold text-white'>{backupCodes.map((item) => <li key={item} className='list-none rounded-lg bg-white/10 px-2 py-2'>{item}</li>)}</ul><button type='button' onClick={() => { void navigator.clipboard.writeText(backupCodes.join('\n')).then(() => setCopied(true)); }} className='mt-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-slate-300 px-4 text-sm font-semibold text-slate-700'><Copy className='h-4 w-4' />{copied ? ui.copied : ui.copy}</button><label className='mt-5 flex items-start gap-3 text-sm leading-6 text-slate-700'><input type='checkbox' checked={backupSaved} onChange={(event) => setBackupSaved(event.target.checked)} className='mt-1 h-5 w-5 accent-emerald-700' />{ui.saved}</label><button type='button' disabled={!backupSaved} onClick={() => window.location.assign(GEKTA_PATHS[initialLocale])} className='mt-5 min-h-12 w-full rounded-xl bg-emerald-800 px-5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-40'>{ui.continue}</button></div> : null}
          </div>
        </section>
      </div>
    </main>
  );
}
