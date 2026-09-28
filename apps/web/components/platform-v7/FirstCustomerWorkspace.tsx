import Link from 'next/link';
import { getLocale } from 'next-intl/server';
import styles from './FirstCustomerWorkspace.module.css';
import { InlineNotice, StatusChip } from '@pc/design-system-v8';
import {
  OperationalCockpitSection,
  OperationalDecisionCockpit,
  OperationalQueue,
  OperationalQueueLink,
  operationalCockpitClasses,
  type OperationalPriority,
} from '@/components/transaction-ux/OperationalDecisionCockpit';
import {
  getFirstCustomerWorkspace,
  type FirstCustomerSurface,
} from '@/lib/first-customer-workspace-server';

type Locale = 'ru' | 'en' | 'zh';

const COPY = {
  ru: {
    title: 'Рабочий кабинет', description: 'Пользователь, организация, membership и очередь получены из текущей серверной сессии и PostgreSQL.', sellerDescription: 'Сервер подтвердил доступ к рабочей очереди продавца. Здесь показаны только доступные продавцу серверные факты; неподтверждённые данные остаются UNKNOWN.',
    buyerDescription: 'Сервер проверяет доступ к сделкам для роли покупателя. Данные организации показываются при подтверждении; очередь помогает найти сделку, но не назначает обязательное действие или срок.', buyerQueueNote: 'Проверяйте состояние в самой сделке. Порядок и дата обновления списка не означают приоритет, срок или банковское подтверждение.',
    bankDescription: 'Сервер проверяет роль банковского кабинета и доступ к сделкам. Очередь помогает найти сделку; провайдер, резерв и выплата этим ответом не подтверждены.',
    bankQueueReady: 'очередь сделок доступна', bankQueueNote: 'Статусы строк относятся к сделкам. Порядок списка и дата обновления не означают приоритет, банковское решение или срок выплаты.', bankQueueDetail: 'Открыть сделку для проверки серверных фактов',
    bankUnknownTitle: 'Банковские факты — UNKNOWN', bankUnknownDescription: 'Этот экран не получает подтверждённую связь операции с провайдером, статус резерва, выплаты или банковский callback. Решение о движении денег здесь не принимается.',
    ownerDescription: 'Реальный вход владельца с MFA. Интерфейс кабинета открыт в фиксированной контролируемой тестовой организации; клиентская роль в API не подменяется.',
    ownerReady: 'владелец · контролируемый доступ', ownerReadyTitle: 'Открыть рабочий раздел кабинета', ownerReadyDescription: 'Это настоящий защищённый маршрут кабинета. Данные для просмотра контролируемые; боевые действия продолжают проверяться сервером по реальной личности владельца.',
    ready: 'сервер подтверждён', empty: 'очередь пуста', degraded: 'серверная очередь недоступна', forbidden: 'доступ запрещён',
    blocker: 'Блокер', owner: 'Ответственный', impact: 'Влияние', result: 'Результат', next: 'Следующее действие', priority: 'Главная задача', facts: 'Подтверждённые данные',
    sellerPriorityUnknownTitle: 'Следующий обязательный шаг не опубликован', sellerPriorityUnknownDescription: 'Сервер подтвердил очередь сделок, но не выбрал, какая сделка должна быть первой. Порядок списка — это навигация, а не бизнес-приоритет.', priorityUnknownTitle: 'Следующее обязательное действие не опубликовано', priorityUnknownDescription: 'Сервер подтвердил рабочую очередь, но не назначил приоритетное действие. Порядок списка помогает найти объект и не определяет срочность.', priorityUnknownResult: 'UNKNOWN', workQueue: 'Рабочая очередь',
    emptyTitle: 'Рабочих объектов пока нет', emptyDescription: 'Это реальное пустое состояние. Демо-сделки, рейсы и заявки не подставляются.',
    degradedTitle: 'Не подменять недоступный backend', degradedDescription: 'Сервер не подтвердил очередь. Доступ и локальные данные не создаются.',
    forbiddenTitle: 'Роль не соответствует кабинету', forbiddenDescription: 'URL не меняет серверную роль. Вернись в назначенное рабочее пространство.',
    organization: 'Организация', membership: 'Контекст просмотра', identity: 'Пользователь', role: 'Роль кабинета', queue: 'Рабочая очередь', profile: 'Профиль доступа', team: 'Команда организации', status: 'Состояние системы', open: 'Открыть', noNext: 'следующее действие определит сервер', correlation: 'Correlation ID',
  },
  en: {
    title: 'Work cabinet', description: 'User, organization, membership and queue come from the current server session and PostgreSQL.', sellerDescription: 'The server confirmed access to the seller work queue. This view shows only server facts available to the current seller; unconfirmed data remains UNKNOWN.',
    buyerDescription: 'The server checks Deal access for the buyer role. Organization details appear when confirmed; the queue helps locate a Deal but does not assign a required action or deadline.', buyerQueueNote: 'Check the Deal for its current state. List order and update time do not establish priority, a deadline or bank confirmation.',
    bankDescription: 'The server checks the bank cabinet role and access to Deals. The queue helps locate a Deal; this response does not confirm a provider, reserve or payout.',
    bankQueueReady: 'Deal queue available', bankQueueNote: 'Row statuses describe Deals. List order and update time do not establish priority, a bank decision or a payout deadline.', bankQueueDetail: 'Open the Deal to check server facts',
    bankUnknownTitle: 'Bank facts — UNKNOWN', bankUnknownDescription: 'This screen has no confirmed operation-to-provider binding, reserve or payout status, or bank callback. It does not make a money movement decision.',
    ownerDescription: 'Real platform-owner sign-in with MFA. The cabinet interface is opened against a fixed controlled test organization; the API business role is not impersonated.',
    ownerReady: 'owner · controlled access', ownerReadyTitle: 'Open the cabinet work area', ownerReadyDescription: 'This is the real protected cabinet route. Review data is controlled; production actions still authorize the real owner identity on the server.',
    ready: 'server confirmed', empty: 'queue is empty', degraded: 'server queue unavailable', forbidden: 'access denied',
    blocker: 'Blocker', owner: 'Owner', impact: 'Impact', result: 'Result', next: 'Next action', priority: 'Primary task', facts: 'Confirmed data',
    sellerPriorityUnknownTitle: 'Required next step is not published', sellerPriorityUnknownDescription: 'The server confirmed the Deal queue but did not choose which Deal comes first. List order is navigation, not business priority.', priorityUnknownTitle: 'Required next action is not published', priorityUnknownDescription: 'The server confirmed the work queue but did not assign a priority action. List order helps you find an object and does not indicate urgency.', priorityUnknownResult: 'UNKNOWN', workQueue: 'Work queue',
    emptyTitle: 'No work objects yet', emptyDescription: 'This is a real empty state. No demo Deals, trips or applications are substituted.',
    degradedTitle: 'Do not substitute an unavailable backend', degradedDescription: 'The server did not confirm the queue. No access or local data is created.',
    forbiddenTitle: 'Role does not match this cabinet', forbiddenDescription: 'A URL cannot change the server role. Return to the assigned workspace.',
    organization: 'Organization', membership: 'Review context', identity: 'User', role: 'Cabinet role', queue: 'Work queue', profile: 'Access profile', team: 'Organization team', status: 'System status', open: 'Open', noNext: 'the server will determine the next action', correlation: 'Correlation ID',
  },
  zh: {
    title: '工作空间', description: '用户、组织、membership 和队列均来自当前服务器会话与 PostgreSQL。', sellerDescription: '服务器已确认卖方工作队列的访问权限。这里只显示当前卖方可见的服务器事实；未确认的数据保持为 UNKNOWN。',
    buyerDescription: '服务器会核查买方角色的交易访问权限。组织信息仅在确认后显示；队列用于查找交易，不指定必须执行的操作或期限。', buyerQueueNote: '请在交易详情中核查状态。列表顺序和更新时间不代表优先级、期限或银行确认。',
    bankDescription: '服务器会核查银行工作台角色和交易访问权限。队列仅帮助查找交易；此响应不确认服务提供方、资金预留或付款。',
    bankQueueReady: '交易队列可用', bankQueueNote: '行状态只描述交易。列表顺序和更新时间不代表优先级、银行决定或付款期限。', bankQueueDetail: '打开交易并核查服务器事实',
    bankUnknownTitle: '银行事实 — UNKNOWN', bankUnknownDescription: '此页面没有已确认的操作与服务提供方关联、资金预留或付款状态，也没有银行回调。此处不会作出资金划转决定。',
    ownerDescription: '平台所有者使用真实账号与 MFA 登录。工作台绑定固定受控测试组织，API 中不会伪装客户业务角色。',
    ownerReady: '所有者 · 受控访问', ownerReadyTitle: '打开工作台功能区', ownerReadyDescription: '这是实际受保护的工作台路由。查看数据受控；生产操作仍按所有者真实身份由服务器授权。',
    ready: '服务器已确认', empty: '队列为空', degraded: '服务器队列不可用', forbidden: '禁止访问',
    blocker: '阻塞项', owner: '负责人', impact: '影响', result: '结果', next: '下一步', priority: '主要任务', facts: '已确认数据',
    sellerPriorityUnknownTitle: '服务器未提供必须执行的下一步', sellerPriorityUnknownDescription: '服务器已确认交易队列，但没有选择哪一笔交易应排在第一位。列表顺序仅用于导航，不代表业务优先级。', priorityUnknownTitle: '服务器未提供优先执行的操作', priorityUnknownDescription: '服务器已确认工作队列，但未指定优先操作。列表顺序仅帮助查找对象，不代表紧急程度。', priorityUnknownResult: 'UNKNOWN', workQueue: '工作队列',
    emptyTitle: '暂时没有工作对象', emptyDescription: '这是真实的空状态，不会替换为演示交易、行程或申请。',
    degradedTitle: '不得替换不可用的 backend', degradedDescription: '服务器未确认队列，不会创建访问权限或本地数据。',
    forbiddenTitle: '角色与此工作空间不匹配', forbiddenDescription: 'URL 不能更改服务器角色。请返回分配的工作空间。',
    organization: '组织', membership: '查看上下文', identity: '用户', role: '工作台角色', queue: '工作队列', profile: '访问档案', team: '组织团队', status: '系统状态', open: '打开', noNext: '下一步由服务器确定', correlation: 'Correlation ID',
  },
} as const;

const ROLE_LABEL: Record<Locale, Record<FirstCustomerSurface, string>> = {
  ru: { seller: 'Продавец', buyer: 'Покупатель', logistics: 'Логистика', driver: 'Водитель', elevator: 'Элеватор', lab: 'Лаборатория', surveyor: 'Сюрвейер', bank: 'Банк' },
  en: { seller: 'Seller', buyer: 'Buyer', logistics: 'Logistics', driver: 'Driver', elevator: 'Elevator', lab: 'Laboratory', surveyor: 'Surveyor', bank: 'Bank' },
  zh: { seller: '卖方', buyer: '买方', logistics: '物流', driver: '司机', elevator: '粮库', lab: '实验室', surveyor: '检验员', bank: '银行' },
};

function localeOf(value: string): Locale { return value.startsWith('en') ? 'en' : value.startsWith('zh') ? 'zh' : 'ru'; }

export async function FirstCustomerWorkspace({ surface }: { surface: FirstCustomerSurface }) {
  const locale = localeOf(await getLocale());
  const copy = COPY[locale];
  const workspace = await getFirstCustomerWorkspace(surface);
  const first = workspace.items[0];
  const state = workspace.forbidden ? 'forbidden' : !workspace.available ? 'degraded' : workspace.items.length ? 'ready' : 'empty';
  const description = workspace.ownerControlled ? copy.ownerDescription : surface === 'seller' ? copy.sellerDescription : surface === 'buyer' ? copy.buyerDescription : surface === 'bank' ? copy.bankDescription : copy.description;
  const priorityUnknown = state === 'ready' && !workspace.ownerControlled;
  const unknownTitle = surface === 'seller' ? copy.sellerPriorityUnknownTitle : copy.priorityUnknownTitle;
  const unknownDescription = surface === 'seller' ? copy.sellerPriorityUnknownDescription : copy.priorityUnknownDescription;
  const priority: OperationalPriority = {
    state: priorityUnknown ? 'readonly' : state === 'ready' ? 'active' : state === 'empty' ? 'readonly' : 'critical',
    title: priorityUnknown ? unknownTitle : state === 'ready' ? copy.ownerReadyTitle : state === 'empty' ? copy.emptyTitle : state === 'forbidden' ? copy.forbiddenTitle : copy.degradedTitle,
    description: priorityUnknown ? unknownDescription : state === 'ready' ? copy.ownerReadyDescription : state === 'empty' ? copy.emptyDescription : state === 'forbidden' ? copy.forbiddenDescription : copy.degradedDescription,
    blocker: state === 'degraded' || state === 'forbidden' ? (workspace.correlationId || copy.degradedDescription) : undefined,
    owner: priorityUnknown ? undefined : state === 'degraded' ? copy.status : ROLE_LABEL[locale][surface],
    result: priorityUnknown ? copy.priorityUnknownResult : state === 'ready' ? first?.status : state === 'empty' ? copy.empty : copy.degraded,
    primaryAction: priorityUnknown
      ? <a className={operationalCockpitClasses.primaryLink} href='#first-customer-work-queue'>{copy.workQueue}</a>
      : first?.href
        ? <Link className={operationalCockpitClasses.primaryLink} href={first.href}>{copy.open}</Link>
        : <Link className={operationalCockpitClasses.primaryLink} href='/platform-v7/profile'>{copy.profile}</Link>,
    secondaryAction: workspace.ownerControlled
      ? <Link className={operationalCockpitClasses.secondaryLink} href='/platform-v7/staff'>Все кабинеты</Link>
      : <Link className={operationalCockpitClasses.secondaryLink} href='/platform-v7/profile/team'>{copy.team}</Link>,
  };

  return (
    <OperationalDecisionCockpit
      testId={`p0-first-customer-workspace-${surface}`}
      eyebrow={ROLE_LABEL[locale][surface]}
      title={copy.title}
      description={description}
      statusLabel={workspace.ownerControlled && state === 'ready' ? copy.ownerReady : state === 'ready' ? surface === 'bank' ? copy.bankQueueReady : copy.ready : state === 'empty' ? copy.empty : state === 'forbidden' ? copy.forbidden : copy.degraded}
      statusTone={state === 'ready' ? 'success' : state === 'empty' ? 'information' : 'critical'}
      priority={priority}
      labels={{ blocker: copy.blocker, owner: copy.owner, impact: copy.impact, result: copy.result, nextAction: copy.next, prioritySection: copy.priority, factsSection: copy.facts }}
      facts={[
        { label: copy.identity, value: workspace.profile.fullName || workspace.profile.email || workspace.profile.id || '—', hint: workspace.profile.id || undefined },
        { label: copy.organization, value: workspace.organization.organizationName || workspace.profile.orgId || '—', hint: workspace.profile.tenantId || undefined },
        { label: copy.membership, value: workspace.ownerControlled ? 'PLATFORM_OWNER · MFA' : (workspace.profile.membershipId || '—') },
        { label: copy.role, value: workspace.profile.role || '—' },
      ]}
      boundary={description}
    >
      {surface === 'bank' && !workspace.ownerControlled ? (
        <InlineNotice tone='information' title={copy.bankUnknownTitle}>{copy.bankUnknownDescription}</InlineNotice>
      ) : null}
      <OperationalCockpitSection id='first-customer-work-queue'>
        {surface === 'buyer' && !workspace.ownerControlled && state === 'ready' ? <p className={styles.buyerQueueNote}>{copy.buyerQueueNote}</p> : null}
        {surface === 'bank' && !workspace.ownerControlled && state === 'ready' ? <p className={styles.bankQueueNote}>{copy.bankQueueNote}</p> : null}
        {workspace.available && workspace.items.length ? (
          <OperationalQueue aria-label={copy.queue}>
            {workspace.items.map((item) => item.href ? (
              <OperationalQueueLink key={item.id} href={item.href} title={item.id} detail={surface === 'bank' ? copy.bankQueueDetail : item.nextAction || copy.noNext} status={<StatusChip tone='information'>{item.status}</StatusChip>} />
            ) : (
              <InlineNotice key={item.id} tone='information' title={`${item.id} · ${item.status}`}>{surface === 'bank' ? copy.bankQueueDetail : item.nextAction || copy.noNext}</InlineNotice>
            ))}
          </OperationalQueue>
        ) : (
          <InlineNotice tone={state === 'empty' ? 'information' : 'critical'} title={state === 'empty' ? copy.emptyTitle : state === 'forbidden' ? copy.forbiddenTitle : copy.degradedTitle}>
            {state === 'empty' ? copy.emptyDescription : state === 'forbidden' ? copy.forbiddenDescription : copy.degradedDescription}
            {workspace.correlationId ? ` ${copy.correlation}: ${workspace.correlationId}` : ''}
          </InlineNotice>
        )}
      </OperationalCockpitSection>
    </OperationalDecisionCockpit>
  );
}
