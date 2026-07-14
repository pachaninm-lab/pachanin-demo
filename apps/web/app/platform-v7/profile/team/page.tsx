import type { Metadata } from 'next';
import Link from 'next/link';
import { getLocale } from 'next-intl/server';
import { InlineNotice, StatusChip } from '@pc/design-system-v8';
import { getAuthProfile } from '@/lib/auth-profile-server';
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
  statusConfirmed: string;
  statusUnavailable: string;
  blocker: string;
  owner: string;
  impact: string;
  result: string;
  nextAction: string;
  prioritySection: string;
  factsSection: string;
  confirmedTitle: string;
  confirmedDescription: string;
  unavailableTitle: string;
  unavailableDescription: string;
  ownerValue: string;
  openProfile: string;
  openHelp: string;
  openStatus: string;
  boundaryTitle: string;
  boundary: string;
  directoryTitle: string;
  directoryDescription: string;
  values: Readonly<{ confirmed: string; notProvided: string; unavailable: string }>;
  facts: Readonly<{ identity: string; email: string; organization: string; membership: string; role: string; mfa: string }>;
  routes: ReadonlyArray<Readonly<{ href: string; title: string; detail: string }> >;
}>;

const COPY: Record<Locale, Copy> = {
  ru: {
    metadataTitle: 'Команда организации · Прозрачная Цена', metadataDescription: 'Подтверждённый membership текущего пользователя и граница серверного администрирования команды.',
    eyebrow: 'Организация · доступы', title: 'Показывать только подтверждённые членства',
    description: 'Экран не создаёт участников, приглашения, роли или права в браузере. До появления серверного каталога membership здесь отображается только текущая подтверждённая сессия.',
    statusConfirmed: 'membership подтверждён', statusUnavailable: 'membership недоступен',
    blocker: 'Блокер', owner: 'Ответственный', impact: 'Влияние', result: 'Результат', nextAction: 'Следующее действие', prioritySection: 'Главная задача доступа', factsSection: 'Подтверждённые факты',
    confirmedTitle: 'Проверить границы текущего membership', confirmedDescription: 'Пользователь, организация, роль и MFA получены из серверной сессии. Изменение состава команды требует отдельной административной команды с аудитом.',
    unavailableTitle: 'Восстановить серверный профиль membership', unavailableDescription: 'Ответ `/auth/me` недоступен или некорректен. Интерфейс не подставляет вымышленных сотрудников, email, приглашения и матрицу прав.',
    ownerValue: 'Администратор организации / безопасность', openProfile: 'Открыть профиль', openHelp: 'Открыть помощь', openStatus: 'Проверить систему',
    boundaryTitle: 'Граница управления командой',
    boundary: 'Приглашение, отзыв, смена роли и разделение полномочий считаются выполненными только после серверной команды, повторной проверки администратора, tenant scope, MFA для критических изменений, идемпотентности и неизменяемого audit trail. Клиентский переключатель не меняет RBAC.',
    directoryTitle: 'Каталог команды не подтверждён', directoryDescription: 'Платформа пока не получила серверный список всех membership организации. Поэтому экран намеренно не показывает фиктивных директора, оператора, бухгалтера, логиста или приглашения.',
    values: { confirmed: 'Подтверждено', notProvided: 'Не предоставлено', unavailable: 'Недоступно' },
    facts: { identity: 'Текущий пользователь', email: 'Email', organization: 'Организация', membership: 'Membership', role: 'Роль', mfa: 'MFA' },
    routes: [
      { href: '/platform-v7/profile', title: 'Профиль доступа', detail: 'Проверить исходные данные текущей серверной сессии.' },
      { href: '/platform-v7/onboarding', title: 'Готовность к работе', detail: 'Проверить membership, MFA и доступ к первой Сделке.' },
      { href: '/platform-v7/help', title: 'Помощь по доступу', detail: 'Эскалация без локального изменения роли или прав.' },
      { href: '/platform-v7/status', title: 'Состояние системы', detail: 'Проверяемые внутренние сигналы и внешние границы.' },
    ],
  },
  en: {
    metadataTitle: 'Organization team · Transparent Price', metadataDescription: 'Confirmed current-user membership and the boundary of server-side team administration.',
    eyebrow: 'Organization · access', title: 'Show confirmed memberships only',
    description: 'This screen does not create users, invitations, roles or rights in the browser. Until a server membership directory exists, it shows only the current confirmed session.',
    statusConfirmed: 'membership confirmed', statusUnavailable: 'membership unavailable',
    blocker: 'Blocker', owner: 'Owner', impact: 'Impact', result: 'Result', nextAction: 'Next action', prioritySection: 'Primary access task', factsSection: 'Confirmed facts',
    confirmedTitle: 'Review the current membership boundary', confirmedDescription: 'User, organization, role and MFA come from the server session. Team changes require a separate audited administration command.',
    unavailableTitle: 'Restore the server membership profile', unavailableDescription: 'The `/auth/me` response is unavailable or invalid. The UI does not substitute fictional staff, emails, invitations or an access matrix.',
    ownerValue: 'Organization administrator / security', openProfile: 'Open profile', openHelp: 'Open help', openStatus: 'Check system',
    boundaryTitle: 'Team administration boundary',
    boundary: 'Invitation, revocation, role change and separation of authority are complete only after a server command, administrator revalidation, tenant scope, MFA for critical changes, idempotency and an immutable audit trail. A client toggle never changes RBAC.',
    directoryTitle: 'Team directory not confirmed', directoryDescription: 'The platform has not received a server list of all organization memberships. It therefore shows no fictional director, operator, accountant, logistician or invitations.',
    values: { confirmed: 'Confirmed', notProvided: 'Not provided', unavailable: 'Unavailable' },
    facts: { identity: 'Current user', email: 'Email', organization: 'Organization', membership: 'Membership', role: 'Role', mfa: 'MFA' },
    routes: [
      { href: '/platform-v7/profile', title: 'Access profile', detail: 'Review the source data of the current server session.' },
      { href: '/platform-v7/onboarding', title: 'Work readiness', detail: 'Review membership, MFA and access to the first Deal.' },
      { href: '/platform-v7/help', title: 'Access help', detail: 'Escalation without a local role or rights change.' },
      { href: '/platform-v7/status', title: 'System status', detail: 'Verifiable internal signals and external boundaries.' },
    ],
  },
  zh: {
    metadataTitle: '组织团队 · 透明价格', metadataDescription: '当前用户已确认 membership 以及服务器端团队管理边界。',
    eyebrow: '组织 · 访问权限', title: '仅显示已确认的 membership',
    description: '该页面不会在浏览器中创建用户、邀请、角色或权限。在服务器 membership 目录可用之前，只显示当前已确认会话。',
    statusConfirmed: 'membership 已确认', statusUnavailable: 'membership 不可用',
    blocker: '阻塞项', owner: '负责人', impact: '影响', result: '结果', nextAction: '下一步', prioritySection: '主要访问任务', factsSection: '已确认事实',
    confirmedTitle: '检查当前 membership 边界', confirmedDescription: '用户、组织、角色和 MFA 来自服务器会话。团队变更需要单独的、带审计的管理命令。',
    unavailableTitle: '恢复服务器 membership 档案', unavailableDescription: '`/auth/me` 响应不可用或无效。界面不会替换为虚构员工、邮箱、邀请或权限矩阵。',
    ownerValue: '组织管理员 / 安全', openProfile: '打开档案', openHelp: '打开帮助', openStatus: '检查系统',
    boundaryTitle: '团队管理边界',
    boundary: '邀请、撤销、角色变更和权限分离只有在服务器命令、管理员重新验证、tenant scope、关键变更 MFA、幂等和不可变审计轨迹完成后才生效。客户端开关不会改变 RBAC。',
    directoryTitle: '团队目录未确认', directoryDescription: '平台尚未获得组织全部 membership 的服务器列表，因此不会显示虚构的负责人、操作员、会计、物流人员或邀请。',
    values: { confirmed: '已确认', notProvided: '未提供', unavailable: '不可用' },
    facts: { identity: '当前用户', email: 'Email', organization: '组织', membership: 'Membership', role: '角色', mfa: 'MFA' },
    routes: [
      { href: '/platform-v7/profile', title: '访问档案', detail: '检查当前服务器会话的源数据。' },
      { href: '/platform-v7/onboarding', title: '工作准备度', detail: '检查 membership、MFA 和首笔交易访问。' },
      { href: '/platform-v7/help', title: '访问帮助', detail: '不会在本地改变角色或权限的升级路径。' },
      { href: '/platform-v7/status', title: '系统状态', detail: '可验证内部信号和外部边界。' },
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

export default async function TeamPage() {
  const copy = COPY[localeOf(await getLocale())];
  const profile = await getAuthProfile();
  const available = profile.available && Boolean(profile.membershipId);

  const priority: OperationalPriority = available
    ? {
        state: 'ready', title: copy.confirmedTitle, description: copy.confirmedDescription,
        owner: copy.ownerValue, result: copy.values.confirmed,
        primaryAction: <Link className={operationalCockpitClasses.primaryLink} href='/platform-v7/profile'>{copy.openProfile}</Link>,
        secondaryAction: <Link className={operationalCockpitClasses.secondaryLink} href='/platform-v7/help'>{copy.openHelp}</Link>,
      }
    : {
        state: 'critical', title: copy.unavailableTitle, description: copy.unavailableDescription,
        blocker: copy.unavailableDescription, owner: copy.ownerValue, impact: copy.statusUnavailable, result: copy.values.confirmed,
        primaryAction: <Link className={operationalCockpitClasses.primaryLink} href='/platform-v7/status'>{copy.openStatus}</Link>,
        secondaryAction: <Link className={operationalCockpitClasses.secondaryLink} href='/platform-v7/profile'>{copy.openProfile}</Link>,
      };

  return (
    <OperationalDecisionCockpit
      testId='platform-v7-team-v8'
      eyebrow={copy.eyebrow}
      title={copy.title}
      description={copy.description}
      statusLabel={available ? copy.statusConfirmed : copy.statusUnavailable}
      statusTone={available ? 'success' : 'critical'}
      priority={priority}
      labels={{ blocker: copy.blocker, owner: copy.owner, impact: copy.impact, result: copy.result, nextAction: copy.nextAction, prioritySection: copy.prioritySection, factsSection: copy.factsSection }}
      facts={[
        { label: copy.facts.identity, value: available ? profile.fullName || profile.id || copy.values.notProvided : copy.values.unavailable },
        { label: copy.facts.email, value: available ? profile.email || copy.values.notProvided : copy.values.unavailable },
        { label: copy.facts.organization, value: available ? profile.orgId || copy.values.notProvided : copy.values.unavailable },
        { label: copy.facts.membership, value: available ? profile.membershipId || copy.values.notProvided : copy.values.unavailable },
        { label: copy.facts.role, value: available ? profile.surfaceRole || profile.role || copy.values.notProvided : copy.values.unavailable },
        { label: copy.facts.mfa, value: profile.mfaVerified === true ? copy.values.confirmed : profile.mfaVerified === false ? copy.values.notProvided : copy.values.unavailable },
      ]}
      boundary={copy.boundary}
    >
      <InlineNotice tone='information' title={copy.directoryTitle}>{copy.directoryDescription}</InlineNotice>
      <OperationalCockpitSection id='team-boundaries'>
        <OperationalQueue>
          {copy.routes.map((route) => (
            <OperationalQueueLink key={route.href} {...route} status={<StatusChip tone='neutral'>{copy.nextAction}</StatusChip>} />
          ))}
        </OperationalQueue>
      </OperationalCockpitSection>
      <InlineNotice tone='warning' title={copy.boundaryTitle}>{copy.boundary}</InlineNotice>
    </OperationalDecisionCockpit>
  );
}
