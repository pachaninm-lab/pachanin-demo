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

type Locale = 'ru' | 'en' | 'zh';
type RouteState = 'confirmed' | 'unconfirmed';

type Copy = Readonly<{
  metadataTitle: string;
  metadataDescription: string;
  eyebrow: string;
  title: string;
  description: string;
  unavailableStatus: string;
  profileStatus: string;
  labels: Readonly<{
    blocker: string;
    owner: string;
    impact: string;
    result: string;
    nextAction: string;
    prioritySection: string;
    factsSection: string;
  }>;
  profileTask: Readonly<{ title: string; description: string; blocker: string; impact: string; result: string }>;
  authorityTask: Readonly<{ title: string; description: string; blocker: string; impact: string; result: string }>;
  owner: string;
  actions: Readonly<{ profile: string; bank: string; deals: string; status: string }>;
  facts: Readonly<{
    user: string;
    userHint: string;
    organization: string;
    organizationHint: string;
    deals: string;
    dealsHint: string;
    registry: string;
    registryHint: string;
  }>;
  values: Readonly<{ unavailable: string; unconfirmed: string; confirmed: string }>;
  noticeTitle: string;
  notice: string;
  boundaryTitle: string;
  boundary: string;
  routes: ReadonlyArray<Readonly<{ href: string; title: string; detail: string; state: RouteState }>>;
}>;

const COPY: Record<Locale, Copy> = {
  ru: {
    metadataTitle: 'Финансирование закупки · Прозрачная Цена',
    metadataDescription: 'Граница финансирования покупателя без фиктивных заявок, лимитов, ставок и клиентского кредитного решения.',
    eyebrow: 'Покупатель · финансирование',
    title: 'Заявка на финансирование — только через серверный и банковский контур',
    description: 'Экран не создаёт кредитную заявку, не рассчитывает лимит и не показывает решение банка. До появления tenant-scoped реестра, серверных команд и подтверждённого банковского адаптера доступна только граница будущего процесса.',
    unavailableStatus: 'Контур финансирования не подтверждён',
    profileStatus: 'Профиль не подтверждён',
    labels: {
      blocker: 'Блокер',
      owner: 'Ответственный',
      impact: 'Влияние',
      result: 'Результат',
      nextAction: 'Следующее действие',
      prioritySection: 'Главная задача',
      factsSection: 'Подтверждённые факты',
    },
    profileTask: {
      title: 'Восстановить подтверждённую серверную сессию',
      description: 'Пользователь, организация и роль недоступны через `/auth/me`. Интерфейс не назначает покупателя или организацию локально.',
      blocker: 'серверный профиль не подтверждён',
      impact: 'невозможно доказать полномочия на финансирование закупки',
      result: 'валидная сессия с buyer membership',
    },
    authorityTask: {
      title: 'Создать durable контур финансирования до включения формы',
      description: 'Нужны PostgreSQL-реестр заявок, версии условий, серверные команды, банковский договор и адаптер, идемпотентность, аудит, outbox и связь с канонической Сделкой.',
      blocker: 'нет подтверждённых financing API, durable registry и банковского адаптера',
      impact: 'нельзя безопасно принять заявку, лимит, ставку или кредитное решение',
      result: 'проверяемый tenant/RBAC workflow без браузерного денежного authority',
    },
    owner: 'Product / CTO / Bank Partnerships',
    actions: {
      profile: 'Открыть профиль доступа',
      bank: 'Открыть банковский контур',
      deals: 'Открыть Сделки',
      status: 'Проверить состояние системы',
    },
    facts: {
      user: 'Пользователь',
      userHint: 'только из активной серверной сессии',
      organization: 'Организация',
      organizationHint: 'orgId и tenant boundary из `/auth/me`',
      deals: 'Доступных Сделок',
      dealsHint: 'participant-scoped серверный реестр',
      registry: 'Реестр финансирования',
      registryHint: 'не подтверждён серверным API',
    },
    values: { unavailable: 'Недоступно', unconfirmed: 'Не подтверждён', confirmed: 'Подтверждено' },
    noticeTitle: 'Локальная кредитная симуляция удалена',
    notice: 'Удалены вымышленные заявки, кредитный лимит, ставка, статусы одобрения и UI-only подача формы. Пустой backend не заменяется данными браузера.',
    boundaryTitle: 'Граница финансирования',
    boundary: 'Браузер не создаёт заявку, не рассчитывает лимит, не назначает ставку и не отмечает одобрение или выдачу. Сервер должен проверить tenant, buyer membership, каноническую Сделку, версии условий, идемпотентность и optimistic concurrency, затем атомарно записать факты, audit и outbox. Решение банка поступает только через подтверждённый адаптер, callback и reconciliation.',
    routes: [
      { href: '/platform-v7/bank', title: 'Банковский контур', detail: 'Каноническая очередь оснований, блокеров и подтверждённых банковских событий.', state: 'confirmed' },
      { href: '/platform-v7/deals', title: 'Канонические Сделки', detail: 'Проверить Сделки, к которым в будущем может относиться финансирование.', state: 'confirmed' },
      { href: '/platform-v7/api-docs', title: 'Контракт financing API', detail: 'Публиковать только после реализации и проверки серверных контроллеров.', state: 'unconfirmed' },
    ],
  },
  en: {
    metadataTitle: 'Purchase financing · Transparent Price',
    metadataDescription: 'A buyer-financing boundary without fictional applications, limits, rates or client-owned credit decisions.',
    eyebrow: 'Buyer · financing',
    title: 'Submit financing applications only through server and bank authority',
    description: 'This screen does not create credit applications, calculate limits or display bank decisions. Until a tenant-scoped registry, server commands and a verified bank adapter exist, it exposes only the future process boundary.',
    unavailableStatus: 'Financing circuit not confirmed',
    profileStatus: 'Profile not confirmed',
    labels: {
      blocker: 'Blocker',
      owner: 'Owner',
      impact: 'Impact',
      result: 'Result',
      nextAction: 'Next action',
      prioritySection: 'Primary task',
      factsSection: 'Confirmed facts',
    },
    profileTask: {
      title: 'Restore a confirmed server session',
      description: 'User, organization and role are unavailable from `/auth/me`. The UI does not assign a buyer or organization locally.',
      blocker: 'server profile not confirmed',
      impact: 'purchase-financing authority cannot be proven',
      result: 'a valid session with buyer membership',
    },
    authorityTask: {
      title: 'Build a durable financing circuit before enabling the form',
      description: 'The platform needs a PostgreSQL application registry, versioned terms, server commands, a bank agreement and adapter, idempotency, audit, outbox and a canonical Deal link.',
      blocker: 'no confirmed financing API, durable registry or bank adapter',
      impact: 'an application, limit, rate or credit decision cannot be accepted safely',
      result: 'a verifiable tenant/RBAC workflow without browser-owned money authority',
    },
    owner: 'Product / CTO / Bank Partnerships',
    actions: {
      profile: 'Open access profile',
      bank: 'Open bank circuit',
      deals: 'Open Deals',
      status: 'Check system status',
    },
    facts: {
      user: 'User',
      userHint: 'from the active server session only',
      organization: 'Organization',
      organizationHint: 'orgId and tenant boundary from `/auth/me`',
      deals: 'Accessible Deals',
      dealsHint: 'participant-scoped server registry',
      registry: 'Financing registry',
      registryHint: 'not confirmed by a server API',
    },
    values: { unavailable: 'Unavailable', unconfirmed: 'Not confirmed', confirmed: 'Confirmed' },
    noticeTitle: 'The local credit simulation was removed',
    notice: 'Fictional applications, credit limits, rates, approval states and the UI-only submission form were removed. An empty backend is not replaced with browser data.',
    boundaryTitle: 'Financing boundary',
    boundary: 'The browser does not create an application, calculate a limit, assign a rate or mark approval or disbursement. The server must verify tenant, buyer membership, canonical Deal, term versions, idempotency and optimistic concurrency, then atomically write facts, audit and outbox. A bank decision arrives only through a verified adapter, callback and reconciliation.',
    routes: [
      { href: '/platform-v7/bank', title: 'Bank circuit', detail: 'Canonical queue of bases, blockers and confirmed bank events.', state: 'confirmed' },
      { href: '/platform-v7/deals', title: 'Canonical Deals', detail: 'Inspect Deals that may later be linked to financing.', state: 'confirmed' },
      { href: '/platform-v7/api-docs', title: 'Financing API contract', detail: 'Publish only after server controllers are implemented and verified.', state: 'unconfirmed' },
    ],
  },
  zh: {
    metadataTitle: '采购融资 · 透明价格',
    metadataDescription: '不展示虚构申请、额度、利率或客户端信贷决定的买方融资边界。',
    eyebrow: '买方 · 融资',
    title: '仅通过服务器和银行权威提交融资申请',
    description: '该页面不会创建信贷申请、计算额度或展示银行决定。在 tenant-scoped 登记册、服务器命令和已验证银行适配器建立之前，仅展示未来流程边界。',
    unavailableStatus: '融资闭环未确认',
    profileStatus: '档案未确认',
    labels: {
      blocker: '阻塞项',
      owner: '负责人',
      impact: '影响',
      result: '结果',
      nextAction: '下一步',
      prioritySection: '主要任务',
      factsSection: '已确认事实',
    },
    profileTask: {
      title: '恢复已确认的服务器会话',
      description: '无法从 `/auth/me` 获取用户、组织和角色。界面不会在本地分配买方或组织。',
      blocker: '服务器档案未确认',
      impact: '无法证明采购融资权限',
      result: '包含 buyer membership 的有效会话',
    },
    authorityTask: {
      title: '启用表单前建立持久化融资闭环',
      description: '需要 PostgreSQL 申请登记册、条款版本、服务器命令、银行协议和适配器、幂等、审计、outbox 以及与规范交易的关联。',
      blocker: '没有已确认的 financing API、持久登记册或银行适配器',
      impact: '无法安全接收申请、额度、利率或信贷决定',
      result: '不依赖浏览器资金权威的可验证 tenant/RBAC 工作流',
    },
    owner: 'Product / CTO / 银行合作',
    actions: {
      profile: '打开访问档案',
      bank: '打开银行闭环',
      deals: '打开交易',
      status: '检查系统状态',
    },
    facts: {
      user: '用户',
      userHint: '仅来自活动服务器会话',
      organization: '组织',
      organizationHint: '来自 `/auth/me` 的 orgId 和 tenant 边界',
      deals: '可访问交易',
      dealsHint: '参与方范围服务器登记册',
      registry: '融资登记册',
      registryHint: '未由服务器 API 确认',
    },
    values: { unavailable: '不可用', unconfirmed: '未确认', confirmed: '已确认' },
    noticeTitle: '本地信贷模拟已删除',
    notice: '已删除虚构申请、信贷额度、利率、审批状态和仅由界面处理的提交表单。空 backend 不会由浏览器数据替代。',
    boundaryTitle: '融资边界',
    boundary: '浏览器不会创建申请、计算额度、指定利率或标记批准和放款。服务器必须验证 tenant、buyer membership、规范交易、条款版本、幂等和乐观并发，然后原子写入事实、audit 和 outbox。银行决定只能通过已验证适配器、callback 和 reconciliation 到达。',
    routes: [
      { href: '/platform-v7/bank', title: '银行闭环', detail: '规范的依据、阻塞项和已确认银行事件队列。', state: 'confirmed' },
      { href: '/platform-v7/deals', title: '规范交易', detail: '查看未来可能关联融资的交易。', state: 'confirmed' },
      { href: '/platform-v7/api-docs', title: '融资 API 合同', detail: '仅在服务器控制器实现并验证后发布。', state: 'unconfirmed' },
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

export default async function BuyerFinancingPage() {
  const copy = COPY[localeOf(await getLocale())];
  const [profile, rawDeals] = await Promise.all([getAuthProfile(), getDealsCanonical()]);
  const dealCount = Array.isArray(rawDeals) ? rawDeals.length : 0;
  const identity = profile.fullName || profile.email || profile.id || copy.values.unavailable;
  const task = profile.available ? copy.authorityTask : copy.profileTask;
  const priority: OperationalPriority = {
    state: 'critical',
    title: task.title,
    description: task.description,
    blocker: task.blocker,
    owner: copy.owner,
    impact: task.impact,
    result: task.result,
    primaryAction: profile.available
      ? <Link className={operationalCockpitClasses.primaryLink} href='/platform-v7/bank'>{copy.actions.bank}</Link>
      : <Link className={operationalCockpitClasses.primaryLink} href='/platform-v7/profile'>{copy.actions.profile}</Link>,
    secondaryAction: profile.available
      ? <Link className={operationalCockpitClasses.secondaryLink} href='/platform-v7/deals'>{copy.actions.deals}</Link>
      : <Link className={operationalCockpitClasses.secondaryLink} href='/platform-v7/status'>{copy.actions.status}</Link>,
  };

  return (
    <OperationalDecisionCockpit
      testId='platform-v7-buyer-financing-v8'
      eyebrow={copy.eyebrow}
      title={copy.title}
      description={copy.description}
      statusLabel={profile.available ? copy.unavailableStatus : copy.profileStatus}
      statusTone='warning'
      priority={priority}
      facts={[
        { label: copy.facts.user, value: identity, hint: copy.facts.userHint },
        { label: copy.facts.organization, value: profile.orgId || copy.values.unavailable, hint: copy.facts.organizationHint },
        { label: copy.facts.deals, value: String(dealCount), hint: copy.facts.dealsHint },
        { label: copy.facts.registry, value: copy.values.unconfirmed, hint: copy.facts.registryHint },
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
