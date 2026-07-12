'use client';

import { useEffect, useMemo, useState, type ComponentProps, type FormEvent } from 'react';
import { PLATFORM_V7_ACTIVE_ROLE_KEY } from '@/components/platform-v7/PlatformV7SingleEntryGuard';
import type { OwnerAccessCenterCopy } from '@/i18n/owner-access-center-messages';
import {
  CONTROLLED_CABINET_CONTEXTS,
  type ControlledCabinetRole,
} from '@/lib/platform-v7/controlled-test-organizations';
import { OwnerAccessCenter as OwnerAccessCenterV2 } from './OwnerAccessCenterV2';
import styles from './OwnerAccessCenterV3.module.css';

type StaffAssignment = { id: string; role: string; status: string };
type Props = ComponentProps<typeof OwnerAccessCenterV2> & { csrfToken: string };
type SurfaceRole = ControlledCabinetRole;
type OpenCabinetResponse = {
  ok?: boolean;
  code?: string;
  message?: string;
  redirectTo?: string;
};
type CsrfRefreshResponse = {
  ok?: boolean;
  code?: string;
  csrfToken?: string;
};

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
    testNetwork: 'Тестовый контур компаний',
    testNetworkBody: 'Для каждого кабинета назначена связанная тестовая организация. Все компании работают вокруг одной канонической тестовой сделки и помечены как тестовые данные.',
    safety: 'Деньги, банковские подтверждения, подпись, лабораторная финализация и решение арбитра не подменяются владельцем и остаются под отдельными серверными правилами.',
    open: 'Открыть кабинет',
    opening: 'Открываем кабинет…',
    openFailed: 'Не удалось открыть кабинет. Повтори попытку.',
    advanced: 'Управление сотрудниками и доступами',
    back: 'Вернуться ко всем кабинетам',
    loading: 'Проверяем полномочия владельца…',
  },
  en: {
    eyebrow: 'Platform owner',
    title: 'Every cabinet without signing in again',
    description: 'Open any working cabinet with one tap. No repeated password, ticket, reason or separate read-access request is required.',
    access: 'Maximum visibility',
    accessBody: 'All 12 working cabinets and their interfaces are available within the current owner sign-in.',
    testNetwork: 'Test organization network',
    testNetworkBody: 'Each cabinet is linked to a controlled test organization. All organizations participate in one canonical test deal and are explicitly marked as test data.',
    safety: 'Money movement, bank confirmations, signatures, laboratory finalization and arbitration decisions remain protected by separate server rules.',
    open: 'Open cabinet',
    opening: 'Opening cabinet…',
    openFailed: 'The cabinet could not be opened. Try again.',
    advanced: 'Staff and access management',
    back: 'Back to all cabinets',
    loading: 'Checking owner authority…',
  },
  zh: {
    eyebrow: '平台所有者',
    title: '无需重复登录即可进入全部工作台',
    description: '一次点击即可打开任意工作台。只读访问无需再次输入密码、工单、原因或单独提交请求。',
    access: '最大可见范围',
    accessBody: '当前所有者登录期间可访问全部 12 个工作台及其界面。',
    testNetwork: '测试组织网络',
    testNetworkBody: '每个工作台都绑定到受控测试组织。所有组织围绕同一笔标准测试交易运行，并明确标记为测试数据。',
    safety: '资金操作、银行确认、签署、实验室终审和仲裁决定仍受独立服务器规则保护。',
    open: '打开工作台',
    opening: '正在打开工作台…',
    openFailed: '无法打开工作台，请重试。',
    advanced: '员工与访问管理',
    back: '返回全部工作台',
    loading: '正在检查所有者权限…',
  },
} as const;

export function OwnerAccessCenter(props: Props) {
  const { csrfToken, ...baseProps } = props;
  const { locale, copy, identity, apiAvailable } = baseProps;
  const text = OWNER_COPY[locale];
  const [checking, setChecking] = useState(apiAvailable);
  const [isOwner, setIsOwner] = useState(false);
  const [advanced, setAdvanced] = useState(false);
  const [busyRole, setBusyRole] = useState<SurfaceRole | null>(null);
  const [openError, setOpenError] = useState<string | null>(null);
  const controlledOwner = identity?.id === 'owner-controlled-test';

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
    () => CABINETS.map((item) => ({
      ...item,
      label: copy.cabinetRoles[item.cabinetRole],
      organization: CONTROLLED_CABINET_CONTEXTS[item.role],
    })),
    [copy],
  );

  async function refreshCsrf(signal: AbortSignal): Promise<string> {
    const response = await fetch('/platform-v7/staff/prepare?format=json', {
      method: 'GET',
      credentials: 'same-origin',
      cache: 'no-store',
      headers: { Accept: 'application/json' },
      signal,
    });
    const payload = await response.json().catch(() => null) as CsrfRefreshResponse | null;
    if (!response.ok || payload?.ok !== true || typeof payload.csrfToken !== 'string' || payload.csrfToken.length < 32) {
      const code = payload?.code ? ` (${payload.code})` : '';
      throw new Error(`${text.openFailed}${code}`);
    }
    return payload.csrfToken;
  }

  async function requestCabinet(
    role: SurfaceRole,
    organizationId: string,
    token: string,
    signal: AbortSignal,
  ): Promise<{ response: Response; payload: OpenCabinetResponse | null }> {
    const response = await fetch('/platform-v7/staff/open-cabinet', {
      method: 'POST',
      credentials: 'same-origin',
      cache: 'no-store',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'X-CSRF-Token': token,
      },
      body: JSON.stringify({
        role,
        organizationId: controlledOwner ? organizationId : undefined,
      }),
      signal,
    });
    const payload = await response.json().catch(() => null) as OpenCabinetResponse | null;
    return { response, payload };
  }

  async function openCabinet(
    event: FormEvent<HTMLFormElement>,
    role: SurfaceRole,
    organizationId: string,
  ) {
    event.preventDefault();
    if (busyRole) return;

    setBusyRole(role);
    setOpenError(null);
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 18_000);

    try {
      let freshToken = await refreshCsrf(controller.signal);
      let result = await requestCabinet(role, organizationId, freshToken, controller.signal);

      if (result.response.status === 403 && result.payload?.code === 'CSRF_REJECTED') {
        freshToken = await refreshCsrf(controller.signal);
        result = await requestCabinet(role, organizationId, freshToken, controller.signal);
      }

      if (!result.response.ok || result.payload?.ok !== true) {
        const detail = result.payload?.message || text.openFailed;
        const code = result.payload?.code ? ` (${result.payload.code})` : '';
        throw new Error(`${detail}${code}`);
      }
      if (!result.payload.redirectTo || !result.payload.redirectTo.startsWith('/platform-v7/')) {
        throw new Error(text.openFailed);
      }

      try {
        window.sessionStorage.setItem(PLATFORM_V7_ACTIVE_ROLE_KEY, role);
      } catch {
        // The signed, HttpOnly cabinet session remains the authority. Navigation must not stop.
      }
      window.location.replace(result.payload.redirectTo);
    } catch (error) {
      const timedOut = error instanceof DOMException && error.name === 'AbortError';
      setOpenError(timedOut ? text.openFailed : error instanceof Error ? error.message : text.openFailed);
      setBusyRole(null);
    } finally {
      window.clearTimeout(timeoutId);
    }
  }

  if (advanced || (!checking && !isOwner)) {
    return (
      <div className={styles.advancedWrap}>
        {isOwner && (
          <button type="button" className={styles.backButton} onClick={() => setAdvanced(false)}>
            ← {text.back}
          </button>
        )}
        <OwnerAccessCenterV2 {...baseProps} />
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

      {openError && <section className={styles.error} role="alert" aria-live="assertive">{openError}</section>}

      {controlledOwner && (
        <section className={styles.testNetwork} aria-label={text.testNetwork}>
          <span>TEST</span>
          <div>
            <strong>{text.testNetwork}</strong>
            <p>{text.testNetworkBody}</p>
          </div>
        </section>
      )}

      <section className={styles.cabinetGrid} aria-label={text.title} aria-busy={busyRole !== null}>
        {cabinetLabels.map((item) => (
          <article key={item.role} className={styles.cabinetCard}>
            <span className={styles.number} aria-hidden="true">{item.icon}</span>
            <h2>{item.label}</h2>
            {controlledOwner && (
              <p className={styles.organization}>
                <span>Тестовая организация</span>
                <strong>{item.organization.organizationName}</strong>
              </p>
            )}
            <form
              method="post"
              action="/platform-v7/staff/open-cabinet/submit"
              onSubmit={(event) => openCabinet(event, item.role, item.organization.organizationId)}
            >
              <input type="hidden" name="_csrf" value={csrfToken} />
              {controlledOwner && (
                <input type="hidden" name="organizationId" value={item.organization.organizationId} />
              )}
              <button type="submit" name="role" value={item.role} disabled={!csrfToken || busyRole !== null}>
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
