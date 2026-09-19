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
import {
  getFirstCustomerWorkspace,
  type FirstCustomerSurface,
} from '@/lib/first-customer-workspace-server';

type Locale = 'ru' | 'en' | 'zh';

const COPY = {
  ru: {
    title: 'Рабочий кабинет', description: 'Пользователь, организация, membership и очередь получены из текущей серверной сессии и PostgreSQL.',
    ownerDescription: 'Реальный вход владельца с MFA. Интерфейс кабинета открыт в фиксированной контролируемой тестовой организации; клиентская роль в API не подменяется.',
    ownerReady: 'владелец · контролируемый доступ', ownerReadyTitle: 'Открыть рабочий раздел кабинета', ownerReadyDescription: 'Это настоящий защищённый маршрут кабинета. Данные для просмотра контролируемые; боевые действия продолжают проверяться сервером по реальной личности владельца.',
    ready: 'сервер подтверждён', empty: 'очередь пуста', degraded: 'серверная очередь недоступна', forbidden: 'доступ запрещён',
    blocker: 'Блокер', owner: 'Ответственный', impact: 'Влияние', result: 'Результат', next: 'Следующее действие', priority: 'Главная задача', facts: 'Подтверждённые данные',
    readyTitle: 'Открыть первый доступный объект', readyDescription: 'Объект уже ограничен текущим tenant, membership и ролью на API.',
    emptyTitle: 'Рабочих объектов пока нет', emptyDescription: 'Это реальное пустое состояние. Демо-сделки, рейсы и заявки не подставляются.',
    degradedTitle: 'Не подменять недоступный backend', degradedDescription: 'Сервер не подтвердил очередь. Доступ и локальные данные не создаются.',
    forbiddenTitle: 'Роль не соответствует кабинету', forbiddenDescription: 'URL не меняет серверную роль. Вернись в назначенное рабочее пространство.',
    organization: 'Организация', membership: 'Контекст просмотра', identity: 'Пользователь', role: 'Роль кабинета', queue: 'Рабочая очередь', profile: 'Профиль доступа', team: 'Команда организации', status: 'Состояние системы', open: 'Открыть', noNext: 'следующее действие определит сервер', correlation: 'Correlation ID',
  },
  en: {
    title: 'Work cabinet', description: 'User, organization, membership and queue come from the current server session and PostgreSQL.',
    ownerDescription: 'Real platform-owner sign-in with MFA. The cabinet interface is opened against a fixed controlled test organization; the API business role is not impersonated.',
    ownerReady: 'owner · controlled access', ownerReadyTitle: 'Open the cabinet work area', ownerReadyDescription: 'This is the real protected cabinet route. Review data is controlled; production actions still authorize the real owner identity on the server.',
    ready: 'server confirmed', empty: 'queue is empty', degraded: 'server queue unavailable', forbidden: 'access denied',
    blocker: 'Blocker', owner: 'Owner', impact: 'Impact', result: 'Result', next: 'Next action', priority: 'Primary task', facts: 'Confirmed data',
    readyTitle: 'Open the first accessible object', readyDescription: 'The API has already scoped this object to the current tenant, membership and role.',
    emptyTitle: 'No work objects yet', emptyDescription: 'This is a real empty state. No demo Deals, trips or applications are substituted.',
    degradedTitle: 'Do not substitute an unavailable backend', degradedDescription: 'The server did not confirm the queue. No access or local data is created.',
    forbiddenTitle: 'Role does not match this cabinet', forbiddenDescription: 'A URL cannot change the server role. Return to the assigned workspace.',
    organization: 'Organization', membership: 'Review context', identity: 'User', role: 'Cabinet role', queue: 'Work queue', profile: 'Access profile', team: 'Organization team', status: 'System status', open: 'Open', noNext: 'the server will determine the next action', correlation: 'Correlation ID',
  },
  zh: {
    title: '工作空间', description: '用户、组织、membership 和队列均来自当前服务器会话与 PostgreSQL。',
    ownerDescription: '平台所有者使用真实账号与 MFA 登录。工作台绑定固定受控测试组织，API 中不会伪装客户业务角色。',
    ownerReady: '所有者 · 受控访问', ownerReadyTitle: '打开工作台功能区', ownerReadyDescription: '这是实际受保护的工作台路由。查看数据受控；生产操作仍按所有者真实身份由服务器授权。',
    ready: '服务器已确认', empty: '队列为空', degraded: '服务器队列不可用', forbidden: '禁止访问',
    blocker: '阻塞项', owner: '负责人', impact: '影响', result: '结果', next: '下一步', priority: '主要任务', facts: '已确认数据',
    readyTitle: '打开第一个可访问对象', readyDescription: 'API 已按当前 tenant、membership 和角色限制该对象。',
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
  const description = workspace.ownerControlled ? copy.ownerDescription : copy.description;
  const priority: OperationalPriority = {
    state: state === 'ready' ? 'active' : state === 'empty' ? 'readonly' : 'critical',
    title: workspace.ownerControlled && state === 'ready'
      ? copy.ownerReadyTitle
      : state === 'ready' ? copy.readyTitle : state === 'empty' ? copy.emptyTitle : state === 'forbidden' ? copy.forbiddenTitle : copy.degradedTitle,
    description: workspace.ownerControlled && state === 'ready'
      ? copy.ownerReadyDescription
      : state === 'ready' ? copy.readyDescription : state === 'empty' ? copy.emptyDescription : state === 'forbidden' ? copy.forbiddenDescription : copy.degradedDescription,
    blocker: state === 'degraded' || state === 'forbidden' ? (workspace.correlationId || copy.degradedDescription) : undefined,
    owner: state === 'degraded' ? copy.status : ROLE_LABEL[locale][surface],
    result: state === 'ready' ? first?.status : state === 'empty' ? copy.empty : copy.degraded,
    primaryAction: first?.href
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
      statusLabel={workspace.ownerControlled && state === 'ready' ? copy.ownerReady : state === 'ready' ? copy.ready : state === 'empty' ? copy.empty : state === 'forbidden' ? copy.forbidden : copy.degraded}
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
      <OperationalCockpitSection id='first-customer-work-queue'>
        {workspace.available && workspace.items.length ? (
          <OperationalQueue aria-label={copy.queue}>
            {workspace.items.map((item) => item.href ? (
              <OperationalQueueLink key={item.id} href={item.href} title={item.id} detail={item.nextAction || copy.noNext} status={<StatusChip tone='information'>{item.status}</StatusChip>} />
            ) : (
              <InlineNotice key={item.id} tone='information' title={`${item.id} · ${item.status}`}>{item.nextAction || copy.noNext}</InlineNotice>
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
