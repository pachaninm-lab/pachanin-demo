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
import { PLATFORM_V7_BANK_ROUTE, PLATFORM_V7_DEALS_ROUTE, PLATFORM_V7_STATUS_ROUTE } from '@/lib/platform-v7/routes';

type Locale = 'ru' | 'en' | 'zh';
type RouteState = 'confirmed' | 'unconfirmed';
type TaskCopy = Readonly<{ title: string; description: string; blocker: string; impact: string; result: string }>;
type Copy = Readonly<{
  metadataTitle: string;
  metadataDescription: string;
  eyebrow: string;
  title: string;
  description: string;
  statusUnavailable: string;
  statusProfileUnavailable: string;
  labels: Readonly<{ blocker: string; owner: string; impact: string; result: string; nextAction: string; prioritySection: string; factsSection: string }>;
  profile: TaskCopy;
  authority: TaskCopy;
  ownerValue: string;
  actions: Readonly<{ profile: string; bank: string; deals: string; status: string }>;
  facts: Readonly<{ user: string; userHint: string; organization: string; organizationHint: string; deals: string; dealsHint: string; registry: string; registryHint: string }>;
  values: Readonly<{ unavailable: string; notConfirmed: string; confirmed: string }>;
  noticeTitle: string;
  notice: string;
  boundaryTitle: string;
  boundary: string;
  routes: ReadonlyArray<Readonly<{ href: string; title: string; detail: string; state: RouteState }>>;
}>;

const COPY: Record<Locale, Copy> = {
  ru: {
    metadataTitle: 'Факторинг · Прозрачная Цена',
    metadataDescription: 'Граница факторинга без фиктивных лимитов, заявок, одобрений и клиентских денежных переходов.',
    eyebrow: 'Банк · факторинг',
    title: 'Факторинг включается только после серверного и банковского контракта',
    description: 'Здесь нет демонстрационных заявок, расчётных лимитов и локального изменения статуса финансирования. Пока реестр, команды и банковский адаптер не подтверждены, работа продолжается через каноническую Сделку и банковский контур.',
    statusUnavailable: 'Факторинг не подтверждён',
    statusProfileUnavailable: 'Профиль не подтверждён',
    labels: { blocker: 'Блокер', owner: 'Ответственный', impact: 'Влияние', result: 'Результат', nextAction: 'Следующее действие', prioritySection: 'Главная задача финансирования', factsSection: 'Подтверждённые факты' },
    profile: { title: 'Восстановить подтверждённую серверную сессию', description: 'Пользователь и организация недоступны через `/auth/me`. Интерфейс не назначает банковскую роль или организацию локально.', blocker: 'серверный профиль не подтверждён', impact: 'нельзя доказать полномочия на банковский контур', result: 'валидная сессия с разрешённым доступом' },
    authority: { title: 'Подтвердить промышленный контур факторинга до включения операций', description: 'Нужны tenant-scoped PostgreSQL-реестр заявок, серверные команды, версии условий уступки, банковский скоринг, callbacks, reconciliation, audit/outbox и атомарная связь с канонической Сделкой.', blocker: 'нет подтверждённых factoring read/write API и банковского адаптера', impact: 'лимит, одобрение и аванс нельзя считать фактом', result: 'идемпотентный factoring workflow с RBAC, аудитом и банковским подтверждением' },
    ownerValue: 'Product / CTO / банк-партнёр',
    actions: { profile: 'Открыть профиль доступа', bank: 'Открыть банковский контур', deals: 'Открыть Сделки', status: 'Проверить состояние системы' },
    facts: { user: 'Пользователь', userHint: 'только из активной серверной сессии', organization: 'Организация', organizationHint: 'orgId и tenant boundary из `/auth/me`', deals: 'Доступных Сделок', dealsHint: 'participant-scoped серверный реестр', registry: 'Реестр факторинга', registryHint: 'не подтверждён серверным API' },
    values: { unavailable: 'Недоступно', notConfirmed: 'Не подтверждён', confirmed: 'Подтверждено' },
    noticeTitle: 'Локальная симуляция финансирования удалена',
    notice: 'Удалены вымышленные заявки FAC-*, лимит 48 млн ₽, ставка, локальный скоринг, принятие пакета и отметка аванса. Пустой backend не заменяется браузерным состоянием.',
    boundaryTitle: 'Граница факторинга',
    boundary: 'Браузер не создаёт заявку, не меняет скоринг, не подтверждает уступку и не отмечает аванс. Серверная команда обязана проверять membership, tenant, полномочия, идемпотентность и optimistic concurrency, писать audit/outbox и принимать банковский результат только через аутентифицированный callback с reconciliation.',
    routes: [
      { href: PLATFORM_V7_BANK_ROUTE, title: 'Банковский контур', detail: 'Подтверждённая очередь оснований, блокеров и следующих действий.', state: 'confirmed' },
      { href: PLATFORM_V7_DEALS_ROUTE, title: 'Канонические Сделки', detail: 'Проверить договорное и документное основание финансирования.', state: 'confirmed' },
      { href: '/platform-v7/api-docs', title: 'Контракт factoring API', detail: 'Публиковать только после реализации и проверки контроллеров.', state: 'unconfirmed' },
      { href: PLATFORM_V7_STATUS_ROUTE, title: 'Статус интеграций', detail: 'Проверить подтверждённые зависимости без fake-live.', state: 'confirmed' },
    ],
  },
  en: {
    metadataTitle: 'Factoring · Transparent Price',
    metadataDescription: 'A factoring boundary without fictional limits, applications, approvals or client-owned money transitions.',
    eyebrow: 'Bank · factoring',
    title: 'Enable factoring only after server and bank contracts are accepted',
    description: 'This page contains no demonstration applications, estimated limits or local financing-state changes. Until the registry, commands and bank adapter are confirmed, work continues through the canonical Deal and bank workspace.',
    statusUnavailable: 'Factoring not confirmed',
    statusProfileUnavailable: 'Profile not confirmed',
    labels: { blocker: 'Blocker', owner: 'Owner', impact: 'Impact', result: 'Result', nextAction: 'Next action', prioritySection: 'Primary financing task', factsSection: 'Confirmed facts' },
    profile: { title: 'Restore a confirmed server session', description: 'The user and organization are unavailable from `/auth/me`. The UI does not assign a bank role or organization locally.', blocker: 'server profile not confirmed', impact: 'authority for the bank circuit cannot be proven', result: 'a valid session with permitted access' },
    authority: { title: 'Accept an industrial factoring circuit before enabling operations', description: 'The platform needs a tenant-scoped PostgreSQL application registry, server commands, assignment-term versions, bank scoring, callbacks, reconciliation, audit/outbox and an atomic link to the canonical Deal.', blocker: 'no confirmed factoring read/write API or bank adapter', impact: 'a limit, approval or advance cannot be treated as a fact', result: 'an idempotent factoring workflow with RBAC, audit and bank confirmation' },
    ownerValue: 'Product / CTO / bank partner',
    actions: { profile: 'Open access profile', bank: 'Open bank workspace', deals: 'Open Deals', status: 'Check system status' },
    facts: { user: 'User', userHint: 'from the active server session only', organization: 'Organization', organizationHint: 'orgId and tenant boundary from `/auth/me`', deals: 'Accessible Deals', dealsHint: 'participant-scoped server registry', registry: 'Factoring registry', registryHint: 'not confirmed by a server API' },
    values: { unavailable: 'Unavailable', notConfirmed: 'Not confirmed', confirmed: 'Confirmed' },
    noticeTitle: 'The local financing simulation was removed',
    notice: 'Fictional FAC-* applications, the RUB 48 million limit, rate, local scoring, package acceptance and advance marking were removed. An empty backend is not replaced with browser state.',
    boundaryTitle: 'Factoring boundary',
    boundary: 'The browser does not create an application, change scoring, confirm an assignment or mark an advance. A server command must verify membership, tenant, authority, idempotency and optimistic concurrency, write audit/outbox records and accept a bank result only through an authenticated callback with reconciliation.',
    routes: [
      { href: PLATFORM_V7_BANK_ROUTE, title: 'Bank workspace', detail: 'Confirmed queue of bases, blockers and next actions.', state: 'confirmed' },
      { href: PLATFORM_V7_DEALS_ROUTE, title: 'Canonical Deals', detail: 'Verify the contractual and document basis for financing.', state: 'confirmed' },
      { href: '/platform-v7/api-docs', title: 'Factoring API contract', detail: 'Publish only after controllers are implemented and verified.', state: 'unconfirmed' },
      { href: PLATFORM_V7_STATUS_ROUTE, title: 'Integration status', detail: 'Review confirmed dependencies without fake-live.', state: 'confirmed' },
    ],
  },
  zh: {
    metadataTitle: '保理 · 透明价格',
    metadataDescription: '不展示虚构额度、申请、审批或客户端资金状态迁移的保理边界。',
    eyebrow: '银行 · 保理',
    title: '仅在服务器和银行合同验收后启用保理',
    description: '该页面不包含演示申请、估算额度或本地融资状态变更。在登记册、命令和银行适配器得到确认之前，工作通过规范交易和银行工作区继续进行。',
    statusUnavailable: '保理未确认',
    statusProfileUnavailable: '档案未确认',
    labels: { blocker: '阻塞项', owner: '负责人', impact: '影响', result: '结果', nextAction: '下一步', prioritySection: '主要融资任务', factsSection: '已确认事实' },
    profile: { title: '恢复已确认的服务器会话', description: '无法从 `/auth/me` 获取用户和组织。界面不会在本地指定银行角色或组织。', blocker: '服务器档案未确认', impact: '无法证明银行闭环权限', result: '具有许可访问权限的有效会话' },
    authority: { title: '启用操作前验收工业级保理闭环', description: '需要 tenant-scoped PostgreSQL 申请登记册、服务器命令、债权转让条件版本、银行评分、回调、对账、audit/outbox，以及与规范交易的原子关联。', blocker: '没有已确认的保理读写 API 和银行适配器', impact: '额度、审批和预付款不能视为事实', result: '具备 RBAC、审计和银行确认的幂等保理工作流' },
    ownerValue: 'Product / CTO / 银行合作方',
    actions: { profile: '打开访问档案', bank: '打开银行工作区', deals: '打开交易', status: '检查系统状态' },
    facts: { user: '用户', userHint: '仅来自活动服务器会话', organization: '组织', organizationHint: '来自 `/auth/me` 的 orgId 和 tenant 边界', deals: '可访问交易', dealsHint: '参与方范围服务器登记册', registry: '保理登记册', registryHint: '未由服务器 API 确认' },
    values: { unavailable: '不可用', notConfirmed: '未确认', confirmed: '已确认' },
    noticeTitle: '本地融资模拟已删除',
    notice: '已删除虚构 FAC-* 申请、4800 万卢布额度、利率、本地评分、材料验收和预付款标记。空 backend 不会由浏览器状态替代。',
    boundaryTitle: '保理边界',
    boundary: '浏览器不会创建申请、修改评分、确认债权转让或标记预付款。服务器命令必须验证 membership、tenant、权限、幂等和乐观并发，写入 audit/outbox，并且只能通过带 reconciliation 的认证银行回调接受结果。',
    routes: [
      { href: PLATFORM_V7_BANK_ROUTE, title: '银行工作区', detail: '已确认的依据、阻塞项和下一步队列。', state: 'confirmed' },
      { href: PLATFORM_V7_DEALS_ROUTE, title: '规范交易', detail: '核验融资的合同和文档依据。', state: 'confirmed' },
      { href: '/platform-v7/api-docs', title: '保理 API 合同', detail: '仅在控制器实现并验证后发布。', state: 'unconfirmed' },
      { href: PLATFORM_V7_STATUS_ROUTE, title: '集成状态', detail: '在不制造 fake-live 的情况下查看已确认依赖。', state: 'confirmed' },
    ],
  },
};

function localeOf(value: string): Locale {
  if (value.startsWith('en')) return 'en';
  if (value.startsWith('zh')) return 'zh';
  return 'ru';
}

export async function generateMetadata(): Promise<Metadata> {
  const copy = COPY[localeOf(await getLocale())];
  return { title: copy.metadataTitle, description: copy.metadataDescription, robots: { index: false, follow: false } };
}

export default async function BankFactoringPage() {
  const copy = COPY[localeOf(await getLocale())];
  const [profile, rawDeals] = await Promise.all([getAuthProfile(), getDealsCanonical()]);
  const dealCount = Array.isArray(rawDeals) ? rawDeals.length : 0;
  const identity = profile.fullName || profile.email || profile.id || copy.values.unavailable;
  const task = profile.available ? copy.authority : copy.profile;
  const priority: OperationalPriority = {
    state: 'critical',
    title: task.title,
    description: task.description,
    blocker: task.blocker,
    owner: copy.ownerValue,
    impact: task.impact,
    result: task.result,
    primaryAction: profile.available
      ? <Link className={operationalCockpitClasses.primaryLink} href={PLATFORM_V7_BANK_ROUTE}>{copy.actions.bank}</Link>
      : <Link className={operationalCockpitClasses.primaryLink} href='/platform-v7/profile'>{copy.actions.profile}</Link>,
    secondaryAction: profile.available
      ? <Link className={operationalCockpitClasses.secondaryLink} href={PLATFORM_V7_DEALS_ROUTE}>{copy.actions.deals}</Link>
      : <Link className={operationalCockpitClasses.secondaryLink} href={PLATFORM_V7_STATUS_ROUTE}>{copy.actions.status}</Link>,
  };

  return (
    <OperationalDecisionCockpit
      testId='platform-v7-bank-factoring-v8'
      eyebrow={copy.eyebrow}
      title={copy.title}
      description={copy.description}
      statusLabel={profile.available ? copy.statusUnavailable : copy.statusProfileUnavailable}
      statusTone='warning'
      priority={priority}
      facts={[
        { label: copy.facts.user, value: identity, hint: copy.facts.userHint },
        { label: copy.facts.organization, value: profile.orgId || copy.values.unavailable, hint: copy.facts.organizationHint },
        { label: copy.facts.deals, value: String(dealCount), hint: copy.facts.dealsHint },
        { label: copy.facts.registry, value: copy.values.notConfirmed, hint: copy.facts.registryHint },
      ]}
      boundary={copy.boundary}
      labels={copy.labels}
    >
      <InlineNotice tone='warning' title={copy.noticeTitle}>{copy.notice}</InlineNotice>
      <OperationalCockpitSection>
        <OperationalQueue>
          {copy.routes.map((route) => (
            <OperationalQueueLink
              key={route.href}
              href={route.href}
              title={route.title}
              detail={route.detail}
              status={<StatusChip tone={route.state === 'confirmed' ? 'success' : 'warning'}>{route.state === 'confirmed' ? copy.values.confirmed : copy.values.notConfirmed}</StatusChip>}
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
