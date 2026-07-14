import type { Metadata } from 'next';
import Link from 'next/link';
import { getLocale } from 'next-intl/server';
import { InlineNotice, StatusChip } from '@pc/design-system-v8';
import {
  OperationalCockpitSection,
  OperationalDecisionCockpit,
  OperationalQueue,
  OperationalQueueLink,
  operationalCockpitClasses,
  type OperationalPriority,
} from '@/components/transaction-ux/OperationalDecisionCockpit';
import { getAuthProfile } from '@/lib/auth-profile-server';
import { getDealsCanonical } from '@/lib/deals-server';

export type SupportAuthorityMode = 'index' | 'new' | 'detail' | 'operator';
type Locale = 'ru' | 'en' | 'zh';
type RouteState = 'confirmed' | 'unconfirmed';

type ModeCopy = Readonly<{
  metadataTitle: string;
  metadataDescription: string;
  eyebrow: string;
  title: string;
  description: string;
  status: string;
  taskTitle: string;
  taskDescription: string;
  impact: string;
  result: string;
  noticeTitle: string;
  notice: string;
}>;

type Copy = Readonly<{
  labels: Readonly<{
    blocker: string;
    owner: string;
    impact: string;
    result: string;
    nextAction: string;
    prioritySection: string;
    factsSection: string;
  }>;
  profileTask: Readonly<{
    title: string;
    description: string;
    blocker: string;
    impact: string;
    result: string;
  }>;
  owner: string;
  blocker: string;
  profileStatus: string;
  actions: Readonly<{ profile: string; support: string; deals: string; status: string }>;
  facts: Readonly<{
    user: string;
    userHint: string;
    organization: string;
    organizationHint: string;
    deals: string;
    dealsHint: string;
    staffRegistry: string;
    staffRegistryHint: string;
    participantApi: string;
    participantApiHint: string;
    requestedCase: string;
    requestedCaseHint: string;
  }>;
  values: Readonly<{ unavailable: string; confirmed: string; unconfirmed: string; registered: string }>;
  boundaryTitle: string;
  boundary: string;
  routes: ReadonlyArray<Readonly<{ href: string; title: string; detail: string; state: RouteState }>>;
  modes: Readonly<Record<SupportAuthorityMode, ModeCopy>>;
}>;

const COPY: Record<Locale, Copy> = {
  ru: {
    labels: {
      blocker: 'Блокер', owner: 'Ответственный', impact: 'Влияние', result: 'Результат',
      nextAction: 'Следующее действие', prioritySection: 'Главная задача', factsSection: 'Подтверждённые факты',
    },
    profileTask: {
      title: 'Восстановить подтверждённую серверную сессию',
      description: 'Пользователь, организация и роль недоступны через `/auth/me`. Интерфейс не назначает роль из URL или клиентского хранилища.',
      blocker: 'серверный профиль не подтверждён',
      impact: 'невозможно доказать доступ к обращениям организации',
      result: 'валидная сессия и membership организации',
    },
    owner: 'Support / Operations / CTO / Security',
    blocker: 'participant-facing support API не подключён к durable staff registry',
    profileStatus: 'Профиль не подтверждён',
    actions: { profile: 'Открыть профиль доступа', support: 'Открыть поддержку', deals: 'Открыть Сделки', status: 'Проверить состояние системы' },
    facts: {
      user: 'Пользователь', userHint: 'только из активной серверной сессии',
      organization: 'Организация', organizationHint: 'orgId и tenant boundary из `/auth/me`',
      deals: 'Доступных Сделок', dealsHint: 'participant-scoped серверный реестр',
      staffRegistry: 'Staff support registry', staffRegistryHint: 'PostgreSQL `support.cases` и append-only `support.case_events` существуют',
      participantApi: 'Participant support API', participantApiHint: 'list/create/detail для обычных ролей не подтверждены',
      requestedCase: 'Запрошенное обращение', requestedCaseHint: 'идентификатор из URL, не подтверждён серверным чтением',
    },
    values: { unavailable: 'Недоступно', confirmed: 'Подтверждено', unconfirmed: 'Не подтверждён', registered: 'Зарегистрирован в PostgreSQL' },
    boundaryTitle: 'Граница поддержки',
    boundary: 'Браузер не создаёт, не хранит и не переводит обращения между статусами. Роль не принимается из URL или client store. Пользовательский gateway должен проверить tenant, membership и участие в Сделке, применять идемпотентность и optimistic concurrency, атомарно записывать case/event/audit/outbox и запрещать доступ к чужим обращениям. Staff-переходы выполняются только через отдельную staff-сессию и permissions.',
    routes: [
      { href: '/platform-v7/deals', title: 'Канонические Сделки', detail: 'Проверить сделки и блокеры, к которым может относиться обращение.', state: 'confirmed' },
      { href: '/platform-v7/documents', title: 'Документы', detail: 'Проверить документные основания и подтверждённые статусы.', state: 'confirmed' },
      { href: '/platform-v7/disputes', title: 'Споры', detail: 'Открыть доказательный и арбитражный контур.', state: 'confirmed' },
      { href: '/platform-v7/api-docs', title: 'Participant support API', detail: 'Публиковать после реализации role-safe list/create/detail команд.', state: 'unconfirmed' },
    ],
    modes: {
      index: {
        metadataTitle: 'Поддержка сделки · Прозрачная Цена',
        metadataDescription: 'Граница пользовательской поддержки без fixture-обращений и browser-owned статусов.',
        eyebrow: 'Поддержка · обращения организации',
        title: 'Обращения должны читаться из durable server registry',
        description: 'Staff-реестр обращений существует в PostgreSQL, но participant-facing список для обычных ролей не подключён. Экран не подменяет его fixtures и localStorage.',
        status: 'Пользовательский список не подключён',
        taskTitle: 'Подключить role-safe participant support gateway',
        taskDescription: 'Нужны tenant-scoped list/read endpoints, проверка membership и участия в Сделке, безопасная проекция статусов и событий без раскрытия staff-only заметок.',
        impact: 'пользователь не может безопасно увидеть свои реальные обращения',
        result: 'серверный список обращений организации без client authority',
        noticeTitle: 'Fixture-реестр и localStorage удаляются из authority',
        notice: 'Статические SUP-* обращения, суммы риска и локальные статусы не считаются фактами платформы.',
      },
      new: {
        metadataTitle: 'Создать обращение · Прозрачная Цена',
        metadataDescription: 'Граница создания обращения без browser-only записи и роли из URL.',
        eyebrow: 'Поддержка · новое обращение',
        title: 'Обращение создаётся только серверной идемпотентной командой',
        description: 'Форма не должна сохранять обращение в localStorage или принимать requester role из query string. До participant create API действие закрыто.',
        status: 'Создание обращения не подключено',
        taskTitle: 'Подключить participant create command к support.cases',
        taskDescription: 'Команда должна вывести tenant/user/org из сессии, проверить Deal/object scope, валидировать категорию и вложения, записать case/event/audit/outbox одной транзакцией.',
        impact: 'browser-only обращение нельзя считать доставленным оператору',
        result: 'идемпотентно созданное обращение с correlation id и доказуемым событием',
        noticeTitle: 'Локальная отправка отключена',
        notice: 'До серверного подтверждения интерфейс не показывает «обращение создано» и не генерирует фиктивный номер.',
      },
      detail: {
        metadataTitle: 'Карточка обращения · Прозрачная Цена',
        metadataDescription: 'Граница чтения обращения без fixture-данных и локальных переходов статуса.',
        eyebrow: 'Поддержка · карточка обращения',
        title: 'Карточка доступна только через participant-scoped server read',
        description: 'Идентификатор из URL не доказывает право доступа. До role-safe detail endpoint статус, сообщения, SLA и события не отображаются.',
        status: 'Серверное чтение обращения не подключено',
        taskTitle: 'Подключить participant detail projection',
        taskDescription: 'Сервер должен проверить tenant, membership, requester/organization/deal scope и вернуть только публичные события без staff-only заметок и privileged действий.',
        impact: 'нельзя безопасно подтвердить статус и историю конкретного обращения',
        result: 'role-safe карточка с version, SLA, публичными событиями и audit provenance',
        noticeTitle: 'URL не является источником доступа',
        notice: 'Запрошенный case id показан только как непроверенный параметр. Данные обращения не синтезируются в браузере.',
      },
      operator: {
        metadataTitle: 'Операторская очередь поддержки · Прозрачная Цена',
        metadataDescription: 'Граница операторской очереди без browser store и подмены staff permissions.',
        eyebrow: 'Поддержка · операторская очередь',
        title: 'Операторская очередь требует отдельной staff authority',
        description: 'PostgreSQL staff registry и staff API существуют, но обычная роль operator не равна staff-сессии. Экран не обходит X-Staff-Access-Session и permissions.',
        status: 'Staff authority не подключена к этому маршруту',
        taskTitle: 'Развести роль оператора сделки и staff control-plane',
        taskDescription: 'Очередь должна работать либо в staff workspace с отдельной сессией, либо через ограниченную server projection без privileged переходов и внутренних заметок.',
        impact: 'клиентский store создаёт ложную операторскую authority',
        result: 'очередь с явным access mode, permissions, versioned transitions и audit trail',
        noticeTitle: 'Staff permissions не эмулируются',
        notice: 'Маршрут не читает localStorage и не позволяет локально менять статус, назначать ответственного или эскалировать обращение.',
      },
    },
  },
  en: {
    labels: {
      blocker: 'Blocker', owner: 'Owner', impact: 'Impact', result: 'Result',
      nextAction: 'Next action', prioritySection: 'Primary task', factsSection: 'Confirmed facts',
    },
    profileTask: {
      title: 'Restore a confirmed server session',
      description: 'User, organization and role are unavailable from `/auth/me`. The UI does not assign a role from the URL or client storage.',
      blocker: 'server profile not confirmed',
      impact: 'access to organization support cases cannot be proven',
      result: 'a valid session and organization membership',
    },
    owner: 'Support / Operations / CTO / Security',
    blocker: 'participant-facing support API is not connected to the durable staff registry',
    profileStatus: 'Profile not confirmed',
    actions: { profile: 'Open access profile', support: 'Open support', deals: 'Open Deals', status: 'Check system status' },
    facts: {
      user: 'User', userHint: 'from the active server session only',
      organization: 'Organization', organizationHint: 'orgId and tenant boundary from `/auth/me`',
      deals: 'Accessible Deals', dealsHint: 'participant-scoped server registry',
      staffRegistry: 'Staff support registry', staffRegistryHint: 'PostgreSQL `support.cases` and append-only `support.case_events` exist',
      participantApi: 'Participant support API', participantApiHint: 'list/create/detail for ordinary roles are not confirmed',
      requestedCase: 'Requested case', requestedCaseHint: 'URL identifier not confirmed by a server read',
    },
    values: { unavailable: 'Unavailable', confirmed: 'Confirmed', unconfirmed: 'Not confirmed', registered: 'Registered in PostgreSQL' },
    boundaryTitle: 'Support boundary',
    boundary: 'The browser does not create, store or transition support cases. Role is not accepted from the URL or client store. The participant gateway must verify tenant, membership and Deal participation, enforce idempotency and optimistic concurrency, atomically write case/event/audit/outbox, and deny access to other organizations’ cases. Staff transitions require a separate staff session and permissions.',
    routes: [
      { href: '/platform-v7/deals', title: 'Canonical Deals', detail: 'Inspect Deals and blockers that may be linked to a case.', state: 'confirmed' },
      { href: '/platform-v7/documents', title: 'Documents', detail: 'Inspect document bases and confirmed states.', state: 'confirmed' },
      { href: '/platform-v7/disputes', title: 'Disputes', detail: 'Open the evidence and arbitration circuit.', state: 'confirmed' },
      { href: '/platform-v7/api-docs', title: 'Participant support API', detail: 'Publish after role-safe list/create/detail commands are implemented.', state: 'unconfirmed' },
    ],
    modes: {
      index: {
        metadataTitle: 'Deal support · Transparent Price', metadataDescription: 'Participant support boundary without fixture cases or browser-owned states.',
        eyebrow: 'Support · organization cases', title: 'Cases must be read from the durable server registry',
        description: 'A staff support registry exists in PostgreSQL, but a participant-facing list for ordinary roles is not connected. The screen does not replace it with fixtures or localStorage.',
        status: 'Participant case list not connected', taskTitle: 'Connect a role-safe participant support gateway',
        taskDescription: 'Implement tenant-scoped list/read endpoints, membership and Deal-participation checks, and a safe status/event projection without staff-only notes.',
        impact: 'users cannot safely see their real support cases', result: 'a server case list for the organization without client authority',
        noticeTitle: 'Fixture registry and localStorage are removed from authority', notice: 'Static SUP-* cases, risk amounts and local states are not platform facts.',
      },
      new: {
        metadataTitle: 'Create support case · Transparent Price', metadataDescription: 'Support creation boundary without browser-only persistence or URL-derived roles.',
        eyebrow: 'Support · new case', title: 'A case must be created by an idempotent server command only',
        description: 'The form must not persist a case in localStorage or accept requester role from the query string. The action remains closed until a participant create API exists.',
        status: 'Case creation not connected', taskTitle: 'Connect participant create command to support.cases',
        taskDescription: 'Derive tenant/user/org from the session, verify Deal/object scope, validate category and attachments, and write case/event/audit/outbox in one transaction.',
        impact: 'a browser-only case cannot be treated as delivered to operations', result: 'an idempotently created case with correlation id and provable event',
        noticeTitle: 'Local submission is disabled', notice: 'Until server confirmation, the UI does not show “case created” or generate a fictional identifier.',
      },
      detail: {
        metadataTitle: 'Support case · Transparent Price', metadataDescription: 'Support detail boundary without fixture data or local status transitions.',
        eyebrow: 'Support · case detail', title: 'A case is available only through participant-scoped server read',
        description: 'A URL identifier does not prove access. Until a role-safe detail endpoint exists, status, messages, SLA and events are not displayed.',
        status: 'Server case read not connected', taskTitle: 'Connect participant detail projection',
        taskDescription: 'Verify tenant, membership, requester/organization/Deal scope and return public events only, excluding staff-only notes and privileged actions.',
        impact: 'the status and history of a specific case cannot be confirmed safely', result: 'a role-safe card with version, SLA, public events and audit provenance',
        noticeTitle: 'The URL is not an access authority', notice: 'The requested case id is shown only as an unverified parameter. Case data is not synthesized in the browser.',
      },
      operator: {
        metadataTitle: 'Support operations queue · Transparent Price', metadataDescription: 'Operations queue boundary without browser store or emulated staff permissions.',
        eyebrow: 'Support · operations queue', title: 'The operations queue requires separate staff authority',
        description: 'The PostgreSQL staff registry and staff API exist, but the ordinary operator role is not a staff session. The screen does not bypass X-Staff-Access-Session or permissions.',
        status: 'Staff authority not connected to this route', taskTitle: 'Separate Deal operator role from staff control-plane',
        taskDescription: 'Run the queue in the staff workspace with a separate session, or expose a restricted server projection without privileged transitions and internal notes.',
        impact: 'the client store creates false operator authority', result: 'a queue with explicit access mode, permissions, versioned transitions and audit trail',
        noticeTitle: 'Staff permissions are not emulated', notice: 'The route does not read localStorage or locally change status, assignment or escalation.',
      },
    },
  },
  zh: {
    labels: {
      blocker: '阻塞项', owner: '负责人', impact: '影响', result: '结果',
      nextAction: '下一步', prioritySection: '主要任务', factsSection: '已确认事实',
    },
    profileTask: {
      title: '恢复已确认的服务器会话',
      description: '无法从 `/auth/me` 获取用户、组织和角色。界面不会从 URL 或客户端存储分配角色。',
      blocker: '服务器档案未确认', impact: '无法证明对组织支持工单的访问权限', result: '有效会话和组织 membership',
    },
    owner: 'Support / Operations / CTO / Security',
    blocker: 'participant-facing support API 尚未连接持久化 staff registry',
    profileStatus: '档案未确认',
    actions: { profile: '打开访问档案', support: '打开支持', deals: '打开交易', status: '检查系统状态' },
    facts: {
      user: '用户', userHint: '仅来自活动服务器会话',
      organization: '组织', organizationHint: '来自 `/auth/me` 的 orgId 和 tenant 边界',
      deals: '可访问交易', dealsHint: '参与方范围服务器登记册',
      staffRegistry: 'Staff support registry', staffRegistryHint: 'PostgreSQL `support.cases` 和 append-only `support.case_events` 已存在',
      participantApi: 'Participant support API', participantApiHint: '普通角色的 list/create/detail 尚未确认',
      requestedCase: '请求的工单', requestedCaseHint: 'URL 标识符尚未由服务器读取确认',
    },
    values: { unavailable: '不可用', confirmed: '已确认', unconfirmed: '未确认', registered: '已登记在 PostgreSQL' },
    boundaryTitle: '支持边界',
    boundary: '浏览器不会创建、存储或转换支持工单。角色不会从 URL 或 client store 接受。参与方 gateway 必须验证 tenant、membership 和交易参与关系，执行幂等和乐观并发，原子写入 case/event/audit/outbox，并拒绝访问其他组织的工单。Staff 转换需要独立 staff 会话和权限。',
    routes: [
      { href: '/platform-v7/deals', title: '规范交易', detail: '查看可能与工单关联的交易和阻塞项。', state: 'confirmed' },
      { href: '/platform-v7/documents', title: '文档', detail: '查看文档依据和已确认状态。', state: 'confirmed' },
      { href: '/platform-v7/disputes', title: '争议', detail: '打开证据与仲裁闭环。', state: 'confirmed' },
      { href: '/platform-v7/api-docs', title: 'Participant support API', detail: '在 role-safe list/create/detail 命令实现后发布。', state: 'unconfirmed' },
    ],
    modes: {
      index: {
        metadataTitle: '交易支持 · 透明价格', metadataDescription: '不使用虚构工单或浏览器状态的参与方支持边界。',
        eyebrow: '支持 · 组织工单', title: '工单必须从持久服务器登记册读取',
        description: 'PostgreSQL 中已有 staff 支持登记册，但普通角色的参与方列表尚未连接。该页面不会用 fixtures 或 localStorage 替代。',
        status: '参与方工单列表未连接', taskTitle: '连接 role-safe participant support gateway',
        taskDescription: '实现 tenant-scoped list/read endpoint、membership 与交易参与检查，以及不包含 staff-only 备注的安全状态和事件投影。',
        impact: '用户无法安全查看真实支持工单', result: '不依赖客户端权威的组织服务器工单列表',
        noticeTitle: 'Fixture 登记册和 localStorage 已从权威中移除', notice: '静态 SUP-* 工单、风险金额和本地状态不是平台事实。',
      },
      new: {
        metadataTitle: '创建支持工单 · 透明价格', metadataDescription: '不使用浏览器持久化或 URL 角色的工单创建边界。',
        eyebrow: '支持 · 新工单', title: '工单只能由幂等服务器命令创建',
        description: '表单不得把工单保存到 localStorage，也不得从 query string 接受 requester role。在 participant create API 建立前操作关闭。',
        status: '工单创建未连接', taskTitle: '将 participant create command 连接到 support.cases',
        taskDescription: '从会话推导 tenant/user/org，验证交易和对象范围，校验类别与附件，并在一个事务中写入 case/event/audit/outbox。',
        impact: '仅浏览器创建的工单不能视为已送达运营', result: '具有 correlation id 和可证明事件的幂等工单',
        noticeTitle: '本地提交已禁用', notice: '在服务器确认前，界面不会显示“工单已创建”或生成虚构编号。',
      },
      detail: {
        metadataTitle: '支持工单 · 透明价格', metadataDescription: '不使用 fixture 数据或本地状态转换的工单详情边界。',
        eyebrow: '支持 · 工单详情', title: '工单只能通过 participant-scoped 服务器读取访问',
        description: 'URL 标识符不能证明访问权限。在 role-safe detail endpoint 建立前，不显示状态、消息、SLA 和事件。',
        status: '服务器工单读取未连接', taskTitle: '连接 participant detail projection',
        taskDescription: '验证 tenant、membership、requester/organization/Deal 范围，仅返回公共事件，排除 staff-only 备注和特权操作。',
        impact: '无法安全确认特定工单的状态和历史', result: '包含 version、SLA、公共事件和 audit provenance 的 role-safe 卡片',
        noticeTitle: 'URL 不是访问权威', notice: '请求的 case id 仅作为未验证参数显示。浏览器不会合成工单数据。',
      },
      operator: {
        metadataTitle: '支持运营队列 · 透明价格', metadataDescription: '不使用浏览器 store 或模拟 staff 权限的运营队列边界。',
        eyebrow: '支持 · 运营队列', title: '运营队列需要独立 staff authority',
        description: 'PostgreSQL staff registry 和 staff API 已存在，但普通 operator 角色不等于 staff 会话。页面不会绕过 X-Staff-Access-Session 或权限。',
        status: 'Staff authority 未连接到此路由', taskTitle: '分离交易 operator 角色与 staff control-plane',
        taskDescription: '在具有独立会话的 staff workspace 中运行队列，或提供不包含特权转换和内部备注的受限服务器投影。',
        impact: '客户端 store 产生虚假的 operator authority', result: '具有明确 access mode、权限、版本化转换和审计轨迹的队列',
        noticeTitle: 'Staff 权限不会被模拟', notice: '路由不会读取 localStorage，也不会在本地更改状态、负责人或升级。',
      },
    },
  },
};

function localeOf(value: string): Locale {
  if (value.startsWith('en')) return 'en';
  if (value.startsWith('zh')) return 'zh';
  return 'ru';
}

export async function getSupportAuthorityMetadata(mode: SupportAuthorityMode): Promise<Metadata> {
  const copy = COPY[localeOf(await getLocale())].modes[mode];
  return { title: copy.metadataTitle, description: copy.metadataDescription, robots: { index: false, follow: false } };
}

export async function SupportParticipantAuthority({ mode, caseId }: { mode: SupportAuthorityMode; caseId?: string }) {
  const copy = COPY[localeOf(await getLocale())];
  const modeCopy = copy.modes[mode];
  const [profile, rawDeals] = await Promise.all([getAuthProfile(), getDealsCanonical()]);
  const dealCount = Array.isArray(rawDeals) ? rawDeals.length : 0;
  const identity = profile.fullName || profile.email || profile.id || copy.values.unavailable;
  const requestedCaseId = String(caseId || '').trim() || copy.values.unavailable;
  const task = profile.available
    ? {
        title: modeCopy.taskTitle,
        description: modeCopy.taskDescription,
        blocker: copy.blocker,
        impact: modeCopy.impact,
        result: modeCopy.result,
      }
    : copy.profileTask;

  const priority: OperationalPriority = {
    state: 'critical',
    title: task.title,
    description: task.description,
    blocker: task.blocker,
    owner: copy.owner,
    impact: task.impact,
    result: task.result,
    primaryAction: profile.available
      ? mode === 'index'
        ? <Link className={operationalCockpitClasses.primaryLink} href='/platform-v7/deals'>{copy.actions.deals}</Link>
        : <Link className={operationalCockpitClasses.primaryLink} href='/platform-v7/support'>{copy.actions.support}</Link>
      : <Link className={operationalCockpitClasses.primaryLink} href='/platform-v7/profile'>{copy.actions.profile}</Link>,
    secondaryAction: <Link className={operationalCockpitClasses.secondaryLink} href='/platform-v7/status'>{copy.actions.status}</Link>,
  };

  const facts = [
    { label: copy.facts.user, value: identity, hint: copy.facts.userHint },
    { label: copy.facts.organization, value: profile.orgId || copy.values.unavailable, hint: copy.facts.organizationHint },
    { label: copy.facts.deals, value: String(dealCount), hint: copy.facts.dealsHint },
    { label: copy.facts.staffRegistry, value: copy.values.registered, hint: copy.facts.staffRegistryHint },
    { label: copy.facts.participantApi, value: copy.values.unconfirmed, hint: copy.facts.participantApiHint },
    ...(mode === 'detail' ? [{ label: copy.facts.requestedCase, value: requestedCaseId, hint: copy.facts.requestedCaseHint }] : []),
  ];

  return (
    <OperationalDecisionCockpit
      testId={`platform-v7-support-${mode}-v8`}
      eyebrow={modeCopy.eyebrow}
      title={modeCopy.title}
      description={modeCopy.description}
      statusLabel={profile.available ? modeCopy.status : copy.profileStatus}
      statusTone='warning'
      priority={priority}
      facts={facts}
      boundary={copy.boundary}
      labels={copy.labels}
    >
      <InlineNotice tone='warning' title={modeCopy.noticeTitle}>{modeCopy.notice}</InlineNotice>
      <OperationalCockpitSection>
        <OperationalQueue>
          {copy.routes.map((route) => (
            <OperationalQueueLink
              key={route.href}
              href={route.href}
              title={route.title}
              detail={route.detail}
              status={<StatusChip tone={route.state === 'confirmed' ? 'success' : 'warning'}>{route.state === 'confirmed' ? copy.values.confirmed : copy.values.unconfirmed}</StatusChip>}
            />
          ))}
        </OperationalQueue>
      </OperationalCockpitSection>
      <OperationalCockpitSection>
        <InlineNotice tone='information' title={copy.boundaryTitle}>{copy.boundary}</InlineNotice>
      </OperationalCockpitSection>
    </OperationalDecisionCockpit>
  );
}
