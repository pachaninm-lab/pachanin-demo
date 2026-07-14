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
    metadataDescription: 'Граница seller RFQ и предложений без фиктивных совпадений, ставок и клиентского создания DealDraft.',
    eyebrow: 'Продавец · запросы и предложения',
    title: 'Предложение продавца создаётся только через серверный торговый контур',
    description: 'Экран не подбирает покупателя, не рассчитывает процент совпадения и не создаёт предложение или черновик сделки. До появления durable реестра RFQ и офферов доступна только проверяемая граница будущего процесса.',
    unavailableStatus: 'Seller RFQ-контур не подтверждён',
    profileStatus: 'Профиль не подтверждён',
    labels: { blocker: 'Блокер', owner: 'Ответственный', impact: 'Влияние', result: 'Результат', nextAction: 'Следующее действие', prioritySection: 'Главная задача', factsSection: 'Подтверждённые факты' },
    profileTask: {
      title: 'Восстановить подтверждённую серверную сессию',
      description: 'Пользователь, организация и роль недоступны через `/auth/me`. Интерфейс не назначает продавца локально.',
      blocker: 'серверный профиль не подтверждён',
      impact: 'невозможно доказать полномочия на работу с партиями и запросами',
      result: 'валидная сессия с seller membership',
    },
    authorityTask: {
      title: 'Создать durable RFQ/Offer registry до включения действий',
      description: 'Нужны tenant-scoped PostgreSQL-реестры запросов и предложений, связь с канонической партией и лотом, версии условий, серверные команды, идемпотентность, optimistic concurrency, audit и outbox.',
      blocker: 'нет подтверждённых seller RFQ/Offer API, durable registry и matching authority',
      impact: 'нельзя безопасно подобрать покупателя, отправить предложение или создать DealDraft',
      result: 'воспроизводимый server-authoritative переход RFQ → Offer → Deal',
    },
    owner: 'Product / Trading / CTO / Risk',
    actions: { profile: 'Открыть профиль доступа', auction: 'Открыть аукцион', deals: 'Открыть Сделки', status: 'Проверить состояние системы' },
    facts: {
      user: 'Пользователь', userHint: 'только из активной серверной сессии',
      organization: 'Организация', organizationHint: 'orgId и tenant boundary из `/auth/me`',
      deals: 'Доступных Сделок', dealsHint: 'participant-scoped серверный реестр',
      registry: 'RFQ/Offer registry', registryHint: 'не подтверждён серверным API',
    },
    values: { unavailable: 'Недоступно', unconfirmed: 'Не подтверждён', confirmed: 'Подтверждено' },
    noticeTitle: 'Фиктивный подбор и предложения удалены',
    notice: 'Удалены совпадение 85%+, фиктивный DealDraft, локальные ставки, рейтинг покупателя и browser-owned действие отправки предложения. Пустой backend не заменяется демонстрационными данными.',
    boundaryTitle: 'Граница торгового решения',
    boundary: 'Браузер не создаёт RFQ, Offer или DealDraft, не выбирает покупателя и не принимает условия. Сервер обязан проверить tenant, seller membership, каноническую партию, лот и RFQ, версии условий, идемпотентность и optimistic concurrency, затем атомарно записать Offer, audit и outbox. Переход в Сделку допускается только после подтверждённого принятия условий сервером.',
    routes: [
      { href: '/platform-v7/auction', title: 'Канонический аукцион', detail: 'Работа с подтверждёнными лотами, допуском и этапами торгов.', state: 'confirmed' },
      { href: '/platform-v7/deals', title: 'Канонические Сделки', detail: 'Открыть только participant-scoped сделки организации.', state: 'confirmed' },
      { href: '/platform-v7/api-docs', title: 'Контракт seller RFQ/Offer API', detail: 'Публиковать только после реализации и проверки серверных контроллеров.', state: 'unconfirmed' },
    ],
  },
  en: {
    metadataTitle: 'Buyer requests · Transparent Price',
    metadataDescription: 'A seller RFQ and offer boundary without fictional matches, bids or client-created DealDrafts.',
    eyebrow: 'Seller · requests and offers',
    title: 'Seller offers must be created through server trading authority only',
    description: 'This screen does not match buyers, calculate a match percentage, create an offer or create a Deal draft. Until durable RFQ and Offer registries exist, it exposes only the verifiable future process boundary.',
    unavailableStatus: 'Seller RFQ circuit not confirmed',
    profileStatus: 'Profile not confirmed',
    labels: { blocker: 'Blocker', owner: 'Owner', impact: 'Impact', result: 'Result', nextAction: 'Next action', prioritySection: 'Primary task', factsSection: 'Confirmed facts' },
    profileTask: {
      title: 'Restore a confirmed server session',
      description: 'User, organization and role are unavailable from `/auth/me`. The UI does not assign a seller locally.',
      blocker: 'server profile not confirmed',
      impact: 'authority over batches and requests cannot be proven',
      result: 'a valid session with seller membership',
    },
    authorityTask: {
      title: 'Build durable RFQ and Offer registries before enabling actions',
      description: 'The platform needs tenant-scoped PostgreSQL request and offer registries, canonical batch and lot links, versioned terms, server commands, idempotency, optimistic concurrency, audit and outbox.',
      blocker: 'no confirmed seller RFQ/Offer API, durable registry or matching authority',
      impact: 'a buyer cannot safely be matched, an offer submitted or a DealDraft created',
      result: 'a reproducible server-authoritative RFQ → Offer → Deal transition',
    },
    owner: 'Product / Trading / CTO / Risk',
    actions: { profile: 'Open access profile', auction: 'Open auction', deals: 'Open Deals', status: 'Check system status' },
    facts: {
      user: 'User', userHint: 'from the active server session only',
      organization: 'Organization', organizationHint: 'orgId and tenant boundary from `/auth/me`',
      deals: 'Accessible Deals', dealsHint: 'participant-scoped server registry',
      registry: 'RFQ/Offer registry', registryHint: 'not confirmed by a server API',
    },
    values: { unavailable: 'Unavailable', unconfirmed: 'Not confirmed', confirmed: 'Confirmed' },
    noticeTitle: 'Fictional matching and offers were removed',
    notice: 'The 85%+ match, fictional DealDraft, local bids, buyer rating and browser-owned offer submission were removed. An empty backend is not replaced with demonstration data.',
    boundaryTitle: 'Trading decision boundary',
    boundary: 'The browser does not create an RFQ, Offer or DealDraft, select a buyer or accept terms. The server must verify tenant, seller membership, canonical batch, lot and RFQ, term versions, idempotency and optimistic concurrency, then atomically write the Offer, audit and outbox. A Deal transition is allowed only after server-confirmed acceptance of terms.',
    routes: [
      { href: '/platform-v7/auction', title: 'Canonical auction', detail: 'Work with confirmed lots, admission and trading stages.', state: 'confirmed' },
      { href: '/platform-v7/deals', title: 'Canonical Deals', detail: 'Open participant-scoped Deals for the organization only.', state: 'confirmed' },
      { href: '/platform-v7/api-docs', title: 'Seller RFQ/Offer API contract', detail: 'Publish only after server controllers are implemented and verified.', state: 'unconfirmed' },
    ],
  },
  zh: {
    metadataTitle: '买方需求 · 透明价格',
    metadataDescription: '不展示虚构匹配、报价或客户端 DealDraft 的卖方 RFQ 与 Offer 边界。',
    eyebrow: '卖方 · 需求与报价',
    title: '卖方报价只能通过服务器交易权威创建',
    description: '该页面不会匹配买方、计算匹配百分比、创建报价或交易草稿。在持久 RFQ 和 Offer 登记册建立之前，仅展示可验证的未来流程边界。',
    unavailableStatus: '卖方 RFQ 闭环未确认',
    profileStatus: '档案未确认',
    labels: { blocker: '阻塞项', owner: '负责人', impact: '影响', result: '结果', nextAction: '下一步', prioritySection: '主要任务', factsSection: '已确认事实' },
    profileTask: {
      title: '恢复已确认的服务器会话',
      description: '无法从 `/auth/me` 获取用户、组织和角色。界面不会在本地分配卖方角色。',
      blocker: '服务器档案未确认',
      impact: '无法证明对批次和需求的权限',
      result: '包含 seller membership 的有效会话',
    },
    authorityTask: {
      title: '启用操作前建立持久 RFQ 与 Offer 登记册',
      description: '需要 tenant-scoped PostgreSQL 需求和报价登记册、规范批次和地块关联、条款版本、服务器命令、幂等、乐观并发、审计和 outbox。',
      blocker: '没有已确认的 seller RFQ/Offer API、持久登记册或匹配权威',
      impact: '无法安全匹配买方、提交报价或创建 DealDraft',
      result: '可复现的服务器权威 RFQ → Offer → Deal 转换',
    },
    owner: 'Product / Trading / CTO / Risk',
    actions: { profile: '打开访问档案', auction: '打开拍卖', deals: '打开交易', status: '检查系统状态' },
    facts: {
      user: '用户', userHint: '仅来自活动服务器会话',
      organization: '组织', organizationHint: '来自 `/auth/me` 的 orgId 和 tenant 边界',
      deals: '可访问交易', dealsHint: '参与方范围服务器登记册',
      registry: 'RFQ/Offer 登记册', registryHint: '未由服务器 API 确认',
    },
    values: { unavailable: '不可用', unconfirmed: '未确认', confirmed: '已确认' },
    noticeTitle: '虚构匹配和报价已删除',
    notice: '已删除 85%+ 匹配、虚构 DealDraft、本地报价、买方评分以及由浏览器处理的报价提交。空 backend 不会由演示数据替代。',
    boundaryTitle: '交易决策边界',
    boundary: '浏览器不会创建 RFQ、Offer 或 DealDraft，不会选择买方或接受条款。服务器必须验证 tenant、seller membership、规范批次、地块和 RFQ、条款版本、幂等和乐观并发，然后原子写入 Offer、audit 和 outbox。只有在服务器确认接受条款后，才能转换为交易。',
    routes: [
      { href: '/platform-v7/auction', title: '规范拍卖', detail: '处理已确认地块、准入和交易阶段。', state: 'confirmed' },
      { href: '/platform-v7/deals', title: '规范交易', detail: '仅打开组织参与方范围内的交易。', state: 'confirmed' },
      { href: '/platform-v7/api-docs', title: '卖方 RFQ/Offer API 合同', detail: '仅在服务器控制器实现并验证后发布。', state: 'unconfirmed' },
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
