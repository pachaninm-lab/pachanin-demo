'use client';

import * as React from 'react';
import { CheckCircle2, Eye, EyeOff, RefreshCw, ShieldCheck } from 'lucide-react';
import { applyCsrfHeader } from '@/lib/csrf';
import { RegisterFormClient } from './RegisterFormClient';

type Locale = 'ru' | 'en' | 'zh';
type RegistrationStatus = {
  applicationId?: string;
  status?: string;
  nextAction?: string;
  reason?: string | null;
  correlationId?: string;
  statusToken?: string;
  ok?: boolean;
};

const STATUS_LABELS: Record<string, string> = {
  EMAIL_VERIFICATION_REQUIRED: 'Ожидается подтверждение электронной почты',
  ORGANIZATION_VERIFICATION_PENDING: 'Заявка находится на проверке',
  ADDITIONAL_INFORMATION_REQUIRED: 'Нужны дополнительные сведения',
  APPROVED: 'Заявка одобрена. Доступ активируется',
  ACTIVATED: 'Доступ активирован',
  REJECTED: 'Заявка отклонена',
  SUSPENDED: 'Рассмотрение заявки приостановлено',
  EXPIRED: 'Срок действия заявки истёк',
  CANCELLED: 'Заявка отменена',
};
const NEXT_LABELS: Record<string, string> = {
  VERIFY_EMAIL: 'Откройте письмо и подтвердите адрес электронной почты.',
  WAIT_FOR_REVIEW: 'Ожидайте результата проверки заявки.',
  PROVIDE_ADDITIONAL_INFORMATION: 'Предоставьте запрошенные дополнительные сведения.',
  WAIT_FOR_ACTIVATION: 'Ожидайте завершения активации доступа.',
  LOGIN: 'Войдите в личный кабинет с подтверждённой учётной записью.',
  CONTACT_SUPPORT: 'При обращении в поддержку сообщите номер обращения, указанный ниже.',
  START_NEW_APPLICATION: 'Подайте новую заявку на регистрацию.',
  WAIT: 'Ожидайте обновления информации по заявке.',
};
const PARTICIPATION = [
  ['seller', 'Сельхозпроизводитель / продавец продукции'],
  ['buyer', 'Покупатель продукции'],
  ['logistics', 'Логистическая организация'],
  ['driver', 'Водитель'],
  ['elevator', 'Элеватор / зернохранилище'],
  ['lab', 'Лаборатория'],
  ['surveyor', 'Сюрвейер / независимый инспектор'],
  ['bank', 'Банк / финансовая организация'],
  ['employee', 'Сотрудник существующей организации'],
] as const;
const ORG_TYPES = [
  ['LEGAL', 'Юридическое лицо'],
  ['INDIVIDUAL', 'Индивидуальный предприниматель'],
  ['SELF_EMPLOYED', 'Самозанятый'],
] as const;

function field(form: FormData, name: string) {
  return String(form.get(name) || '').trim();
}

function Reference({ value }: { value: string }) {
  if (!value) return null;
  return <p className='p0-register-reference'><strong>Номер обращения:</strong> <span>{value}</span></p>;
}

function RussianRegistration({ verifyToken, initialStatusToken }: { verifyToken?: string; initialStatusToken?: string }) {
  const idempotencyKey = React.useRef<string>(globalThis.crypto.randomUUID());
  const [workspace, setWorkspace] = React.useState('seller');
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState('');
  const [correlationId, setCorrelationId] = React.useState('');
  const [statusToken, setStatusToken] = React.useState(initialStatusToken || '');
  const [status, setStatus] = React.useState<RegistrationStatus | null>(null);
  const [statusLoading, setStatusLoading] = React.useState(Boolean(initialStatusToken));
  const [verificationCompleted, setVerificationCompleted] = React.useState(false);
  const [submissionAccepted, setSubmissionAccepted] = React.useState(false);
  const [submittedEmail, setSubmittedEmail] = React.useState('');
  const [resendMessage, setResendMessage] = React.useState('');
  const [additionalInformation, setAdditionalInformation] = React.useState('');
  const [informationSubmitting, setInformationSubmitting] = React.useState(false);
  const [informationMessage, setInformationMessage] = React.useState('');
  const [passwordVisible, setPasswordVisible] = React.useState(false);

  const loadStatus = React.useCallback(async (token: string) => {
    if (!token) return;
    setStatusLoading(true);
    setError('');
    try {
      const response = await fetch(`/api/auth/registration/status?token=${encodeURIComponent(token)}`, {
        cache: 'no-store', credentials: 'same-origin',
      });
      const payload = await response.json().catch(() => ({} as RegistrationStatus));
      setCorrelationId(String(payload.correlationId || ''));
      if (!response.ok || payload.ok === false) throw new Error('status_failed');
      setStatus(payload);
    } catch {
      setError('Сейчас не удалось обновить статус заявки. Повторите попытку позднее.');
    } finally {
      setStatusLoading(false);
    }
  }, []);

  React.useEffect(() => {
    if (initialStatusToken) void loadStatus(initialStatusToken);
  }, [initialStatusToken, loadStatus]);

  async function submitRegistration(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    const element = event.currentTarget;
    if (!element.checkValidity()) {
      element.reportValidity();
      setError('Заполните обязательные поля и подтвердите согласия.');
      return;
    }
    const form = new FormData(element);
    const password = field(form, 'password');
    if (password !== field(form, 'confirmPassword')) {
      setError('Пароли не совпадают. Введите одинаковый пароль в обоих полях.');
      return;
    }
    const payload = {
      workspace: field(form, 'workspace'),
      orgType: field(form, 'orgType'),
      orgLegalName: field(form, 'orgLegalName'),
      orgInn: field(form, 'orgInn'),
      orgKpp: field(form, 'orgKpp') || undefined,
      orgOgrn: field(form, 'orgOgrn') || undefined,
      region: field(form, 'region'),
      fullName: field(form, 'fullName'),
      position: field(form, 'position'),
      phone: field(form, 'phone'),
      email: field(form, 'email').toLowerCase(),
      password,
      termsVersion: '2026-09-03',
      privacyVersion: '2026-09-03',
      acceptTerms: true,
      acceptPrivacy: true,
      locale: 'ru',
    };
    setSubmitting(true);
    setError('');
    setCorrelationId('');
    try {
      const controller = new AbortController();
      const timer = window.setTimeout(() => controller.abort(), 15_000);
      let response: Response;
      try {
        response = await fetch('/api/auth/register', {
          method: 'POST',
          headers: applyCsrfHeader({ 'Content-Type': 'application/json', 'idempotency-key': idempotencyKey.current }),
          body: JSON.stringify(payload), cache: 'no-store', credentials: 'same-origin', signal: controller.signal,
        });
      } finally {
        window.clearTimeout(timer);
      }
      const result = await response.json().catch(() => ({} as RegistrationStatus & { accepted?: boolean }));
      setCorrelationId(String(result.correlationId || ''));
      if (!response.ok || result.accepted !== true) {
        if (response.status === 400) throw new Error('invalid');
        throw new Error('unavailable');
      }
      setSubmittedEmail(payload.email);
      setSubmissionAccepted(true);
    } catch (cause) {
      setError(cause instanceof Error && cause.message === 'invalid'
        ? 'Проверьте правильность заполнения обязательных полей.'
        : 'Сейчас не удалось отправить заявку. Данные не были приняты. Повторите попытку позднее.');
    } finally {
      setSubmitting(false);
    }
  }

  async function resendEmail() {
    if (!submittedEmail || submitting) return;
    setSubmitting(true); setError(''); setResendMessage('');
    try {
      const response = await fetch('/api/auth/registration/resend', {
        method: 'POST', headers: applyCsrfHeader({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ email: submittedEmail, locale: 'ru' }), cache: 'no-store', credentials: 'same-origin', signal: AbortSignal.timeout(15_000),
      });
      const result = await response.json().catch(() => ({} as { accepted?: boolean; correlationId?: string }));
      setCorrelationId(String(result.correlationId || ''));
      if (!response.ok || result.accepted !== true) throw new Error('failed');
      setResendMessage('Если заявка ожидает подтверждения электронной почты, мы направим новое письмо на указанный адрес.');
    } catch {
      setError('Сейчас не удалось отправить письмо. Повторите попытку позднее.');
    } finally { setSubmitting(false); }
  }

  async function verifyEmail() {
    if (!verifyToken || submitting) return;
    setSubmitting(true); setError('');
    try {
      const response = await fetch('/api/auth/registration/verify', {
        method: 'POST', headers: applyCsrfHeader({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ token: verifyToken, locale: 'ru' }), cache: 'no-store', credentials: 'same-origin',
      });
      const result = await response.json().catch(() => ({} as RegistrationStatus));
      setCorrelationId(String(result.correlationId || ''));
      if (!response.ok || result.ok !== true || !result.statusToken) throw new Error('failed');
      setVerificationCompleted(true); setStatusToken(result.statusToken); setStatus(result);
      window.history.replaceState(null, '', `/platform-v7/register?statusToken=${encodeURIComponent(result.statusToken)}&lang=ru`);
    } catch {
      setError('Ссылка недействительна, срок её действия истёк или она уже была использована.');
    } finally { setSubmitting(false); }
  }

  async function submitAdditionalInformation(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const responseText = additionalInformation.trim();
    if (!statusToken || informationSubmitting || responseText.length < 8) {
      setError('Укажите запрошенные сведения.'); return;
    }
    setInformationSubmitting(true); setError(''); setInformationMessage('');
    try {
      const response = await fetch('/api/auth/registration/additional-information', {
        method: 'POST', headers: applyCsrfHeader({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ statusToken, response: responseText }), cache: 'no-store', credentials: 'same-origin', signal: AbortSignal.timeout(15_000),
      });
      const result = await response.json().catch(() => ({} as RegistrationStatus));
      setCorrelationId(String(result.correlationId || ''));
      if (!response.ok || result.ok !== true) throw new Error('failed');
      setAdditionalInformation(''); setInformationMessage('Дополнительные сведения сохранены. Заявка снова направлена на проверку.');
      setStatus((current) => ({ ...current, ...result, reason: null }));
    } catch {
      setError('Сейчас не удалось сохранить дополнительные сведения. Повторите попытку позднее.');
    } finally { setInformationSubmitting(false); }
  }

  const reference = correlationId || status?.correlationId || '';

  if (verifyToken && !verificationCompleted && !status) {
    return <section className='p0-register-card p0-register-state' aria-labelledby='p0-register-verify-title'>
      <ShieldCheck size={40} aria-hidden='true' />
      <h2 id='p0-register-verify-title'>Подтверждение электронной почты</h2>
      <p>После подтверждения адреса заявка будет направлена на проверку. Доступ к личному кабинету предоставляется только после одобрения и активации заявки.</p>
      {error ? <p className='p0-register-error' role='alert'>{error}</p> : null}<Reference value={reference} />
      <button type='button' className='p0-register-primary' onClick={verifyEmail} disabled={submitting} aria-busy={submitting}>{submitting ? 'Адрес подтверждается…' : 'Подтвердить адрес электронной почты'}</button>
    </section>;
  }

  if (submissionAccepted) {
    return <section className='p0-register-card p0-register-state' aria-labelledby='p0-register-status-title' aria-live='polite'>
      <ShieldCheck size={40} aria-hidden='true' />
      <h2 id='p0-register-status-title'>Заявка принята</h2>
      <p>На указанный адрес будет направлено письмо, если он может быть использован для регистрации. Если учётная запись уже существует, воспользуйтесь входом или восстановлением доступа.</p>
      {resendMessage ? <p role='status'>{resendMessage}</p> : null}{error ? <p className='p0-register-error' role='alert'>{error}</p> : null}<Reference value={reference} />
      <div className='p0-register-actions'><button type='button' className='p0-register-primary' onClick={() => void resendEmail()} disabled={submitting}>{submitting ? 'Письмо отправляется…' : 'Отправить письмо повторно'}</button><a className='p0-register-secondary' href='/platform-v7/login'>Войти</a><a className='p0-register-secondary' href='/platform-v7/forgot-password'>Восстановить доступ</a></div>
    </section>;
  }

  if (statusToken || status) {
    const statusCode = String(status?.status || 'EMAIL_VERIFICATION_REQUIRED');
    const nextCode = String(status?.nextAction || 'VERIFY_EMAIL');
    return <section className='p0-register-card p0-register-state' aria-labelledby='p0-register-status-title' aria-live='polite'>
      {statusCode === 'ACTIVATED' ? <CheckCircle2 size={40} aria-hidden='true' /> : <ShieldCheck size={40} aria-hidden='true' />}
      <h2 id='p0-register-status-title'>Статус регистрации</h2>
      <dl className='p0-register-status-list'><div><dt>Номер заявки</dt><dd>{status?.applicationId || '—'}</dd></div><div><dt>Статус</dt><dd>{STATUS_LABELS[statusCode] || 'Информация по заявке обновляется'}</dd></div><div><dt>Следующий шаг</dt><dd>{NEXT_LABELS[nextCode] || 'Ожидайте обновления информации по заявке.'}</dd></div>{status?.reason ? <div><dt>Комментарий по заявке</dt><dd>{status.reason}</dd></div> : null}</dl>
      {error ? <p className='p0-register-error' role='alert'>{error}</p> : null}{informationMessage ? <p role='status'>{informationMessage}</p> : null}<Reference value={reference} />
      {statusCode === 'ADDITIONAL_INFORMATION_REQUIRED' ? <form className='p0-register-additional-form' onSubmit={submitAdditionalInformation}><label><span>Дополнительные сведения</span><textarea value={additionalInformation} onChange={(event) => setAdditionalInformation(event.target.value)} minLength={8} maxLength={4000} placeholder='Введите сведения, которые были запрошены. Не указывайте пароль, коды подтверждения и другие секретные данные.' required disabled={informationSubmitting} /></label><button type='submit' className='p0-register-primary' disabled={informationSubmitting || additionalInformation.trim().length < 8}>{informationSubmitting ? 'Сведения отправляются…' : 'Отправить сведения'}</button></form> : null}
      <div className='p0-register-actions'><button type='button' className='p0-register-secondary' onClick={() => void loadStatus(statusToken)} disabled={statusLoading || !statusToken}><RefreshCw size={17} aria-hidden='true' />{statusLoading ? '…' : 'Обновить статус'}</button>{statusCode === 'ACTIVATED' ? <a className='p0-register-primary' href='/platform-v7/login'>Войти</a> : null}</div>
    </section>;
  }

  return <form className='p0-register-form' onSubmit={submitRegistration}>
    <p className='p0-register-required-note'>Поля со знаком * обязательны для заполнения.</p>
    <section className='p0-register-card'><div className='p0-register-section-heading'><h2>1. Формат участия</h2><p>Выберите предполагаемый формат участия. Права доступа и доступные действия будут определены после проверки и одобрения заявки.</p></div><div className='p0-register-grid'><label><span>Формат участия *</span><select name='workspace' aria-label='Формат участия *' value={workspace} onChange={(event) => setWorkspace(event.target.value)} required>{PARTICIPATION.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label><span>Правовой статус *</span><select name='orgType' aria-label='Правовой статус *' defaultValue='LEGAL' required>{ORG_TYPES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label></div></section>

    <section className='p0-register-card'><div className='p0-register-section-heading'><h2>2. Сведения об организации</h2><p>{workspace === 'employee' ? 'Укажите сведения существующей организации, к которой вы запрашиваете присоединение. Новая организация при этом не создаётся.' : 'Укажите сведения, по которым можно однозначно идентифицировать организацию или предпринимателя.'}</p></div><div className='p0-register-grid'><label className='p0-register-wide'><span>Наименование организации / ФИО предпринимателя *</span><input name='orgLegalName' minLength={2} maxLength={300} required autoComplete='organization' /></label><label><span>ИНН *</span><input name='orgInn' inputMode='numeric' pattern='(?:[0-9]{10}|[0-9]{12})' required aria-describedby='p0-register-inn-hint' /><small id='p0-register-inn-hint'>10 цифр для юридического лица или 12 цифр для ИП / физического лица.</small></label><label><span>КПП (при наличии)</span><input name='orgKpp' inputMode='numeric' pattern='[0-9]{9}' aria-describedby='p0-register-kpp-hint' /><small id='p0-register-kpp-hint'>9 цифр. Для ИП и самозанятых обычно не указывается.</small></label><label><span>ОГРН / ОГРНИП (при наличии)</span><input name='orgOgrn' inputMode='numeric' pattern='(?:[0-9]{13}|[0-9]{15})' aria-describedby='p0-register-ogrn-hint' /><small id='p0-register-ogrn-hint'>13 цифр для ОГРН или 15 цифр для ОГРНИП.</small></label><label><span>Регион *</span><input name='region' minLength={2} maxLength={160} required autoComplete='address-level1' /></label></div></section>

    <section className='p0-register-card'><div className='p0-register-section-heading'><h2>3. Заявитель и доступ</h2><p>Укажите данные заявителя и задайте пароль для последующего входа в личный кабинет.</p></div><div className='p0-register-grid'><label><span>ФИО заявителя *</span><input name='fullName' minLength={2} maxLength={200} required autoComplete='name' /></label><label><span>Должность или статус *</span><input name='position' minLength={2} maxLength={200} required autoComplete='organization-title' /></label><label><span>Телефон *</span><input name='phone' type='tel' minLength={7} maxLength={24} pattern='\+?[0-9()\-\s]{7,24}' required autoComplete='tel' placeholder='+7 900 000-00-00' /></label><label><span>Адрес электронной почты *</span><input name='email' type='email' maxLength={254} required autoComplete='email' autoCapitalize='none' spellCheck={false} placeholder='name@company.ru' /></label><label className='p0-register-wide'><span>Пароль *</span><div className='p0-register-password-control'><input name='password' aria-label='Пароль *' type={passwordVisible ? 'text' : 'password'} minLength={12} maxLength={128} required autoComplete='new-password' aria-describedby='p0-register-password-hint' /><button type='button' className='p0-register-password-toggle' onClick={() => setPasswordVisible((value) => !value)} aria-label={passwordVisible ? 'Скрыть пароль' : 'Показать пароль'} title={passwordVisible ? 'Скрыть пароль' : 'Показать пароль'}>{passwordVisible ? <EyeOff size={18} aria-hidden='true' /> : <Eye size={18} aria-hidden='true' />}</button></div><small id='p0-register-password-hint'>12–128 символов. Используйте как минимум три группы: строчные буквы, прописные буквы, цифры, специальные знаки. Не используйте очевидные последовательности.</small></label><label className='p0-register-wide'><span>Повторите пароль *</span><input name='confirmPassword' type={passwordVisible ? 'text' : 'password'} minLength={12} maxLength={128} required autoComplete='new-password' /></label></div></section>

    <section className='p0-register-card p0-register-consents'><div className='p0-register-section-heading'><h2>4. Подтверждение условий</h2><p>Перед отправкой проверьте сведения. Они будут использованы для рассмотрения заявки и предоставления доступа.</p></div><label><input name='acceptTerms' type='checkbox' value='yes' required /><span>Я принимаю условия <a href='/platform-v7/terms' target='_blank' rel='noreferrer'>Пользовательского соглашения</a>.</span></label><label><input name='acceptPrivacy' type='checkbox' value='yes' required /><span>Я ознакомлен(а) с <a href='/platform-v7/privacy' target='_blank' rel='noreferrer'>Политикой обработки персональных данных</a>.</span></label></section>

    {error ? <p className='p0-register-error' role='alert'>{error}</p> : null}
    <button className='p0-register-primary p0-register-submit' type='submit' disabled={submitting} aria-busy={submitting}>{submitting ? 'Заявка отправляется…' : 'Отправить заявку на регистрацию'}</button>
    <div className='p0-register-help-links'><a href='/platform-v7/login'>Войти</a><a href='/platform-v7/forgot-password'>Восстановить доступ</a></div>
  </form>;
}

export function RegisterFormClientPublic(props: { locale: Locale; verifyToken?: string; initialStatusToken?: string }) {
  if (props.locale !== 'ru') return <RegisterFormClient {...props} />;
  return <RussianRegistration verifyToken={props.verifyToken} initialStatusToken={props.initialStatusToken} />;
}