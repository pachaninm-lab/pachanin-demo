import type { Metadata } from 'next';
import Link from 'next/link';
import { getLocale } from 'next-intl/server';
import { InlineNotice, StatusChip } from '@pc/design-system-v8';
import { getAuthProfile } from '@/lib/auth-profile-server';
import { getReportingRegistry } from '@/lib/reporting-server';
import {
  OperationalCockpitSection,
  OperationalDecisionCockpit,
  OperationalQueue,
  OperationalQueueLink,
  operationalCockpitClasses,
  type OperationalPriority,
} from '@/components/transaction-ux/OperationalDecisionCockpit';

type Locale = 'ru' | 'en' | 'zh';

type Copy = Readonly<{
  metadataTitle: string;
  metadataDescription: string;
  eyebrow: string;
  title: string;
  description: string;
  statusReady: string;
  statusIncomplete: string;
  statusUnavailable: string;
  blocker: string;
  owner: string;
  impact: string;
  result: string;
  nextAction: string;
  prioritySection: string;
  factsSection: string;
  unavailableTitle: string;
  unavailableDescription: string;
  mfaTitle: string;
  mfaDescription: string;
  firstDealTitle: string;
  firstDealDescription: string;
  readyTitle: string;
  readyDescription: string;
  ownerValue: string;
  openProfile: string;
  openHelp: string;
  openDeals: string;
  continueDeal: string;
  readinessSection: string;
  boundaryTitle: string;
  boundary: string;
  values: Readonly<{
    confirmed: string;
    notConfirmed: string;
    unavailable: string;
    noDeals: string;
  }>;
  facts: Readonly<{
    identity: string;
    role: string;
    membership: string;
    mfa: string;
    deals: string;
  }>;
  routes: ReadonlyArray<Readonly<{ href: string; title: string; detail: string }>>;
}>;

const COPY: Record<Locale, Copy> = {
  ru: {
    metadataTitle: 'Готовность к работе · Прозрачная Цена',
    metadataDescription: 'Проверяемая готовность пользователя и организации к первой Сделке по серверной сессии и доступному реестру.',
    eyebrow: 'Доступ · первая Сделка',
    title: 'Подтвердить доступ и перейти к реальной работе',
    description: 'Онбординг не выбирает роль и не создаёт готовность в браузере. Он показывает только подтверждённую серверную сессию, membership, MFA и доступные Сделки.',
    statusReady: 'готовность подтверждена', statusIncomplete: 'требуется действие', statusUnavailable: 'источник недоступен',
    blocker: 'Блокер', owner: 'Ответственный', impact: 'Влияние', result: 'Результат', nextAction: 'Следующее действие',
    prioritySection: 'Главная задача запуска', factsSection: 'Подтверждённые факты',
    unavailableTitle: 'Восстановить подтверждённый профиль доступа', unavailableDescription: 'Серверная сессия или participant-scoped реестр недоступны. Интерфейс не подставляет роль, организацию или тестовую Сделку.',
    mfaTitle: 'Подтвердить MFA для критических действий', mfaDescription: 'Membership подтверждён, но MFA не подтверждён сервером. Денежные и иные критические действия должны оставаться закрытыми.',
    firstDealTitle: 'Открыть или получить доступ к первой Сделке', firstDealDescription: 'Профиль подтверждён, но в доступном серверном реестре нет Сделок. Онбординг не создаёт локальный лот или демонстрационную сделку.',
    readyTitle: 'Продолжить исполнение первой доступной Сделки', readyDescription: 'Профиль, membership, MFA и participant-scoped реестр подтверждены сервером.',
    ownerValue: 'Пользователь / администратор организации', openProfile: 'Проверить профиль', openHelp: 'Открыть помощь', openDeals: 'Открыть реестр Сделок', continueDeal: 'Продолжить Сделку', readinessSection: 'Маршруты готовности', boundaryTitle: 'Граница онбординга',
    boundary: 'Онбординг подтверждает только внутренний доступ и не подключает банк, ФГИС, ЭДО или ЭПД. Внешние контуры требуют договора, credentials, проверенного обмена, callback, reconciliation, мониторинга и audit trail.',
    values: { confirmed: 'Подтверждено', notConfirmed: 'Не подтверждено', unavailable: 'Недоступно', noDeals: 'Нет доступных' },
    facts: { identity: 'Пользователь', role: 'Роль', membership: 'Membership', mfa: 'MFA', deals: 'Доступные Сделки' },
    routes: [
      { href: '/platform-v7/profile', title: 'Профиль доступа', detail: 'Пользователь, организация, membership, роль и MFA из `/auth/me`.' },
      { href: '/platform-v7/profile/team', title: 'Команда организации', detail: 'Только подтверждённый membership и границы администрирования.' },
      { href: '/platform-v7/connectors', title: 'Интеграционные контуры', detail: 'Диагностика отдельно от фактического внешнего подключения.' },
      { href: '/platform-v7/help', title: 'Справочный центр', detail: 'Следующий шаг без изменения роли и прав в браузере.' },
    ],
  },
  en: {
    metadataTitle: 'Work readiness · Transparent Price', metadataDescription: 'Verifiable readiness for the first Deal based on the server session and accessible registry.',
    eyebrow: 'Access · first Deal', title: 'Confirm access and move to real work',
    description: 'Onboarding does not select a role or manufacture readiness in the browser. It shows only the confirmed server session, membership, MFA and accessible Deals.',
    statusReady: 'readiness confirmed', statusIncomplete: 'action required', statusUnavailable: 'source unavailable',
    blocker: 'Blocker', owner: 'Owner', impact: 'Impact', result: 'Result', nextAction: 'Next action', prioritySection: 'Primary launch task', factsSection: 'Confirmed facts',
    unavailableTitle: 'Restore the confirmed access profile', unavailableDescription: 'The server session or participant-scoped registry is unavailable. The UI does not substitute a role, organization or test Deal.',
    mfaTitle: 'Confirm MFA for critical actions', mfaDescription: 'Membership is confirmed, but MFA is not server-confirmed. Money and other critical actions must remain closed.',
    firstDealTitle: 'Open or receive access to the first Deal', firstDealDescription: 'The profile is confirmed, but the accessible server registry contains no Deals. Onboarding does not create a local lot or demo Deal.',
    readyTitle: 'Continue execution of the first accessible Deal', readyDescription: 'Profile, membership, MFA and the participant-scoped registry are server-confirmed.',
    ownerValue: 'User / organization administrator', openProfile: 'Check profile', openHelp: 'Open help', openDeals: 'Open Deal registry', continueDeal: 'Continue Deal', readinessSection: 'Readiness routes', boundaryTitle: 'Onboarding boundary',
    boundary: 'Onboarding confirms internal access only and does not connect a bank, grain registry, EDI or transport system. External circuits require a contract, credentials, verified exchange, callbacks, reconciliation, monitoring and an audit trail.',
    values: { confirmed: 'Confirmed', notConfirmed: 'Not confirmed', unavailable: 'Unavailable', noDeals: 'No accessible Deals' },
    facts: { identity: 'User', role: 'Role', membership: 'Membership', mfa: 'MFA', deals: 'Accessible Deals' },
    routes: [
      { href: '/platform-v7/profile', title: 'Access profile', detail: 'User, organization, membership, role and MFA from `/auth/me`.' },
      { href: '/platform-v7/profile/team', title: 'Organization team', detail: 'Confirmed membership and administration boundaries only.' },
      { href: '/platform-v7/connectors', title: 'Integration circuits', detail: 'Diagnostics separated from actual external connectivity.' },
      { href: '/platform-v7/help', title: 'Help centre', detail: 'Next step without changing role or rights in the browser.' },
    ],
  },
  zh: {
    metadataTitle: '工作准备度 · 透明价格', metadataDescription: '基于服务器会话和可访问交易登记册验证首笔交易准备度。',
    eyebrow: '访问 · 首笔交易', title: '确认访问后进入真实工作',
    description: '入驻流程不会选择角色，也不会在浏览器中制造准备状态。它只显示服务器确认的会话、membership、MFA 和可访问交易。',
    statusReady: '准备度已确认', statusIncomplete: '需要操作', statusUnavailable: '来源不可用',
    blocker: '阻塞项', owner: '负责人', impact: '影响', result: '结果', nextAction: '下一步', prioritySection: '主要启动任务', factsSection: '已确认事实',
    unavailableTitle: '恢复已确认的访问档案', unavailableDescription: '服务器会话或参与方范围登记册不可用。界面不会替换为虚构角色、组织或测试交易。',
    mfaTitle: '为关键操作确认 MFA', mfaDescription: 'Membership 已确认，但 MFA 尚未由服务器确认。资金和其他关键操作必须保持关闭。',
    firstDealTitle: '打开或获得首笔交易访问权限', firstDealDescription: '档案已确认，但可访问服务器登记册中没有交易。入驻流程不会创建本地批次或演示交易。',
    readyTitle: '继续执行首笔可访问交易', readyDescription: '档案、membership、MFA 和参与方范围登记册均已由服务器确认。',
    ownerValue: '用户 / 组织管理员', openProfile: '检查档案', openHelp: '打开帮助', openDeals: '打开交易登记册', continueDeal: '继续交易', readinessSection: '准备路径', boundaryTitle: '入驻边界',
    boundary: '入驻只确认内部访问，不会连接银行、粮食登记、电子单证或运输系统。外部闭环需要合同、凭据、已验证交换、callback、对账、监控和审计轨迹。',
    values: { confirmed: '已确认', notConfirmed: '未确认', unavailable: '不可用', noDeals: '无可访问交易' },
    facts: { identity: '用户', role: '角色', membership: 'Membership', mfa: 'MFA', deals: '可访问交易' },
    routes: [
      { href: '/platform-v7/profile', title: '访问档案', detail: '来自 `/auth/me` 的用户、组织、membership、角色和 MFA。' },
      { href: '/platform-v7/profile/team', title: '组织团队', detail: '仅显示已确认 membership 和管理边界。' },
      { href: '/platform-v7/connectors', title: '集成闭环', detail: '诊断与实际外部连接分离。' },
      { href: '/platform-v7/help', title: '帮助中心', detail: '不会在浏览器中改变角色或权限的下一步。' },
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

export default async function PlatformV7OnboardingPage() {
  const copy = COPY[localeOf(await getLocale())];
  const [profile, registry] = await Promise.all([getAuthProfile(), getReportingRegistry()]);
  const firstDeal = registry.deals[0] ?? null;
  const profileReady = profile.available && Boolean(profile.membershipId);
  const mfaReady = profile.mfaVerified === true;
  const registryReady = registry.available;
  const fullyReady = profileReady && mfaReady && registryReady && Boolean(firstDeal);

  const priority: OperationalPriority = !profileReady || !registryReady
    ? {
        state: 'critical', title: copy.unavailableTitle, description: copy.unavailableDescription,
        blocker: copy.unavailableDescription, owner: copy.ownerValue, impact: copy.statusUnavailable, result: copy.values.confirmed,
        primaryAction: <Link className={operationalCockpitClasses.primaryLink} href='/platform-v7/profile'>{copy.openProfile}</Link>,
        secondaryAction: <Link className={operationalCockpitClasses.secondaryLink} href='/platform-v7/status'>{copy.statusUnavailable}</Link>,
      }
    : !mfaReady
      ? {
          state: 'active', title: copy.mfaTitle, description: copy.mfaDescription,
          blocker: copy.values.notConfirmed, owner: copy.ownerValue, impact: copy.mfaDescription, result: copy.values.confirmed,
          primaryAction: <Link className={operationalCockpitClasses.primaryLink} href='/platform-v7/profile'>{copy.openProfile}</Link>,
          secondaryAction: <Link className={operationalCockpitClasses.secondaryLink} href='/platform-v7/help'>{copy.openHelp}</Link>,
        }
      : !firstDeal
        ? {
            state: 'active', title: copy.firstDealTitle, description: copy.firstDealDescription,
            blocker: copy.values.noDeals, owner: copy.ownerValue, impact: copy.firstDealDescription, result: copy.openDeals,
            primaryAction: <Link className={operationalCockpitClasses.primaryLink} href='/platform-v7/deals'>{copy.openDeals}</Link>,
          }
        : {
            state: 'ready', title: copy.readyTitle, description: copy.readyDescription,
            owner: copy.ownerValue, result: firstDeal.id,
            primaryAction: <Link className={operationalCockpitClasses.primaryLink} href={`/platform-v7/deals/${encodeURIComponent(firstDeal.id)}`}>{copy.continueDeal}</Link>,
            secondaryAction: <Link className={operationalCockpitClasses.secondaryLink} href='/platform-v7/deals'>{copy.openDeals}</Link>,
          };

  return (
    <OperationalDecisionCockpit
      testId='platform-v7-onboarding-v8'
      eyebrow={copy.eyebrow}
      title={copy.title}
      description={copy.description}
      statusLabel={!profileReady || !registryReady ? copy.statusUnavailable : fullyReady ? copy.statusReady : copy.statusIncomplete}
      statusTone={!profileReady || !registryReady ? 'critical' : fullyReady ? 'success' : 'warning'}
      priority={priority}
      labels={{ blocker: copy.blocker, owner: copy.owner, impact: copy.impact, result: copy.result, nextAction: copy.nextAction, prioritySection: copy.prioritySection, factsSection: copy.factsSection }}
      facts={[
        { label: copy.facts.identity, value: profile.available ? profile.fullName || profile.email || profile.id || '—' : '—' },
        { label: copy.facts.role, value: profile.available ? profile.surfaceRole || profile.role || '—' : '—' },
        { label: copy.facts.membership, value: profile.available ? profile.membershipId || copy.values.notConfirmed : copy.values.unavailable },
        { label: copy.facts.mfa, value: profile.mfaVerified === true ? copy.values.confirmed : profile.mfaVerified === false ? copy.values.notConfirmed : copy.values.unavailable },
        { label: copy.facts.deals, value: registry.available ? String(registry.deals.length) : copy.values.unavailable },
      ]}
      boundary={copy.boundary}
    >
      <OperationalCockpitSection id='readiness'>
        <OperationalQueue>
          {copy.routes.map((route) => (
            <OperationalQueueLink key={route.href} {...route} status={<StatusChip tone='neutral'>{copy.nextAction}</StatusChip>} />
          ))}
        </OperationalQueue>
      </OperationalCockpitSection>
      <InlineNotice tone={fullyReady ? 'success' : 'information'} title={copy.boundaryTitle}>{copy.boundary}</InlineNotice>
    </OperationalDecisionCockpit>
  );
}
