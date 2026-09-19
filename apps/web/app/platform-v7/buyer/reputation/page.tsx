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
  actions: Readonly<{ profile: string; deals: string; documents: string; disputes: string; status: string }>;
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
    metadataTitle: 'Надёжность контрагентов · Прозрачная Цена',
    metadataDescription: 'Граница оценки контрагентов без вымышленного рейтинга и клиентского скоринга.',
    eyebrow: 'Покупатель · надёжность контрагента',
    title: 'Оценка продавца строится только на проверяемых фактах сделки',
    description: 'Экран не показывает условный рейтинг и не влияет на допуск. До появления durable реестра доказательств, версий модели и объяснимых факторов доступна только граница будущего контура.',
    unavailableStatus: 'Реестр надёжности не подтверждён',
    profileStatus: 'Профиль не подтверждён',
    labels: { blocker: 'Блокер', owner: 'Ответственный', impact: 'Влияние', result: 'Результат', nextAction: 'Следующее действие', prioritySection: 'Главная задача', factsSection: 'Подтверждённые факты' },
    profileTask: {
      title: 'Восстановить подтверждённую серверную сессию',
      description: 'Пользователь, организация и роль недоступны через `/auth/me`. Интерфейс не назначает покупателя локально.',
      blocker: 'серверный профиль не подтверждён',
      impact: 'невозможно доказать полномочия на просмотр данных контрагента',
      result: 'валидная сессия с buyer membership',
    },
    authorityTask: {
      title: 'Создать доказательный реестр до публикации рейтинга',
      description: 'Нужны PostgreSQL-факты завершённых Сделок, качества, веса, документов и споров, происхождение каждого события, версия модели, объяснимые факторы, аудит и процедура оспаривания.',
      blocker: 'нет подтверждённых counterparty-risk API, durable evidence registry и versioned score model',
      impact: 'нельзя безопасно показывать балл или использовать его для допуска и ранжирования',
      result: 'воспроизводимая и оспоримая оценка на server-authoritative фактах',
    },
    owner: 'Risk / Compliance / Product / Data',
    actions: { profile: 'Открыть профиль доступа', deals: 'Открыть Сделки', documents: 'Открыть документы', disputes: 'Открыть споры', status: 'Проверить состояние системы' },
    facts: { user: 'Пользователь', userHint: 'только из активной серверной сессии', organization: 'Организация', organizationHint: 'orgId и tenant boundary из `/auth/me`', deals: 'Доступных Сделок', dealsHint: 'participant-scoped серверный реестр', registry: 'Реестр надёжности', registryHint: 'не подтверждён серверным API' },
    values: { unavailable: 'Недоступно', unconfirmed: 'Не подтверждён', confirmed: 'Подтверждено' },
    noticeTitle: 'Вымышленный рейтинг удалён',
    notice: 'Удалены балл 92/100, неподтверждённые выводы о качестве, весе и документной дисциплине. Пустой backend не заменяется локальной оценкой.',
    boundaryTitle: 'Граница оценки',
    boundary: 'Браузер не рассчитывает, не хранит и не изменяет рейтинг. Сервер должен использовать только tenant-scoped доказательства с неизменяемым происхождением, версией модели и объяснением факторов. Любое влияние на допуск, порядок показа или условия сделки требует RBAC, audit/outbox, антифрод-контроля и процедуры оспаривания.',
    routes: [
      { href: '/platform-v7/deals', title: 'Канонические Сделки', detail: 'Фактические результаты исполнения доступны только участникам Сделки.', state: 'confirmed' },
      { href: '/platform-v7/documents', title: 'Документы', detail: 'Проверить подтверждённые документы и основания.', state: 'confirmed' },
      { href: '/platform-v7/disputes', title: 'Споры', detail: 'Проверить открытые и закрытые разногласия.', state: 'confirmed' },
      { href: '/platform-v7/api-docs', title: 'Контракт risk API', detail: 'Публиковать только после реализации и проверки серверных контроллеров.', state: 'unconfirmed' },
    ],
  },
  en: {
    metadataTitle: 'Counterparty reliability · Transparent Price',
    metadataDescription: 'A counterparty assessment boundary without a fictional rating or client-side scoring.',
    eyebrow: 'Buyer · counterparty reliability',
    title: 'Seller assessment must use verifiable Deal facts only',
    description: 'This screen does not display a provisional score or affect admission. Until a durable evidence registry, model versions and explainable factors exist, it exposes only the future authority boundary.',
    unavailableStatus: 'Reliability registry not confirmed',
    profileStatus: 'Profile not confirmed',
    labels: { blocker: 'Blocker', owner: 'Owner', impact: 'Impact', result: 'Result', nextAction: 'Next action', prioritySection: 'Primary task', factsSection: 'Confirmed facts' },
    profileTask: {
      title: 'Restore a confirmed server session',
      description: 'User, organization and role are unavailable from `/auth/me`. The UI does not assign a buyer locally.',
      blocker: 'server profile not confirmed',
      impact: 'authority to view counterparty data cannot be proven',
      result: 'a valid session with buyer membership',
    },
    authorityTask: {
      title: 'Build an evidence registry before publishing a score',
      description: 'The platform needs PostgreSQL facts for completed Deals, quality, weight, documents and disputes, event provenance, a model version, explainable factors, audit and an appeal procedure.',
      blocker: 'no confirmed counterparty-risk API, durable evidence registry or versioned score model',
      impact: 'a score cannot safely be displayed or used for admission and ranking',
      result: 'a reproducible and appealable assessment based on server-authoritative facts',
    },
    owner: 'Risk / Compliance / Product / Data',
    actions: { profile: 'Open access profile', deals: 'Open Deals', documents: 'Open documents', disputes: 'Open disputes', status: 'Check system status' },
    facts: { user: 'User', userHint: 'from the active server session only', organization: 'Organization', organizationHint: 'orgId and tenant boundary from `/auth/me`', deals: 'Accessible Deals', dealsHint: 'participant-scoped server registry', registry: 'Reliability registry', registryHint: 'not confirmed by a server API' },
    values: { unavailable: 'Unavailable', unconfirmed: 'Not confirmed', confirmed: 'Confirmed' },
    noticeTitle: 'The fictional rating was removed',
    notice: 'The 92/100 score and unsupported conclusions about quality, weight and document discipline were removed. An empty backend is not replaced with a local assessment.',
    boundaryTitle: 'Assessment boundary',
    boundary: 'The browser does not calculate, store or change a rating. The server must use tenant-scoped evidence with immutable provenance, a model version and factor explanations. Any effect on admission, ranking or Deal terms requires RBAC, audit/outbox, fraud controls and an appeal procedure.',
    routes: [
      { href: '/platform-v7/deals', title: 'Canonical Deals', detail: 'Actual execution outcomes are visible only to Deal participants.', state: 'confirmed' },
      { href: '/platform-v7/documents', title: 'Documents', detail: 'Inspect confirmed documents and bases.', state: 'confirmed' },
      { href: '/platform-v7/disputes', title: 'Disputes', detail: 'Inspect open and closed disagreements.', state: 'confirmed' },
      { href: '/platform-v7/api-docs', title: 'Risk API contract', detail: 'Publish only after server controllers are implemented and verified.', state: 'unconfirmed' },
    ],
  },
  zh: {
    metadataTitle: '交易对手可靠性 · 透明价格',
    metadataDescription: '不展示虚构评分或客户端评分逻辑的交易对手评估边界。',
    eyebrow: '买方 · 交易对手可靠性',
    title: '卖方评估只能基于可验证的交易事实',
    description: '该页面不会展示临时评分，也不会影响准入。在持久证据登记册、模型版本和可解释因素建立之前，仅展示未来权威边界。',
    unavailableStatus: '可靠性登记册未确认',
    profileStatus: '档案未确认',
    labels: { blocker: '阻塞项', owner: '负责人', impact: '影响', result: '结果', nextAction: '下一步', prioritySection: '主要任务', factsSection: '已确认事实' },
    profileTask: {
      title: '恢复已确认的服务器会话',
      description: '无法从 `/auth/me` 获取用户、组织和角色。界面不会在本地分配买方角色。',
      blocker: '服务器档案未确认',
      impact: '无法证明查看交易对手数据的权限',
      result: '包含 buyer membership 的有效会话',
    },
    authorityTask: {
      title: '发布评分前建立证据登记册',
      description: '需要已完成交易、质量、重量、文档和争议的 PostgreSQL 事实、事件来源、模型版本、可解释因素、审计和申诉流程。',
      blocker: '没有已确认的 counterparty-risk API、持久证据登记册或版本化评分模型',
      impact: '无法安全展示评分或将其用于准入和排序',
      result: '基于服务器权威事实的可复现、可申诉评估',
    },
    owner: 'Risk / Compliance / Product / Data',
    actions: { profile: '打开访问档案', deals: '打开交易', documents: '打开文档', disputes: '打开争议', status: '检查系统状态' },
    facts: { user: '用户', userHint: '仅来自活动服务器会话', organization: '组织', organizationHint: '来自 `/auth/me` 的 orgId 和 tenant 边界', deals: '可访问交易', dealsHint: '参与方范围服务器登记册', registry: '可靠性登记册', registryHint: '未由服务器 API 确认' },
    values: { unavailable: '不可用', unconfirmed: '未确认', confirmed: '已确认' },
    noticeTitle: '虚构评分已删除',
    notice: '已删除 92/100 评分以及关于质量、重量和文档纪律的未确认结论。空 backend 不会由本地评估替代。',
    boundaryTitle: '评估边界',
    boundary: '浏览器不会计算、存储或更改评分。服务器必须使用具有不可变来源、模型版本和因素解释的 tenant-scoped 证据。任何对准入、排序或交易条件的影响都需要 RBAC、audit/outbox、反欺诈控制和申诉流程。',
    routes: [
      { href: '/platform-v7/deals', title: '规范交易', detail: '实际执行结果仅对交易参与方可见。', state: 'confirmed' },
      { href: '/platform-v7/documents', title: '文档', detail: '查看已确认的文档和依据。', state: 'confirmed' },
      { href: '/platform-v7/disputes', title: '争议', detail: '查看开放和已关闭的争议。', state: 'confirmed' },
      { href: '/platform-v7/api-docs', title: '风险 API 合同', detail: '仅在服务器控制器实现并验证后发布。', state: 'unconfirmed' },
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

export default async function BuyerReputationPage() {
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
      ? <Link className={operationalCockpitClasses.primaryLink} href='/platform-v7/deals'>{copy.actions.deals}</Link>
      : <Link className={operationalCockpitClasses.primaryLink} href='/platform-v7/profile'>{copy.actions.profile}</Link>,
    secondaryAction: profile.available
      ? <Link className={operationalCockpitClasses.secondaryLink} href='/platform-v7/disputes'>{copy.actions.disputes}</Link>
      : <Link className={operationalCockpitClasses.secondaryLink} href='/platform-v7/status'>{copy.actions.status}</Link>,
  };

  return (
    <OperationalDecisionCockpit
      testId='platform-v7-buyer-reputation-v8'
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
