import type { Metadata } from 'next';
import '@/styles/platform-v7-organization-team-admin.css';
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
import { OrganizationTeamAdminClient } from './OrganizationTeamAdminClient';

type Locale = 'ru' | 'en' | 'zh';
type Copy = Readonly<{
  metaTitle: string; metaDescription: string; eyebrow: string; title: string; description: string;
  ready: string; unavailable: string; blocker: string; owner: string; impact: string; result: string;
  next: string; prioritySection: string; factsSection: string; priorityTitle: string; priorityDescription: string;
  unavailableTitle: string; unavailableDescription: string; unavailableImpact: string; unavailableResult: string;
  ownerValue: string; profile: string; deals: string; system: string; members: string; active: string; roles: string;
  organization: string; membership: string; roster: string; member: string; role: string; status: string; joined: string;
  current: string; primary: string; activeLabel: string; restricted: string; boundaryTitle: string; boundary: string; empty: string;
  roleLabels: Readonly<Record<string, string>>;
}>;

const COPY: Record<Locale, Copy> = {
  ru: {
    metaTitle: 'Команда организации · Прозрачная Цена', metaDescription: 'Серверно подтверждённый состав организации без фиктивных приглашений и клиентского назначения ролей.',
    eyebrow: 'Команда организации', title: 'Роли и участники из PostgreSQL',
    description: 'Показаны только membership активной организации и tenant текущей серверной сессии. Команды администратора проходят серверную MFA, role ceiling и аудит.',
    ready: 'состав подтверждён', unavailable: 'состав недоступен', blocker: 'Блокер', owner: 'Ответственный', impact: 'Влияние', result: 'Результат', next: 'Следующее действие',
    prioritySection: 'Главная задача доступа', factsSection: 'Подтверждённые факты', priorityTitle: 'Проверить разделение полномочий',
    priorityDescription: 'Состав загружен из серверного membership-контура. Денежные, контрольные и операционные роли не должны совмещаться без обоснования.',
    unavailableTitle: 'Восстановить серверный реестр команды', unavailableDescription: 'Сервер не подтвердил активный tenant, организацию или membership. Локальный список сотрудников не подставляется.',
    unavailableImpact: 'невозможно доказать, кто имеет доступ к данным и действиям организации', unavailableResult: 'валидный tenant-scoped реестр membership', ownerValue: 'Администратор организации / безопасность',
    profile: 'Открыть профиль', deals: 'Открыть Сделки', system: 'Состояние системы', members: 'Участников', active: 'Активных', roles: 'Ролей', organization: 'Организация', membership: 'Текущий membership',
    roster: 'Состав команды', member: 'Участник', role: 'Роль', status: 'Статус', joined: 'Присоединился', current: 'Текущий', primary: 'Основной', activeLabel: 'Активен', restricted: 'Ограничен',
    boundaryTitle: 'Граница управления доступом',
    boundary: 'Приглашения, решения по join-заявкам, изменение роли и отзыв membership выполняются сервером с tenant-проверкой, свежей MFA, optimistic concurrency и audit trail. URL и клиентское состояние не выдают полномочия.',
    empty: 'В активной организации нет подтверждённых участников.',
    roleLabels: { FARMER: 'Продавец', BUYER: 'Покупатель', LOGISTICIAN: 'Логистика', DRIVER: 'Водитель', SURVEYOR: 'Сюрвейер', LAB: 'Лаборатория', ELEVATOR: 'Элеватор', ACCOUNTING: 'Финансы', EXECUTIVE: 'Руководитель', SUPPORT_MANAGER: 'Поддержка', ADMIN: 'Администратор', GUEST: 'Гость', COMPLIANCE_OFFICER: 'Комплаенс', ARBITRATOR: 'Арбитр' },
  },
  en: {
    metaTitle: 'Organization team · Transparent Price', metaDescription: 'Server-confirmed organization membership without fake invitations or client-side role assignment.',
    eyebrow: 'Organization team', title: 'Roles and members from PostgreSQL', description: 'Only membership for the active organization and tenant in the current server session is shown. Administrator commands enforce server-side MFA, role ceilings and audit.',
    ready: 'roster confirmed', unavailable: 'roster unavailable', blocker: 'Blocker', owner: 'Owner', impact: 'Impact', result: 'Result', next: 'Next action',
    prioritySection: 'Primary access task', factsSection: 'Confirmed facts', priorityTitle: 'Review separation of duties', priorityDescription: 'The roster comes from the server membership authority. Money, control and operational roles must not be combined without justification.',
    unavailableTitle: 'Restore the server team registry', unavailableDescription: 'The server did not confirm the active tenant, organization or membership. No local employee list is substituted.',
    unavailableImpact: 'who can access organization data and actions cannot be proven', unavailableResult: 'a valid tenant-scoped membership registry', ownerValue: 'Organization administrator / security',
    profile: 'Open profile', deals: 'Open Deals', system: 'System status', members: 'Members', active: 'Active', roles: 'Roles', organization: 'Organization', membership: 'Current membership',
    roster: 'Team roster', member: 'Member', role: 'Role', status: 'Status', joined: 'Joined', current: 'Current', primary: 'Default', activeLabel: 'Active', restricted: 'Restricted',
    boundaryTitle: 'Access-management boundary',
    boundary: 'Invitations, join decisions, role changes and membership revocation run through tenant-scoped server commands with fresh MFA, optimistic concurrency and an audit trail. URLs and client state do not grant authority.',
    empty: 'The active organization has no confirmed members.',
    roleLabels: { FARMER: 'Seller', BUYER: 'Buyer', LOGISTICIAN: 'Logistics', DRIVER: 'Driver', SURVEYOR: 'Surveyor', LAB: 'Laboratory', ELEVATOR: 'Elevator', ACCOUNTING: 'Finance', EXECUTIVE: 'Executive', SUPPORT_MANAGER: 'Support', ADMIN: 'Administrator', GUEST: 'Guest', COMPLIANCE_OFFICER: 'Compliance', ARBITRATOR: 'Arbitrator' },
  },
  zh: {
    metaTitle: '组织团队 · 透明价格', metaDescription: '服务器确认的组织 membership，不使用虚假邀请或客户端角色分配。',
    eyebrow: '组织团队', title: '来自 PostgreSQL 的角色和成员', description: '仅显示当前服务器会话中活动组织和 tenant 的 membership。管理员命令由服务器执行 MFA、角色上限和审计。',
    ready: '名单已确认', unavailable: '名单不可用', blocker: '阻塞项', owner: '负责人', impact: '影响', result: '结果', next: '下一步',
    prioritySection: '主要访问任务', factsSection: '已确认事实', priorityTitle: '检查职责分离', priorityDescription: '名单来自服务器 membership 权威。资金、控制和运营角色不得在无依据时合并。',
    unavailableTitle: '恢复服务器团队登记册', unavailableDescription: '服务器未确认活动 tenant、组织或 membership。不会用本地员工列表替代。',
    unavailableImpact: '无法证明谁可以访问组织数据和操作', unavailableResult: '有效的 tenant 范围 membership 登记册', ownerValue: '组织管理员 / 安全',
    profile: '打开档案', deals: '打开交易', system: '系统状态', members: '成员', active: '活动', roles: '角色', organization: '组织', membership: '当前 membership',
    roster: '团队名单', member: '成员', role: '角色', status: '状态', joined: '加入时间', current: '当前', primary: '默认', activeLabel: '活动', restricted: '受限',
    boundaryTitle: '访问管理边界',
    boundary: '邀请、加入审批、角色变更和 membership 撤销均通过 tenant 范围的服务器命令执行，并要求最新 MFA、乐观并发和审计。URL 和客户端状态不会授予权限。',
    empty: '活动组织中没有已确认成员。',
    roleLabels: { FARMER: '卖方', BUYER: '买方', LOGISTICIAN: '物流', DRIVER: '司机', SURVEYOR: '检验员', LAB: '实验室', ELEVATOR: '粮库', ACCOUNTING: '财务', EXECUTIVE: '管理层', SUPPORT_MANAGER: '支持', ADMIN: '管理员', GUEST: '访客', COMPLIANCE_OFFICER: '合规', ARBITRATOR: '仲裁员' },
  },
};

function localeOf(value: string): Locale { return value.startsWith('en') ? 'en' : value.startsWith('zh') ? 'zh' : 'ru'; }
function roleLabel(copy: Copy, role: string): string { return copy.roleLabels[role] ?? role; }
function statusLabel(copy: Copy, member: OrganizationTeamMember): string { return member.userStatus === 'ACTIVE' && member.membershipStatus === 'ACTIVE' ? copy.activeLabel : copy.restricted; }
function dateLabel(locale: Locale, value: string): string {
  return new Intl.DateTimeFormat(locale === 'zh' ? 'zh-CN' : locale === 'en' ? 'en-GB' : 'ru-RU', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(value));
}

export async function generateMetadata(): Promise<Metadata> {
  const copy = COPY[localeOf(await getLocale())];
  return { title: copy.metaTitle, description: copy.metaDescription, robots: { index: false, follow: false } };
}

export default async function OrganizationTeamPage() {
  const locale = localeOf(await getLocale());
  const copy = COPY[locale];
  const team = await getOrganizationTeam();
  const activeCount = team.members.filter((member) => member.userStatus === 'ACTIVE' && member.membershipStatus === 'ACTIVE').length;
  const roleCount = new Set(team.members.map((member) => member.role)).size;
  const priority: OperationalPriority = team.available ? {
    state: 'readonly', title: copy.priorityTitle, description: copy.priorityDescription, owner: copy.ownerValue, result: copy.ready,
    primaryAction: <Link className={operationalCockpitClasses.primaryLink} href='/platform-v7/profile'>{copy.profile}</Link>,
    secondaryAction: <Link className={operationalCockpitClasses.secondaryLink} href='/platform-v7/deals'>{copy.deals}</Link>,
  } : {
    state: 'critical', title: copy.unavailableTitle, description: copy.unavailableDescription, blocker: copy.unavailableDescription,
    owner: copy.ownerValue, impact: copy.unavailableImpact, result: copy.unavailableResult,
    primaryAction: <Link className={operationalCockpitClasses.primaryLink} href='/platform-v7/status'>{copy.system}</Link>,
  };

  return (
    <OperationalDecisionCockpit testId='platform-v7-profile-team-v8' eyebrow={copy.eyebrow} title={copy.title} description={copy.description}
      statusLabel={team.available ? copy.ready : copy.unavailable} statusTone={team.available ? 'information' : 'critical'} priority={priority}
      labels={{ blocker: copy.blocker, owner: copy.owner, impact: copy.impact, result: copy.result, nextAction: copy.next, prioritySection: copy.prioritySection, factsSection: copy.factsSection }}
      facts={[
        { label: copy.members, value: team.available ? String(team.members.length) : '—', hint: copy.roster },
        { label: copy.active, value: team.available ? String(activeCount) : '—', hint: copy.activeLabel },
        { label: copy.roles, value: team.available ? String(roleCount) : '—', hint: copy.role },
        { label: copy.organization, value: team.organizationName ?? team.organizationId ?? '—', hint: team.tenantId ?? undefined },
        { label: copy.membership, value: team.currentMembershipId ?? '—', hint: copy.current },
      ]} boundary={copy.boundary}>
      <OperationalCockpitSection id='organization-team-roster'>
        {team.available && team.members.length ? <div className={operationalCockpitClasses.tableWrap}>
          <table className={operationalCockpitClasses.readOnlyTable}>
            <thead><tr><th>{copy.member}</th><th>{copy.role}</th><th>{copy.status}</th><th>{copy.joined}</th><th>{copy.membership}</th></tr></thead>
            <tbody>{team.members.map((member) => <tr key={member.membershipId}>
              <td><strong>{member.fullName}</strong><br /><span className={operationalCockpitClasses.muted}>{member.email}</span></td>
              <td>{roleLabel(copy, member.role)}</td>
              <td><StatusChip tone={member.userStatus === 'ACTIVE' && member.membershipStatus === 'ACTIVE' ? 'success' : 'warning'}>{statusLabel(copy, member)}</StatusChip></td>
              <td>{dateLabel(locale, member.joinedAt)}</td>
              <td>{member.membershipId}<br />{member.current ? <StatusChip tone='information'>{copy.current}</StatusChip> : member.isDefault ? <StatusChip tone='neutral'>{copy.primary}</StatusChip> : null}</td>
            </tr>)}</tbody>
          </table>
        </div> : <InlineNotice tone={team.available ? 'information' : 'critical'} title={copy.roster}>{team.available ? copy.empty : copy.unavailableDescription}</InlineNotice>}
      </OperationalCockpitSection>
      {team.available && team.isOrganizationAdmin && team.currentRole && team.currentMembershipId ? (
        <OrganizationTeamAdminClient
          locale={locale}
          currentRole={team.currentRole}
          hasFreshMfa={team.hasFreshMfa}
          currentMembershipId={team.currentMembershipId}
          members={team.members}
        />
      ) : null}
      <InlineNotice tone='information' title={copy.boundaryTitle}>{copy.boundary}</InlineNotice>
    </OperationalDecisionCockpit>
  );
}
