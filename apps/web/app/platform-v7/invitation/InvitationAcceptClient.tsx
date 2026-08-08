'use client';

import * as React from 'react';
import { CheckCircle2, ShieldCheck } from 'lucide-react';
import { applyCsrfHeader } from '@/lib/csrf';

type Locale = 'ru' | 'en' | 'zh';

const COPY = {
  ru: {
    title: 'Принять приглашение',
    lead: 'Одноразовая ссылка создаёт membership только в указанной организации. Роль уже ограничена сервером.',
    invalidLink: 'Ссылка отсутствует, недействительна, истекла, отозвана или уже использована.',
    fullName: 'ФИО',
    phone: 'Телефон (необязательно)',
    password: 'Пароль',
    passwordHint: 'Для новой учётной записи задай сильный пароль. Если email уже используется на платформе, введи текущий пароль.',
    acceptTerms: 'Я принимаю условия',
    terms: 'пользовательского соглашения',
    acceptPrivacy: 'Я принимаю условия',
    privacy: 'политики обработки данных',
    submit: 'Принять приглашение',
    submitting: 'Проверяем и создаём доступ…',
    invalid: 'Проверь поля и обязательные согласия.',
    unavailable: 'Сервис приглашений недоступен. Доступ не создан. Повтори позже.',
    success: 'Доступ создан',
    successLead: 'Теперь войди с приглашённым email и паролем. Кабинет и роль определит сервер.',
    login: 'Перейти ко входу',
  },
  en: {
    title: 'Accept invitation',
    lead: 'The single-use link creates membership only in the specified organization. The role is already constrained by the server.',
    invalidLink: 'The link is missing, invalid, expired, revoked, or has already been used.',
    fullName: 'Full name', phone: 'Phone (optional)', password: 'Password',
    passwordHint: 'Set a strong password for a new account. If this email is already used on the platform, enter the current password.',
    acceptTerms: 'I accept the', terms: 'user agreement', acceptPrivacy: 'I accept the', privacy: 'data processing policy',
    submit: 'Accept invitation', submitting: 'Verifying and creating access…', invalid: 'Check the fields and required consents.',
    unavailable: 'The invitation service is unavailable. No access was created. Try again later.',
    success: 'Access created', successLead: 'Sign in with the invited email and password. The server will select the workspace and role.', login: 'Go to sign in',
  },
  zh: {
    title: '接受邀请', lead: '一次性链接仅在指定组织中创建 membership。角色已由服务器限制。',
    invalidLink: '链接缺失、无效、已过期、已撤销或已被使用。', fullName: '姓名', phone: '电话（可选）', password: '密码',
    passwordHint: '新账户请设置强密码。如果该邮箱已在平台使用，请输入当前密码。',
    acceptTerms: '我接受', terms: '用户协议', acceptPrivacy: '我接受', privacy: '数据处理政策',
    submit: '接受邀请', submitting: '正在验证并创建访问权限…', invalid: '请检查字段和必选同意项。',
    unavailable: '邀请服务不可用。未创建访问权限。请稍后重试。', success: '访问权限已创建',
    successLead: '现在请使用受邀邮箱和密码登录。服务器将确定工作空间和角色。', login: '前往登录',
  },
} as const;

export function InvitationAcceptClient({ token, locale }: { token: string; locale: Locale }) {
  const copy = COPY[locale];
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState('');
  const [correlationId, setCorrelationId] = React.useState('');
  const [accepted, setAccepted] = React.useState(false);
  const tokenValidShape = token.startsWith('iv_') && token.includes('.') && token.length >= 48;

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting || !tokenValidShape) return;
    const form = new FormData(event.currentTarget);
    if (form.get('acceptTerms') !== 'yes' || form.get('acceptPrivacy') !== 'yes') {
      setError(copy.invalid);
      return;
    }
    const payload = {
      token,
      fullName: String(form.get('fullName') || '').trim(),
      phone: String(form.get('phone') || '').trim() || undefined,
      password: String(form.get('password') || ''),
      termsVersion: '2026-07-31',
      privacyVersion: '2026-07-31',
      acceptTerms: true,
      acceptPrivacy: true,
    };
    setSubmitting(true);
    setError('');
    try {
      const response = await fetch('/api/auth/organization-invitations/accept', {
        method: 'POST',
        headers: applyCsrfHeader({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(payload),
        cache: 'no-store',
        credentials: 'same-origin',
        signal: AbortSignal.timeout(15_000),
      });
      const result = await response.json().catch(() => ({} as { correlationId?: string; code?: string }));
      setCorrelationId(String(result.correlationId || ''));
      if (!response.ok) {
        if (response.status === 400) throw new Error('invalid');
        throw new Error('unavailable');
      }
      setAccepted(true);
      window.history.replaceState(null, '', `/platform-v7/invitation?lang=${locale}`);
    } catch (cause) {
      setError(cause instanceof Error && cause.message === 'invalid' ? copy.invalidLink : copy.unavailable);
    } finally {
      setSubmitting(false);
    }
  }

  if (accepted) {
    return (
      <section className='p0-register-card p0-register-state' aria-live='polite'>
        <CheckCircle2 size={40} aria-hidden='true' />
        <h2>{copy.success}</h2>
        <p>{copy.successLead}</p>
        {correlationId ? <p className='p0-register-correlation'>ID: {correlationId}</p> : null}
        <a className='p0-register-primary' href='/platform-v7/login'>{copy.login}</a>
      </section>
    );
  }

  if (!tokenValidShape) {
    return (
      <section className='p0-register-card p0-register-state' role='alert'>
        <ShieldCheck size={40} aria-hidden='true' />
        <h2>{copy.title}</h2>
        <p className='p0-register-error'>{copy.invalidLink}</p>
      </section>
    );
  }

  return (
    <form className='p0-register-form' onSubmit={submit} noValidate>
      <section className='p0-register-card'>
        <h2>{copy.title}</h2>
        <p>{copy.lead}</p>
        <div className='p0-register-grid'>
          <label><span>{copy.fullName}</span><input name='fullName' minLength={2} maxLength={200} required autoComplete='name' /></label>
          <label><span>{copy.phone}</span><input name='phone' type='tel' minLength={7} maxLength={24} autoComplete='tel' /></label>
          <label className='p0-register-wide'>
            <span>{copy.password}</span>
            <input name='password' type='password' minLength={1} maxLength={128} required autoComplete='current-password' aria-describedby='invitation-password-hint' />
            <small id='invitation-password-hint'>{copy.passwordHint}</small>
          </label>
        </div>
      </section>
      <section className='p0-register-card p0-register-consents'>
        <label><input name='acceptTerms' type='checkbox' value='yes' required /><span>{copy.acceptTerms} <a href='/platform-v7/terms' target='_blank' rel='noreferrer'>{copy.terms}</a>.</span></label>
        <label><input name='acceptPrivacy' type='checkbox' value='yes' required /><span>{copy.acceptPrivacy} <a href='/platform-v7/privacy' target='_blank' rel='noreferrer'>{copy.privacy}</a>.</span></label>
      </section>
      {error ? <p className='p0-register-error' role='alert'>{error}{correlationId ? ` ID: ${correlationId}` : ''}</p> : null}
      <button className='p0-register-primary p0-register-submit' type='submit' disabled={submitting} aria-busy={submitting}>
        {submitting ? copy.submitting : copy.submit}
      </button>
    </form>
  );
}
