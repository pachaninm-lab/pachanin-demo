'use client';

import { useEffect, useMemo, useState, type ComponentProps } from 'react';
import type { OwnerAccessCenterCopy } from '@/i18n/owner-access-center-messages';
import { OwnerAccessCenter as OwnerAccessCenterV2 } from './OwnerAccessCenterV2';
import styles from './OwnerAccessCenterV3.module.css';

type StaffAssignment = { id: string; role: string; status: string };
type Props = ComponentProps<typeof OwnerAccessCenterV2>;

type SurfaceRole =
  | 'operator'
  | 'buyer'
  | 'seller'
  | 'logistics'
  | 'driver'
  | 'surveyor'
  | 'elevator'
  | 'lab'
  | 'bank'
  | 'arbitrator'
  | 'compliance'
  | 'executive';

const CABINETS: ReadonlyArray<{ role: SurfaceRole; cabinetRole: keyof OwnerAccessCenterCopy['cabinetRoles']; icon: string }> = [
  { role: 'operator', cabinetRole: 'ADMIN', icon: '01' },
  { role: 'buyer', cabinetRole: 'BUYER', icon: '02' },
  { role: 'seller', cabinetRole: 'FARMER', icon: '03' },
  { role: 'logistics', cabinetRole: 'LOGISTICIAN', icon: '04' },
  { role: 'driver', cabinetRole: 'DRIVER', icon: '05' },
  { role: 'surveyor', cabinetRole: 'SURVEYOR', icon: '06' },
  { role: 'elevator', cabinetRole: 'ELEVATOR', icon: '07' },
  { role: 'lab', cabinetRole: 'LAB', icon: '08' },
  { role: 'bank', cabinetRole: 'ACCOUNTING', icon: '09' },
  { role: 'arbitrator', cabinetRole: 'ARBITRATOR', icon: '10' },
  { role: 'compliance', cabinetRole: 'COMPLIANCE_OFFICER', icon: '11' },
  { role: 'executive', cabinetRole: 'EXECUTIVE', icon: '12' },
];

const OWNER_COPY = {
  ru: {
    eyebrow: 'Владелец платформы',
    title: 'Все кабинеты — без повторного входа',
    description: 'Открывай любой рабочий кабинет одним нажатием. Повторный пароль, тикет, причина и отдельный запрос для просмотра не требуются.',
    access: 'Максимальный обзор',
    accessBody: 'Доступны все 12 рабочих кабинетов и их интерфейсы. Переключение действует в пределах текущего входа владельца.',
    safety: 'Деньги, банковские подтверждения, подпись, лабораторная финализация и решение арбитра не подменяются владельцем и остаются под отдельными серверными правилами.',
    open: 'Открыть кабинет',
    opening: 'Открываем…',
    advanced: 'Управление сотрудниками и доступами',
    back: 'Вернуться ко всем кабинетам',
    loading: 'Проверяем полномочия владельца…',
    error: 'Не удалось открыть кабинет. Обнови страницу и повтори.',
  },
  en: {
    eyebrow: 'Platform owner',
    title: 'Every cabinet without signing in again',
    description: 'Open any working cabinet with one tap. No repeated password, ticket, reason or separate read-access request is required.',
    access: 'Maximum visibility',
    accessBody: 'All 12 working cabinets and their interfaces are available within the current owner sign-in.',
    safety: 'Money movement, bank confirmations, signatures, laboratory finalization and arbitration decisions remain protected by separate server rules.',
    open: 'Open cabinet',
    opening: 'Opening…',
    advanced: 'Staff and access management',
    back: 'Back to all cabinets',
    loading: 'Checking owner authority…',
    error: 'The cabinet could not be opened. Refresh and try again.',
  },
  zh: {
    eyebrow: '平台所有者',
    title: '无需重复登录即可进入全部工作台',
    description: '一次点击即可打开任意工作台。只读访问无需再次输入密码、工单、原因或单独提交请求。',
    access: '最大可见范围',
    accessBody: '当前所有者登录期间可访问全部 12 个工作台及其界面。',
    safety: '资金操作、银行确认、签署、实验室终审和仲裁决定仍受独立服务器规则保护。',
    open: '打开工作台',
    opening: '正在打开…',
    advanced: '员工与访问管理',
    back: '返回全部工作台',
    loading: '正在检查所有者权限…',
    error: '无法打开工作台。请刷新后重试。',
  },
} as const;

function csrfToken() {
  if (typeof document === 'undefined') return '';
  const row = document.cookie.split('; ').find((entry) => entry.startsWith('pc_csrf_token='));
  return row ? decodeURIComponent(row.slice(row.indexOf('=') + 1)) : '';
}

export function OwnerAccessCenter(props: Props) {
  const { locale, copy, identity, apiAvailable } = props;
  const text = OWNER_COPY[locale];
  const [checking, setChecking] = useState(apiAvailable);
  const [isOwner, setIsOwner] = useState(false);
  const [advanced, setAdvanced] = useState(false);
  const [busyRole, setBusyRole] = useState<SurfaceRole | null>(null);
  const [csrf, setCsrf] = useState('');

  useEffect(() => {
    setCsrf(csrfToken());
    const resetBusy = () => setBusyRole(null);
    window.addEventListener('pageshow', resetBusy);
    return () => window.removeEventListener('pageshow', resetBusy);
  }, []);

  useEffect(() => {
    if (!apiAvailable) {
      setChecking(false);
      return;
    }
    let cancelled = false;
    fetch('/api/staff/assignments/me', {
      credentials: 'same-origin',
      cache: 'no-store',
      signal: AbortSignal.timeout(8_000),
    })
      .then(async (response) => response.ok ? response.json() : [])
      .then((rows: StaffAssignment[]) => {
        if (!cancelled) setIsOwner(Array.isArray(rows) && rows.some((item) => item.role === 'PLATFORM_OWNER' && item.status === 'ACTIVE'));
      })
      .catch(() => {
        if (!cancelled) setIsOwner(false);
      })
      .finally(() => {
        if (!cancelled) setChecking(false);
      });
    return () => { cancelled = true; };
  }, [apiAvailable]);

  const cabinetLabels = useMemo(
    () => CABINETS.map((item) => ({ ...item, label: copy.cabinetRoles[item.cabinetRole] })),
    [copy],
  );

  const prepareCabinetNavigation = (role: SurfaceRole) => {
    setBusyRole(role);
    window.sessionStorage.setItem('pc-v7-active-role', role);
  };

  if (advanced || (!checking && !isOwner)) {
    return (
      <div className={styles.advancedWrap}>
        {isOwner && (
          <button type="button" className={styles.backButton} onClick={() => setAdvanced(false)}>
            ← {text.back}
          </button>
        )}
        <OwnerAccessCenterV2 {...props} />
      </div>
    );
  }

  if (checking) {
    return <main className={styles.page}><section className={styles.loadingCard}>{text.loading}</section></main>;
  }

  return (
    <main className={styles.page} data-owner-direct-cabinet-access>
      <header className={styles.hero}>
        <div>
          <p className={styles.eyebrow}>{text.eyebrow}</p>
          <h1>{text.title}</h1>
          <p>{text.description}</p>
          {identity?.email && <small>{identity.email}</small>}
        </div>
        <button type="button" className={styles.advancedButton} onClick={() => setAdvanced(true)}>
          {text.advanced}
        </button>
      </header>

      <section className={styles.accessSummary}>
        <strong>{text.access}</strong>
        <p>{text.accessBody}</p>
      </section>

      <section className={styles.cabinetGrid} aria-label={text.title}>
        {cabinetLabels.map((item) => (
          <article key={item.role} className={styles.cabinetCard}>
            <span className={styles.number} aria-hidden="true">{item.icon}</span>
            <h2>{item.label}</h2>
            <form
              method="post"
              action="/platform-v7/staff/open-cabinet"
              onSubmit={() => prepareCabinetNavigation(item.role)}
            >
              <input type="hidden" name="_csrf" value={csrf} />
              <input type="hidden" name="role" value={item.role} />
              <button type="submit" disabled={!csrf || busyRole !== null}>
                {busyRole === item.role ? text.opening : text.open}
              </button>
            </form>
          </article>
        ))}
      </section>

      <aside className={styles.safetyNote}>{text.safety}</aside>
    </main>
  );
}
