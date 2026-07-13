import Link from 'next/link';
import { getLocale } from 'next-intl/server';
import { EmptyState, StatusChip } from '@pc/design-system-v8';
import { CollapsibleSection } from '@/components/platform-v7/CollapsibleSection';
import { DecisionPackMiniPanel } from '@/components/platform-v7/DecisionPackMiniPanel';
import { P7ExecutionMachineReadOnlyStrip } from '@/components/platform-v7/P7ExecutionMachineReadOnlyStrip';
import { ReleasePipelineStrip } from '@/components/platform-v7/ReleasePipelineStrip';
import { canonicalDomainDeals } from '@/lib/domain/selectors';
import { evaluateReleaseGuard, type ReleaseGuardBlocker } from '@/lib/platform-v7/domain/release-guard';
import {
  MoneyBoundary,
  MoneyCockpitSection,
  MoneyObligationCockpit,
  MoneyQueue,
  MoneyQueueLink,
  moneyCockpitClasses,
  type MoneyCockpitLabels,
} from '@/components/transaction-ux/MoneyObligationCockpit';

type Locale = 'ru' | 'en' | 'zh';

type Copy = {
  eyebrow: string;
  title: string;
  description: string;
  stoppedStatus: string;
  readyStatus: string;
  emptyStatus: string;
  priorityTitle: (id: string) => string;
  priorityDescription: string;
  noStoppedTitle: string;
  noStoppedDescription: string;
  noDealsTitle: string;
  noDealsDescription: string;
  blocker: string;
  noBlocker: string;
  noDataBlocker: string;
  owner: string;
  result: string;
  openDeal: string;
  deals: string;
  bankWorkspace: string;
  facts: {
    candidate: string;
    stopped: string;
    underReview: string;
    deals: string;
    candidateHint: string;
    stoppedHint: string;
    underReviewHint: string;
    dealsHint: string;
  };
  boundary: string;
  projectionBoundary: string;
  pipelineTitle: string;
  pipelineSummary: string;
  pipelineEmptyTitle: string;
  pipelineEmptyDescription: string;
  queueTitle: string;
  queueSummary: string;
  dealStatusBlocked: string;
  dealStatusRequest: string;
  dealStatusBank: string;
  reserve: string;
  hold: string;
  requestAmount: string;
  reasons: string;
  noReasons: string;
  decisionTitle: string;
  decisionSummary: string;
  decisionEmptyTitle: string;
  decisionEmptyDescription: string;
  machineTitle: string;
  machineSummary: string;
  reasonLabels: Record<ReleaseGuardBlocker, string>;
  labels: MoneyCockpitLabels;
};

const COPY: Record<Locale, Copy> = {
  ru: {
    eyebrow: 'Банк · основание → проверка → callback',
    title: 'Сначала условия Сделки, затем банковская проверка',
    description: 'Экран показывает сумму, резерв, удержание и причины остановки. Это контрольная проекция: интерфейс не выпускает деньги и не создаёт банковский статус.',
    stoppedStatus: 'есть остановленные сделки',
    readyStatus: 'основания готовы к проверке',
    emptyStatus: 'нет доступных сделок',
    priorityTitle: (id) => `Закрыть причины остановки по ${id}`,
    priorityDescription: 'Запрос в банк скрыт, пока не подтверждены резерв, документы, СДИЗ, транспорт, приёмка, качество и отсутствие открытого спора.',
    noStoppedTitle: 'Передать готовое основание на внешнюю проверку',
    noStoppedDescription: 'Условия платформы закрыты. Следующий статус может прийти только от банка через подтверждённый интеграционный контур.',
    noDealsTitle: 'Нет Сделок для проверки основания',
    noDealsDescription: 'Откройте реестр Сделок. Банковская проекция появляется только для доступных участнику Сделок.',
    blocker: 'не закрыты обязательные условия Сделки',
    noBlocker: 'условия платформы закрыты',
    noDataBlocker: 'нет доступной расчётной проекции',
    owner: 'участники Сделки → оператор → банк',
    result: 'проверяемое основание и внешний банковский callback',
    openDeal: 'Открыть Сделку',
    deals: 'Реестр Сделок',
    bankWorkspace: 'Кабинет банка',
    facts: {
      candidate: 'К запросу после проверки', stopped: 'Остановлено', underReview: 'Под влиянием блокеров', deals: 'Сделок проверено',
      candidateHint: 'это ещё не движение денег', stoppedHint: 'запрос в банк недоступен', underReviewHint: 'удержание или потенциальная выплата', dealsHint: 'доменная проекция release guard',
    },
    boundary: 'Платформа вычисляет готовность и формирует основание. Только банк подтверждает резерв, проверку и движение денег; ручная кнопка не заменяет callback и reconciliation.',
    projectionBoundary: 'Суммы на этом экране — расчётная проекция условий Сделки. Авторитетные банковские операции, ledger, callback и reconciliation остаются в серверном денежном контуре.',
    pipelineTitle: 'Путь банковской проверки',
    pipelineSummary: 'резерв → условия → запрос → callback → reconciliation',
    pipelineEmptyTitle: 'Нет Сделки для построения пути',
    pipelineEmptyDescription: 'Путь банковской проверки строится только для конкретной доступной Сделки.',
    queueTitle: 'Сделки и условия банковской проверки',
    queueSummary: 'резерв · удержание · сумма · причины',
    dealStatusBlocked: 'закрыть условия',
    dealStatusRequest: 'можно запросить проверку',
    dealStatusBank: 'ожидает банк',
    reserve: 'резерв',
    hold: 'удержано',
    requestAmount: 'к запросу',
    reasons: 'причины',
    noReasons: 'условия закрыты для запроса проверки',
    decisionTitle: 'Пакет решения',
    decisionSummary: 'основание · доказательства · влияние · следующий шаг',
    decisionEmptyTitle: 'Пакет решения открывается внутри Сделки',
    decisionEmptyDescription: 'Для этой Сделки нет встроенного справочного пакета. Используйте канонический Deal Workspace и журнал.',
    machineTitle: 'Машина исполнения только для чтения',
    machineSummary: 'серверные состояния · без ручной подмены',
    reasonLabels: {
      NO_RESERVED_MONEY: 'нет подтверждённого резерва', NO_RELEASE_AMOUNT: 'нет суммы к выплате', HOLD_AMOUNT_ACTIVE: 'есть активное удержание', OPEN_DISPUTE: 'открыт спор', DOCUMENTS_NOT_READY: 'документы не закрыты', FGIS_NOT_READY: 'ФГИС / СДИЗ не подтверждены', TRANSPORT_NOT_READY: 'рейс или транспортные документы не закрыты', ACCEPTANCE_NOT_CONFIRMED: 'приёмка не подтверждена', QUALITY_NOT_APPROVED: 'качество не подтверждено', MANUAL_BLOCKER: 'есть ручная остановка', DEAL_NOT_READY: 'стадия Сделки не готова к банковской проверке',
    },
    labels: {
      money: 'Деньги', blocker: 'Блокер', owner: 'Ответственный', result: 'Результат', nextAction: 'Следующее безопасное действие', prioritySection: 'Главное денежное обязательство', factsSection: 'Ключевые денежные факты',
    },
  },
  en: {
    eyebrow: 'Bank · basis → review → callback',
    title: 'Deal conditions first, bank review second',
    description: 'The screen shows amount, reserve, hold and stop reasons. It is a control projection: the interface cannot release money or manufacture a bank status.',
    stoppedStatus: 'deals are blocked',
    readyStatus: 'bases ready for review',
    emptyStatus: 'no accessible Deals',
    priorityTitle: (id) => `Close stop reasons for ${id}`,
    priorityDescription: 'A bank request remains unavailable until reserve, documents, grain registry, transport, acceptance, quality and dispute conditions are verified.',
    noStoppedTitle: 'Send the ready basis to external review',
    noStoppedDescription: 'Platform conditions are complete. The next status can only come from the bank through a verified integration path.',
    noDealsTitle: 'No Deals are available for basis review',
    noDealsDescription: 'Open the Deal registry. The bank projection exists only for Deals accessible to the participant.',
    blocker: 'mandatory Deal conditions are incomplete',
    noBlocker: 'platform conditions are complete',
    noDataBlocker: 'no accessible calculation projection',
    owner: 'Deal participants → operator → bank',
    result: 'verifiable basis and external bank callback',
    openDeal: 'Open Deal',
    deals: 'Deal registry',
    bankWorkspace: 'Bank workspace',
    facts: {
      candidate: 'Eligible to request after review', stopped: 'Blocked', underReview: 'Affected by blockers', deals: 'Deals checked',
      candidateHint: 'this is not movement of money', stoppedHint: 'bank request unavailable', underReviewHint: 'hold or potential payout', dealsHint: 'domain release-guard projection',
    },
    boundary: 'The platform calculates readiness and prepares a basis. Only the bank confirms reserve, review and movement of money; a manual button cannot replace callback and reconciliation.',
    projectionBoundary: 'Amounts on this screen are a calculated projection of Deal conditions. Authoritative bank operations, ledger, callback and reconciliation remain in the server money contour.',
    pipelineTitle: 'Bank review path',
    pipelineSummary: 'reserve → conditions → request → callback → reconciliation',
    pipelineEmptyTitle: 'No Deal is available for the review path',
    pipelineEmptyDescription: 'A bank-review path is built only for a specific accessible Deal.',
    queueTitle: 'Deals and bank-review conditions',
    queueSummary: 'reserve · hold · amount · reasons',
    dealStatusBlocked: 'close conditions',
    dealStatusRequest: 'review may be requested',
    dealStatusBank: 'awaiting bank',
    reserve: 'reserve',
    hold: 'held',
    requestAmount: 'request amount',
    reasons: 'reasons',
    noReasons: 'conditions complete for a review request',
    decisionTitle: 'Decision package',
    decisionSummary: 'basis · evidence · impact · next step',
    decisionEmptyTitle: 'The decision package opens inside the Deal',
    decisionEmptyDescription: 'No embedded reference package exists for this Deal. Use the canonical Deal Workspace and journal.',
    machineTitle: 'Read-only execution machine',
    machineSummary: 'server states · no manual substitution',
    reasonLabels: {
      NO_RESERVED_MONEY: 'no confirmed reserve', NO_RELEASE_AMOUNT: 'no payout amount', HOLD_AMOUNT_ACTIVE: 'an active hold exists', OPEN_DISPUTE: 'an open dispute exists', DOCUMENTS_NOT_READY: 'documents are incomplete', FGIS_NOT_READY: 'grain registry / certificate not confirmed', TRANSPORT_NOT_READY: 'trip or transport documents are incomplete', ACCEPTANCE_NOT_CONFIRMED: 'acceptance not confirmed', QUALITY_NOT_APPROVED: 'quality not approved', MANUAL_BLOCKER: 'manual stop exists', DEAL_NOT_READY: 'Deal stage is not ready for bank review',
    },
    labels: {
      money: 'Money', blocker: 'Blocker', owner: 'Owner', result: 'Result', nextAction: 'Next safe action', prioritySection: 'Primary money obligation', factsSection: 'Key money facts',
    },
  },
  zh: {
    eyebrow: '银行 · 依据 → 审核 → 回调',
    title: '先完成交易条件，再进行银行审核',
    description: '页面显示金额、预留、冻结和停止原因。这只是控制投影：界面不能释放资金，也不能生成银行状态。',
    stoppedStatus: '存在被阻止的交易',
    readyStatus: '依据已准备好接受审核',
    emptyStatus: '没有可访问的交易',
    priorityTitle: (id) => `关闭 ${id} 的停止原因`,
    priorityDescription: '在资金预留、文件、粮食登记、运输、验收、质量和争议条件得到验证前，银行审核请求不可用。',
    noStoppedTitle: '将完整依据提交外部审核',
    noStoppedDescription: '平台条件已完成。下一状态只能通过已验证的银行集成路径返回。',
    noDealsTitle: '没有可供审核依据的交易',
    noDealsDescription: '请打开交易登记册。银行投影只针对参与方可访问的交易。',
    blocker: '交易的强制条件尚未完成',
    noBlocker: '平台条件已完成',
    noDataBlocker: '没有可访问的计算投影',
    owner: '交易参与方 → 运营人员 → 银行',
    result: '可验证依据和外部银行回调',
    openDeal: '打开交易',
    deals: '交易登记册',
    bankWorkspace: '银行工作区',
    facts: {
      candidate: '审核后可申请', stopped: '被阻止', underReview: '受阻塞项影响', deals: '已检查交易',
      candidateHint: '这还不是资金流动', stoppedHint: '银行请求不可用', underReviewHint: '冻结或潜在付款', dealsHint: '领域 release guard 投影',
    },
    boundary: '平台计算就绪度并形成依据。只有银行可以确认预留、审核和资金流动；手动按钮不能替代回调和对账。',
    projectionBoundary: '本页面金额是交易条件的计算投影。权威银行操作、账本、回调和对账仍位于服务器资金链路。',
    pipelineTitle: '银行审核路径',
    pipelineSummary: '预留 → 条件 → 请求 → 回调 → 对账',
    pipelineEmptyTitle: '没有可用于构建审核路径的交易',
    pipelineEmptyDescription: '银行审核路径只针对具体且可访问的交易。',
    queueTitle: '交易和银行审核条件',
    queueSummary: '预留 · 冻结 · 金额 · 原因',
    dealStatusBlocked: '关闭条件',
    dealStatusRequest: '可以申请审核',
    dealStatusBank: '等待银行',
    reserve: '预留',
    hold: '冻结',
    requestAmount: '申请金额',
    reasons: '原因',
    noReasons: '申请审核的条件已完成',
    decisionTitle: '决策包',
    decisionSummary: '依据 · 证据 · 影响 · 下一步',
    decisionEmptyTitle: '决策包在交易工作区中打开',
    decisionEmptyDescription: '该交易没有内置参考包。请使用规范交易工作区和日志。',
    machineTitle: '只读执行状态机',
    machineSummary: '服务器状态 · 禁止手动替换',
    reasonLabels: {
      NO_RESERVED_MONEY: '没有已确认的资金预留', NO_RELEASE_AMOUNT: '没有付款金额', HOLD_AMOUNT_ACTIVE: '存在活动冻结', OPEN_DISPUTE: '存在未决争议', DOCUMENTS_NOT_READY: '文件未完成', FGIS_NOT_READY: '粮食登记 / 凭证未确认', TRANSPORT_NOT_READY: '运输任务或运输文件未完成', ACCEPTANCE_NOT_CONFIRMED: '验收未确认', QUALITY_NOT_APPROVED: '质量未批准', MANUAL_BLOCKER: '存在人工停止项', DEAL_NOT_READY: '交易阶段尚未准备好接受银行审核',
    },
    labels: {
      money: '资金', blocker: '阻塞项', owner: '负责人', result: '结果', nextAction: '下一安全操作', prioritySection: '主要资金义务', factsSection: '资金关键事实',
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

function decisionPackContext(dealId: string | undefined) {
  if (dealId === 'DL-9102') return 'dl9102_dispute_hold' as const;
  if (dealId === 'DL-9106') return 'dl9106_payout_review' as const;
  return null;
}

export default async function BankReleaseSafetyPage() {
  const locale = normalizeLocale(await getLocale());
  const copy = COPY[locale];
  const rows = canonicalDomainDeals.slice(0, 12).map((deal) => {
    const check = evaluateReleaseGuard(deal);
    return {
      id: deal.id,
      grain: deal.grain,
      reserved: check.reservedAmount,
      hold: deal.money.holdAmount,
      release: check.releaseAmount,
      reasons: check.blockers,
      stopped: !check.canRequestRelease,
      canExecuteRelease: check.canExecuteRelease,
    };
  });

  const stoppedRows = rows.filter((row) => row.stopped);
  const priority = stoppedRows[0] ?? rows[0];
  const payoutCandidate = rows.filter((row) => !row.stopped).reduce((sum, row) => sum + row.release, 0);
  const moneyUnderCheck = stoppedRows.reduce((sum, row) => sum + Math.max(row.hold, row.release), 0);
  const packContext = decisionPackContext(priority?.id);
  const reasonText = (reasons: readonly ReleaseGuardBlocker[]) => reasons.length
    ? reasons.map((reason) => copy.reasonLabels[reason]).join(', ')
    : copy.noReasons;

  const primaryHref = priority ? `/platform-v7/deals/${encodeURIComponent(priority.id)}/clean` : '/platform-v7/deals';
  const primaryLabel = priority ? copy.openDeal : copy.deals;
  const hasRows = rows.length > 0;

  return (
    <MoneyObligationCockpit
      testId='platform-v7-bank-release-safety-v8'
      eyebrow={copy.eyebrow}
      title={copy.title}
      description={copy.description}
      statusLabel={!hasRows ? copy.emptyStatus : stoppedRows.length > 0 ? copy.stoppedStatus : copy.readyStatus}
      statusTone={!hasRows ? 'warning' : stoppedRows.length > 0 ? 'critical' : 'success'}
      labels={copy.labels}
      priority={{
        state: !hasRows ? 'waiting' : stoppedRows.length > 0 ? 'critical' : 'ready',
        title: !hasRows ? copy.noDealsTitle : stoppedRows.length > 0 && priority ? copy.priorityTitle(priority.id) : copy.noStoppedTitle,
        description: !hasRows ? copy.noDealsDescription : stoppedRows.length > 0 ? copy.priorityDescription : copy.noStoppedDescription,
        amount: formatMoney(priority?.release ?? payoutCandidate, locale),
        blocker: !hasRows ? copy.noDataBlocker : stoppedRows.length > 0 ? copy.blocker : copy.noBlocker,
        owner: copy.owner,
        result: copy.result,
        primaryAction: <Link className={moneyCockpitClasses.primaryLink} href={primaryHref}>{primaryLabel}</Link>,
        secondaryAction: <Link className={moneyCockpitClasses.secondaryLink} href='/platform-v7/bank'>{copy.bankWorkspace}</Link>,
      }}
      facts={[
        { label: copy.facts.candidate, value: formatMoney(payoutCandidate, locale), hint: copy.facts.candidateHint },
        { label: copy.facts.stopped, value: String(stoppedRows.length), hint: copy.facts.stoppedHint },
        { label: copy.facts.underReview, value: formatMoney(moneyUnderCheck, locale), hint: copy.facts.underReviewHint },
        { label: copy.facts.deals, value: String(rows.length), hint: copy.facts.dealsHint },
      ]}
    >
      <MoneyBoundary>{copy.boundary}</MoneyBoundary>
      <MoneyBoundary>{copy.projectionBoundary}</MoneyBoundary>

      <MoneyCockpitSection id='release-pipeline'>
        <CollapsibleSection title={copy.pipelineTitle} summary={copy.pipelineSummary} defaultOpen>
          {priority ? (
            <ReleasePipelineStrip dealId={priority.id} />
          ) : (
            <EmptyState title={copy.pipelineEmptyTitle} description={copy.pipelineEmptyDescription} />
          )}
        </CollapsibleSection>
      </MoneyCockpitSection>

      <CollapsibleSection title={copy.queueTitle} summary={copy.queueSummary} defaultOpen={false}>
        {rows.length > 0 ? (
          <MoneyQueue>
            {rows.map((row) => {
              const status = row.stopped
                ? copy.dealStatusBlocked
                : row.canExecuteRelease
                  ? copy.dealStatusBank
                  : copy.dealStatusRequest;
              const tone = row.stopped ? 'critical' : row.canExecuteRelease ? 'success' : 'warning';
              return (
                <MoneyQueueLink
                  key={row.id}
                  href={`/platform-v7/deals/${encodeURIComponent(row.id)}/clean`}
                  title={`${row.id} · ${row.grain}`}
                  detail={`${copy.reserve}: ${formatMoney(row.reserved, locale)} · ${copy.hold}: ${formatMoney(row.hold, locale)} · ${copy.requestAmount}: ${formatMoney(row.release, locale)} · ${copy.reasons}: ${reasonText(row.reasons)}`}
                  status={<StatusChip tone={tone}>{status}</StatusChip>}
                />
              );
            })}
          </MoneyQueue>
        ) : (
          <EmptyState title={copy.noDealsTitle} description={copy.noDealsDescription} />
        )}
      </CollapsibleSection>

      <CollapsibleSection title={copy.decisionTitle} summary={copy.decisionSummary} defaultOpen={false}>
        {packContext ? (
          <DecisionPackMiniPanel context={packContext} />
        ) : (
          <EmptyState title={copy.decisionEmptyTitle} description={copy.decisionEmptyDescription} />
        )}
      </CollapsibleSection>

      <CollapsibleSection title={copy.machineTitle} summary={copy.machineSummary} defaultOpen={false}>
        <P7ExecutionMachineReadOnlyStrip compact />
      </CollapsibleSection>
    </MoneyObligationCockpit>
  );
}
