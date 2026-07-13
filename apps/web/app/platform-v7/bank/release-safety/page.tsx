import Link from 'next/link';
import { getLocale } from 'next-intl/server';
import { StatusChip } from '@pc/design-system-v8';
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
} from '@/components/transaction-ux/MoneyObligationCockpit';

type Locale = 'ru' | 'en' | 'zh';

type Copy = {
  eyebrow: string;
  title: string;
  description: string;
  stoppedStatus: string;
  readyStatus: string;
  priorityTitle: (id: string) => string;
  priorityDescription: string;
  noStoppedTitle: string;
  noStoppedDescription: string;
  blocker: string;
  noBlocker: string;
  owner: string;
  result: string;
  openDeal: string;
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
  pipelineTitle: string;
  pipelineSummary: string;
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
  machineTitle: string;
  machineSummary: string;
  reasonLabels: Record<ReleaseGuardBlocker, string>;
};

const COPY: Record<Locale, Copy> = {
  ru: {
    eyebrow: 'Банк · основание → проверка → callback',
    title: 'Сначала условия Сделки, затем банковская проверка',
    description: 'Экран показывает сумму, резерв, удержание и причины остановки. Это контрольная проекция: интерфейс не выпускает деньги и не создаёт банковский статус.',
    stoppedStatus: 'есть остановленные сделки',
    readyStatus: 'основания готовы к проверке',
    priorityTitle: (id) => `Закрыть причины остановки по ${id}`,
    priorityDescription: 'Запрос в банк скрыт, пока не подтверждены резерв, документы, СДИЗ, транспорт, приёмка, качество и отсутствие открытого спора.',
    noStoppedTitle: 'Передать готовое основание на внешнюю проверку',
    noStoppedDescription: 'Условия платформы закрыты. Следующий статус может прийти только от банка через подтверждённый интеграционный контур.',
    blocker: 'не закрыты обязательные условия Сделки',
    noBlocker: 'условия платформы закрыты',
    owner: 'участники Сделки → оператор → банк',
    result: 'проверяемое основание и внешний банковский callback',
    openDeal: 'Открыть Сделку',
    bankWorkspace: 'Кабинет банка',
    facts: {
      candidate: 'К запросу после проверки', stopped: 'Остановлено', underReview: 'Под влиянием блокеров', deals: 'Сделок проверено',
      candidateHint: 'это ещё не движение денег', stoppedHint: 'запрос в банк недоступен', underReviewHint: 'удержание или потенциальная выплата', dealsHint: 'доменная проекция release guard',
    },
    boundary: 'Платформа вычисляет готовность и формирует основание. Только банк подтверждает резерв, проверку и движение денег; ручная кнопка не заменяет callback и reconciliation.',
    pipelineTitle: 'Путь банковской проверки',
    pipelineSummary: 'резерв → условия → запрос → callback → reconciliation',
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
    machineTitle: 'Машина исполнения только для чтения',
    machineSummary: 'серверные состояния · без ручной подмены',
    reasonLabels: {
      NO_RESERVED_MONEY: 'нет подтверждённого резерва', NO_RELEASE_AMOUNT: 'нет суммы к выплате', HOLD_AMOUNT_ACTIVE: 'есть активное удержание', OPEN_DISPUTE: 'открыт спор', DOCUMENTS_NOT_READY: 'документы не закрыты', FGIS_NOT_READY: 'ФГИС / СДИЗ не подтверждены', TRANSPORT_NOT_READY: 'рейс или транспортные документы не закрыты', ACCEPTANCE_NOT_CONFIRMED: 'приёмка не подтверждена', QUALITY_NOT_APPROVED: 'качество не подтверждено', MANUAL_BLOCKER: 'есть ручная остановка', DEAL_NOT_READY: 'стадия Сделки не готова к банковской проверке',
    },
  },
  en: {
    eyebrow: 'Bank · basis → review → callback',
    title: 'Deal conditions first, bank review second',
    description: 'The screen shows amount, reserve, hold and stop reasons. It is a control projection: the interface cannot release money or manufacture a bank status.',
    stoppedStatus: 'deals are blocked',
    readyStatus: 'bases ready for review',
    priorityTitle: (id) => `Close stop reasons for ${id}`,
    priorityDescription: 'A bank request remains unavailable until reserve, documents, grain registry, transport, acceptance, quality and dispute conditions are verified.',
    noStoppedTitle: 'Send the ready basis to external review',
    noStoppedDescription: 'Platform conditions are complete. The next status can only come from the bank through a verified integration path.',
    blocker: 'mandatory Deal conditions are incomplete',
    noBlocker: 'platform conditions are complete',
    owner: 'Deal participants → operator → bank',
    result: 'verifiable basis and external bank callback',
    openDeal: 'Open Deal',
    bankWorkspace: 'Bank workspace',
    facts: {
      candidate: 'Eligible to request after review', stopped: 'Blocked', underReview: 'Affected by blockers', deals: 'Deals checked',
      candidateHint: 'this is not movement of money', stoppedHint: 'bank request unavailable', underReviewHint: 'hold or potential payout', dealsHint: 'domain release-guard projection',
    },
    boundary: 'The platform calculates readiness and prepares a basis. Only the bank confirms reserve, review and movement of money; a manual button cannot replace callback and reconciliation.',
    pipelineTitle: 'Bank review path',
    pipelineSummary: 'reserve → conditions → request → callback → reconciliation',
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
    machineTitle: 'Read-only execution machine',
    machineSummary: 'server states · no manual substitution',
    reasonLabels: {
      NO_RESERVED_MONEY: 'no confirmed reserve', NO_RELEASE_AMOUNT: 'no payout amount', HOLD_AMOUNT_ACTIVE: 'an active hold exists', OPEN_DISPUTE: 'an open dispute exists', DOCUMENTS_NOT_READY: 'documents are incomplete', FGIS_NOT_READY: 'grain registry / certificate not confirmed', TRANSPORT_NOT_READY: 'trip or transport documents are incomplete', ACCEPTANCE_NOT_CONFIRMED: 'acceptance not confirmed', QUALITY_NOT_APPROVED: 'quality not approved', MANUAL_BLOCKER: 'manual stop exists', DEAL_NOT_READY: 'Deal stage is not ready for bank review',
    },
  },
  zh: {
    eyebrow: '银行 · 依据 → 审核 → 回调',
    title: '先完成交易条件，再进行银行审核',
    description: '页面显示金额、预留、冻结和停止原因。这只是控制投影：界面不能释放资金，也不能生成银行状态。',
    stoppedStatus: '存在被阻止的交易',
    readyStatus: '依据已准备好接受审核',
    priorityTitle: (id) => `关闭 ${id} 的停止原因`,
    priorityDescription: '在资金预留、文件、粮食登记、运输、验收、质量和争议条件得到验证前，银行审核请求不可用。',
    noStoppedTitle: '将完整依据提交外部审核',
    noStoppedDescription: '平台条件已完成。下一状态只能通过已验证的银行集成路径返回。',
    blocker: '交易的强制条件尚未完成',
    noBlocker: '平台条件已完成',
    owner: '交易参与方 → 运营人员 → 银行',
    result: '可验证依据和外部银行回调',
    openDeal: '打开交易',
    bankWorkspace: '银行工作区',
    facts: {
      candidate: '审核后可申请', stopped: '被阻止', underReview: '受阻塞项影响', deals: '已检查交易',
      candidateHint: '这还不是资金流动', stoppedHint: '银行请求不可用', underReviewHint: '冻结或潜在付款', dealsHint: '领域 release guard 投影',
    },
    boundary: '平台计算就绪度并形成依据。只有银行可以确认预留、审核和资金流动；手动按钮不能替代回调和对账。',
    pipelineTitle: '银行审核路径',
    pipelineSummary: '预留 → 条件 → 请求 → 回调 → 对账',
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
    machineTitle: '只读执行状态机',
    machineSummary: '服务器状态 · 禁止手动替换',
    reasonLabels: {
      NO_RESERVED_MONEY: '没有已确认的资金预留', NO_RELEASE_AMOUNT: '没有付款金额', HOLD_AMOUNT_ACTIVE: '存在活动冻结', OPEN_DISPUTE: '存在未决争议', DOCUMENTS_NOT_READY: '文件未完成', FGIS_NOT_READY: '粮食登记 / 凭证未确认', TRANSPORT_NOT_READY: '运输任务或运输文件未完成', ACCEPTANCE_NOT_CONFIRMED: '验收未确认', QUALITY_NOT_APPROVED: '质量未批准', MANUAL_BLOCKER: '存在人工停止项', DEAL_NOT_READY: '交易阶段尚未准备好接受银行审核',
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
  const reasonText = (reasons: readonly ReleaseGuardBlocker[]) => reasons.length
    ? reasons.map((reason) => copy.reasonLabels[reason]).join(', ')
    : copy.noReasons;

  return (
    <MoneyObligationCockpit
      testId='platform-v7-bank-release-safety-v8'
      eyebrow={copy.eyebrow}
      title={copy.title}
      description={copy.description}
      statusLabel={stoppedRows.length > 0 ? copy.stoppedStatus : copy.readyStatus}
      statusTone={stoppedRows.length > 0 ? 'critical' : 'success'}
      priority={{
        state: stoppedRows.length > 0 ? 'critical' : 'ready',
        title: stoppedRows.length > 0 && priority ? copy.priorityTitle(priority.id) : copy.noStoppedTitle,
        description: stoppedRows.length > 0 ? copy.priorityDescription : copy.noStoppedDescription,
        amount: formatMoney(priority?.release ?? payoutCandidate, locale),
        blocker: stoppedRows.length > 0 ? copy.blocker : copy.noBlocker,
        owner: copy.owner,
        result: copy.result,
        primaryAction: <Link className={moneyCockpitClasses.primaryLink} href={`/platform-v7/deals/${priority?.id ?? 'DL-9106'}/clean`}>{copy.openDeal}</Link>,
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

      <MoneyCockpitSection id='release-pipeline'>
        <CollapsibleSection title={copy.pipelineTitle} summary={copy.pipelineSummary} defaultOpen>
          <ReleasePipelineStrip dealId={priority?.id ?? 'DL-9106'} />
        </CollapsibleSection>
      </MoneyCockpitSection>

      <CollapsibleSection title={copy.queueTitle} summary={copy.queueSummary} defaultOpen={false}>
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
                href={`/platform-v7/deals/${row.id}/clean`}
                title={`${row.id} · ${row.grain}`}
                detail={`${copy.reserve}: ${formatMoney(row.reserved, locale)} · ${copy.hold}: ${formatMoney(row.hold, locale)} · ${copy.requestAmount}: ${formatMoney(row.release, locale)} · ${copy.reasons}: ${reasonText(row.reasons)}`}
                status={<StatusChip tone={tone}>{status}</StatusChip>}
              />
            );
          })}
        </MoneyQueue>
      </CollapsibleSection>

      <CollapsibleSection title={copy.decisionTitle} summary={copy.decisionSummary} defaultOpen={false}>
        <DecisionPackMiniPanel context='dl9106_payout_review' />
      </CollapsibleSection>

      <CollapsibleSection title={copy.machineTitle} summary={copy.machineSummary} defaultOpen={false}>
        <P7ExecutionMachineReadOnlyStrip compact />
      </CollapsibleSection>
    </MoneyObligationCockpit>
  );
}
