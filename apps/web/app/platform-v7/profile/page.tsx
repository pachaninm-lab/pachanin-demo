import type { Metadata } from 'next';
import Link from 'next/link';
import { getLocale } from 'next-intl/server';
import { InlineNotice, StatusChip } from '@pc/design-system-v8';
import { getAuthProfile, type AuthProfileSnapshot } from '@/lib/auth-profile-server';
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
  statusAvailable: string;
  statusUnavailable: string;
  statusMfaRequired: string;
  blocker: string;
  owner: string;
  impact: string;
  result: string;
  nextAction: string;
  prioritySection: string;
  factsSection: string;
  readyTitle: string;
  readyDescription: string;
  mfaTitle: string;
  mfaDescription: string;
  unavailableTitle: string;
  unavailableDescription: string;
  unavailableImpact: string;
  unavailableResult: string;
  openDeals: string;
  openStatus: string;
  openHelp: string;
  workspacesTitle: string;
  securityTitle: string;
  securityBoundary: string;
  ownerValue: string;
  mfaImpact: string;
  mfaResult: string;
  facts: Readonly<{
    identity: string;
    identityHint: string;
    email: string;
    emailHint: string;
    role: string;
    roleHint: string;
    organization: string;
    organizationHint: string;
    membership: string;
    membershipHint: string;
    mfa: string;
    mfaHint: string;
  }>;
  values: Readonly<{
    notProvided: string;
    verified: string;
    notVerified: string;
    unknown: string;
  }>;
  routes: ReadonlyArray<Readonly<{ href: string; title: string; detail: string }>>;
}>;

const COPY: Record<Locale, Copy> = {
  ru: {
    metadataTitle: 'Профиль доступа · Прозрачная Цена',
    metadataDescription: 'Проверенный профиль пользователя, организации, роли и MFA из серверной сессии.',
    eyebrow: 'Профиль доступа',
    title: 'Только данные подтверждённой сессии',
    description: 'Профиль показывает пользователя, организацию, membership, роль и MFA из `/auth/me`. Компания, реквизиты, сертификаты, оборот и рейтинг не создаются локально.',
    statusAvailable: 'профиль подтверждён',
    statusUnavailable: 'профиль недоступен',
    statusMfaRequired: 'MFA не подтверждён',
    blocker: 'Блокер', owner: 'Ответственный', impact: 'Влияние', result: 'Результат', nextAction: 'Следующее действие',
    prioritySection: 'Главная задача доступа', factsSection: 'Подтверждённые факты',
    readyTitle: 'Сессия и membership подтверждены',
    readyDescription: 'Интерфейс использует роль и организацию из серверной security boundary. URL и клиентское состояние не назначают доступ.',
    mfaTitle: 'Подтвердить MFA через реальный auth-контур',
    mfaDescription: 'Профиль не включает локальные переключатели, SMS-симуляцию, демо-секрет или фиктивные сессии. Статус изменяется только серверным MFA flow.',
    unavailableTitle: 'Восстановить серверный профиль',
    unavailableDescription: 'Ответ `/auth/me` недоступен или некорректен. Интерфейс не подставляет фиктивную компанию и не показывает локальные реквизиты.',
    unavailableImpact: 'нельзя подтвердить текущую роль, организацию и membership',
    unavailableResult: 'валидный профиль активной серверной сессии',
    openDeals: 'Открыть сделки', openStatus: 'Состояние системы', openHelp: 'Открыть помощь',
    workspacesTitle: 'Рабочие контуры', securityTitle: 'Граница безопасности',
    securityBoundary: 'Профиль не управляет паролем, MFA, сессиями или ролями в браузере. Эти изменения выполняются только через серверные auth/admin команды с аудитом, отзывом и повторной проверкой membership.',
    ownerValue: 'Пользователь / администратор организации',
    mfaImpact: 'доступ к денежным и иным критическим действиям',
    mfaResult: 'серверно подтверждённый MFA status',
    facts: {
      identity: 'Пользователь', identityHint: 'fullName, email или серверный user ID',
      email: 'Email', emailHint: 'из подтверждённой auth-сессии',
      role: 'Роль', roleHint: 'server membership / surface role',
      organization: 'Организация', organizationHint: 'server orgId без локальной карточки компании',
      membership: 'Membership', membershipHint: 'идентификатор активного членства',
      mfa: 'MFA', mfaHint: 'только серверный результат проверки',
    },
    values: { notProvided: 'Не предоставлено', verified: 'Подтверждён', notVerified: 'Не подтверждён', unknown: 'Неизвестно' },
    routes: [
      { href: '/platform-v7/profile/team', title: 'Команда организации', detail: 'Membership, роли и разделение полномочий.' },
      { href: '/platform-v7/deals', title: 'Мои сделки', detail: 'Только participant-scoped канонический реестр.' },
      { href: '/platform-v7/connectors', title: 'Интеграционные контуры', detail: 'Диагностика отдельно от production-подключения.' },
      { href: '/platform-v7/onboarding', title: 'Онбординг организации', detail: 'Подтверждение организации и подготовка к первой Сделке.' },
      { href: '/platform-v7/status', title: 'Состояние системы', detail: 'Проверяемые внутренние сигналы и внешние границы.' },
    ],
  },
  en: {
    metadataTitle: 'Access profile · Transparent Price',
    metadataDescription: 'Verified user, organization, role and MFA profile from the server session.',
    eyebrow: 'Access profile', title: 'Only confirmed session data',
    description: 'The profile displays user, organization, membership, role and MFA from `/auth/me`. Company details, certificates, turnover and ratings are never created locally.',
    statusAvailable: 'profile confirmed', statusUnavailable: 'profile unavailable', statusMfaRequired: 'MFA not confirmed',
    blocker: 'Blocker', owner: 'Owner', impact: 'Impact', result: 'Result', nextAction: 'Next action',
    prioritySection: 'Primary access task', factsSection: 'Confirmed facts',
    readyTitle: 'Session and membership confirmed',
    readyDescription: 'The UI uses role and organization from the server security boundary. URL and client state do not assign access.',
    mfaTitle: 'Confirm MFA through the real auth circuit',
    mfaDescription: 'The profile contains no local toggles, SMS simulation, demo secret or fabricated sessions. Status changes only through the server MFA flow.',
    unavailableTitle: 'Restore the server profile',
    unavailableDescription: 'The `/auth/me` response is unavailable or invalid. The UI does not substitute a fictional company or local legal details.',
    unavailableImpact: 'current role, organization and membership cannot be confirmed',
    unavailableResult: 'a valid active server-session profile',
    openDeals: 'Open Deals', openStatus: 'System status', openHelp: 'Open help',
    workspacesTitle: 'Work areas', securityTitle: 'Security boundary',
    securityBoundary: 'The browser profile does not manage password, MFA, sessions or roles. These changes require server auth/admin commands with audit, revocation and membership revalidation.',
    ownerValue: 'User / organization administrator',
    mfaImpact: 'access to money and other critical actions',
    mfaResult: 'server-confirmed MFA status',
    facts: {
      identity: 'User', identityHint: 'fullName, email or server user ID',
      email: 'Email', emailHint: 'from the confirmed auth session',
      role: 'Role', roleHint: 'server membership / surface role',
      organization: 'Organization', organizationHint: 'server orgId without a local company card',
      membership: 'Membership', membershipHint: 'active membership identifier',
      mfa: 'MFA', mfaHint: 'server verification result only',
    },
    values: { notProvided: 'Not provided', verified: 'Verified', notVerified: 'Not verified', unknown: 'Unknown' },
    routes: [
      { href: '/platform-v7/profile/team', title: 'Organization team', detail: 'Membership, roles and separation of authority.' },
      { href: '/platform-v7/deals', title: 'My Deals', detail: 'Participant-scoped canonical registry only.' },
      { href: '/platform-v7/connectors', title: 'Integration circuits', detail: 'Diagnostics separated from production connectivity.' },
      { href: '/platform-v7/onboarding', title: 'Organization onboarding', detail: 'Organization confirmation and first-Deal preparation.' },
      { href: '/platform-v7/status', title: 'System status', detail: 'Verifiable internal signals and external boundaries.' },
    ],
  },
  zh: {
    metadataTitle: '访问档案 · 透明价格', metadataDescription: '来自服务器会话的已验证用户、组织、角色和 MFA 档案。',
    eyebrow: '访问档案', title: '仅显示已确认的会话数据',
    description: '档案仅显示 `/auth/me` 返回的用户、组织、membership、角色和 MFA。公司资料、证书、营业额和评分不会在本地生成。',
    statusAvailable: '档案已确认', statusUnavailable: '档案不可用', statusMfaRequired: 'MFA 未确认',
    blocker: '阻塞项', owner: '负责人', impact: '影响', result: '结果', nextAction: '下一步',
    prioritySection: '主要访问任务', factsSection: '已确认事实',
    readyTitle: '会话和 membership 已确认', readyDescription: '界面使用服务器安全边界中的角色和组织。URL 和客户端状态不能分配访问权限。',
    mfaTitle: '通过真实认证闭环确认 MFA',
    mfaDescription: '档案中没有本地开关、短信模拟、演示密钥或虚构会话。状态只能通过服务器 MFA flow 改变。',
    unavailableTitle: '恢复服务器档案',
    unavailableDescription: '`/auth/me` 响应不可用或无效。界面不会替换为虚构公司或本地法人资料。',
    unavailableImpact: '无法确认当前角色、组织和 membership', unavailableResult: '有效的活动服务器会话档案',
    openDeals: '打开交易', openStatus: '系统状态', openHelp: '打开帮助', workspacesTitle: '工作区域', securityTitle: '安全边界',
    securityBoundary: '浏览器档案不管理密码、MFA、会话或角色。这些变更只能通过带审计、撤销和 membership 重新验证的服务器 auth/admin 命令完成。',
    ownerValue: '用户 / 组织管理员', mfaImpact: '资金和其他关键操作的访问权限', mfaResult: '服务器确认的 MFA 状态',
    facts: {
      identity: '用户', identityHint: 'fullName、email 或服务器 user ID',
      email: 'Email', emailHint: '来自已确认的认证会话',
      role: '角色', roleHint: '服务器 membership / surface role',
      organization: '组织', organizationHint: '服务器 orgId，不使用本地公司卡片',
      membership: 'Membership', membershipHint: '活动 membership 标识符',
      mfa: 'MFA', mfaHint: '仅服务器验证结果',
    },
    values: { notProvided: '未提供', verified: '已确认', notVerified: '未确认', unknown: '未知' },
    routes: [
      { href: '/platform-v7/profile/team', title: '组织团队', detail: 'Membership、角色和权限分离。' },
      { href: '/platform-v7/deals', title: '我的交易', detail: '仅参与方范围的规范登记册。' },
      { href: '/platform-v7/connectors', title: '集成闭环', detail: '诊断与生产连接分离。' },
      { href: '/platform-v7/onboarding', title: '组织入驻', detail: '组织确认和首笔交易准备。' },
      { href: '/platform-v7/status', title: '系统状态', detail: '可验证内部信号和外部边界。' },
    ],
  },
};

function localeOf(value: string): Locale {
  if (value.startsWith('en')) return 'en';
  if (value.startsWith('zh')) return 'zh';
  return 'ru';
}

function profileIdentity(profile: AuthProfileSnapshot, copy: Copy): string {
  return profile.fullName || profile.email || profile.id || copy.values.notProvided;
}

export async function generateMetadata(): Promise<Metadata> {
  const copy = COPY[localeOf(await getLocale())];
  return {
    title: copy.metadataTitle,
    description: copy.metadataDescription,
    robots: { index: false, follow: false },
  };
}

export default async function ProfilePage() {
  const copy = COPY[localeOf(await getLocale())];
  const profile = await getAuthProfile();
  const mfaVerified = profile.mfaVerified === true;
  const priority: OperationalPriority = !profile.available
    ? {
        state: 'critical',
        title: copy.unavailableTitle,
        description: copy.unavailableDescription,
        blocker: copy.unavailableDescription,
        owner: copy.ownerValue,
        impact: copy.unavailableImpact,
        result: copy.unavailableResult,
        primaryAction: <Link className={operationalCockpitClasses.primaryLink} href='/platform-v7/status'>{copy.openStatus}</Link>,
      }
    : !mfaVerified
      ? {
          state: 'active',
          title: copy.mfaTitle,
          description: copy.mfaDescription,
          blocker: copy.mfaDescription,
          owner: copy.ownerValue,
          impact: copy.mfaImpact,
          result: copy.mfaResult,
          primaryAction: <Link className={operationalCockpitClasses.primaryLink} href='/platform-v7/help'>{copy.openHelp}</Link>,
          secondaryAction: <Link className={operationalCockpitClasses.secondaryLink} href='/platform-v7/status'>{copy.openStatus}</Link>,
        }
      : {
          state: 'ready',
          title: copy.readyTitle,
          description: copy.readyDescription,
          owner: copy.ownerValue,
          result: copy.values.verified,
          primaryAction: <Link className={operationalCockpitClasses.primaryLink} href='/platform-v7/deals'>{copy.openDeals}</Link>,
        };

  const mfaValue = profile.mfaVerified === true
    ? copy.values.verified
    : profile.mfaVerified === false
      ? copy.values.notVerified
      : copy.values.unknown;

  return (
    <OperationalDecisionCockpit
      testId='platform-v7-profile-v8'
      eyebrow={copy.eyebrow}
      title={copy.title}
      description={copy.description}
      statusLabel={!profile.available ? copy.statusUnavailable : mfaVerified ? copy.statusAvailable : copy.statusMfaRequired}
      statusTone={!profile.available ? 'critical' : mfaVerified ? 'success' : 'warning'}
      priority={priority}
      labels={{
        blocker: copy.blocker,
        owner: copy.owner,
        impact: copy.impact,
        result: copy.result,
        nextAction: copy.nextAction,
        prioritySection: copy.prioritySection,
        factsSection: copy.factsSection,
      }}
      facts={[
        { label: copy.facts.identity, value: profile.available ? profileIdentity(profile, copy) : '—', hint: copy.facts.identityHint },
        { label: copy.facts.email, value: profile.available ? profile.email || copy.values.notProvided : '—', hint: copy.facts.emailHint },
        { label: copy.facts.role, value: profile.available ? profile.surfaceRole || profile.role || copy.values.unknown : '—', hint: copy.facts.roleHint },
        { label: copy.facts.organization, value: profile.available ? profile.orgId || copy.values.unknown : '—', hint: copy.facts.organizationHint },
        { label: copy.facts.membership, value: profile.available ? profile.membershipId || copy.values.unknown : '—', hint: copy.facts.membershipHint },
        { label: copy.facts.mfa, value: profile.available ? mfaValue : '—', hint: copy.facts.mfaHint },
      ]}
      boundary={copy.securityBoundary}
    >
      <OperationalCockpitSection id='workspaces'>
        <OperationalQueue>
          {copy.routes.map((route) => (
            <OperationalQueueLink
              key={route.href}
              {...route}
              status={<StatusChip tone='neutral'>{copy.nextAction}</StatusChip>}
            />
          ))}
        </OperationalQueue>
      </OperationalCockpitSection>

      <InlineNotice tone={mfaVerified ? 'success' : 'information'} title={copy.securityTitle}>
        {copy.securityBoundary}
      </InlineNotice>
    </OperationalDecisionCockpit>
  );
}
