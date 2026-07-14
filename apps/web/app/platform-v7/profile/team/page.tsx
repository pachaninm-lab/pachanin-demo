import type { Metadata } from 'next';
import Link from 'next/link';
import { getLocale } from 'next-intl/server';
import { InlineNotice, StatusChip } from '@pc/design-system-v8';
import { getOrganizationTeam, type OrganizationTeamMember } from '@/lib/organization-team-server';
import {
  OperationalCockpitSection,
  OperationalDecisionCockpit,
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
  statusUnavailable: string;
  blocker: string;
  owner: string;
  impact: string;
  result: string;
  nextAction: string;
  prioritySection: string;
  factsSection: string;
  readyTitle: string;
  readyDescription: string;
  unavailableTitle: string;
  unavailableDescription: string;
  unavailableImpact: string;
  unavailableResult: string;
  ownerValue: string;
  openProfile: string;
  openDeals: string;
  openStatus: string;
  members: string;
  active: string;
  roles: string;
  organization: string;
  currentMembership: string;
  rosterSection: string;
  member: string;
  role: string;
  status: string;
  joined: string;
  membership: string;
  current: string;
  defaultMembership: string;
  activeStatus: string;
  restrictedStatus: string;
  boundaryTitle: string;
  boundary: string;
  empty: string;
  roleLabels: Readonly<Record<string, string>>;
}>;

const COPY: Record<Locale, Copy> = {
  ru: {
    metadataTitle: 'Команда организации · Прозрачная Цена',
    metadataDescription: 'Серверно подтверждённый состав организации без фиктивных приглашений и клиентского назначения ролей.',
    eyebrow: 'Команда организации',
    title: 'Роли и участники из PostgreSQL',
    description: 'Страница показывает только membership активной организации и tenant текущей серверной сессии. Клиент не создаёт участников и не меняет права.',
    statusReady: 'состав подтверждён', statusUnavailable: 'состав недоступен',
    blocker: 'Блокер', owner: 'Ответственный', impact: 'Влияние', result: 'Результат', nextAction: 'Следующее действие',
    prioritySection: 'Главная задача доступа', factsSection: 'Подтверждённые факты',
    readyTitle: 'Проверить разделение полномочий',
    readyDescription: 'Состав организации загружен из серверного membership-контура. Проверь, что денежные, контрольные и операционные роли не совмещены без обоснования.',
    unavailableTitle: 'Восстановить серверный реестр команды',
    unavailableDescription: 'Сервер не подтвердил активный tenant, организацию или membership. Локальный список сотрудников вместо него не показывается.',
    unavailableImpact: 'невозможно доказать, кто имеет доступ к данным и действиям организации',
    unavailableResult: 'валидный tenant-scoped реестр membership',
    ownerValue: 'Администратор организации / безопасность',
    openProfile: 'Открыть профиль', openDeals: 'Открыть Сделки', openStatus: 'Состояние системы',
    members: 'Участников', active: 'Активных', roles: 'Ролей', organization: 'Организация', currentMembership: 'Текущий membership',
    rosterSection: 'Состав команды', member: 'Участник', role: 'Роль', status: 'Статус', joined: 'Присоединился', membership: 'Membership',
    current: 'Текущий', defaultMembership: 'Основной', activeStatus: 'Активен', restrictedStatus: 'Ограничен',
    boundaryTitle: 'Граница управления доступом',
    boundary: 'На этом экране нет фиктивных приглашений, переключателей ролей и локальной блокировки пользователей. Приглашение, изменение роли, приостановка membership и отзыв сессий должны выполняться только отдельными серверными командами с RBAC, MFA, идемпотентностью и audit trail. До их реализации экран остаётся проверяемым read-only реестром.',
    empty: 'В активной организации нет подтверждённых участников.',
    roleLabels: {
      FARMER: 'Продавец', BUYER: 'Покупатель', LOGISTICIAN: 'Логистика', DRIVER: 'Водитель', SURVEYOR: 'Сюрвейер', LAB: 'Лаборатория', ELEVATOR: 'Элеватор', ACCOUNTING: 'Финансы', EXECUTIVE: 'Руководитель', SUPPORT_MANAGER: 'Поддержка', ADMIN: 'Администратор', GUEST: 'Гость', COMPLIANCE_OFFICER: 'Комплаенс', ARBITRATOR: 'Арбитр',
    },
  },
  en: {
    metadataTitle: 'Organization team · Transparent Price',
    metadataDescription: 'Server-confirmed organization membership without fake invitations or client-side role assignment.',
    eyebrow: 'Organization team', title: 'Roles and members from PostgreSQL',
    description: 'This page shows only membership for the active organization and tenant in the current server session. The client cannot create members or change authority.',
    statusReady: 'roster confirmed', statusUnavailable: 'roster unavailable',
    blocker: 'Blocker', owner: 'Owner', impact: 'Impact', result: 'Result', nextAction: 'Next action',
    prioritySection: 'Primary access task', factsSection: 'Confirmed facts',
    readyTitle: 'Review separation of duties',
    readyDescription: 'The organization roster comes from the server membership authority. Verify that money, control and operational roles are not combined without justification.',
    unavailableTitle: 'Restore the server team registry',
    unavailableDescription: 'The server did not confirm the active tenant, organization or membership. No local employee list is substituted.',
    unavailableImpact: 'it is impossible to prove who can access organization data and actions', unavailableResult: 'a valid tenant-scoped membership registry',
    ownerValue: 'Organization administrator / security',
    openProfile: 'Open profile', openDeals: 'Open Deals', openStatus: 'System status',
    members: 'Members', active: 'Active', roles: 'Roles', organization: 'Organization', currentMembership: 'Current membership',
    rosterSection: 'Team roster', member: 'Member', role: 'Role', status: 'Status', joined: 'Joined', membership: 'Membership',
    current: 'Current', defaultMembership: 'Default', activeStatus: 'Active', restrictedStatus: 'Restricted',
    boundaryTitle: 'Access-management boundary',
    boundary: 'This screen has no fake invitations, role toggles or local user blocking. Inviting a member, changing a role, suspending membership and revoking sessions require separate server commands with RBAC, MFA, idempotency and an audit trail. Until those commands exist, this remains a verifiable read-only registry.',
    empty: 'The active organization has no confirmed members.',
    roleLabels: {
      FARMER: 'Seller', BUYER: 'Buyer', LOGISTICIAN: 'Logistics', DRIVER: 'Driver', SURVEYOR: 'Surveyor', LAB: 'Laboratory', ELEVATOR: 'Elevator', ACCOUNTING: 'Finance', EXECUTIVE: 'Executive', SUPPORT_MANAGER: 'Support', ADMIN: 'Administrator', GUEST: 'Guest', COMPLIANCE_OFFICER: 'Compliance', ARBITRATOR: 'Arbitrator',
    },
  },
  zh: {
    metadataTitle: '组织团队 · 透明价格', metadataDescription: '服务器确认的组织 membership，不使用虚假邀请或客户端角色分配。',
    eyebrow: '组织团队', title: '来自 PostgreSQL 的角色和成员',
    description: '此页面仅显示当前服务器会话中活动组织和 tenant 的 membership。客户端不能创建成员或更改权限。',
    statusReady: '名单已确认', statusUnavailable: '名单不可用',
    blocker: '阻塞项', owner: '负责人', impact: '影响', result: '结果', nextAction: '下一步',
    prioritySection: '主要访问任务', factsSection: '已确认事实',
    readyTitle: '检查职责分离', readyDescription: '组织名单来自服务器 membership 权威。需要确认资金、控制和运营角色没有在无依据时合并。',
    unavailableTitle: '恢复服务器团队登记册', unavailableDescription: '服务器未确认活动 tenant、组织或 membership。不会用本地员工列表替代。',
    unavailableImpact: '无法证明谁可以访问组织数据和操作', unavailableResult: '有效的 tenant 范围 membership 登记册',
    ownerValue: '组织管理员 / 安全',
    openProfile: '打开档案', openDeals: '打开交易', openStatus: '系统状态',
    members: '成员', active: '活动', roles: '角色', organization: '组织', currentMembership: '当前 membership',
    rosterSection: '团队名单', member: '成员', role: '角色', status: '状态', joined: '加入时间', membership: 'Membership',
    current: '当前', defaultMembership: '默认', activeStatus: '活动', restrictedStatus: '受限',
    boundaryTitle: '访问管理边界',
    boundary: '此页面没有虚假邀请、角色切换或本地用户封禁。邀请成员、修改角色、暂停 membership 和撤销会话必须通过具有 RBAC、MFA、幂等性和审计轨迹的独立服务器命令完成。在这些命令实现前，本页面保持为可验证的只读登记册。',
    empty: '活动组织中没有已确认成员。',
    roleLabels: {
      FARMER: '卖方', BUYER: '买方', LOGISTICIAN: '物流', DRIVER: '司机', SURVEYOR: '检验员', LAB: '实验室', ELEVATOR: '粮库', ACCOUNTING: '财务', EXECUTIVE: '管理层', SUPPORT_MANAGER: '支持', ADMIN: '管理员', GUEST: '访客', COMPLIANCE_OFFICER: '合规', ARBITRATOR: '仲裁员',
    },
  },
};

function localeOf(value: string): Locale {
  if (value.startsWith('en')) return 'en';
  if (value.startsWith('zh')) return 'zh';
  return 'ru';
}

function roleLabel(copy: Copy, role: string): string {
  return copy.roleLabels[role] ?? role;
}

function memberStatus(copy: Copy, member: OrganizationTeamMember): string {
  return member.userStatus === 'ACTIVE' ? copy.activeStatus : copy.restrictedStatus;
}

function dateLabel(locale: Locale, value: string): string {
  const language = locale === 'zh' ? 'zh-CN' : locale === 'en' ? 'en-GB' : 'ru-RU';
  return new Intl.DateTimeFormat(language, { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(value));
}

export async function generateMetadata(): Promise<Metadata> {
  const copy = COPY[localeOf(await getLocale())];
  return { title: copy.metadataTitle, description: copy.metadataDescription, robots: { index: false, follow: false } };
}

export default async function OrganizationTeamPage() {
  const locale = localeOf(await getLocale());
  const copy = COPY[locale];
  const team = await getOrganizationTeam();
  const activeCount = team.members.filter((member) => member.userStatus === 'ACTIVE').length;
  const roleCount = new Set(team.members.map((member) => member.role)).size;
  const priority: OperationalPriority = team.available
    ? {
        state: 'readonly', title: copy.readyTitle, description: copy.readyDescription,
        owner: copy.ownerValue, result: copy.statusReady,
        primaryAction: <Link className={operationalCockpitClasses.primaryLink} href='/platform-v7/profile'>{copy.openProfile}</Link>,
        secondaryAction: <Link className={operationalCockpitClasses.secondaryLink} href='/platform-v7/deals'>{copy.openDeals}</Link>,
      }
    : {
        state: 'critical', title: copy.unavailableTitle, description: copy.unavailableDescription,
        blocker: copy.unavailableDescription, owner: copy.ownerValue, impact: copy.unavailableImpact, result: copy.unavailableResult,
        primaryAction: <Link className={operationalCockpitClasses.primaryLink} href='/platform-v7/status'>{copy.openStatus}</Link>,
      };

  return (
    <OperationalDecisionCockpit
      testId='platform-v7-profile-team-v8'
      eyebrow={copy.eyebrow}
      title={copy.title}
      description={copy.description}
      statusLabel={team.available ? copy.statusReady : copy.statusUnavailable}
      statusTone={team.available ? 'information' : 'critical'}
      priority={priority}
      labels={{ blocker: copy.blocker, owner: copy.owner, impact: copy.impact, result: copy.result, nextAction: copy.nextAction, prioritySection: copy.prioritySection, factsSection: copy.factsSection }}
      facts={[
        { label: copy.members, value: team.available ? String(team.members.length) : '—', hint: copy.rosterSection },
        { label: copy.active, value: team.available ? String(activeCount) : '—', hint: copy.activeStatus },
        { label: copy.roles, value: team.available ? String(roleCount) : '—', hint: copy.role },
        { label: copy.organization, value: team.organizationId ?? '—', hint: team.tenantId ?? undefined },
        { label: copy.currentMembership, value: team.currentMembershipId ?? '—', hint: copy.current },
      ]}
      boundary={copy.boundary}
    >
      <OperationalCockpitSection id='organization-team-roster'>
        {team.available && team.members.length > 0 ? (
          <div className={operationalCockpitClasses.tableWrap}>
            <table className={operationalCockpitClasses.readOnlyTable}>
              <thead>
                <tr>
                  <th>{copy.member}</th>
                  <th>{copy.role}</th>
                  <th>{copy.status}</th>
                  <th>{copy.joined}</th>
                  <th>{copy.membership}</th>
                </tr>
              </thead>
              <tbody>
                {team.members.map((member) => (
                  <tr key={member.membershipId}>
                    <td>
                      <strong>{member.fullName}</strong><br />
                      <span className={operationalCockpitClasses.muted}>{member.email}</span>
                    </td>
                    <td>{roleLabel(copy, member.role)}</td>
                    <td>
                      <StatusChip tone={member.userStatus === 'ACTIVE' ? 'success' : 'warning'}>{memberStatus(copy, member)}</StatusChip>
                    </td>
                    <td>{dateLabel(locale, member.joinedAt)}</td>
                    <td>
                      {member.membershipId}<br />
                      {member.current ? <StatusChip tone='information'>{copy.current}</StatusChip> : member.isDefault ? <StatusChip tone='neutral'>{copy.defaultMembership}</StatusChip> : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <InlineNotice tone={team.available ? 'information' : 'critical'} title={copy.rosterSection}>{team.available ? copy.empty : copy.unavailableDescription}</InlineNotice>}
      </OperationalCockpitSection>

      <InlineNotice tone='information' title={copy.boundaryTitle}>{copy.boundary}</InlineNotice>
    </OperationalDecisionCockpit>
  );
}
