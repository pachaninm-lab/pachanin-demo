'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type ComponentProps } from 'react';
import type { AppLocale } from '@/i18n/locale';
import type { OwnerAccessCenterCopy } from '@/i18n/owner-access-center-messages';
import { OwnerAccessCenter as OwnerAccessCenterV2 } from './OwnerAccessCenterV2';
import styles from './OwnerAccessCenterV3.module.css';

type StaffAssignment = { id: string; role: string; status: string };
type Props = ComponentProps<typeof OwnerAccessCenterV2> & { csrfToken: string };
type FounderCabinet = {
  key: string;
  canonicalPath: string;
  effectiveRole: string;
};
type RoleModeRegistry = {
  schemaVersion: string;
  mode: 'VIEW_AS';
  readOnly: true;
  returnPath: string;
  restrictions: string[];
  cabinets: FounderCabinet[];
};
type RoleModeInfo = {
  cabinetKey: string;
  canonicalPath: string;
  effectiveRole: string;
  effectiveOrganizationId: string;
  effectiveTenantId?: string;
  mode: 'VIEW_AS';
  readOnly: true;
  restrictions: string[];
  returnPath: string;
};
type FounderRoleModeSession = {
  schemaVersion: 'pc-crop.founder-role-mode.v1';
  active: true;
  accessSessionId: string;
  actor: { displayName: string };
  cabinetKey: string;
  canonicalPath: string;
  effectiveRole: string;
  effectiveOrganizationId: string;
  effectiveTenantId: string;
  mode: 'VIEW_AS';
  readOnly: true;
  restrictions: string[];
  expiresAt: string;
  ticketId: string;
  mfaRequired: true;
  returnPath: string;
};
type ActiveRoleMode = RoleModeInfo & {
  accessSessionId: string;
  actorDisplayName: string;
  expiresAt: string;
};
type RoleModeRequestResponse = {
  status?: string;
  grantId?: string | null;
  roleMode?: RoleModeInfo | null;
  code?: string;
  message?: string;
};
type SessionMetadata = {
  accessSessionId: string;
  accessMode: string;
  permissions: string[];
  effectiveOrganizationId?: string | null;
  effectiveRole?: string | null;
  expiresAt: string;
};
type SessionContext = {
  active: boolean;
  session: SessionMetadata | null;
  code?: string;
  message?: string;
};
type OwnSession = { id: string; status?: string };
type CabinetProjection = {
  mode?: string;
  effectiveOrganizationId?: string;
  effectiveRole?: string;
  expiresAt?: string;
  deals?: Array<{
    id: string;
    deal_number?: string | null;
    dealNumber?: string | null;
    status?: string;
    next_action?: string | null;
    nextAction?: string | null;
    updated_at?: string;
    updatedAt?: string;
  }>;
};
type CsrfRefreshResponse = {
  ok?: boolean;
  code?: string;
  csrfToken?: string;
};
type ApiErrorPayload = {
  code?: string;
  message?: string;
};

const CABINET_ROLE_KEYS: Readonly<Record<string, keyof OwnerAccessCenterCopy['cabinetRoles'] | null>> = {
  operator: 'ADMIN',
  buyer: 'BUYER',
  seller: 'FARMER',
  logistics: 'LOGISTICIAN',
  driver: 'DRIVER',
  surveyor: 'SURVEYOR',
  elevator: 'ELEVATOR',
  lab: 'LAB',
  bank: 'ACCOUNTING',
  organization: null,
  arbitrator: 'ARBITRATOR',
  compliance: 'COMPLIANCE_OFFICER',
  executive: 'EXECUTIVE',
};

const EMPLOYEE_LABEL: Record<AppLocale, string> = {
  ru: 'Сотрудник организации',
  en: 'Organization employee',
  zh: '组织员工',
};

const OWNER_COPY = {
  ru: {
    eyebrow: 'Владелец платформы',
    title: 'Открыть как роль — через серверную authority',
    description: 'Control Center использует канонический VIEW_AS-контракт. Роль, tenant и разрешения назначает сервер; браузер передаёт только выбранный кабинет, реальную организацию, причину, тикет и срок.',
    access: '13 серверных кабинетов',
    accessBody: 'Список приходит из pc-crop.founder-role-mode.v1. Если сервер не подтверждает кабинет или организацию, просмотр не открывается.',
    boundary: 'Режим только для чтения',
    boundaryBody: 'Деньги, банковская финальность, подпись, лабораторная финализация, приёмка, арбитраж и удаление evidence остаются запрещены. Текущий web-контур пока показывает делегированную read-only проекцию внутри Control Center; canonicalPath не используется как локальная authority.',
    organization: 'ID реальной организации',
    organizationHint: 'Введите ID организации, доступной владельцу. Контролируемые тестовые организации сервер отклоняет.',
    ticket: 'Тикет / основание',
    reason: 'Причина просмотра',
    duration: 'Срок',
    minutes: 'мин',
    open: 'Открыть read-only',
    opening: 'Открываем…',
    openFailed: 'Не удалось открыть read-only режим.',
    advanced: 'Управление сотрудниками и доступами',
    back: 'Вернуться ко всем кабинетам',
    loading: 'Проверяем владельца и серверный реестр…',
    active: 'Открыто как роль',
    actor: 'Фактический actor',
    effectiveOrganization: 'Эффективная организация',
    effectiveRole: 'Эффективная роль',
    expires: 'Действует до',
    restrictions: 'Ограничения',
    return: 'Завершить режим и вернуться в Control Center',
    returning: 'Завершаем режим…',
    canonicalPath: 'Канонический маршрут',
    transportPending: 'Прямой переход на canonicalPath пока не используется: web-транспорт делегированной staff-сессии должен оставаться server-authoritative. Ни role, ни tenant не синтезируются в браузере.',
    projection: 'Read-only проекция кабинета',
    projectionEmpty: 'В доступной проекции нет сделок.',
    projectionUnavailable: 'Проекция кабинета временно недоступна. Делегированная сессия остаётся read-only.',
    statusPending: 'Запрос создан, но активный grant сервер не вернул. Режим не открыт.',
    registryUnavailable: 'Канонический реестр role-mode временно недоступен.',
    protectedSessionActive: 'Уже активна другая защищённая staff-сессия. Завершите её перед открытием Founder role-mode.',
    sessionUnknown: 'Состояние защищённой сессии не подтверждено. Повторите проверку перед открытием кабинета.',
    retry: 'Повторить проверку сессии',
  },
  en: {
    eyebrow: 'Platform owner',
    title: 'Open as role through server authority',
    description: 'Control Center consumes the canonical VIEW_AS contract. The server assigns role, tenant and permissions; the browser sends only the selected cabinet, real organization, reason, ticket and duration.',
    access: '13 server-owned cabinets',
    accessBody: 'The list comes from pc-crop.founder-role-mode.v1. If the server cannot verify the cabinet or organization, the view stays closed.',
    boundary: 'Read-only mode',
    boundaryBody: 'Money movement, bank finality, signing, laboratory finalization, acceptance, arbitration and evidence deletion remain prohibited. The current web contour renders the delegated read-only projection inside Control Center; canonicalPath is not used as local authority.',
    organization: 'Real organization ID',
    organizationHint: 'Enter an organization ID available to the owner. Controlled test organizations are rejected by the server.',
    ticket: 'Ticket / basis',
    reason: 'Reason for access',
    duration: 'Duration',
    minutes: 'min',
    open: 'Open read-only',
    opening: 'Opening…',
    openFailed: 'The read-only mode could not be opened.',
    advanced: 'Staff and access management',
    back: 'Back to all cabinets',
    loading: 'Checking owner authority and server registry…',
    active: 'Open as role',
    actor: 'Actual actor',
    effectiveOrganization: 'Effective organization',
    effectiveRole: 'Effective role',
    expires: 'Expires',
    restrictions: 'Restrictions',
    return: 'End mode and return to Control Center',
    returning: 'Ending mode…',
    canonicalPath: 'Canonical route',
    transportPending: 'Direct navigation to canonicalPath is not used yet: delegated staff-session transport must remain server-authoritative. The browser never synthesizes role or tenant.',
    projection: 'Read-only cabinet projection',
    projectionEmpty: 'No deals are present in the available projection.',
    projectionUnavailable: 'The cabinet projection is temporarily unavailable. The delegated session remains read-only.',
    statusPending: 'The request was created, but the server did not return an active grant. The mode was not opened.',
    registryUnavailable: 'The canonical role-mode registry is temporarily unavailable.',
    protectedSessionActive: 'Another protected staff session is active. End it before opening Founder role mode.',
    sessionUnknown: 'The protected session state is unverified. Check it again before opening a cabinet.',
    retry: 'Check session again',
  },
  zh: {
    eyebrow: '平台所有者',
    title: '通过服务器权限“以角色查看”',
    description: 'Control Center 使用规范 VIEW_AS 合同。角色、租户和权限由服务器分配；浏览器只提交工作台、真实组织、原因、工单和时限。',
    access: '13 个服务器工作台',
    accessBody: '列表来自 pc-crop.founder-role-mode.v1。若服务器无法验证工作台或组织，则不会开启查看。',
    boundary: '只读模式',
    boundaryBody: '资金操作、银行最终状态、签署、实验室终审、验收、仲裁和 evidence 删除仍被禁止。当前 Web 仅在 Control Center 内显示委托的只读投影；canonicalPath 不作为本地权限。',
    organization: '真实组织 ID',
    organizationHint: '输入所有者可访问的组织 ID。服务器会拒绝受控测试组织。',
    ticket: '工单 / 依据',
    reason: '查看原因',
    duration: '时限',
    minutes: '分钟',
    open: '打开只读视图',
    opening: '正在打开…',
    openFailed: '无法打开只读模式。',
    advanced: '员工与访问管理',
    back: '返回全部工作台',
    loading: '正在检查所有者权限和服务器注册表…',
    active: '以角色查看',
    actor: '实际操作者',
    effectiveOrganization: '有效组织',
    effectiveRole: '有效角色',
    expires: '有效期至',
    restrictions: '限制',
    return: '结束模式并返回 Control Center',
    returning: '正在结束模式…',
    canonicalPath: '规范路由',
    transportPending: '暂不直接跳转 canonicalPath：委托 staff 会话的 Web 传输必须保持服务器权威。浏览器不会自行生成 role 或 tenant。',
    projection: '工作台只读投影',
    projectionEmpty: '当前可用投影中没有交易。',
    projectionUnavailable: '工作台投影暂时不可用。委托会话仍保持只读。',
    statusPending: '请求已创建，但服务器未返回可激活 grant，因此模式尚未开启。',
    registryUnavailable: '规范 role-mode 注册表暂时不可用。',
    protectedSessionActive: '已有其他受保护 staff 会话。请先结束该会话，再开启 Founder role-mode。',
    sessionUnknown: '受保护会话状态尚未确认。请重新检查后再打开工作台。',
    retry: '重新检查会话',
  },
} as const;

function currentCsrfToken(fallback: string) {
  if (typeof document === 'undefined') return fallback;
  const row = document.cookie.split('; ').find((entry) => entry.startsWith('pc_csrf_token='));
  return row ? decodeURIComponent(row.slice(row.indexOf('=') + 1)) : fallback;
}

function formatDate(value: string | null | undefined, locale: AppLocale) {
  if (!value) return '—';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '—';
  return new Intl.DateTimeFormat(locale === 'zh' ? 'zh-CN' : locale === 'en' ? 'en-GB' : 'ru-RU', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

function payloadMessage(payload: ApiErrorPayload | null | undefined, fallback: string) {
  const message = typeof payload?.message === 'string' && payload.message.trim()
    ? payload.message.trim()
    : fallback;
  return payload?.code ? `${message} (${payload.code})` : message;
}

function validRegistry(value: unknown): value is RoleModeRegistry {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const row = value as Partial<RoleModeRegistry>;
  if (
    row.schemaVersion !== 'pc-crop.founder-role-mode.v1'
    || row.mode !== 'VIEW_AS'
    || row.readOnly !== true
    || typeof row.returnPath !== 'string'
    || !row.returnPath.startsWith('/platform-v7/staff')
    || !Array.isArray(row.restrictions)
    || !Array.isArray(row.cabinets)
    || row.cabinets.length !== 13
  ) return false;
  const seen = new Set<string>();
  return row.cabinets.every((cabinet) => {
    if (
      !cabinet
      || typeof cabinet.key !== 'string'
      || typeof cabinet.canonicalPath !== 'string'
      || !cabinet.canonicalPath.startsWith('/platform-v7/')
      || typeof cabinet.effectiveRole !== 'string'
      || seen.has(cabinet.key)
    ) return false;
    seen.add(cabinet.key);
    return true;
  });
}

function cabinetLabel(cabinet: FounderCabinet, copy: OwnerAccessCenterCopy, locale: AppLocale) {
  if (cabinet.key === 'organization') return EMPLOYEE_LABEL[locale];
  const key = CABINET_ROLE_KEYS[cabinet.key];
  if (key) return copy.cabinetRoles[key];
  return cabinet.effectiveRole || cabinet.key;
}

export function OwnerAccessCenter(props: Props) {
  const { csrfToken, ...baseProps } = props;
  const { locale, copy, identity, apiAvailable } = baseProps;
  const text = OWNER_COPY[locale];
  const [checking, setChecking] = useState(apiAvailable);
  const [isOwner, setIsOwner] = useState(false);
  const [advanced, setAdvanced] = useState(false);
  const [registry, setRegistry] = useState<RoleModeRegistry | null>(null);
  const [sessionContext, setSessionContext] = useState<SessionContext>({ active: false, session: null });
  const [sessionKnown, setSessionKnown] = useState(false);
  const loadGeneration = useRef(0);
  const [activeMode, setActiveMode] = useState<ActiveRoleMode | null>(null);
  const [projection, setProjection] = useState<CabinetProjection | null>(null);
  const [projectionUnavailable, setProjectionUnavailable] = useState(false);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [openError, setOpenError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [organizationId, setOrganizationId] = useState('');
  const [ticketId, setTicketId] = useState('');
  const [reason, setReason] = useState('');
  const [durationSeconds, setDurationSeconds] = useState(15 * 60);

  const cabinetLabels = useMemo(
    () => registry?.cabinets.map((cabinet, index) => ({
      ...cabinet,
      icon: String(index + 1).padStart(2, '0'),
      label: cabinetLabel(cabinet, copy, locale),
    })) ?? [],
    [copy, locale, registry],
  );

  const refreshCsrf = useCallback(async (signal: AbortSignal): Promise<string> => {
    const response = await fetch('/platform-v7/staff/prepare?format=json', {
      method: 'GET',
      credentials: 'same-origin',
      cache: 'no-store',
      headers: { Accept: 'application/json' },
      signal,
    });
    const payload = await response.json().catch(() => null) as CsrfRefreshResponse | null;
    if (!response.ok || payload?.ok !== true || typeof payload.csrfToken !== 'string' || payload.csrfToken.length < 32) {
      throw new Error(payloadMessage(payload, text.openFailed));
    }
    return payload.csrfToken;
  }, [text.openFailed]);

  const loadProjection = useCallback(async (session: SessionMetadata, isCurrent: () => boolean = () => true) => {
    if (!session.effectiveOrganizationId || !session.effectiveRole) {
      if (isCurrent()) {
        setProjection(null);
        setProjectionUnavailable(true);
      }
      return;
    }
    try {
      const organization = encodeURIComponent(session.effectiveOrganizationId);
      const role = encodeURIComponent(session.effectiveRole);
      const response = await fetch(`/api/staff/organizations/${organization}/cabinet/${role}`, {
        credentials: 'same-origin',
        cache: 'no-store',
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(8_000),
      });
      const payload = await response.json().catch(() => null) as CabinetProjection | ApiErrorPayload | null;
      if (!response.ok || !payload || typeof payload !== 'object') {
        throw new Error(payloadMessage(payload as ApiErrorPayload | null, text.projectionUnavailable));
      }
      if (isCurrent()) {
        setProjection(payload as CabinetProjection);
        setProjectionUnavailable(false);
      }
    } catch {
      if (isCurrent()) {
        setProjection(null);
        setProjectionUnavailable(true);
      }
    }
  }, [text.projectionUnavailable]);

  const loadRoleMode = useCallback(async () => {
    const generation = ++loadGeneration.current;
    const isCurrent = () => generation === loadGeneration.current;
    setSessionKnown(false);
    if (!apiAvailable) {
      setRegistry(null);
      setSessionContext({ active: false, session: null });
      setActiveMode(null);
      setProjection(null);
      setProjectionUnavailable(true);
      setChecking(false);
      return;
    }
    setChecking(true);
    setOpenError(null);
    try {
      const [assignmentsResponse, registryResponse, sessionResponse, roleModeSessionResponse, ownSessionsResponse] = await Promise.all([
        fetch('/api/staff/assignments/me', {
          credentials: 'same-origin',
          cache: 'no-store',
          headers: { Accept: 'application/json' },
          signal: AbortSignal.timeout(8_000),
        }),
        fetch('/platform-v7/staff/role-mode', {
          credentials: 'same-origin',
          cache: 'no-store',
          headers: { Accept: 'application/json' },
          signal: AbortSignal.timeout(8_000),
        }),
        fetch('/api/staff/session-context', {
          credentials: 'same-origin',
          cache: 'no-store',
          headers: { Accept: 'application/json' },
          signal: AbortSignal.timeout(8_000),
        }),
        fetch('/api/staff/founder/role-mode/session', {
          credentials: 'same-origin',
          cache: 'no-store',
          headers: { Accept: 'application/json' },
          signal: AbortSignal.timeout(8_000),
        }),
        fetch('/api/staff/access/sessions', {
          credentials: 'same-origin',
          cache: 'no-store',
          headers: { Accept: 'application/json' },
          signal: AbortSignal.timeout(8_000),
        }),
      ]);

      const assignments = await assignmentsResponse.json().catch(() => []) as StaffAssignment[] | ApiErrorPayload;
      const owner = assignmentsResponse.ok
        && Array.isArray(assignments)
        && assignments.some((item) => item.role === 'PLATFORM_OWNER' && item.status === 'ACTIVE');
      if (!isCurrent()) return;
      setIsOwner(owner);
      if (!owner) {
        setRegistry(null);
        setSessionContext({ active: false, session: null });
        setActiveMode(null);
        setProjection(null);
        return;
      }

      const registryPayload = await registryResponse.json().catch(() => null) as unknown;
      if (!isCurrent()) return;
      if (!registryResponse.ok || !validRegistry(registryPayload)) {
        throw new Error(text.registryUnavailable);
      }
      setRegistry(registryPayload);

      const sessionPayload = await sessionResponse.json().catch(() => null) as SessionContext | null;
      const roleModeSession = await roleModeSessionResponse.json().catch(() => null) as FounderRoleModeSession | { active: false } | ApiErrorPayload | null;
      const ownSessions = await ownSessionsResponse.json().catch(() => null) as OwnSession[] | null;
      if (!isCurrent()) return;
      const protectedSessionActive = sessionResponse.ok && sessionPayload?.active === true && Boolean(sessionPayload.session);
      const canonicalActive = roleModeSessionResponse.ok && roleModeSession && 'active' in roleModeSession
        && roleModeSession.active === true;
      const canonicalInactive = (roleModeSessionResponse.status === 401
        && roleModeSession && 'code' in roleModeSession && roleModeSession.code === 'ROLE_MODE_SESSION_INACTIVE')
        || (roleModeSessionResponse.ok && roleModeSession && 'active' in roleModeSession
          && roleModeSession.active === false);
      if (!sessionResponse.ok || typeof sessionPayload?.active !== 'boolean'
        || (sessionPayload.active && !sessionPayload.session)
        || (!sessionPayload.active && sessionPayload.session)
        || (protectedSessionActive ? !canonicalActive : !canonicalInactive)
        || !ownSessionsResponse.ok || !Array.isArray(ownSessions) || ownSessions.length >= 200
        || ownSessions.some((row) => !row || typeof row.id !== 'string' || !row.id || (row.status && row.status !== 'ACTIVE'))) {
        throw new Error(text.sessionUnknown);
      }
      setSessionContext(protectedSessionActive ? sessionPayload! : { active: false, session: null });
      if (!protectedSessionActive && ownSessions.length > 0) {
        setActiveMode(null);
        setProjection(null);
        setProjectionUnavailable(true);
        setSessionKnown(false);
        setNotice(text.sessionUnknown);
        return;
      }
      if (protectedSessionActive && (ownSessions.length !== 1
        || ownSessions[0].id !== sessionPayload!.session!.accessSessionId)) {
        throw new Error(text.sessionUnknown);
      }

      if (protectedSessionActive) {
        const session = sessionPayload!.session!;
        const canonical = roleModeSession as FounderRoleModeSession;
        const cabinet = registryPayload.cabinets.find((item) => item.key === canonical.cabinetKey);
        const valid = canonical.schemaVersion === 'pc-crop.founder-role-mode.v1'
          && canonical.active === true
          && canonical.mode === 'VIEW_AS'
          && canonical.readOnly === true
          && canonical.mfaRequired === true
          && typeof canonical.actor?.displayName === 'string'
          && canonical.actor.displayName.trim().length > 0
          && Array.isArray(canonical.restrictions)
          && cabinet?.canonicalPath === canonical.canonicalPath
          && cabinet?.effectiveRole === canonical.effectiveRole
          && session.accessSessionId === canonical.accessSessionId
          && session.accessMode === 'VIEW_AS'
          && session.permissions.includes('cabinet:view-as')
          && session.effectiveOrganizationId === canonical.effectiveOrganizationId
          && session.effectiveRole === canonical.effectiveRole
          && canonical.returnPath.startsWith('/platform-v7/staff');
        if (!valid) throw new Error(text.openFailed);

        setActiveMode({
          cabinetKey: canonical.cabinetKey,
          canonicalPath: canonical.canonicalPath,
          effectiveRole: canonical.effectiveRole,
          effectiveOrganizationId: canonical.effectiveOrganizationId,
          effectiveTenantId: canonical.effectiveTenantId,
          mode: 'VIEW_AS',
          readOnly: true,
          restrictions: canonical.restrictions,
          returnPath: canonical.returnPath,
          accessSessionId: canonical.accessSessionId,
          actorDisplayName: canonical.actor.displayName,
          expiresAt: canonical.expiresAt,
        });
        setOrganizationId(canonical.effectiveOrganizationId);
        setNotice(null);
        setSessionKnown(true);
        await loadProjection(session, isCurrent);
      } else {
        setActiveMode(null);
        setProjection(null);
        setProjectionUnavailable(false);
        if (protectedSessionActive) {
          setNotice(text.protectedSessionActive);
        } else {
          setNotice(null);
        }
        setSessionKnown(true);
      }
    } catch (error) {
      if (!isCurrent()) return;
      setRegistry(null);
      setSessionContext({ active: false, session: null });
      setSessionKnown(false);
      setActiveMode(null);
      setProjection(null);
      setProjectionUnavailable(true);
      setOpenError(error instanceof Error ? error.message : text.registryUnavailable);
    } finally {
      if (isCurrent()) setChecking(false);
    }
  }, [apiAvailable, loadProjection, text.openFailed, text.protectedSessionActive, text.registryUnavailable, text.sessionUnknown]);

  useEffect(() => {
    void loadRoleMode();
    return () => { loadGeneration.current += 1; };
  }, [loadRoleMode]);
  useEffect(() => {
    const recheck = () => { void loadRoleMode(); };
    window.addEventListener('pc:staff-session-changed', recheck);
    return () => window.removeEventListener('pc:staff-session-changed', recheck);
  }, [loadRoleMode]);

  async function requestRoleMode(cabinet: FounderCabinet, token: string, signal: AbortSignal) {
    const response = await fetch('/platform-v7/staff/role-mode', {
      method: 'POST',
      credentials: 'same-origin',
      cache: 'no-store',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'X-CSRF-Token': token,
      },
      body: JSON.stringify({
        cabinetKey: cabinet.key,
        organizationId: organizationId.trim(),
        reason: reason.trim(),
        ticketId: ticketId.trim(),
        durationSeconds,
      }),
      signal,
    });
    const payload = await response.json().catch(() => null) as RoleModeRequestResponse | null;
    return { response, payload };
  }

  async function openCabinet(cabinet: FounderCabinet) {
    if (busyKey || sessionContext.active || !sessionKnown) return;
    if (organizationId.trim().length < 3) {
      setOpenError(text.organizationHint);
      return;
    }
    if (ticketId.trim().length < 3 || reason.trim().length < 10) {
      setOpenError(text.openFailed);
      return;
    }

    setBusyKey(cabinet.key);
    setSessionKnown(false);
    setOpenError(null);
    setNotice(null);
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 20_000);
    let activationAttempted = false;

    try {
      let token = await refreshCsrf(controller.signal);
      let requested = await requestRoleMode(cabinet, token, controller.signal);

      if (requested.response.status === 403 && requested.payload?.code === 'CSRF_REJECTED') {
        token = await refreshCsrf(controller.signal);
        requested = await requestRoleMode(cabinet, token, controller.signal);
      }
      if (!requested.response.ok || !requested.payload) {
        throw new Error(payloadMessage(requested.payload, text.openFailed));
      }

      const roleMode = requested.payload.roleMode;
      if (
        !roleMode
        || roleMode.cabinetKey !== cabinet.key
        || roleMode.effectiveOrganizationId !== organizationId.trim()
        || roleMode.effectiveRole !== cabinet.effectiveRole
        || roleMode.mode !== 'VIEW_AS'
        || roleMode.readOnly !== true
        || roleMode.canonicalPath !== cabinet.canonicalPath
      ) {
        throw new Error(text.openFailed);
      }
      if (!requested.payload.grantId) {
        setNotice(text.statusPending);
        return;
      }

      activationAttempted = true;
      const activationResponse = await fetch(`/api/staff/access/grants/${encodeURIComponent(requested.payload.grantId)}/activate`, {
        method: 'POST',
        credentials: 'same-origin',
        cache: 'no-store',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          'X-CSRF-Token': token,
        },
        body: '{}',
        signal: controller.signal,
      });
      const activationPayload = await activationResponse.json().catch(() => null) as ApiErrorPayload | null;
      if (!activationResponse.ok) {
        throw new Error(payloadMessage(activationPayload, text.openFailed));
      }

      const [sessionResponse, roleModeSessionResponse] = await Promise.all([
        fetch('/api/staff/session-context', {
          credentials: 'same-origin',
          cache: 'no-store',
          headers: { Accept: 'application/json' },
          signal: controller.signal,
        }),
        fetch('/api/staff/founder/role-mode/session', {
          credentials: 'same-origin',
          cache: 'no-store',
          headers: { Accept: 'application/json' },
          signal: controller.signal,
        }),
      ]);
      const sessionPayload = await sessionResponse.json().catch(() => null) as SessionContext | null;
      const canonical = await roleModeSessionResponse.json().catch(() => null) as FounderRoleModeSession | null;
      const session = sessionPayload?.session;
      if (
        !sessionResponse.ok
        || !roleModeSessionResponse.ok
        || sessionPayload?.active !== true
        || !session
        || !canonical
        || canonical.schemaVersion !== 'pc-crop.founder-role-mode.v1'
        || canonical.active !== true
        || canonical.mode !== 'VIEW_AS'
        || canonical.readOnly !== true
        || canonical.mfaRequired !== true
        || canonical.accessSessionId !== session.accessSessionId
        || canonical.cabinetKey !== roleMode.cabinetKey
        || canonical.canonicalPath !== roleMode.canonicalPath
        || canonical.effectiveOrganizationId !== roleMode.effectiveOrganizationId
        || canonical.effectiveRole !== roleMode.effectiveRole
        || session.accessMode !== 'VIEW_AS'
        || !session.permissions.includes('cabinet:view-as')
        || session.effectiveOrganizationId !== canonical.effectiveOrganizationId
        || session.effectiveRole !== canonical.effectiveRole
        || !Array.isArray(canonical.restrictions)
        || typeof canonical.actor?.displayName !== 'string'
        || !canonical.actor.displayName.trim()
        || !canonical.returnPath.startsWith('/platform-v7/staff')
      ) {
        throw new Error(text.openFailed);
      }

      setSessionContext(sessionPayload);
      setSessionKnown(true);
      setActiveMode({
        cabinetKey: canonical.cabinetKey,
        canonicalPath: canonical.canonicalPath,
        effectiveRole: canonical.effectiveRole,
        effectiveOrganizationId: canonical.effectiveOrganizationId,
        effectiveTenantId: canonical.effectiveTenantId,
        mode: 'VIEW_AS',
        readOnly: true,
        restrictions: canonical.restrictions,
        returnPath: canonical.returnPath,
        accessSessionId: canonical.accessSessionId,
        actorDisplayName: canonical.actor.displayName,
        expiresAt: canonical.expiresAt,
      });
      window.dispatchEvent(new Event('pc:staff-session-changed'));
    } catch (error) {
      if (activationAttempted) {
        setSessionContext({ active: false, session: null });
        setSessionKnown(false);
        setActiveMode(null);
        setProjection(null);
        setProjectionUnavailable(true);
        setNotice(text.sessionUnknown);
      }
      const timedOut = error instanceof DOMException && error.name === 'AbortError';
      setOpenError(timedOut ? text.openFailed : error instanceof Error ? error.message : text.openFailed);
    } finally {
      if (!activationAttempted) setSessionKnown(true);
      window.clearTimeout(timeoutId);
      setBusyKey(null);
    }
  }

  async function returnToControlCenter() {
    const sessionId = sessionContext.session?.accessSessionId;
    if (!sessionId || busyKey) return;
    setBusyKey('return');
    setOpenError(null);
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 12_000);
    try {
      const token = await refreshCsrf(controller.signal);
      const response = await fetch(`/api/staff/access/sessions/${encodeURIComponent(sessionId)}/end`, {
        method: 'POST',
        credentials: 'same-origin',
        cache: 'no-store',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          'X-CSRF-Token': token,
        },
        body: JSON.stringify({ reason: 'Founder ended read-only role mode from Control Center' }),
        signal: controller.signal,
      });
      const payload = await response.json().catch(() => null) as ApiErrorPayload | null;
      if (!response.ok) throw new Error(payloadMessage(payload, text.openFailed));

      const returnPath = activeMode?.returnPath || registry?.returnPath;
      setSessionContext({ active: false, session: null });
      setActiveMode(null);
      setProjection(null);
      setProjectionUnavailable(false);
      setSessionKnown(false);
      window.dispatchEvent(new Event('pc:staff-session-changed'));
      if (returnPath?.startsWith('/platform-v7/staff')) {
        window.location.assign(returnPath);
      }
    } catch (error) {
      setOpenError(error instanceof Error ? error.message : text.openFailed);
    } finally {
      window.clearTimeout(timeoutId);
      setBusyKey(null);
    }
  }

  if (advanced || (!checking && !isOwner)) {
    return (
      <div className={styles.advancedWrap}>
        {isOwner && (
          <button type="button" className={styles.backButton} onClick={() => { setAdvanced(false); void loadRoleMode(); }}>
            ← {text.back}
          </button>
        )}
        <OwnerAccessCenterV2 {...baseProps} />
      </div>
    );
  }

  if (checking) {
    return <main className={styles.page}><section className={styles.loadingCard} aria-live="polite">{text.loading}</section></main>;
  }

  return (
    <main className={styles.page} data-founder-role-mode-consumer>
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
      {notice && <section className={styles.notice} role="status" aria-live="polite">{notice}</section>}
      {!sessionKnown && !checking && apiAvailable && (
        <button type="button" className={styles.advancedButton} onClick={() => void loadRoleMode()} disabled={busyKey !== null}>
          {text.retry}
        </button>
      )}

      {sessionContext.active && sessionContext.session && activeMode ? (
        <section className={styles.activeMode} data-founder-role-mode-active>
          <div className={styles.activeModeHeader}>
            <div>
              <p className={styles.eyebrow}>{text.active}</p>
              <h2>{cabinetLabel({ key: activeMode.cabinetKey, canonicalPath: activeMode.canonicalPath, effectiveRole: activeMode.effectiveRole }, copy, locale)}</h2>
            </div>
            <span className={styles.readOnlyBadge}>VIEW_AS · READ_ONLY</span>
          </div>
          <dl className={styles.modeFacts}>
            <div><dt>{text.actor}</dt><dd>{activeMode.actorDisplayName}</dd></div>
            <div><dt>{text.effectiveOrganization}</dt><dd>{activeMode.effectiveOrganizationId}</dd></div>
            <div><dt>{text.effectiveRole}</dt><dd>{activeMode.effectiveRole}</dd></div>
            <div><dt>{text.expires}</dt><dd>{formatDate(activeMode.expiresAt, locale)}</dd></div>
          </dl>
          <div className={styles.restrictions}>
            <strong>{text.restrictions}</strong>
            <ul>{activeMode.restrictions.map((item) => <li key={item}>{item}</li>)}</ul>
          </div>
          <div className={styles.routeMetadata}>
            <span>{text.canonicalPath}</span>
            <code>{activeMode.canonicalPath || '—'}</code>
            <p>{text.transportPending}</p>
          </div>
          <button
            type="button"
            className={styles.returnButton}
            onClick={() => void returnToControlCenter()}
            disabled={busyKey === 'return'}
          >
            {busyKey === 'return' ? text.returning : text.return}
          </button>

          <section className={styles.projection}>
            <h3>{text.projection}</h3>
            {projectionUnavailable ? <p className={styles.projectionState}>{text.projectionUnavailable}</p> : null}
            {!projectionUnavailable && (projection?.deals?.length ?? 0) === 0 ? <p className={styles.projectionState}>{text.projectionEmpty}</p> : null}
            {!projectionUnavailable && projection?.deals?.length ? (
              <div className={styles.dealList}>
                {projection.deals.map((deal) => (
                  <article key={deal.id}>
                    <strong>{deal.dealNumber || deal.deal_number || deal.id}</strong>
                    <span>{deal.status || '—'}</span>
                    <small>{deal.nextAction || deal.next_action || '—'} · {formatDate(deal.updatedAt || deal.updated_at, locale)}</small>
                  </article>
                ))}
              </div>
            ) : null}
          </section>
        </section>
      ) : (
        <>
          <section className={styles.setupPanel} aria-label={text.boundary}>
            <div className={styles.setupIntro}>
              <strong>{text.boundary}</strong>
              <p>{text.boundaryBody}</p>
            </div>
            <div className={styles.setupFields}>
              <label>
                <span>{text.organization}</span>
                <input
                  value={organizationId}
                  onChange={(event) => setOrganizationId(event.target.value)}
                  maxLength={128}
                  autoComplete="off"
                  inputMode="text"
                />
                <small>{text.organizationHint}</small>
              </label>
              <label>
                <span>{text.ticket}</span>
                <input
                  value={ticketId}
                  onChange={(event) => setTicketId(event.target.value)}
                  maxLength={128}
                  autoComplete="off"
                />
              </label>
              <label>
                <span>{text.duration}</span>
                <select value={durationSeconds} onChange={(event) => setDurationSeconds(Number(event.target.value))}>
                  {[5, 10, 15, 30, 60].map((minutes) => (
                    <option key={minutes} value={minutes * 60}>{minutes} {text.minutes}</option>
                  ))}
                </select>
              </label>
              <label className={styles.reasonField}>
                <span>{text.reason}</span>
                <textarea
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  rows={3}
                  maxLength={2000}
                />
              </label>
            </div>
          </section>

          <section className={styles.cabinetGrid} aria-label={text.title} aria-busy={busyKey !== null}>
            {cabinetLabels.map((item) => (
              <article key={item.key} className={styles.cabinetCard}>
                <span className={styles.number} aria-hidden="true">{item.icon}</span>
                <h2>{item.label}</h2>
                <p className={styles.organization}>
                  <span>{item.effectiveRole}</span>
                  <strong>{item.canonicalPath}</strong>
                </p>
                <button
                  type="button"
                  onClick={() => void openCabinet(item)}
                  disabled={
                    busyKey !== null
                    || sessionContext.active
                    || !sessionKnown
                    || organizationId.trim().length < 3
                    || ticketId.trim().length < 3
                    || reason.trim().length < 10
                  }
                >
                  {busyKey === item.key ? text.opening : text.open}
                </button>
              </article>
            ))}
          </section>
        </>
      )}

      <aside className={styles.safetyNote}>{text.boundaryBody}</aside>
    </main>
  );
}
