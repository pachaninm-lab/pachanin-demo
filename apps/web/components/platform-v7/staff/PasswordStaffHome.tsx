'use client';

import * as React from 'react';
import { applyCsrfHeader } from '@/lib/csrf';
import type { AppLocale } from '@/i18n/locale';
import type { StaffHomeContract } from '@/lib/platform-v7/staff-capabilities';
import styles from '@/app/platform-v7/profile/team/OrganizationTeamAdminClient.module.css';

const COPY = {
  ru: { title: 'Кабинет сотрудника', signedIn: 'Вход выполнен по логину и паролю.', action: 'Подготовить защищённое действие', lead: 'Дополнительное подтверждение потребуется для защищённых операций.', setup: 'Добавь ключ в приложение-аутентификатор.', code: 'Код подтверждения', confirm: 'Подтвердить', error: 'Проверка не завершена. Начни заново.', backups: 'Сохрани резервные коды. Каждый действует один раз.', open: 'Открыть управление' },
  en: { title: 'Staff cabinet', signedIn: 'Signed in with your login and password.', action: 'Prepare a protected action', lead: 'Protected operations require additional verification.', setup: 'Add this key to your authenticator.', code: 'Verification code', confirm: 'Confirm', error: 'Verification did not complete. Start again.', backups: 'Save these backup codes. Each works once.', open: 'Open management' },
  zh: { title: '员工账户', signedIn: '已通过登录名和密码登录。', action: '准备受保护操作', lead: '受保护操作需要额外验证。', setup: '将此密钥添加到身份验证应用。', code: '验证码', confirm: '确认', error: '验证未完成。请重新开始。', backups: '请保存备用代码。每个代码只能使用一次。', open: '打开管理界面' },
} as const;

export function PasswordStaffHome({ locale, home }: { locale: AppLocale; home: StaffHomeContract }) {
  const copy = COPY[locale];
  const [started, setStarted] = React.useState(false);
  const [secret, setSecret] = React.useState('');
  const [code, setCode] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState(false);
  const [backups, setBackups] = React.useState<string[]>([]);
  const [verified, setVerified] = React.useState(false);

  async function start() {
    if (busy) return;
    setBusy(true); setError(false); setCode(''); setSecret(''); setStarted(false);
    try {
      const response = await fetch('/api/auth/mfa-step-up/start', { method: 'POST',
        headers: applyCsrfHeader({ 'Content-Type': 'application/json' }), body: '{}',
        credentials: 'same-origin', cache: 'no-store', signal: AbortSignal.timeout(10_000) });
      const payload = await response.json();
      if (!response.ok || payload.ok !== true) throw new Error('verification_unavailable');
      setSecret(payload.enrollmentRequired === true && typeof payload.setupSecret === 'string' ? payload.setupSecret : '');
      setStarted(true);
    } catch { setError(true); } finally { setBusy(false); }
  }

  async function confirm(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setError(false);
    try {
      const response = await fetch('/api/auth/mfa-step-up/verify', { method: 'POST',
        headers: applyCsrfHeader({ 'Content-Type': 'application/json' }), body: JSON.stringify({ code }),
        credentials: 'same-origin', cache: 'no-store', signal: AbortSignal.timeout(10_000) });
      const payload = await response.json();
      if (!response.ok || payload.mfaVerified !== true) throw new Error('verification_rejected');
      setBackups(Array.isArray(payload.backupCodes) ? payload.backupCodes.filter((item: unknown): item is string => typeof item === 'string') : []);
      setVerified(true);
    } catch { setError(true); setStarted(false); } finally { setBusy(false); setSecret(''); setCode(''); }
  }

  return <section className={styles.panel} aria-labelledby='password-staff-home-title' data-password-staff-home>
    <h1 id='password-staff-home-title'>{copy.title}</h1>
    <p>{home.identity.fullName || home.identity.email}</p>
    <p role='status'>{copy.signedIn}</p>
    <ul>{home.assignments.map((assignment) => <li key={assignment.id}>{assignment.role}</li>)}</ul>
    <p>{copy.lead}</p>
    {error ? <p role='alert'>{copy.error}</p> : null}
    {verified ? <>
      {backups.length ? <div><p>{copy.backups}</p><ul>{backups.map((item) => <li key={item}><code>{item}</code></li>)}</ul></div> : null}
      <button type='button' onClick={() => window.location.reload()}>{copy.open}</button>
    </> : started ? <form className={styles.form} onSubmit={confirm}>
      {secret ? <div><p>{copy.setup}</p><code>{secret}</code></div> : null}
      <label>{copy.code}<input autoComplete='one-time-code' value={code} onChange={(event) => setCode(event.target.value)} maxLength={32} required /></label>
      <button type='submit' disabled={busy}>{copy.confirm}</button>
    </form> : <button type='button' onClick={() => void start()} disabled={busy}>{copy.action}</button>}
  </section>;
}
