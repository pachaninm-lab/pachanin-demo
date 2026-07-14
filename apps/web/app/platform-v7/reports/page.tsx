import type { Metadata } from 'next';
import Link from 'next/link';
import { getLocale } from 'next-intl/server';
import { InlineNotice, StatusChip } from '@pc/design-system-v8';
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
  statusAvailable: string;
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
  emptyTitle: string;
  emptyDescription: string;
  unavailableTitle: string;
  unavailableDescription: string;
  unavailableImpact: string;
  unavailableResult: string;
  openDeals: string;
  openStatus: string;
  dealSection: string;
  sourcesSection: string;
  boundaryTitle: string;
  boundary: string;
  ownerValue: string;
  impactValue: string;
  resultValue: string;
  buildFromDeal: string;
  facts: Readonly<{
    deals: string;
    dealsHint: string;
    submissions: string;
    submissionsHint: string;
    external: string;
    externalHint: string;
    source: string;
    sourceHint: string;
  }>;
  values: Readonly<{
    notConfirmed: string;
    canonicalDeal: string;
  }>;
  routes: ReadonlyArray<Readonly<{ href: string; title: string; detail: string }>>;
}>;

const COPY: Record<Locale, Copy> = {
  ru: {
    metadataTitle: 'Отчётные основания · Прозрачная Цена',
    metadataDescription: 'Доступ к документам, событиям, деньгам и доказательствам конкретной Сделки без фиктивной отправки отчётов.',
    eyebrow: 'Отчётные основания',
    title: 'Отчёт начинается со Сделки, а не с локального шаблона',
    description: 'Здесь показаны только Сделки, к которым сервер подтвердил участие. Документы, события, деньги и доказательства остаются связанными с одной канонической Сделкой.',
    statusAvailable: 'реестр доступен', statusUnavailable: 'реестр недоступен',
    blocker: 'Блокер', owner: 'Ответственный', impact: 'Влияние', result: 'Результат', nextAction: 'Следующее действие',
    prioritySection: 'Главная отчётная задача', factsSection: 'Подтверждённые факты',
    availableTitle: 'Выбрать Сделку и проверить её основания',
    availableDescription: 'Интерфейс не создаёт локальный отчёт и не имитирует отправку в государственную систему. Сначала проверяются факты конкретной Сделки.',
    emptyTitle: 'Доступных Сделок нет', emptyDescription: 'Отчётные карточки не создаются без серверно подтверждённой Сделки.',
    unavailableTitle: 'Восстановить participant-scoped реестр Сделок',
    unavailableDescription: 'Серверный реестр недоступен или некорректен. Интерфейс не подставляет демонстрационные отчёты.',
    unavailableImpact: 'невозможно подтвердить источник документов, денег и доказательств', unavailableResult: 'валидный серверный реестр и выбранная Сделка',
    openDeals: 'Открыть реестр Сделок', openStatus: 'Состояние системы', dealSection: 'Сделки для отчётной проверки', sourcesSection: 'Источники внутри Сделки', boundaryTitle: 'Граница отправки',
    boundary: 'Платформа не считает отчёт отправленным по нажатию кнопки. Государственная или партнёрская отправка подтверждается внешним идентификатором, подписью, квитанцией, callback и audit trail. Пока такого подтверждения нет, статус остаётся неподтверждённым.',
    ownerValue: 'Владелец Сделки / комплаенс', impactValue: 'доказательность и юридическая исполнимость', resultValue: 'проверенный пакет оснований', buildFromDeal: 'Проверить Сделку',
    facts: {
      deals: 'Доступных Сделок', dealsHint: 'participant-scoped серверный реестр',
      submissions: 'Подтверждённых отправок', submissionsHint: 'нет серверного реестра квитанций отправки',
      external: 'Внешние получатели', externalHint: 'ФГИС, ФНС, Росстат и иные системы требуют отдельной интеграции',
      source: 'Источник отчёта', sourceHint: 'одна каноническая Сделка и её evidence chain',
    },
    values: { notConfirmed: 'Не подтверждены', canonicalDeal: 'Каноническая Сделка' },
    routes: [
      { href: '/platform-v7/documents', title: 'Документы', detail: 'Комплектность, версии, подпись и влияние на деньги.' },
      { href: '/platform-v7/disputes', title: 'Споры и доказательства', detail: 'Удержание, evidence package и решение.' },
      { href: '/platform-v7/bank/release-safety', title: 'Денежное основание', detail: 'Резерв, запрос, callback и reconciliation.' },
      { href: '/platform-v7/deal-logistics', title: 'Логистика и приёмка', detail: 'Рейс, вес, качество и подтверждения доставки.' },
      { href: '/platform-v7/connectors', title: 'Внешние интеграции', detail: 'Диагностика не равна подтверждённой отправке.' },
    ],
  },
  en: {
    metadataTitle: 'Reporting basis · Transparent Price', metadataDescription: 'Access to documents, events, money and evidence of a specific Deal without simulated report submission.',
    eyebrow: 'Reporting basis', title: 'A report starts from a Deal, not a local template',
    description: 'Only Deals for which the server confirmed participation are shown. Documents, events, money and evidence remain linked to one canonical Deal.',
    statusAvailable: 'registry available', statusUnavailable: 'registry unavailable',
    blocker: 'Blocker', owner: 'Owner', impact: 'Impact', result: 'Result', nextAction: 'Next action',
    prioritySection: 'Primary reporting task', factsSection: 'Confirmed facts',
    availableTitle: 'Select a Deal and verify its basis', availableDescription: 'The UI does not create a local report or simulate submission to a state system. Facts of a specific Deal are verified first.',
    emptyTitle: 'No accessible Deals', emptyDescription: 'Reporting cards are not created without a server-confirmed Deal.',
    unavailableTitle: 'Restore the participant-scoped Deal registry', unavailableDescription: 'The server registry is unavailable or invalid. Demonstration reports are not substituted.',
    unavailableImpact: 'document, money and evidence sources cannot be confirmed', unavailableResult: 'a valid server registry and selected Deal',
    openDeals: 'Open Deal registry', openStatus: 'System status', dealSection: 'Deals for reporting review', sourcesSection: 'Sources inside the Deal', boundaryTitle: 'Submission boundary',
    boundary: 'The platform does not treat a report as submitted after a button click. State or partner submission requires an external identifier, signature, receipt, callback and audit trail. Until confirmed, the status remains unverified.',
    ownerValue: 'Deal owner / compliance', impactValue: 'evidence and legal enforceability', resultValue: 'verified basis package', buildFromDeal: 'Review Deal',
    facts: {
      deals: 'Accessible Deals', dealsHint: 'participant-scoped server registry',
      submissions: 'Confirmed submissions', submissionsHint: 'no server receipt registry is available',
      external: 'External recipients', externalHint: 'state and partner systems require separate integration',
      source: 'Report source', sourceHint: 'one canonical Deal and its evidence chain',
    },
    values: { notConfirmed: 'Not confirmed', canonicalDeal: 'Canonical Deal' },
    routes: [
      { href: '/platform-v7/documents', title: 'Documents', detail: 'Completeness, versions, signature and money impact.' },
      { href: '/platform-v7/disputes', title: 'Disputes and evidence', detail: 'Hold, evidence package and decision.' },
      { href: '/platform-v7/bank/release-safety', title: 'Money basis', detail: 'Reserve, request, callback and reconciliation.' },
      { href: '/platform-v7/deal-logistics', title: 'Logistics and acceptance', detail: 'Trip, weight, quality and delivery confirmation.' },
      { href: '/platform-v7/connectors', title: 'External integrations', detail: 'Diagnostics are not a confirmed submission.' },
    ],
  },
  zh: {
    metadataTitle: '报告依据 · 透明价格', metadataDescription: '访问具体交易的文件、事件、资金和证据，不模拟报告提交。',
    eyebrow: '报告依据', title: '报告从交易开始，而不是从本地模板开始',
    description: '这里只显示服务器已确认参与的交易。文件、事件、资金和证据始终关联到同一规范交易。',
    statusAvailable: '登记册可用', statusUnavailable: '登记册不可用',
    blocker: '阻塞项', owner: '负责人', impact: '影响', result: '结果', nextAction: '下一步',
    prioritySection: '主要报告任务', factsSection: '已确认事实',
    availableTitle: '选择交易并检查其依据', availableDescription: '界面不会创建本地报告，也不会模拟向政府系统提交。必须先核对具体交易事实。',
    emptyTitle: '没有可访问的交易', emptyDescription: '没有服务器确认的交易时，不会生成报告卡片。',
    unavailableTitle: '恢复参与方范围的交易登记册', unavailableDescription: '服务器登记册不可用或无效。不会替换为演示报告。',
    unavailableImpact: '无法确认文件、资金和证据来源', unavailableResult: '有效服务器登记册和已选择交易',
    openDeals: '打开交易登记册', openStatus: '系统状态', dealSection: '用于报告检查的交易', sourcesSection: '交易内部来源', boundaryTitle: '提交边界',
    boundary: '点击按钮后，平台不会把报告视为已提交。政府或合作伙伴提交必须有外部标识、签名、回执、回调和审计轨迹。确认前状态保持未验证。',
    ownerValue: '交易负责人 / 合规', impactValue: '证据和法律可执行性', resultValue: '已验证的依据包', buildFromDeal: '检查交易',
    facts: {
      deals: '可访问交易', dealsHint: '参与方范围的服务器登记册',
      submissions: '已确认提交', submissionsHint: '目前没有服务器回执登记册',
      external: '外部接收方', externalHint: '政府和合作伙伴系统需要单独集成',
      source: '报告来源', sourceHint: '一个规范交易及其证据链',
    },
    values: { notConfirmed: '未确认', canonicalDeal: '规范交易' },
    routes: [
      { href: '/platform-v7/documents', title: '文件', detail: '完整性、版本、签名和资金影响。' },
      { href: '/platform-v7/disputes', title: '争议和证据', detail: '冻结、证据包和裁决。' },
      { href: '/platform-v7/bank/release-safety', title: '资金依据', detail: '预留、请求、回调和对账。' },
      { href: '/platform-v7/deal-logistics', title: '物流和验收', detail: '运输、重量、质量和交付确认。' },
      { href: '/platform-v7/connectors', title: '外部集成', detail: '诊断不等于已确认提交。' },
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

export default async function ReportsPage() {
  const copy = COPY[localeOf(await getLocale())];
  const registry = await getReportingRegistry();
  const priority: OperationalPriority = !registry.available
    ? {
        state: 'critical', title: copy.unavailableTitle, description: copy.unavailableDescription,
        blocker: copy.unavailableDescription, owner: copy.ownerValue, impact: copy.unavailableImpact, result: copy.unavailableResult,
        primaryAction: <Link className={operationalCockpitClasses.primaryLink} href='/platform-v7/status'>{copy.openStatus}</Link>,
      }
    : registry.deals.length === 0
      ? {
          state: 'ready', title: copy.emptyTitle, description: copy.emptyDescription, owner: copy.ownerValue,
          result: copy.values.notConfirmed,
          primaryAction: <Link className={operationalCockpitClasses.primaryLink} href='/platform-v7/deals'>{copy.openDeals}</Link>,
        }
      : {
          state: 'active', title: copy.availableTitle, description: copy.availableDescription, owner: copy.ownerValue,
          impact: copy.impactValue, result: copy.resultValue,
          primaryAction: <Link className={operationalCockpitClasses.primaryLink} href={`/platform-v7/deals/${encodeURIComponent(registry.deals[0].id)}`}>{copy.buildFromDeal}</Link>,
          secondaryAction: <Link className={operationalCockpitClasses.secondaryLink} href='/platform-v7/deals'>{copy.openDeals}</Link>,
        };

  return (
    <OperationalDecisionCockpit
      testId='platform-v7-reports-v8'
      eyebrow={copy.eyebrow}
      title={copy.title}
      description={copy.description}
      statusLabel={registry.available ? copy.statusAvailable : copy.statusUnavailable}
      statusTone={registry.available ? 'warning' : 'critical'}
      priority={priority}
      labels={{ blocker: copy.blocker, owner: copy.owner, impact: copy.impact, result: copy.result, nextAction: copy.nextAction, prioritySection: copy.prioritySection, factsSection: copy.factsSection }}
      facts={[
        { label: copy.facts.deals, value: registry.available ? String(registry.deals.length) : '—', hint: copy.facts.dealsHint },
        { label: copy.facts.submissions, value: copy.values.notConfirmed, hint: copy.facts.submissionsHint },
        { label: copy.facts.external, value: copy.values.notConfirmed, hint: copy.facts.externalHint },
        { label: copy.facts.source, value: copy.values.canonicalDeal, hint: copy.facts.sourceHint },
      ]}
      boundary={copy.boundary}
    >
      <OperationalCockpitSection id='reporting-deals'>
        <OperationalQueue>
          {registry.deals.length > 0 ? registry.deals.map((deal) => (
            <OperationalQueueLink
              key={deal.id}
              href={`/platform-v7/deals/${encodeURIComponent(deal.id)}`}
              title={deal.id}
              detail={deal.nextAction || deal.status || copy.values.canonicalDeal}
              status={<StatusChip tone='information'>{copy.buildFromDeal}</StatusChip>}
            />
          )) : (
            <InlineNotice tone={registry.available ? 'information' : 'critical'} title={registry.available ? copy.emptyTitle : copy.unavailableTitle}>
              {registry.available ? copy.emptyDescription : copy.unavailableDescription}
            </InlineNotice>
          )}
        </OperationalQueue>
      </OperationalCockpitSection>

      <OperationalCockpitSection id='reporting-sources'>
        <OperationalQueue>
          {copy.routes.map((route) => (
            <OperationalQueueLink key={route.href} {...route} status={<StatusChip tone='warning'>{copy.values.notConfirmed}</StatusChip>} />
          ))}
        </OperationalQueue>
      </OperationalCockpitSection>

      <InlineNotice tone='information' title={copy.boundaryTitle}>{copy.boundary}</InlineNotice>
    </OperationalDecisionCockpit>
  );
}
