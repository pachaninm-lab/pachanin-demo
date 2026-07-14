import type { Metadata } from 'next';
import Link from 'next/link';
import { getLocale } from 'next-intl/server';
import { InlineNotice, StatusChip } from '@pc/design-system-v8';
import { getAuthProfile } from '@/lib/auth-profile-server';
import { getDealsCanonical } from '@/lib/deals-server';
import {
  OperationalCockpitSection,
  OperationalDecisionCockpit,
  OperationalQueue,
  OperationalQueueLink,
  operationalCockpitClasses,
  type OperationalPriority,
} from '@/components/transaction-ux/OperationalDecisionCockpit';

type Locale = 'ru' | 'en' | 'zh';
type RouteState = 'confirmed' | 'unconfirmed';

type Copy = Readonly<{
  metadataTitle: string;
  metadataDescription: string;
  eyebrow: string;
  title: string;
  description: string;
  statusUnavailable: string;
  statusProfileUnavailable: string;
  labels: Readonly<{ blocker: string; owner: string; impact: string; result: string; nextAction: string; prioritySection: string; factsSection: string }>;
  profile: Readonly<{ title: string; description: string; blocker: string; impact: string; result: string }>;
  authority: Readonly<{ title: string; description: string; blocker: string; impact: string; result: string }>;
  ownerValue: string;
  actions: Readonly<{ profile: string; auction: string; deals: string; status: string }>;
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
    metadataTitle: 'Закупочные запросы · Прозрачная Цена',
    metadataDescription: 'Граница закупочного запроса без фиктивных RFQ, предложений и клиентского создания Сделки.',
    eyebrow: 'Покупатель · закупочный запрос',
    title: 'Создавать RFQ только через серверный контур',
    description: 'Здесь нет демонстрационных запросов, локальной формы и фиктивных предложений. До появления tenant-scoped реестра и команд RFQ покупатель работает через подтверждённые аукционы и канонические Сделки.',
    statusUnavailable: 'RFQ-контур не подтверждён',
    statusProfileUnavailable: 'профиль не подтверждён',
    labels: { blocker: 'Блокер', owner: 'Ответственный', impact: 'Влияние', result: 'Результат', nextAction: 'Следующее действие', prioritySection: 'Главная задача закупки', factsSection: 'Подтверждённые факты' },
    profile: {
      title: 'Восстановить подтверждённую серверную сессию',
      description: 'Пользователь, организация и роль недоступны через `/auth/me`. Интерфейс не подставляет покупателя и организацию локально.',
      blocker: 'серверный профиль не подтверждён',
      impact: 'нельзя доказать полномочия на закупку',
      result: 'валидная сессия с buyer membership',
    },
    authority: {
      title: 'Создать промышленный RFQ-контур до включения формы',
      description: 'Нужны PostgreSQL-реестр запросов, серверная команда создания, версии условий, допуск участников, аудит и переход принятого предложения в каноническую Сделку.',
      blocker: 'нет подтверждённых RFQ read/write API и durable registry',
      impact: 'невозможно безопасно создать и воспроизвести закупочный запрос',
      result: 'идемпотентный RFQ workflow с tenant/RBAC и Deal handoff',
    },
    ownerValue: 'Product / CTO / владелец закупочного контура',
    actions: { profile: 'Открыть профиль доступа', auction: 'Открыть аукцион', deals: 'Открыть Сделки', status: 'Проверить состояние системы' },
    facts: { user: 'Пользователь', userHint: 'только из активной серверной сессии', organization: 'Организация', organizationHint: 'orgId и tenant boundary из `/auth/me`', deals: 'Доступных Сделок', dealsHint: 'participant-scoped серверный реестр', registry: 'RFQ-реестр', registryHint: 'не подтверждён серверным API' },
    values: { unavailable: 'Недоступно', notConfirmed: 'Не подтверждён', confirmed: 'Подтверждено' },
    noticeTitle: 'Фиктивный закупочный контур удалён',
    notice: 'Удалены статические RFQ, локальные формы, вымышленные партии, предложения и переходы. Пустой backend не заменяется данными из mock-файлов или браузерного store.',
    boundaryTitle: 'Граница RFQ',
    boundary: 'Браузер не создаёт закупочный запрос, не назначает поставщиков и не превращает предложение в Сделку. Серверная команда должна проверять buyer membership, tenant, допуск, идемпотентность, optimistic concurrency и оставлять audit/outbox. Принятое предложение создаёт каноническую Сделку атомарно.',
    routes: [
      { href: '/platform-v7/auction', title: 'Аукцион', detail: 'Подтверждённый маршрут торгов и ставок без локального RFQ.', state: 'confirmed' },
      { href: '/platform-v7/deals', title: 'Канонические Сделки', detail: 'Продолжить исполнение уже доступных покупателю Сделок.', state: 'confirmed' },
      { href: '/platform-v7/buyer', title: 'Рабочее место покупателя', detail: 'Резерв, документы, обязательства и следующие действия.', state: 'confirmed' },
      { href: '/platform-v7/api-docs', title: 'Контракт RFQ API', detail: 'Публиковать только после реализации и проверки серверных контроллеров.', state: 'unconfirmed' },
    ],
  },
  en: {
    metadataTitle: 'Procurement requests · Transparent Price',
    metadataDescription: 'A procurement-request boundary without fictional RFQs, offers or client-created Deals.',
    eyebrow: 'Buyer · procurement request',
    title: 'Create RFQs only through a server authority',
    description: 'This workspace contains no demonstration requests, local form or fictional offers. Until a tenant-scoped registry and RFQ commands exist, the buyer uses confirmed auctions and canonical Deals.',
    statusUnavailable: 'RFQ circuit not confirmed',
    statusProfileUnavailable: 'profile not confirmed',
    labels: { blocker: 'Blocker', owner: 'Owner', impact: 'Impact', result: 'Result', nextAction: 'Next action', prioritySection: 'Primary procurement task', factsSection: 'Confirmed facts' },
    profile: {
      title: 'Restore a confirmed server session',
      description: 'User, organization and role are unavailable from `/auth/me`. The UI does not substitute a buyer or organization locally.',
      blocker: 'server profile not confirmed',
      impact: 'procurement authority cannot be proven',
      result: 'a valid session with buyer membership',
    },
    authority: {
      title: 'Build an industrial RFQ circuit before enabling the form',
      description: 'The platform needs a PostgreSQL request registry, server create command, condition versions, participant admission, audit and an accepted-offer handoff into the canonical Deal.',
      blocker: 'no confirmed RFQ read/write API or durable registry',
      impact: 'a procurement request cannot be created and reproduced safely',
      result: 'idempotent RFQ workflow with tenant/RBAC and Deal handoff',
    },
    ownerValue: 'Product / CTO / procurement-circuit owner',
    actions: { profile: 'Open access profile', auction: 'Open auction', deals: 'Open Deals', status: 'Check system status' },
    facts: { user: 'User', userHint: 'from the active server session only', organization: 'Organization', organizationHint: 'orgId and tenant boundary from `/auth/me`', deals: 'Accessible Deals', dealsHint: 'participant-scoped server registry', registry: 'RFQ registry', registryHint: 'not confirmed by a server API' },
    values: { unavailable: 'Unavailable', notConfirmed: 'Not confirmed', confirmed: 'Confirmed' },
    noticeTitle: 'The fictional procurement circuit was removed',
    notice: 'Static RFQs, local forms, invented lots, offers and transitions were removed. An empty backend is not replaced with mock files or browser-store data.',
    boundaryTitle: 'RFQ boundary',
    boundary: 'The browser does not create a procurement request, appoint suppliers or convert an offer into a Deal. The server command must verify buyer membership, tenant, admission, idempotency and optimistic concurrency and write audit/outbox records. An accepted offer creates the canonical Deal atomically.',
    routes: [
      { href: '/platform-v7/auction', title: 'Auction', detail: 'Confirmed trading and bidding route without a local RFQ.', state: 'confirmed' },
      { href: '/platform-v7/deals', title: 'Canonical Deals', detail: 'Continue execution of Deals already accessible to the buyer.', state: 'confirmed' },
      { href: '/platform-v7/buyer', title: 'Buyer workspace', detail: 'Reserve, documents, obligations and next actions.', state: 'confirmed' },
      { href: '/platform-v7/api-docs', title: 'RFQ API contract', detail: 'Publish only after server controllers are implemented and verified.', state: 'unconfirmed' },
    ],
  },
  zh: {
    metadataTitle: '采购请求 · 透明价格',
    metadataDescription: '不展示虚构 RFQ、报价或客户端创建交易的采购请求边界。',
    eyebrow: '买方 · 采购请求',
    title: '只通过服务器权威创建 RFQ',
    description: '该工作区不包含演示请求、本地表单或虚构报价。在 tenant-scoped 登记册和 RFQ 命令建立之前，买方使用已确认的拍卖和规范交易。',
    statusUnavailable: 'RFQ 闭环未确认',
    statusProfileUnavailable: '档案未确认',
    labels: { blocker: '阻塞项', owner: '负责人', impact: '影响', result: '结果', nextAction: '下一步', prioritySection: '主要采购任务', factsSection: '已确认事实' },
    profile: {
      title: '恢复已确认的服务器会话',
      description: '无法从 `/auth/me` 获取用户、组织和角色。界面不会在本地替换买方或组织。',
      blocker: '服务器档案未确认',
      impact: '无法证明采购权限',
      result: '包含 buyer membership 的有效会话',
    },
    authority: {
      title: '启用表单前建立工业级 RFQ 闭环',
      description: '需要 PostgreSQL 请求登记册、服务器创建命令、条件版本、参与方准入、审计，以及将已接受报价转换为规范交易。',
      blocker: '没有已确认的 RFQ 读写 API 和持久登记册',
      impact: '无法安全创建和复现采购请求',
      result: '具备 tenant/RBAC 和交易交接的幂等 RFQ 工作流',
    },
    ownerValue: 'Product / CTO / 采购闭环负责人',
    actions: { profile: '打开访问档案', auction: '打开拍卖', deals: '打开交易', status: '检查系统状态' },
    facts: { user: '用户', userHint: '仅来自活动服务器会话', organization: '组织', organizationHint: '来自 `/auth/me` 的 orgId 和 tenant 边界', deals: '可访问交易', dealsHint: '参与方范围服务器登记册', registry: 'RFQ 登记册', registryHint: '未由服务器 API 确认' },
    values: { unavailable: '不可用', notConfirmed: '未确认', confirmed: '已确认' },
    noticeTitle: '虚构采购闭环已删除',
    notice: '已删除静态 RFQ、本地表单、虚构批次、报价和状态迁移。空 backend 不会被 mock 文件或浏览器 store 数据替代。',
    boundaryTitle: 'RFQ 边界',
    boundary: '浏览器不会创建采购请求、指定供应商或把报价转换为交易。服务器命令必须验证 buyer membership、tenant、准入、幂等和乐观并发，并写入 audit/outbox。已接受报价必须原子创建规范交易。',
    routes: [
      { href: '/platform-v7/auction', title: '拍卖', detail: '已确认的交易和出价路径，不使用本地 RFQ。', state: 'confirmed' },
      { href: '/platform-v7/deals', title: '规范交易', detail: '继续执行买方已可访问的交易。', state: 'confirmed' },
      { href: '/platform-v7/buyer', title: '买方工作区', detail: '准备金、文档、义务和下一步操作。', state: 'confirmed' },
      { href: '/platform-v7/api-docs', title: 'RFQ API 合同', detail: '仅在服务器控制器实现并验证后发布。', state: 'unconfirmed' },
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
  return { title: copy.metadataTitle, description: copy.metadataDescription, robots: { index: false, follow: true } };
}

export default async function PlatformV7BuyerRfqPage() {
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
      ? <Link className={operationalCockpitClasses.primaryLink} href='/platform-v7/auction'>{copy.actions.auction}</Link>
      : <Link className={operationalCockpitClasses.primaryLink} href='/platform-v7/profile'>{copy.actions.profile}</Link>,
    secondaryAction: profile.available
      ? <Link className={operationalCockpitClasses.secondaryLink} href='/platform-v7/deals'>{copy.actions.deals}</Link>
      : <Link className={operationalCockpitClasses.secondaryLink} href='/platform-v7/status'>{copy.actions.status}</Link>,
  };

  return (
    <OperationalDecisionCockpit
      testId='platform-v7-buyer-rfq-v8'
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
