import Link from 'next/link';
import { getLocale } from 'next-intl/server';
import { EmptyState } from '@pc/design-system-v8';
import { CollapsibleSection } from '@/components/platform-v7/CollapsibleSection';
import { EvidenceStrengthMeter } from '@/components/platform-v7/visual/EvidenceStrengthMeter';
import { RoleExecutionHandoff, type HandoffItem } from '@/components/platform-v7/RoleExecutionHandoff';
import { EvidenceDecisionPanel } from '@/components/platform-v7/EvidenceDecisionPanel';
import { EvidenceReadinessMiniMatrix } from '@/components/platform-v7/EvidenceReadinessMiniMatrix';
import { DecisionRecommendationStrip } from '@/components/platform-v7/DecisionRecommendationStrip';
import { ActionFeedbackPreviewStrip } from '@/components/platform-v7/ActionFeedbackPreviewStrip';
import { LiveApiStatusBar } from '@/components/platform-v7/LiveApiStatusBar';
import {
  getDisputes,
  disputeTotalHeldRub,
  openDisputeCount,
  type DisputeServerItem,
} from '@/lib/disputes-server';
import {
  OperationalCockpitSection,
  OperationalDecisionCockpit,
  OperationalQueue,
  OperationalQueueLink,
  operationalCockpitClasses,
  type OperationalCockpitLabels,
} from '@/components/transaction-ux/OperationalDecisionCockpit';

type Locale = 'ru' | 'en' | 'zh';

type Copy = {
  eyebrow: string;
  title: string;
  description: string;
  openStatus: string;
  clearStatus: string;
  fallbackStatus: string;
  activeTitle: (id: string) => string;
  noActiveTitle: string;
  activeDescription: string;
  noActiveDescription: string;
  blocker: string;
  noBlocker: string;
  owner: string;
  impact: string;
  result: string;
  openDispute: string;
  audit: string;
  deals: string;
  facts: {
    open: string;
    held: string;
    evidence: string;
    deadline: string;
    serverHint: string;
    fallbackHint: string;
    heldHint: string;
    evidenceHint: string;
    deadlineHint: string;
  };
  boundary: string;
  fallbackBoundary: string;
  queueTitle: string;
  queueSummary: string;
  statusOpen: string;
  statusReview: string;
  noAmount: string;
  noDeadline: string;
  noOwner: string;
  emptyQueueTitle: string;
  emptyQueueDescription: string;
  evidenceTitle: string;
  evidenceSummary: string;
  decisionTitle: string;
  decisionSummary: string;
  handoffTitle: string;
  handoff: HandoffItem[];
  liveRole: string;
  liveSummary: (count: number, amount: string, fallback: boolean) => string;
  evidenceFactors: [string, string, string, string];
  labels: OperationalCockpitLabels;
};

const COPY: Record<Locale, Copy> = {
  ru: {
    eyebrow: 'Спор · доказательства → решение → основание',
    title: 'Спор объясняет, почему сумма удержана',
    description: 'Очередь строится по данным сервера. Сначала видны сумма, причина, срок, ответственный и действие; доказательства и решение раскрываются ниже.',
    openStatus: 'есть открытые споры',
    clearStatus: 'очередь чистая',
    fallbackStatus: 'сервер споров недоступен',
    activeTitle: (id) => `Рассмотреть спор ${id}`,
    noActiveTitle: 'Открытых споров нет',
    activeDescription: 'Проверьте акт, вес, фото, протокол, временные метки и журнал. Решение должно содержать сумму, основание и следующий шаг.',
    noActiveDescription: 'Новый спор появится только после серверной регистрации и привязки к конкретной Сделке.',
    blocker: 'доказательный пакет требует решения',
    noBlocker: 'нет активного блокера',
    owner: 'арбитр → оператор → банк',
    impact: 'удержание сохраняется до подтверждённого решения',
    result: 'мотивированное решение + журнал + банковское основание',
    openDispute: 'Открыть спор',
    audit: 'Журнал Сделки',
    deals: 'Реестр Сделок',
    facts: {
      open: 'Открытых споров',
      held: 'Удержано',
      evidence: 'Доказательств',
      deadline: 'Ближайший срок',
      serverHint: 'только зарегистрированные сервером дела',
      fallbackHint: 'показаны резервные данные, не основание для решения',
      heldHint: 'интерфейс не выпускает спорную сумму',
      evidenceHint: 'по приоритетному спору',
      deadlineHint: 'SLA из данных спора',
    },
    boundary: 'Арбитр формирует мотивированное решение. Платформа не меняет лабораторный факт, не подписывает документы за стороны и не подтверждает движение денег.',
    fallbackBoundary: 'Сервер споров недоступен. Резервные строки показаны только для устойчивости интерфейса и не могут использоваться как юридическое или денежное основание.',
    queueTitle: 'Очередь споров',
    queueSummary: 'сумма · причина · SLA · ответственный',
    statusOpen: 'открыт',
    statusReview: 'на рассмотрении',
    noAmount: 'сумма не указана',
    noDeadline: 'срок не установлен',
    noOwner: 'ответственный не назначен',
    emptyQueueTitle: 'Споров, требующих решения, нет',
    emptyQueueDescription: 'Очередь появится после серверной регистрации спора и проверки доступа к Сделке.',
    evidenceTitle: 'Доказательный пакет',
    evidenceSummary: 'готовность · источник · непротиворечивость',
    decisionTitle: 'Решение и рекомендации',
    decisionSummary: 'основание · следующий шаг · обратная связь',
    handoffTitle: 'Передача между элеватором, лабораторией, арбитром, оператором и банком',
    handoff: [
      { direction: 'awaits', role: 'арбитр ← элеватор', requirement: 'акт расхождения и весовая ведомость', documentImpact: true, moneyImpact: true },
      { direction: 'awaits', role: 'арбитр ← лаборатория', requirement: 'подписанный протокол качества', documentImpact: true, moneyImpact: true },
      { direction: 'sends', role: 'арбитр → оператор', requirement: 'мотивированное решение и сумма', documentImpact: true, moneyImpact: true },
      { direction: 'sends', role: 'оператор → банк', requirement: 'проверенное основание, а не команда на выплату', documentImpact: true, moneyImpact: true },
    ],
    liveRole: 'ARBITRATOR · Споры и доказательства',
    liveSummary: (count, amount, fallback) => `${fallback ? 'резервные данные · ' : ''}${count} открытых споров · ${amount} удержано`,
    evidenceFactors: ['Доказательства со ссылкой на источник', 'Временная шкала событий', 'Подписанные акты и протоколы', 'Неизменяемый журнал аудита'],
    labels: {
      blocker: 'Блокер', owner: 'Ответственный', impact: 'Влияние', result: 'Результат', nextAction: 'Следующее действие', prioritySection: 'Главная задача по спору', factsSection: 'Ключевые факты спора',
    },
  },
  en: {
    eyebrow: 'Dispute · evidence → decision → basis',
    title: 'A dispute explains why money is held',
    description: 'The queue is built from server data. Amount, reason, deadline, owner and action come first; evidence and decision details are disclosed below.',
    openStatus: 'open disputes require action',
    clearStatus: 'queue clear',
    fallbackStatus: 'dispute server unavailable',
    activeTitle: (id) => `Review dispute ${id}`,
    noActiveTitle: 'No open disputes',
    activeDescription: 'Review the act, weight data, photos, protocol, timestamps and journal. The decision must include amount, basis and next step.',
    noActiveDescription: 'A new dispute appears only after server registration and linkage to a specific Deal.',
    blocker: 'the evidence package requires a decision',
    noBlocker: 'no active blocker',
    owner: 'arbitrator → operator → bank',
    impact: 'the hold remains until a verified decision exists',
    result: 'reasoned decision + journal + bank basis',
    openDispute: 'Open dispute',
    audit: 'Deal journal',
    deals: 'Deal registry',
    facts: {
      open: 'Open disputes', held: 'Held amount', evidence: 'Evidence items', deadline: 'Nearest deadline',
      serverHint: 'server-registered cases only', fallbackHint: 'fallback data, not a decision basis', heldHint: 'the interface cannot release the disputed amount', evidenceHint: 'for the priority dispute', deadlineHint: 'SLA from dispute data',
    },
    boundary: 'The arbitrator creates a reasoned decision. The platform does not alter laboratory facts, sign for parties or confirm movement of money.',
    fallbackBoundary: 'The dispute server is unavailable. Fallback rows exist only for interface resilience and cannot be used as a legal or monetary basis.',
    queueTitle: 'Dispute queue',
    queueSummary: 'amount · reason · SLA · owner',
    statusOpen: 'open',
    statusReview: 'under review',
    noAmount: 'amount not specified',
    noDeadline: 'no deadline',
    noOwner: 'owner not assigned',
    emptyQueueTitle: 'No disputes require a decision',
    emptyQueueDescription: 'The queue appears after server registration and Deal-access verification.',
    evidenceTitle: 'Evidence package',
    evidenceSummary: 'readiness · source · consistency',
    decisionTitle: 'Decision and recommendations',
    decisionSummary: 'basis · next step · feedback',
    handoffTitle: 'Handoff between elevator, laboratory, arbitrator, operator and bank',
    handoff: [
      { direction: 'awaits', role: 'arbitrator ← elevator', requirement: 'discrepancy act and weight record', documentImpact: true, moneyImpact: true },
      { direction: 'awaits', role: 'arbitrator ← laboratory', requirement: 'signed quality protocol', documentImpact: true, moneyImpact: true },
      { direction: 'sends', role: 'arbitrator → operator', requirement: 'reasoned decision and amount', documentImpact: true, moneyImpact: true },
      { direction: 'sends', role: 'operator → bank', requirement: 'verified basis, not a payout command', documentImpact: true, moneyImpact: true },
    ],
    liveRole: 'ARBITRATOR · Disputes and evidence',
    liveSummary: (count, amount, fallback) => `${fallback ? 'fallback data · ' : ''}${count} open disputes · ${amount} held`,
    evidenceFactors: ['Source-linked evidence', 'Event timeline', 'Signed acts and protocols', 'Immutable audit trail'],
    labels: {
      blocker: 'Blocker', owner: 'Owner', impact: 'Impact', result: 'Result', nextAction: 'Next action', prioritySection: 'Priority dispute task', factsSection: 'Key dispute facts',
    },
  },
  zh: {
    eyebrow: '争议 · 证据 → 裁决 → 依据',
    title: '争议说明资金为何被冻结',
    description: '队列来自服务器数据。首先显示金额、原因、期限、负责人和操作；证据与裁决细节在下方展开。',
    openStatus: '存在待处理争议',
    clearStatus: '队列为空',
    fallbackStatus: '争议服务器不可用',
    activeTitle: (id) => `审查争议 ${id}`,
    noActiveTitle: '没有未决争议',
    activeDescription: '检查差异单、重量、照片、质量报告、时间戳和日志。裁决必须包含金额、依据和下一步。',
    noActiveDescription: '只有服务器登记并关联到具体交易后，新争议才会出现。',
    blocker: '证据包需要裁决',
    noBlocker: '没有活动阻塞项',
    owner: '仲裁员 → 运营人员 → 银行',
    impact: '在形成已验证裁决前冻结继续有效',
    result: '有理由的裁决 + 日志 + 银行依据',
    openDispute: '打开争议',
    audit: '交易日志',
    deals: '交易登记册',
    facts: {
      open: '未决争议', held: '冻结金额', evidence: '证据数量', deadline: '最近期限',
      serverHint: '仅服务器登记的案件', fallbackHint: '备用数据，不能作为裁决依据', heldHint: '界面不能释放争议金额', evidenceHint: '针对优先争议', deadlineHint: '来自争议数据的 SLA',
    },
    boundary: '仲裁员形成有理由的裁决。平台不更改实验室事实、不代表交易方签署，也不确认资金流动。',
    fallbackBoundary: '争议服务器不可用。备用记录仅用于界面韧性，不能作为法律或资金依据。',
    queueTitle: '争议队列',
    queueSummary: '金额 · 原因 · SLA · 负责人',
    statusOpen: '未决',
    statusReview: '审查中',
    noAmount: '未指定金额',
    noDeadline: '未设置期限',
    noOwner: '未指定负责人',
    emptyQueueTitle: '没有需要裁决的争议',
    emptyQueueDescription: '服务器登记争议并验证交易访问权限后，队列才会出现。',
    evidenceTitle: '证据包',
    evidenceSummary: '就绪度 · 来源 · 一致性',
    decisionTitle: '裁决和建议',
    decisionSummary: '依据 · 下一步 · 反馈',
    handoffTitle: '粮库、实验室、仲裁员、运营人员和银行之间的交接',
    handoff: [
      { direction: 'awaits', role: '仲裁员 ← 粮库', requirement: '差异单和称重记录', documentImpact: true, moneyImpact: true },
      { direction: 'awaits', role: '仲裁员 ← 实验室', requirement: '已签署质量报告', documentImpact: true, moneyImpact: true },
      { direction: 'sends', role: '仲裁员 → 运营人员', requirement: '有理由的裁决和金额', documentImpact: true, moneyImpact: true },
      { direction: 'sends', role: '运营人员 → 银行', requirement: '已验证依据，而不是付款指令', documentImpact: true, moneyImpact: true },
    ],
    liveRole: 'ARBITRATOR · 争议和证据',
    liveSummary: (count, amount, fallback) => `${fallback ? '备用数据 · ' : ''}${count} 个未决争议 · 冻结 ${amount}`,
    evidenceFactors: ['关联来源的证据', '事件时间线', '已签署的差异单和报告', '不可变审计日志'],
    labels: {
      blocker: '阻塞项', owner: '负责人', impact: '影响', result: '结果', nextAction: '下一步', prioritySection: '优先争议任务', factsSection: '争议关键事实',
    },
  },
};

function normalizeLocale(value: string): Locale {
  if (value.startsWith('en')) return 'en';
  if (value.startsWith('zh')) return 'zh';
  return 'ru';
}

function formatMoney(rub: number, locale: Locale): string {
  return new Intl.NumberFormat(locale === 'zh' ? 'zh-CN' : locale === 'en' ? 'en-GB' : 'ru-RU', {
    style: 'currency',
    currency: 'RUB',
    maximumFractionDigits: 0,
  }).format(rub);
}

function formatDeadline(dispute: DisputeServerItem | undefined, locale: Locale, fallback: string): string {
  if (!dispute?.slaDeadline) return fallback;
  const value = new Date(dispute.slaDeadline);
  if (Number.isNaN(value.getTime())) return fallback;
  return new Intl.DateTimeFormat(locale === 'zh' ? 'zh-CN' : locale === 'en' ? 'en-GB' : 'ru-RU', {
    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
  }).format(value);
}

function isFallbackData(disputes: DisputeServerItem[]): boolean {
  return disputes.length > 0 && disputes.every((dispute) => dispute.id === 'DISPUTE-001' || dispute.id === 'DISPUTE-002');
}

function severityRank(severity: DisputeServerItem['severity']): number {
  if (severity === 'CRITICAL') return 0;
  if (severity === 'HIGH') return 1;
  if (severity === 'MEDIUM') return 2;
  return 3;
}

function sortActiveDisputes(disputes: DisputeServerItem[]): DisputeServerItem[] {
  return disputes
    .filter((dispute) => dispute.status === 'OPEN' || dispute.status === 'UNDER_REVIEW')
    .sort((left, right) => {
      const severity = severityRank(left.severity) - severityRank(right.severity);
      if (severity !== 0) return severity;
      const leftDeadline = left.slaDeadline ? Date.parse(left.slaDeadline) : Number.POSITIVE_INFINITY;
      const rightDeadline = right.slaDeadline ? Date.parse(right.slaDeadline) : Number.POSITIVE_INFINITY;
      return leftDeadline - rightDeadline;
    });
}

export default async function PlatformV7DisputesPage() {
  const locale = normalizeLocale(await getLocale());
  const copy = COPY[locale];
  const disputes = await getDisputes();
  const fallback = isFallbackData(disputes);
  const activeDisputes = sortActiveDisputes(disputes);
  const active = activeDisputes[0];
  const heldRub = disputeTotalHeldRub(disputes);
  const disputeCount = openDisputeCount(disputes);
  const evidenceCount = active?.evidenceCount ?? 0;
  const heldLabel = formatMoney(heldRub, locale);
  const activeDisputeHref = active ? `/platform-v7/disputes/${encodeURIComponent(active.id)}` : '/platform-v7/disputes';
  const auditHref = active ? `/platform-v7/deals/${encodeURIComponent(active.dealId)}/audit` : '/platform-v7/deals';

  const liveBlockers = activeDisputes.map((dispute) => ({
    id: dispute.id,
    label: `${dispute.id}: ${dispute.description.slice(0, 72)}`,
    severity: (dispute.severity === 'HIGH' || dispute.severity === 'CRITICAL' ? 'stop' : 'warn') as 'stop' | 'warn',
    responsibleRole: 'ARBITRATOR',
    nextAction: dispute.status === 'OPEN' ? copy.openDispute : copy.statusReview,
  }));

  return (
    <OperationalDecisionCockpit
      testId='platform-v7-disputes-v8'
      eyebrow={copy.eyebrow}
      title={copy.title}
      description={copy.description}
      statusLabel={fallback ? copy.fallbackStatus : disputeCount > 0 ? copy.openStatus : copy.clearStatus}
      statusTone={fallback ? 'warning' : disputeCount > 0 ? 'critical' : 'success'}
      labels={copy.labels}
      liveStatus={(
        <LiveApiStatusBar
          apiOnline={!fallback}
          blockers={liveBlockers}
          openDisputes={disputeCount}
          role={copy.liveRole}
          summary={copy.liveSummary(disputeCount, heldLabel, fallback)}
        />
      )}
      priority={{
        state: active ? 'critical' : 'ready',
        title: active ? copy.activeTitle(active.id) : copy.noActiveTitle,
        description: active ? copy.activeDescription : copy.noActiveDescription,
        blocker: active ? copy.blocker : copy.noBlocker,
        owner: active?.owner ?? copy.owner,
        impact: copy.impact,
        result: copy.result,
        primaryAction: active ? <Link className={operationalCockpitClasses.primaryLink} href={activeDisputeHref}>{copy.openDispute}</Link> : undefined,
        secondaryAction: <Link className={operationalCockpitClasses.secondaryLink} href={auditHref}>{active ? copy.audit : copy.deals}</Link>,
      }}
      facts={[
        { label: copy.facts.open, value: String(disputeCount), hint: fallback ? copy.facts.fallbackHint : copy.facts.serverHint },
        { label: copy.facts.held, value: heldLabel, hint: copy.facts.heldHint },
        { label: copy.facts.evidence, value: String(evidenceCount), hint: copy.facts.evidenceHint },
        { label: copy.facts.deadline, value: formatDeadline(active, locale, copy.noDeadline), hint: copy.facts.deadlineHint },
      ]}
      boundary={fallback ? copy.fallbackBoundary : copy.boundary}
    >
      <OperationalCockpitSection id='dispute-queue'>
        <CollapsibleSection title={copy.queueTitle} summary={copy.queueSummary} defaultOpen>
          {activeDisputes.length > 0 ? (
            <OperationalQueue>
              {activeDisputes.map((dispute) => (
                <OperationalQueueLink
                  key={dispute.id}
                  href={`/platform-v7/disputes/${encodeURIComponent(dispute.id)}`}
                  title={`${dispute.id} · ${dispute.status === 'OPEN' ? copy.statusOpen : copy.statusReview}`}
                  detail={`${dispute.description} · ${formatMoney(dispute.claimAmountRub ?? dispute.moneyHold?.amountRub ?? 0, locale)} · ${formatDeadline(dispute, locale, copy.noDeadline)} · ${dispute.owner ?? copy.noOwner}`}
                />
              ))}
            </OperationalQueue>
          ) : (
            <EmptyState title={copy.emptyQueueTitle} description={copy.emptyQueueDescription} />
          )}
        </CollapsibleSection>
        <RoleExecutionHandoff items={copy.handoff} title={copy.handoffTitle} />
      </OperationalCockpitSection>

      <CollapsibleSection title={copy.evidenceTitle} summary={copy.evidenceSummary} defaultOpen={false}>
        <EvidenceStrengthMeter
          score={Math.min(evidenceCount * 10, 40)}
          maxScore={40}
          factors={[
            { id: 'source', label: copy.evidenceFactors[0], points: 10, earned: evidenceCount > 0 ? 10 : 0, status: evidenceCount > 0 ? 'present' : 'absent' },
            { id: 'timeline', label: copy.evidenceFactors[1], points: 10, earned: evidenceCount >= 2 ? 10 : 0, status: evidenceCount >= 2 ? 'present' : 'pending' },
            { id: 'documents', label: copy.evidenceFactors[2], points: 10, earned: evidenceCount >= 3 ? 10 : 0, status: evidenceCount >= 3 ? 'present' : 'pending' },
            { id: 'audit', label: copy.evidenceFactors[3], points: 10, earned: evidenceCount >= 4 ? 10 : 0, status: evidenceCount >= 4 ? 'present' : 'pending' },
          ]}
          compact
        />
        <EvidenceReadinessMiniMatrix context='disputes' />
      </CollapsibleSection>

      <CollapsibleSection title={copy.decisionTitle} summary={copy.decisionSummary} defaultOpen={false}>
        <div className={operationalCockpitClasses.toolGrid}>
          <EvidenceDecisionPanel />
          <DecisionRecommendationStrip context='disputes' />
          <ActionFeedbackPreviewStrip context='disputes' />
        </div>
      </CollapsibleSection>
    </OperationalDecisionCockpit>
  );
}
