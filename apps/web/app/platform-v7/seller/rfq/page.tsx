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
  labels: Readonly<{ blocker: string; owner: string; impact: string; result: string; nextAction: string; prioritySection: string; factsSection: string }>;
  profileTask: Readonly<{ title: string; description: string; blocker: string; impact: string; result: string }>;
  authorityTask: Readonly<{ title: string; description: string; blocker: string; impact: string; result: string }>;
  owner: string;
  actions: Readonly<{ profile: string; auction: string; deals: string; status: string }>;
  facts: Readonly<{ user: string; userHint: string; organization: string; organizationHint: string; deals: string; dealsHint: string; registry: string; registryHint: string }>;
  values: Readonly<{ unavailable: string; unconfirmed: string; confirmed: string }>;
  noticeTitle: string;
  notice: string;
  boundaryTitle: string;
  boundary: string;
  routes: ReadonlyArray<Readonly<{ href: string; title: string; detail: string; state: RouteState }>>;
}>;

const COPY: Record<Locale, Copy> = {
  ru: {
    metadataTitle: 'Запросы покупателей · Прозрачная Цена',
    metadataDescription: 'Граница ответа продавца на RFQ без фиктивного совпадения, предложения и клиентского создания Сделки.',
    eyebrow: 'Продавец · запросы покупателей',
    title: 'Отвечать на RFQ только через серверный торговый контур',
    description: 'Экран не рассчитывает совпадение, не отправляет предложение и не создаёт черновик Сделки. До появления tenant-scoped RFQ registry и серверных команд доступна только граница будущего процесса.',
    unavailableStatus: 'Seller RFQ-контур не подтверждён',
    profileStatus: 'Профиль не подтверждён',
    labels: { blocker: 'Блокер', owner: 'Ответственный', impact: 'Влияние', result: 'Результат', nextAction: 'Следующее действие', prioritySection: 'Главная задача', factsSection: 'Подтверждённые факты' },
    profileTask: {
      title: 'Восстановить подтверждённую серверную сессию',
      description: 'Пользователь, организация и роль недоступны через `/auth/me`. Интерфейс не назначает продавца или организацию локально.',
      blocker: 'серверный профиль не подтверждён',
      impact: 'невозможно доказать полномочия на ответ по закупочному запросу',
      result: 'валидная сессия с seller membership',
    },
    authorityTask: {
      title: 'Создать durable RFQ-response контур до включения действий',
      description: 'Нужны PostgreSQL-реестр запросов и ответов, версии условий, связь с партией и лотом, серверные команды, допуск, идемпотентность, аудит, outbox и атомарный переход принятого предложения в каноническую Сделку.',
      blocker: 'нет подтверждённых seller RFQ API, durable registry и command authority',
      impact: 'нельзя безопасно рассчитать совпадение, отправить предложение или создать Сделку',
      result: 'проверяемый tenant/RBAC workflow без browser-owned trading state',
    },
    owner: 'Product / CTO / Trading Operations',
    actions: { profile: 'Открыть профиль доступа', auction: 'Открыть аукцион', deals: 'Открыть Сделки', status: 'Проверить состояние системы' },
    facts: { user: 'Пользователь', userHint: 'только из активной серверной сессии', organization: 'Организация', organizationHint: 'orgId и tenant boundary из `/auth/me`', deals: 'Доступных Сделок', dealsHint: 'participant-scoped серверный реестр', registry: 'Seller RFQ-реестр', registryHint: 'не подтверждён серверным API' },
    values: { unavailable: 'Недоступно', unconfirmed: 'Не подтверждён', confirmed: 'Подтверждено' },
    noticeTitle: 'Фиктивный подбор и черновик удалены',
    notice: 'Удалены совпадение 85%+, локальное создание предложения и фиктивный `DD-OFFER-1`. Пустой backend не заменяется карточками и переходами из браузера.',
    boundaryTitle: 'Граница ответа на RFQ',
    boundary: 'Браузер не рассчитывает совпадение, не отправляет предложение и не создаёт DealDraft. Сервер должен проверить tenant, seller membership, партию или лот, версию RFQ, допуск, идемпотентность и optimistic concurrency, затем атомарно записать ответ, audit и outbox. Принятое предложение создаёт каноническую Сделку только серверной командой.',
    routes: [
      { href: '/platform-v7/auction', title: 'Аукцион', detail: 'Подтверждённый торговый контур лотов, допуска и ставок.', state: 'confirmed' },
      { href: '/platform-v7/deals', title: 'Канонические Сделки', detail: 'Продолжить исполнение уже доступных продавцу Сделок.', state: 'confirmed' },
      { href: '/platform-v7/api-docs', title: 'Контракт seller RFQ API', detail: 'Публиковать только после реализации и проверки серверных контроллеров.', state: 'unconfirmed' },
    ],
  },
  en: {
    metadataTitle: 'Buyer requests · Transparent Price',
    metadataDescription: 'A seller RFQ-response boundary without fictional matching, offers or client-created Deals.',
    eyebrow: 'Seller · buyer requests',
    title: 'Respond to RFQs only through server trading authority',
    description: 'This screen does not calculate matches, submit offers or create Deal drafts. Until a tenant-scoped RFQ registry and server commands exist, it exposes only the future process boundary.',
    unavailableStatus: 'Seller RFQ circuit not confirmed',
    profileStatus: 'Profile not confirmed',
    labels: { blocker: 'Blocker', owner: 'Owner', impact: 'Impact', result: 'Result', nextAction: 'Next action', prioritySection: 'Primary task', factsSection: 'Confirmed facts' },
    profileTask: {
      title: 'Restore a confirmed server session',
      description: 'User, organization and role are unavailable from `/auth/me`. The UI does not assign a seller or organization locally.',
      blocker: 'server profile not confirmed',
      impact: 'authority to answer a procurement request cannot be proven',
      result: 'a valid session with seller membership',
    },
    authorityTask: {
      title: 'Build a durable RFQ-response circuit before enabling actions',
      description: 'The platform needs PostgreSQL request and response registries, versioned terms, batch and lot linkage, server commands, admission, idempotency, audit, outbox and an atomic accepted-offer handoff into the canonical Deal.',
      blocker: 'no confirmed seller RFQ API, durable registry or command authority',
      impact: 'matching, offer submission and Deal creation cannot be performed safely',
      result: 'a verifiable tenant/RBAC workflow without browser-owned trading state',
    },
    owner: 'Product / CTO / Trading Operations',
    actions: { profile: 'Open access profile', auction: 'Open auction', deals: 'Open Deals', status: 'Check system status' },
    facts: { user: 'User', userHint: 'from the active server session only', organization: 'Organization', organizationHint: 'orgId and tenant boundary from `/auth/me`', deals: 'Accessible Deals', dealsHint: 'participant-scoped server registry', registry: 'Seller RFQ registry', registryHint: 'not confirmed by a server API' },
    values: { unavailable: 'Unavailable', unconfirmed: 'Not confirmed', confirmed: 'Confirmed' },
    noticeTitle: 'Fictional matching and draft removed',
    notice: 'The 85%+ match, local offer creation and fictional `DD-OFFER-1` were removed. An empty backend is not replaced with browser cards and transitions.',
    boundaryTitle: 'RFQ-response boundary',
    boundary: 'The browser does not calculate matching, submit an offer or create a DealDraft. The server must verify tenant, seller membership, batch or lot, RFQ version, admission, idempotency and optimistic concurrency, then atomically write the response, audit and outbox. An accepted offer creates the canonical Deal only through a server command.',
    routes: [
      { href: '/platform-v7/auction', title: 'Auction', detail: 'Confirmed trading circuit for lots, admission and bids.', state: 'confirmed' },
      { href: '/platform-v7/deals', title: 'Canonical Deals', detail: 'Continue execution of Deals already accessible to the seller.', state: 'confirmed' },
      { href: '/platform-v7/api-docs', title: 'Seller RFQ API contract', detail: 'Publish only after server controllers are implemented and verified.', state: 'unconfirmed' },
    ],
  },
  zh: {
    metadataTitle: '买方请求 · 透明价格',
    metadataDescription: '不展示虚构匹配、报价或客户端创建交易的卖方 RFQ 响应边界。',
    eyebrow: '卖方 · 买方请求',
    title: '仅通过服务器交易权威响应 RFQ',
    description: '该页面不会计算匹配、提交报价或创建交易草稿。在 tenant-scoped RFQ 登记册和服务器命令建立之前，仅展示未来流程边界。',
    unavailableStatus: '卖方 RFQ 闭环未确认',
    profileStatus: '档案未确认',
    labels: { blocker: '阻塞项', owner: '负责人', impact: '影响', result: '结果', nextAction: '下一步', prioritySection: '主要任务', factsSection: '已确认事实' },
    profileTask: {
      title: '恢复已确认的服务器会话',
      description: '无法从 `/auth/me` 获取用户、组织和角色。界面不会在本地分配卖方或组织。',
      blocker: '服务器档案未确认',
      impact: '无法证明响应采购请求的权限',
      result: '包含 seller membership 的有效会话',
    },
    authorityTask: {
      title: '启用操作前建立持久化 RFQ 响应闭环',
      description: '需要 PostgreSQL 请求和响应登记册、条款版本、批次和地块关联、服务器命令、准入、幂等、审计、outbox，以及将已接受报价原子转换为规范交易。',
      blocker: '没有已确认的 seller RFQ API、持久登记册或命令权威',
      impact: '无法安全执行匹配、提交报价或创建交易',
      result: '不依赖浏览器交易状态的可验证 tenant/RBAC 工作流',
    },
    owner: 'Product / CTO / 交易运营',
    actions: { profile: '打开访问档案', auction: '打开拍卖', deals: '打开交易', status: '检查系统状态' },
    facts: { user: '用户', userHint: '仅来自活动服务器会话', organization: '组织', organizationHint: '来自 `/auth/me` 的 orgId 和 tenant 边界', deals: '可访问交易', dealsHint: '参与方范围服务器登记册', registry: '卖方 RFQ 登记册', registryHint: '未由服务器 API 确认' },
    values: { unavailable: '不可用', unconfirmed: '未确认', confirmed: '已确认' },
    noticeTitle: '虚构匹配和草稿已删除',
    notice: '已删除 85%+ 匹配、本地报价创建和虚构的 `DD-OFFER-1`。空 backend 不会被浏览器卡片和状态转换替代。',
    boundaryTitle: 'RFQ 响应边界',
    boundary: '浏览器不会计算匹配、提交报价或创建 DealDraft。服务器必须验证 tenant、seller membership、批次或地块、RFQ 版本、准入、幂等和乐观并发，然后原子写入响应、audit 和 outbox。已接受报价只能通过服务器命令创建规范交易。',
    routes: [
      { href: '/platform-v7/auction', title: '拍卖', detail: '已确认的地块、准入和出价交易闭环。', state: 'confirmed' },
      { href: '/platform-v7/deals', title: '规范交易', detail: '继续执行卖方已可访问的交易。', state: 'confirmed' },
      { href: '/platform-v7/api-docs', title: '卖方 RFQ API 合同', detail: '仅在服务器控制器实现并验证后发布。', state: 'unconfirmed' },
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

export default async function SellerRfqPage() {
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
      ? <Link className={operationalCockpitClasses.primaryLink} href='/platform-v7/auction'>{copy.actions.auction}</Link>
      : <Link className={operationalCockpitClasses.primaryLink} href='/platform-v7/profile'>{copy.actions.profile}</Link>,
    secondaryAction: profile.available
      ? <Link className={operationalCockpitClasses.secondaryLink} href='/platform-v7/deals'>{copy.actions.deals}</Link>
      : <Link className={operationalCockpitClasses.secondaryLink} href='/platform-v7/status'>{copy.actions.status}</Link>,
  };

  return (
    <OperationalDecisionCockpit
      testId='platform-v7-seller-rfq-v8'
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
