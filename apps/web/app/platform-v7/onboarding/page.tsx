import type { Metadata } from 'next';
import Link from 'next/link';
import { getLocale } from 'next-intl/server';
import { InlineNotice, StatusChip } from '@pc/design-system-v8';
import { getAuthProfile, type AuthProfileSnapshot } from '@/lib/auth-profile-server';
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
type StepKind = 'profile' | 'team' | 'deals' | 'connectors';

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
  readyTitle: string;
  readyDescription: string;
  emptyTitle: string;
  emptyDescription: string;
  mfaTitle: string;
  mfaDescription: string;
  registryTitle: string;
  registryDescription: string;
  unavailableTitle: string;
  unavailableDescription: string;
  unavailableImpact: string;
  unavailableResult: string;
  ownerValue: string;
  mfaImpact: string;
  mfaResult: string;
  registryImpact: string;
  registryResult: string;
  openDeals: string;
  openProfile: string;
  openStatus: string;
  boundaryTitle: string;
  boundary: string;
  values: Readonly<{
    notProvided: string;
    confirmed: string;
    notConfirmed: string;
    unknown: string;
    required: string;
    none: string;
  }>;
  facts: Readonly<{
    identity: string;
    identityHint: string;
    organization: string;
    organizationHint: string;
    membership: string;
    membershipHint: string;
    role: string;
    roleHint: string;
    mfa: string;
    mfaHint: string;
    deals: string;
    dealsHint: string;
  }>;
  steps: ReadonlyArray<Readonly<{ href: string; title: string; detail: string; kind: StepKind }>>;
}>;

const COPY: Record<Locale, Copy> = {
  ru: {
    metadataTitle: 'Подготовка доступа · Прозрачная Цена',
    metadataDescription: 'Проверяемая подготовка пользователя и организации к работе со Сделкой на основании серверной сессии.',
    eyebrow: 'Подготовка доступа',
    title: 'Сначала подтвердить доступ, затем начинать Сделку',
    description: 'Онбординг не выбирает роль и не создаёт организацию в браузере. Он показывает, что подтверждено серверной сессией, и ведёт к следующему реальному действию.',
    statusReady: 'доступ подтверждён', statusIncomplete: 'нужно действие', statusUnavailable: 'контур недоступен',
    blocker: 'Блокер', owner: 'Ответственный', impact: 'Влияние', result: 'Результат', nextAction: 'Следующее действие',
    prioritySection: 'Главная задача подготовки', factsSection: 'Подтверждённые факты',
    readyTitle: 'Продолжить первую доступную Сделку',
    readyDescription: 'Пользователь, организация, membership, роль и MFA подтверждены сервером. Реестр вернул Сделку, к которой подтверждено участие.',
    emptyTitle: 'Доступ подтверждён, доступных Сделок пока нет',
    emptyDescription: 'Интерфейс не создаёт учебную Сделку. Новая Сделка появится только после серверного допуска и участия организации.',
    mfaTitle: 'Подтвердить MFA перед критическими действиями',
    mfaDescription: 'Membership определён, но MFA не подтверждён или сервер не вернул однозначный статус. Интерфейс не может повысить этот статус локально.',
    registryTitle: 'Восстановить participant-scoped реестр Сделок',
    registryDescription: 'Профиль подтверждён, но серверный реестр Сделок недоступен или некорректен. Локальный сценарий вместо него не подставляется.',
    unavailableTitle: 'Восстановить серверный профиль доступа',
    unavailableDescription: 'Ответ `/auth/me` недоступен или некорректен. Локальная карточка пользователя, роль по URL и фиктивная организация не подставляются.',
    unavailableImpact: 'невозможно доказать пользователя, организацию, membership и роль',
    unavailableResult: 'валидный профиль активной серверной сессии',
    ownerValue: 'Пользователь / администратор организации',
    mfaImpact: 'денежные, документные и иные критические действия', mfaResult: 'серверно подтверждённый MFA status',
    registryImpact: 'невозможно определить доступную Сделку и следующее действие', registryResult: 'валидный participant-scoped реестр',
    openDeals: 'Открыть Сделки', openProfile: 'Проверить профиль', openStatus: 'Состояние системы',
    boundaryTitle: 'Граница доступа',
    boundary: 'Этот экран не подключает банк, ФГИС, ЭДО или ЭПД и не выдаёт автоматический допуск ко всем данным. Сервер повторно проверяет активную сессию, tenant, membership, роль, MFA и участие в конкретной Сделке. Внешние контуры подтверждаются отдельно договором, credentials, обменом, callback и эксплуатационными доказательствами.',
    values: { notProvided: 'Не предоставлено', confirmed: 'Подтверждено', notConfirmed: 'Не подтверждено', unknown: 'Неизвестно', required: 'Обязательно', none: 'Нет доступных' },
    facts: {
      identity: 'Пользователь', identityHint: 'fullName, email или server user ID',
      organization: 'Организация', organizationHint: 'server orgId / tenant boundary',
      membership: 'Membership', membershipHint: 'активное членство из `/auth/me`',
      role: 'Роль', roleHint: 'роль назначена сервером, а не URL или клиентом',
      mfa: 'MFA', mfaHint: 'серверный результат проверки',
      deals: 'Доступных Сделок', dealsHint: 'participant-scoped ответ серверного `/deals`',
    },
    steps: [
      { href: '/platform-v7/profile', title: 'Проверить личный доступ', detail: 'Пользователь, организация, membership, роль и MFA берутся только из серверной сессии.', kind: 'profile' },
      { href: '/platform-v7/profile/team', title: 'Проверить команду организации', detail: 'Добавление участников, роли и разделение полномочий требуют серверных admin-команд и аудита.', kind: 'team' },
      { href: '/platform-v7/deals', title: 'Открыть доступную Сделку', detail: 'В реестре видны только Сделки, для которых сервер подтвердил участие.', kind: 'deals' },
      { href: '/platform-v7/connectors', title: 'Проверить внешние контуры', detail: 'Диагностика не доказывает договор, credentials, callback, SLA или production-доступность.', kind: 'connectors' },
    ],
  },
  en: {
    metadataTitle: 'Access preparation · Transparent Price',
    metadataDescription: 'Verifiable user and organization preparation for Deal work based on the server session.',
    eyebrow: 'Access preparation', title: 'Confirm access before starting a Deal',
    description: 'Onboarding does not select a role or create an organization in the browser. It shows what the server session has confirmed and leads to the next real action.',
    statusReady: 'access confirmed', statusIncomplete: 'action required', statusUnavailable: 'circuit unavailable',
    blocker: 'Blocker', owner: 'Owner', impact: 'Impact', result: 'Result', nextAction: 'Next action',
    prioritySection: 'Primary preparation task', factsSection: 'Confirmed facts',
    readyTitle: 'Continue the first accessible Deal',
    readyDescription: 'User, organization, membership, role and MFA are server-confirmed. The registry returned a Deal with confirmed participation.',
    emptyTitle: 'Access confirmed, but no Deals are available yet',
    emptyDescription: 'The UI does not create a training Deal. A Deal appears only after server admission and confirmed organization participation.',
    mfaTitle: 'Confirm MFA before critical actions',
    mfaDescription: 'Membership is known, but MFA is not confirmed or the server returned no unambiguous status. The UI cannot elevate it locally.',
    registryTitle: 'Restore the participant-scoped Deal registry',
    registryDescription: 'The profile is confirmed, but the server Deal registry is unavailable or invalid. No local scenario is substituted.',
    unavailableTitle: 'Restore the server access profile',
    unavailableDescription: 'The `/auth/me` response is unavailable or invalid. No local user card, URL role or fictional organization is substituted.',
    unavailableImpact: 'user, organization, membership and role cannot be proven', unavailableResult: 'a valid active server-session profile',
    ownerValue: 'User / organization administrator',
    mfaImpact: 'money, document and other critical actions', mfaResult: 'server-confirmed MFA status',
    registryImpact: 'the accessible Deal and next action cannot be determined', registryResult: 'a valid participant-scoped registry',
    openDeals: 'Open Deals', openProfile: 'Review profile', openStatus: 'System status',
    boundaryTitle: 'Access boundary',
    boundary: 'This screen does not connect a bank, grain registry, EDI or transport system and does not grant automatic access to all data. The server rechecks the active session, tenant, membership, role, MFA and participation in the specific Deal. External circuits require separate contract, credentials, exchange, callback and operational evidence.',
    values: { notProvided: 'Not provided', confirmed: 'Confirmed', notConfirmed: 'Not confirmed', unknown: 'Unknown', required: 'Required', none: 'None available' },
    facts: {
      identity: 'User', identityHint: 'fullName, email or server user ID',
      organization: 'Organization', organizationHint: 'server orgId / tenant boundary',
      membership: 'Membership', membershipHint: 'active membership from `/auth/me`',
      role: 'Role', roleHint: 'assigned by the server, not URL or client state',
      mfa: 'MFA', mfaHint: 'server verification result',
      deals: 'Accessible Deals', dealsHint: 'participant-scoped response from server `/deals`',
    },
    steps: [
      { href: '/platform-v7/profile', title: 'Review personal access', detail: 'User, organization, membership, role and MFA come only from the server session.', kind: 'profile' },
      { href: '/platform-v7/profile/team', title: 'Review organization team', detail: 'Participants, roles and separation of authority require server admin commands and audit.', kind: 'team' },
      { href: '/platform-v7/deals', title: 'Open an accessible Deal', detail: 'The registry contains only Deals for which the server confirmed participation.', kind: 'deals' },
      { href: '/platform-v7/connectors', title: 'Review external circuits', detail: 'Diagnostics do not prove a contract, credentials, callback, SLA or production availability.', kind: 'connectors' },
    ],
  },
  zh: {
    metadataTitle: '访问准备 · 透明价格', metadataDescription: '基于服务器会话，为用户和组织进入交易工作提供可验证准备。',
    eyebrow: '访问准备', title: '先确认访问权限，再开始交易',
    description: '入驻页面不会在浏览器中选择角色或创建组织。它只显示服务器会话已确认的内容，并引导用户完成下一个真实操作。',
    statusReady: '访问已确认', statusIncomplete: '需要操作', statusUnavailable: '闭环不可用',
    blocker: '阻塞项', owner: '负责人', impact: '影响', result: '结果', nextAction: '下一步',
    prioritySection: '主要准备任务', factsSection: '已确认事实',
    readyTitle: '继续第一笔可访问交易', readyDescription: '用户、组织、membership、角色和 MFA 已由服务器确认。登记册返回了参与关系已确认的交易。',
    emptyTitle: '访问已确认，但暂时没有可用交易', emptyDescription: '界面不会创建培训交易。只有服务器准入并确认组织参与后，交易才会出现。',
    mfaTitle: '关键操作前确认 MFA', mfaDescription: 'Membership 已确定，但 MFA 未确认，或服务器没有返回明确状态。界面不能在本地提升该状态。',
    registryTitle: '恢复参与方范围的交易登记册', registryDescription: '档案已确认，但服务器交易登记册不可用或无效。不会用本地场景替代。',
    unavailableTitle: '恢复服务器访问档案', unavailableDescription: '`/auth/me` 响应不可用或无效。不会替换为本地用户卡、URL 角色或虚构组织。',
    unavailableImpact: '无法证明用户、组织、membership 和角色', unavailableResult: '有效的活动服务器会话档案',
    ownerValue: '用户 / 组织管理员', mfaImpact: '资金、文件和其他关键操作', mfaResult: '服务器确认的 MFA 状态',
    registryImpact: '无法确定可访问交易和下一步操作', registryResult: '有效的参与方范围登记册',
    openDeals: '打开交易', openProfile: '检查档案', openStatus: '系统状态',
    boundaryTitle: '访问边界',
    boundary: '此页面不会连接银行、粮食登记、电子单证或运输系统，也不会自动授予所有数据的访问权限。服务器会再次检查活动会话、tenant、membership、角色、MFA 以及对具体交易的参与关系。外部闭环需要单独的合同、凭证、交换、callback 和运行证据。',
    values: { notProvided: '未提供', confirmed: '已确认', notConfirmed: '未确认', unknown: '未知', required: '必须', none: '暂无' },
    facts: {
      identity: '用户', identityHint: 'fullName、email 或服务器 user ID',
      organization: '组织', organizationHint: '服务器 orgId / tenant 边界',
      membership: 'Membership', membershipHint: '来自 `/auth/me` 的活动 membership',
      role: '角色', roleHint: '由服务器分配，而不是 URL 或客户端状态',
      mfa: 'MFA', mfaHint: '服务器验证结果',
      deals: '可访问交易', dealsHint: '服务器 `/deals` 返回的参与方范围结果',
    },
    steps: [
      { href: '/platform-v7/profile', title: '检查个人访问', detail: '用户、组织、membership、角色和 MFA 仅来自服务器会话。', kind: 'profile' },
      { href: '/platform-v7/profile/team', title: '检查组织团队', detail: '参与者、角色和权限分离需要服务器 admin 命令和审计。', kind: 'team' },
      { href: '/platform-v7/deals', title: '打开可访问交易', detail: '登记册只包含服务器已确认参与关系的交易。', kind: 'deals' },
      { href: '/platform-v7/connectors', title: '检查外部闭环', detail: '诊断不能证明合同、凭证、callback、SLA 或生产可用性。', kind: 'connectors' },
    ],
  },
};

function localeOf(value: string): Locale {
  if (value.startsWith('en')) return 'en';
  if (value.startsWith('zh')) return 'zh';
  return 'ru';
}

function identity(profile: AuthProfileSnapshot, copy: Copy): string {
  return profile.fullName || profile.email || profile.id || copy.values.notProvided;
}

function mfaValue(profile: AuthProfileSnapshot, copy: Copy): string {
  if (profile.mfaVerified === true) return copy.values.confirmed;
  if (profile.mfaVerified === false) return copy.values.notConfirmed;
  return copy.values.unknown;
}

export async function generateMetadata(): Promise<Metadata> {
  const copy = COPY[localeOf(await getLocale())];
  return { title: copy.metadataTitle, description: copy.metadataDescription, robots: { index: false, follow: false } };
}

export default async function PlatformV7OnboardingPage() {
  const copy = COPY[localeOf(await getLocale())];
  const [profile, registry] = await Promise.all([getAuthProfile(), getReportingRegistry()]);
  const mfaConfirmed = profile.available && profile.mfaVerified === true;
  const firstDeal = registry.available ? registry.deals[0] : undefined;
  const priority: OperationalPriority = !profile.available
    ? {
        state: 'critical', title: copy.unavailableTitle, description: copy.unavailableDescription,
        blocker: copy.unavailableDescription, owner: copy.ownerValue, impact: copy.unavailableImpact, result: copy.unavailableResult,
        primaryAction: <Link className={operationalCockpitClasses.primaryLink} href='/platform-v7/status'>{copy.openStatus}</Link>,
      }
    : !mfaConfirmed
      ? {
          state: 'active', title: copy.mfaTitle, description: copy.mfaDescription,
          blocker: copy.mfaDescription, owner: copy.ownerValue, impact: copy.mfaImpact, result: copy.mfaResult,
          primaryAction: <Link className={operationalCockpitClasses.primaryLink} href='/platform-v7/profile'>{copy.openProfile}</Link>,
        }
      : !registry.available
        ? {
            state: 'critical', title: copy.registryTitle, description: copy.registryDescription,
            blocker: copy.registryDescription, owner: copy.ownerValue, impact: copy.registryImpact, result: copy.registryResult,
            primaryAction: <Link className={operationalCockpitClasses.primaryLink} href='/platform-v7/status'>{copy.openStatus}</Link>,
          }
        : firstDeal
          ? {
              state: 'ready', title: copy.readyTitle, description: copy.readyDescription,
              owner: copy.ownerValue, result: copy.values.confirmed,
              primaryAction: <Link className={operationalCockpitClasses.primaryLink} href={`/platform-v7/deals/${encodeURIComponent(firstDeal.id)}`}>{copy.openDeals}</Link>,
              secondaryAction: <Link className={operationalCockpitClasses.secondaryLink} href='/platform-v7/profile'>{copy.openProfile}</Link>,
            }
          : {
              state: 'ready', title: copy.emptyTitle, description: copy.emptyDescription,
              owner: copy.ownerValue, result: copy.values.none,
              primaryAction: <Link className={operationalCockpitClasses.primaryLink} href='/platform-v7/deals'>{copy.openDeals}</Link>,
              secondaryAction: <Link className={operationalCockpitClasses.secondaryLink} href='/platform-v7/profile'>{copy.openProfile}</Link>,
            };

  const stepTone = (kind: StepKind) => {
    if (!profile.available) return 'critical' as const;
    if (kind === 'profile') return 'success' as const;
    if (kind === 'deals') {
      if (!registry.available) return 'critical' as const;
      return registry.deals.length > 0 ? 'success' as const : 'information' as const;
    }
    return 'warning' as const;
  };

  const stepStatus = (kind: StepKind) => {
    if (!profile.available) return copy.values.notConfirmed;
    if (kind === 'profile') return copy.values.confirmed;
    if (kind === 'deals') {
      if (!registry.available) return copy.values.notConfirmed;
      return registry.deals.length > 0 ? copy.values.confirmed : copy.values.none;
    }
    return copy.values.required;
  };

  return (
    <OperationalDecisionCockpit
      testId='platform-v7-onboarding-v8'
      eyebrow={copy.eyebrow}
      title={copy.title}
      description={copy.description}
      statusLabel={!profile.available || !registry.available ? copy.statusUnavailable : mfaConfirmed ? copy.statusReady : copy.statusIncomplete}
      statusTone={!profile.available || !registry.available ? 'critical' : mfaConfirmed ? 'success' : 'warning'}
      priority={priority}
      labels={{ blocker: copy.blocker, owner: copy.owner, impact: copy.impact, result: copy.result, nextAction: copy.nextAction, prioritySection: copy.prioritySection, factsSection: copy.factsSection }}
      facts={[
        { label: copy.facts.identity, value: profile.available ? identity(profile, copy) : copy.values.notProvided, hint: copy.facts.identityHint },
        { label: copy.facts.organization, value: profile.orgId || copy.values.notProvided, hint: copy.facts.organizationHint },
        { label: copy.facts.membership, value: profile.membershipId || copy.values.notProvided, hint: copy.facts.membershipHint },
        { label: copy.facts.role, value: profile.surfaceRole || profile.role || copy.values.notProvided, hint: copy.facts.roleHint },
        { label: copy.facts.mfa, value: mfaValue(profile, copy), hint: copy.facts.mfaHint },
        { label: copy.facts.deals, value: registry.available ? String(registry.deals.length) : '—', hint: copy.facts.dealsHint },
      ]}
      boundary={copy.boundary}
    >
      <OperationalCockpitSection id='onboarding-steps'>
        <OperationalQueue>
          {copy.steps.map((step) => (
            <OperationalQueueLink
              key={step.href}
              href={step.href}
              title={step.title}
              detail={step.detail}
              status={<StatusChip tone={stepTone(step.kind)}>{stepStatus(step.kind)}</StatusChip>}
            />
          ))}
        </OperationalQueue>
      </OperationalCockpitSection>

      <InlineNotice tone='information' title={copy.boundaryTitle}>{copy.boundary}</InlineNotice>
    </OperationalDecisionCockpit>
  );
}
