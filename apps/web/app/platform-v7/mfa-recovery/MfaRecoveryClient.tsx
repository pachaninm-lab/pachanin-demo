'use client';

import * as React from 'react';
import { CheckCircle2, Eye, EyeOff, LockKeyhole, ShieldCheck } from 'lucide-react';
import { applyCsrfHeader } from '@/lib/csrf';

type Locale = 'ru' | 'en' | 'zh';

const COPY = {
  ru: {
    title: 'Подтверждение восстановления защиты входа',
    lead: 'Введите текущий пароль. Существующая настройка второго фактора будет сброшена только после успешной проверки.',
    password: 'Текущий пароль',
    show: 'Показать пароль',
    hide: 'Скрыть пароль',
    submit: 'Подтвердить восстановление',
    loading: 'Выполняется проверка…',
    invalid: 'Ссылка или пароль недействительны, ссылка истекла либо уже была использована.',
    unavailable: 'Сервис восстановления защиты входа временно недоступен. Настройки доступа не изменены.',
    rateLimited: 'Превышено допустимое количество попыток. Повторите попытку позднее.',
    successTitle: 'Защита входа сброшена',
    successText: 'Все активные сессии завершены. При следующем входе настройте приложение-аутентификатор и сохраните новые резервные коды.',
    login: 'Перейти ко входу',
    reference: 'Идентификатор обращения',
  },
  en: {
    title: 'Confirm sign-in protection recovery',
    lead: 'Enter your current password. The existing two-factor setting will be reset only after successful verification.',
    password: 'Current password',
    show: 'Show password',
    hide: 'Hide password',
    submit: 'Confirm recovery',
    loading: 'Verifying…',
    invalid: 'The link or password is invalid, or the link has expired or already been used.',
    unavailable: 'Sign-in protection recovery is temporarily unavailable. Your access settings were not changed.',
    rateLimited: 'Too many attempts. Try again later.',
    successTitle: 'Sign-in protection reset',
    successText: 'All active sessions were terminated. At your next sign-in, set up an authenticator app and save the new backup codes.',
    login: 'Go to sign in',
    reference: 'Request reference',
  },
  zh: {
    title: '确认恢复登录保护',
    lead: '请输入当前密码。只有验证成功后，现有双重验证设置才会被重置。',
    password: '当前密码',
    show: '显示密码',
    hide: '隐藏密码',
    submit: '确认恢复',
    loading: '正在验证…',
    invalid: '链接或密码无效，或者链接已过期或已被使用。',
    unavailable: '登录保护恢复服务暂时不可用。访问设置未发生更改。',
    rateLimited: '尝试次数过多。请稍后再试。',
    successTitle: '登录保护已重置',
    successText: '所有活动会话均已终止。下次登录时，请设置身份验证器应用并保存新的备用代码。',
    login: '前往登录',
    reference: '请求编号',
  },
} as const;

export function MfaRecoveryClient({ token, locale }: { token: string; locale: Locale }) {
  const copy = COPY[locale];
  const [password, setPassword] = React.useState('');
  const [showPassword, setShowPassword] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [completed, setCompleted] = React.useState(false);
  const [error, setError] = React.useState('');
  const [correlationId, setCorrelationId] = React.useState('');
  const errorRef = React.useRef<HTMLParagraphElement>(null);
  const tokenValidShape = token.startsWith('mr_') && token.includes('.') && token.length >= 48;

  React.useEffect(() => {
    if (error) errorRef.current?.focus();
  }, [error]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting || !tokenValidShape) return;
    if (password.length < 8 || password.length > 256) {
      setError(copy.invalid);
      return;
    }
    setSubmitting(true);
    setError('');
    setCorrelationId('');
    try {
      const response = await fetch('/api/auth/mfa-recovery/confirm', {
        method: 'POST',
        headers: applyCsrfHeader({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ token, password, locale }),
        cache: 'no-store',
        credentials: 'same-origin',
        signal: AbortSignal.timeout(10_000),
      });
      const payload = await response.json().catch(() => ({} as Record<string, unknown>));
      setCorrelationId(String(payload.correlationId || ''));
      if (!response.ok || payload.ok !== true) {
        if (payload.code === 'RATE_LIMITED') throw new Error('RATE_LIMITED');
        if (payload.code === 'MFA_RECOVERY_UNAVAILABLE') throw new Error('UNAVAILABLE');
        throw new Error('INVALID');
      }
      setPassword('');
      setCompleted(true);
      window.history.replaceState(null, '', `/platform-v7/mfa-recovery?lang=${locale}`);
    } catch (cause) {
      const reason = cause instanceof Error ? cause.message : 'UNAVAILABLE';
      setError(reason === 'RATE_LIMITED' ? copy.rateLimited : reason === 'INVALID' ? copy.invalid : copy.unavailable);
    } finally {
      setSubmitting(false);
    }
  }

  if (completed) {
    return (
      <section className='pc-recovery-card pc-recovery-success' aria-live='polite'>
        <CheckCircle2 size={42} strokeWidth={1.9} aria-hidden='true' />
        <h2>{copy.successTitle}</h2>
        <p>{copy.successText}</p>
        {correlationId ? <p className='pc-recovery-note'>{copy.reference}: {correlationId}</p> : null}
        <a className='pc-recovery-primary-link' href='/platform-v7/login'>{copy.login}</a>
      </section>
    );
  }

  if (!tokenValidShape) {
    return (
      <section className='pc-recovery-card pc-recovery-success' role='alert'>
        <ShieldCheck size={42} strokeWidth={1.9} aria-hidden='true' />
        <h2>{copy.title}</h2>
        <p className='pc-recovery-error'>{copy.invalid}</p>
        <a className='pc-recovery-login-link' href='/platform-v7/login'>{copy.login}</a>
      </section>
    );
  }

  return (
    <form className='pc-recovery-card' onSubmit={submit} noValidate>
      <h2>{copy.title}</h2>
      <p>{copy.lead}</p>
      <label className='pc-recovery-label'>
        <span>{copy.password}</span>
        <span className='pc-recovery-field'>
          <LockKeyhole size={19} aria-hidden='true' />
          <input
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            type={showPassword ? 'text' : 'password'}
            autoComplete='current-password'
            autoCapitalize='none'
            spellCheck={false}
            minLength={8}
            maxLength={256}
            required
            disabled={submitting}
            aria-invalid={Boolean(error)}
            aria-describedby='pc-mfa-recovery-error'
          />
          <button
            type='button'
            className='pc-auth-password-toggle'
            onClick={() => setShowPassword((value) => !value)}
            aria-label={showPassword ? copy.hide : copy.show}
            title={showPassword ? copy.hide : copy.show}
          >
            {showPassword ? <EyeOff size={19} aria-hidden='true' /> : <Eye size={19} aria-hidden='true' />}
          </button>
        </span>
      </label>
      {error ? (
        <p ref={errorRef} id='pc-mfa-recovery-error' className='pc-recovery-error' role='alert' tabIndex={-1}>
          {error}{correlationId ? ` ${copy.reference}: ${correlationId}` : ''}
        </p>
      ) : null}
      <button className='pc-recovery-submit' type='submit' disabled={submitting} aria-busy={submitting}>
        {submitting ? copy.loading : copy.submit}
      </button>
      <a className='pc-recovery-login-link' href='/platform-v7/login'>{copy.login}</a>
    </form>
  );
}
