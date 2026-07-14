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
  statusProfile: string;
  statusUnavailable: string;
  blocker: string;
  owner: string;
  impact: string;
  result: string;
  nextAction: string;
  prioritySection: string;
  factsSection: string;
  availableTitle: string;
  availableDescription: string;
  unavailableTitle: string;
  unavailableDescription: string;
  registryBlocker: string;
  profileBlocker: string;
  ownerValue: string;
  registryImpact: string;
  registryResult: string;
  profileImpact: string;
  profileResult: string;
  openProfile: string;
  openStatus: string;
  facts: Readonly<{
    identity: string;
    identityHint: string;
    organization: string;
    organizationHint: string;
    membership: string;
    membershipHint: string;
    role: string;
    roleHint: string;
  }>;
  values: Readonly<{
    unavailable: string;
    confirmed: string;
    notConfirmed: string;
  }>;
  noticeTitle: string;
  notice: string;
  boundaryTitle: string;
  boundary: string;
  currentMembershipTitle: string;
  currentMembershipDetail: string;
  capabilities: ReadonlyArray<Readonly<{ title: string; detail: string }>>;
}>;

const COPY: Record<Locale, Copy> = {
  ru: {
    metadataTitle: 'Команда и доступ · Прозрачная Цена',
    metadataDescription: 'Проверяемая граница команды организации без фиктивных участников, приглашений и клиентского управления ролями.',
    eyebrow: 'Команда и доступ',
    title: 'Показывать только подтверждённые membership и полномочия',
    description: 'Текущий пользователь и его membership берутся из активной серверной сессии. Полный состав команды, приглашения и изменения ролей не имитируются в браузере.',
    statusProfile: 'текущий membership подтверждён',
    statusUnavailable: 'профиль не подтверждён',
    blocker: 'Блокер', owner: 'Ответственный', impact: 'Влияние', result: 'Результат', nextAction: 'Следующее действие',
    prioritySection: 'Главная задача управления доступом', factsSection: 'Подтверждённые факты',
    availableTitle: 'Создать серверный реестр команды до включения администрирования',
    availableDescription: 'Активная сессия подтверждает только текущего пользователя. Список участников, приглашения, изменение ролей и отзыв доступа требуют отдельного tenant-scoped API, серверных команд и аудита.',
    unavailableTitle: 'Восстановить серверный профиль доступа',
    unavailableDescription: 'Ответ `/auth/me` недоступен или некорректен. Экран не подставляет фиктивную организацию, участников или полномочия.',
    registryBlocker: 'нет подтверждённого tenant-scoped реестра команды и admin-команд',
    profileBlocker: 'активный пользователь и membership не подтверждены',
    ownerValue: 'Администратор организации / владелец IAM',
    registryImpact: 'невозможно безопасно приглашать, менять роли и отзывать доступ',
    registryResult: 'серверный реестр участников с RBAC, MFA, аудитом и отзывом сессий',
    profileImpact: 'невозможно доказать организацию и текущие полномочия',
    profileResult: 'валидный `/auth/me` профиль активной сессии',
    openProfile: 'Открыть профиль доступа', openStatus: 'Проверить состояние системы',
    facts: {
      identity: 'Текущий пользователь', identityHint: 'fullName, email или server user ID из `/auth/me`',
      organization: 'Организация', organizationHint: 'server orgId и tenant boundary',
      membership: 'Membership', membershipHint: 'активное членство из серверной сессии',
      role: 'Роль', roleHint: 'назначена сервером, а не URL или состоянием браузера',
    },
    values: { unavailable: 'Недоступно', confirmed: 'Подтверждено', notConfirmed: 'Не подтверждено' },
    noticeTitle: 'Полный состав команды не подтверждён',
    notice: 'Удалены фиктивные сотрудники, почтовые адреса, приглашения, метрики IAM, матрица доступа и локальные кнопки изменения статуса. Пустой или недоступный серверный контур не заменяется демонстрационными данными.',
    boundaryTitle: 'Граница администрирования',
    boundary: 'Браузер не создаёт membership, не назначает роль и не отзывает доступ. Каждая команда должна проверять администратора, tenant и организацию, требовать MFA для критических изменений, быть идемпотентной, отзывать активные сессии при понижении прав и оставлять неизменяемый audit trail.',
    currentMembershipTitle: 'Текущий membership',
    currentMembershipDetail: 'Единственная запись, которую этот экран может подтвердить через активную серверную сессию.',
    capabilities: [
      { title: 'Список участников', detail: 'Нужен tenant-scoped read endpoint с минимальным набором персональных данных и серверной пагинацией.' },
      { title: 'Приглашение участника', detail: 'Нужны одноразовый токен, срок действия, проверка домена/организации, rate limit и audit.' },
      { title: 'Изменение роли', detail: 'Нужны RBAC/SoD, MFA, optimistic concurrency и запрет клиентского повышения полномочий.' },
      { title: 'Отзыв доступа', detail: 'Нужны атомарная деактивация membership, отзыв всех сессий и журнал причины.' },
    ],
  },
  en: {
    metadataTitle: 'Team and access · Transparent Price',
    metadataDescription: 'A verifiable organization-team boundary without fictional members, invitations or client-side role administration.',
    eyebrow: 'Team and access', title: 'Show only confirmed memberships and authority',
    description: 'The current user and membership come from the active server session. The full team, invitations and role changes are never simulated in the browser.',
    statusProfile: 'current membership confirmed', statusUnavailable: 'profile not confirmed',
    blocker: 'Blocker', owner: 'Owner', impact: 'Impact', result: 'Result', nextAction: 'Next action', prioritySection: 'Primary access-management task', factsSection: 'Confirmed facts',
    availableTitle: 'Create a server team registry before enabling administration',
    availableDescription: 'The active session confirms only the current user. Member lists, invitations, role changes and access revocation require a separate tenant-scoped API, server commands and audit.',
    unavailableTitle: 'Restore the server access profile', unavailableDescription: 'The `/auth/me` response is unavailable or invalid. The screen does not substitute a fictional organization, members or authority.',
    registryBlocker: 'no confirmed tenant-scoped team registry or administration commands', profileBlocker: 'active user and membership are not confirmed',
    ownerValue: 'Organization administrator / IAM owner', registryImpact: 'members cannot be invited, re-roled or revoked safely', registryResult: 'server member registry with RBAC, MFA, audit and session revocation',
    profileImpact: 'organization and current authority cannot be proven', profileResult: 'a valid active-session `/auth/me` profile',
    openProfile: 'Open access profile', openStatus: 'Check system status',
    facts: {
      identity: 'Current user', identityHint: 'fullName, email or server user ID from `/auth/me`', organization: 'Organization', organizationHint: 'server orgId and tenant boundary', membership: 'Membership', membershipHint: 'active membership from the server session', role: 'Role', roleHint: 'assigned by the server, not URL or browser state',
    },
    values: { unavailable: 'Unavailable', confirmed: 'Confirmed', notConfirmed: 'Not confirmed' },
    noticeTitle: 'The complete team is not confirmed', notice: 'Fictional employees, email addresses, invitations, IAM metrics, access matrix and local status-change controls were removed. An empty or unavailable server circuit is never replaced with demonstration data.',
    boundaryTitle: 'Administration boundary', boundary: 'The browser does not create memberships, assign roles or revoke access. Every command must verify administrator, tenant and organization, require MFA for critical changes, be idempotent, revoke active sessions after privilege reduction and leave an immutable audit trail.',
    currentMembershipTitle: 'Current membership', currentMembershipDetail: 'The only record this screen can confirm through the active server session.',
    capabilities: [
      { title: 'Member list', detail: 'Requires a tenant-scoped read endpoint with minimal personal data and server pagination.' },
      { title: 'Member invitation', detail: 'Requires a one-time token, expiry, domain/organization checks, rate limiting and audit.' },
      { title: 'Role change', detail: 'Requires RBAC/SoD, MFA, optimistic concurrency and prevention of client-side privilege escalation.' },
      { title: 'Access revocation', detail: 'Requires atomic membership deactivation, revocation of all sessions and a recorded reason.' },
    ],
  },
  zh: {
    metadataTitle: '团队与访问 · 透明价格', metadataDescription: '可验证的组织团队边界，不展示虚构成员、邀请或客户端角色管理。',
    eyebrow: '团队与访问', title: '只显示已确认的 membership 和权限', description: '当前用户和 membership 来自活动服务器会话。完整团队、邀请和角色变更不会在浏览器中模拟。',
    statusProfile: '当前 membership 已确认', statusUnavailable: '档案未确认', blocker: '阻塞项', owner: '负责人', impact: '影响', result: '结果', nextAction: '下一步', prioritySection: '主要访问管理任务', factsSection: '已确认事实',
    availableTitle: '启用管理前创建服务器团队登记册', availableDescription: '活动会话只能确认当前用户。成员列表、邀请、角色变更和访问撤销需要独立的 tenant-scoped API、服务器命令和审计。',
    unavailableTitle: '恢复服务器访问档案', unavailableDescription: '`/auth/me` 响应不可用或无效。界面不会替换虚构组织、成员或权限。',
    registryBlocker: '没有已确认的 tenant-scoped 团队登记册和管理命令', profileBlocker: '活动用户和 membership 未确认', ownerValue: '组织管理员 / IAM 负责人',
    registryImpact: '无法安全邀请成员、变更角色或撤销访问', registryResult: '具备 RBAC、MFA、审计和会话撤销的服务器成员登记册', profileImpact: '无法证明组织和当前权限', profileResult: '有效的活动会话 `/auth/me` 档案',
    openProfile: '打开访问档案', openStatus: '检查系统状态',
    facts: { identity: '当前用户', identityHint: '来自 `/auth/me` 的 fullName、email 或服务器 user ID', organization: '组织', organizationHint: '服务器 orgId 和 tenant 边界', membership: 'Membership', membershipHint: '服务器会话中的活动 membership', role: '角色', roleHint: '由服务器分配，不来自 URL 或浏览器状态' },
    values: { unavailable: '不可用', confirmed: '已确认', notConfirmed: '未确认' },
    noticeTitle: '完整团队尚未确认', notice: '已删除虚构员工、邮箱、邀请、IAM 指标、访问矩阵和本地状态变更按钮。空或不可用的服务器闭环不会被演示数据替代。',
    boundaryTitle: '管理边界', boundary: '浏览器不会创建 membership、分配角色或撤销访问。每条命令必须验证管理员、tenant 和组织；关键变更需要 MFA；命令必须幂等；降权后撤销活动会话；并留下不可变审计轨迹。',
    currentMembershipTitle: '当前 membership', currentMembershipDetail: '该页面通过活动服务器会话能够确认的唯一记录。',
    capabilities: [
      { title: '成员列表', detail: '需要 tenant-scoped 读取端点、最小个人数据和服务器分页。' },
      { title: '邀请成员', detail: '需要一次性令牌、有效期、域名/组织校验、限流和审计。' },
      { title: '角色变更', detail: '需要 RBAC/SoD、MFA、乐观并发控制并阻止客户端提权。' },
      { title: '撤销访问', detail: '需要原子停用 membership、撤销全部会话并记录原因。' },
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

export default async function TeamPage() {
  const copy = COPY[localeOf(await getLocale())];
  const profile = await getAuthProfile();
  const identity = profile.fullName || profile.email || profile.id || copy.values.unavailable;
  const role = profile.surfaceRole || profile.role || copy.values.unavailable;
  const priority: OperationalPriority = profile.available
    ? {
        state: 'active',
        title: copy.availableTitle,
        description: copy.availableDescription,
        blocker: copy.registryBlocker,
        owner: copy.ownerValue,
        impact: copy.registryImpact,
        result: copy.registryResult,
        primaryAction: <Link className={operationalCockpitClasses.primaryLink} href='/platform-v7/profile'>{copy.openProfile}</Link>,
        secondaryAction: <Link className={operationalCockpitClasses.secondaryLink} href='/platform-v7/status'>{copy.openStatus}</Link>,
      }
    : {
        state: 'critical',
        title: copy.unavailableTitle,
        description: copy.unavailableDescription,
        blocker: copy.profileBlocker,
        owner: copy.ownerValue,
        impact: copy.profileImpact,
        result: copy.profileResult,
        primaryAction: <Link className={operationalCockpitClasses.primaryLink} href='/platform-v7/profile'>{copy.openProfile}</Link>,
        secondaryAction: <Link className={operationalCockpitClasses.secondaryLink} href='/platform-v7/status'>{copy.openStatus}</Link>,
      };

  return (
    <OperationalDecisionCockpit
      testId='platform-v7-profile-team-v8'
      eyebrow={copy.eyebrow}
      title={copy.title}
      description={copy.description}
      statusLabel={profile.available ? copy.statusProfile : copy.statusUnavailable}
      statusTone={profile.available ? 'information' : 'warning'}
      priority={priority}
      facts={[
        { label: copy.facts.identity, value: identity, hint: copy.facts.identityHint },
        { label: copy.facts.organization, value: profile.orgId || copy.values.unavailable, hint: copy.facts.organizationHint },
        { label: copy.facts.membership, value: profile.membershipId || copy.values.unavailable, hint: copy.facts.membershipHint },
        { label: copy.facts.role, value: role, hint: copy.facts.roleHint },
      ]}
      boundary={copy.boundary}
      labels={{ blocker: copy.blocker, owner: copy.owner, impact: copy.impact, result: copy.result, nextAction: copy.nextAction, prioritySection: copy.prioritySection, factsSection: copy.factsSection }}
    >
      <InlineNotice tone='warning' title={copy.noticeTitle}>{copy.notice}</InlineNotice>

      <OperationalCockpitSection>
        <OperationalQueue>
          <OperationalQueueLink
            href='/platform-v7/profile'
            title={copy.currentMembershipTitle}
            detail={copy.currentMembershipDetail}
            status={<StatusChip tone={profile.available ? 'success' : 'warning'}>{profile.available ? copy.values.confirmed : copy.values.notConfirmed}</StatusChip>}
          />
          {copy.capabilities.map((capability) => (
            <OperationalQueueLink
              key={capability.title}
              href='/platform-v7/api-docs'
              title={capability.title}
              detail={capability.detail}
              status={<StatusChip tone='warning'>{copy.values.notConfirmed}</StatusChip>}
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
