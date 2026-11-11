'use client';

import * as React from 'react';
import { RoleExecutionCockpitContent } from '@/components/platform-v7/RoleExecutionCockpit';
import { applyCsrfHeader } from '@/lib/csrf';
import type { AppLocale } from '@/i18n/locale';
import { ownerAccessCenterMessages } from '@/i18n/owner-access-center-messages';
import { ALL_ROLE_EXECUTION_COCKPITS } from '@/lib/platform-v7/role-execution-cockpit';
import type { StaffHomeContract } from '@/lib/platform-v7/staff-capabilities';
import styles from '@/app/platform-v7/profile/team/OrganizationTeamAdminClient.module.css';

const COPY = {
  ru: { title: 'Кабинет сотрудника', signedIn: 'Вход выполнен по логину и паролю.', action: 'Подготовить защищённое действие', lead: 'Дополнительное подтверждение потребуется для защищённых операций.', setup: 'Добавь ключ в приложение-аутентификатор.', code: 'Код подтверждения', confirm: 'Подтвердить', error: 'Проверка не завершена. Начни заново.', backups: 'Сохрани резервные коды. Каждый действует один раз.', open: 'Продолжить' },
  en: { title: 'Staff cabinet', signedIn: 'Signed in with your login and password.', action: 'Prepare a protected action', lead: 'Protected operations require additional verification.', setup: 'Add this key to your authenticator.', code: 'Verification code', confirm: 'Confirm', error: 'Verification did not complete. Start again.', backups: 'Save these backup codes. Each works once.', open: 'Continue' },
  zh: { title: '员工账户', signedIn: '已通过登录名和密码登录。', action: '准备受保护操作', lead: '受保护操作需要额外验证。', setup: '将此密钥添加到身份验证应用。', code: '验证码', confirm: '确认', error: '验证未完成。请重新开始。', backups: '请保存备用代码。每个代码只能使用一次。', open: '继续' },
} as const;

const PREVIEW_COPY = {
  ru: { title: 'Предпросмотр 13 кабинетов', role: 'Кабинет для просмотра', employee: 'Сотрудник организации', notice: 'Тестовые данные. Действия отключены.', organization: 'Организация', sampleOrganization: 'ООО «Золотое Поле Тест»', access: 'Разделы профиля', sections: 'Команда, уведомления и назначенные задачи' },
  en: { title: 'Preview 13 workspaces', role: 'Workspace to preview', employee: 'Organization employee', notice: 'Sample data. Actions are disabled. Business workspace samples are in Russian.', organization: 'Organization', sampleOrganization: 'Golden Field Test LLC', access: 'Profile sections', sections: 'Team, notifications, and assigned tasks' },
  zh: { title: '预览 13 个工作台', role: '要预览的工作台', employee: '机构员工', notice: '测试数据。操作已禁用。业务工作台示例为俄语。', organization: '机构', sampleOrganization: '金色田野测试有限公司', access: '个人页面栏目', sections: '团队、通知和分配的任务' },
} as const;

const PREVIEW_ROLE_LABELS = {
  operator: 'ADMIN',
  buyer: 'BUYER',
  seller: 'FARMER',
  logistics: 'LOGISTICIAN',
  driver: 'DRIVER',
  surveyor: 'SURVEYOR',
  elevator: 'ELEVATOR',
  lab: 'LAB',
  bank: 'ACCOUNTING',
  arbitrator: 'ARBITRATOR',
  compliance: 'COMPLIANCE_OFFICER',
  executive: 'EXECUTIVE',
} as const satisfies Record<keyof typeof ALL_ROLE_EXECUTION_COCKPITS, keyof typeof ownerAccessCenterMessages.ru.cabinetRoles>;

type PreviewRole = keyof typeof PREVIEW_ROLE_LABELS | 'employee';

function OwnerCabinetPreview({ locale }: { locale: AppLocale }) {
  const [role, setRole] = React.useState<PreviewRole>('seller');
  const copy = PREVIEW_COPY[locale];
  const roleLabels = ownerAccessCenterMessages[locale].cabinetRoles;
  const titleId = React.useId();
  const cockpit = role === 'employee' ? null : ALL_ROLE_EXECUTION_COCKPITS[role];

  return <section className={styles.panel} aria-labelledby={titleId}>
    <h2 id={titleId}>{copy.title}</h2>
    <p>{copy.notice}</p>
    <label>{copy.role}
      <select value={role} onChange={(event) => {
        const value = event.currentTarget.value;
        if (value === 'employee' || Object.hasOwn(PREVIEW_ROLE_LABELS, value)) setRole(value as PreviewRole);
      }}>
        {Object.entries(PREVIEW_ROLE_LABELS).map(([key, label]) => (
          <option key={key} value={key}>{roleLabels[label]}</option>
        ))}
        <option value='employee'>{copy.employee}</option>
      </select>
    </label>
    {cockpit ? <div lang='ru'>
      <h3>{cockpit.title}</h3>
      <RoleExecutionCockpitContent cockpit={{
        ...cockpit,
        operations: cockpit.operations.map((operation) => ({
          ...operation,
          action: { label: operation.action.label, disabled: true },
        })),
      }} />
    </div> : <>
      <h3>{copy.employee}</h3>
      <dl>
        <dt>{copy.organization}</dt><dd>{copy.sampleOrganization}</dd>
        <dt>{copy.access}</dt><dd>{copy.sections}</dd>
      </dl>
    </>}
  </section>;
}

export function OwnMfaVerificationPanel({ locale }: { locale: AppLocale }) {
  const copy = COPY[locale];
  const titleId = React.useId();
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

  return <section className={styles.panel} aria-labelledby={titleId} data-own-mfa-verification>
    <h2 id={titleId}>{copy.action}</h2>
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

export function PasswordStaffHome({ locale, home }: { locale: AppLocale; home: StaffHomeContract }) {
  const copy = COPY[locale];
  return <section className={styles.panel} aria-labelledby='password-staff-home-title' data-password-staff-home>
    <h1 id='password-staff-home-title'>{copy.title}</h1>
    <p>{home.identity.fullName || home.identity.email}</p>
    <p role='status'>{copy.signedIn}</p>
    <ul>{home.assignments.map((assignment) => <li key={assignment.id}>{assignment.role}</li>)}</ul>
    <OwnMfaVerificationPanel locale={locale} />
    {home.assignments.some(({ role, status }) => role === 'PLATFORM_OWNER' && status === 'ACTIVE')
      ? <OwnerCabinetPreview locale={locale} />
      : null}
  </section>;
}
