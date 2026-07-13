import type { Metadata } from 'next';
import Link from 'next/link';
import { getLocale } from 'next-intl/server';
import { InlineNotice, StatusChip } from '@pc/design-system-v8';
import { CanonicalDealsList } from '@/components/platform-v7/CanonicalDealsList';
import {
  MoneyBoundary,
  MoneyCockpitSection,
  MoneyObligationCockpit,
  MoneyQueue,
  MoneyQueueLink,
  moneyCockpitClasses,
  type MoneyCockpitLabels,
} from '@/components/transaction-ux/MoneyObligationCockpit';
import {
  buildBankReleaseProjection,
  getCanonicalBankReleaseWorkspace,
  type BankReleaseProjection,
  type BankReleaseState,
} from '@/lib/bank-release-server';

type Locale = 'ru' | 'en' | 'zh';
type PageSearchParams = { dealId?: string | string[]; shipmentId?: string | string[] };

type ReleaseCopy = {
  metadataTitle: string;
  metadataDescription: string;
  eyebrow: string;
  title: string;
  description: string;
  status: string;
  priorityTitle: string;
  priorityDescription: string;
  amount: string;
  blocker: string;
  owner: string;
  result: string;
  registryAction: string;
  bankAction: string;
  reserveLabel: string;
  reserveValue: string;
  reserveHint: string;
  evidenceLabel: string;
  evidenceValue: string;
  evidenceHint: string;
  requestLabel: string;
  requestValue: string;
  requestHint: string;
  callbackLabel: string;
  callbackValue: string;
  callbackHint: string;
  boundary: string;
  noticeTitle: string;
  noticeBody: string;
  labels: MoneyCockpitLabels;
};

type SelectedCopy = {
  unavailableTitle: string;
  unavailableDescription: string;
  openDeals: string;
  openDeal: string;
  openDocuments: string;
  boundary: string;
  sourceNoticeTitle: string;
  sourceNoticeBody: string;
  facts: { amount: string; reserve: string; documents: string; disputes: string; request: string; callback: string };
  values: { confirmed: string; missing: string; ready: string; blocked: string; none: string; sent: string; waiting: string; released: string; notExposed: string };
  states: Record<BankReleaseState, { status: string; title: string; description: string; owner: string; result: string }>;
  queue: { documents: string; reserve: string; request: string; callback: string; reconciliation: string };
  warnings: string;
};

const COPY: Record<Locale, ReleaseCopy> = {
  ru: {
    metadataTitle: 'Проверка выплаты',
    metadataDescription: 'Серверно подтверждённый вход в проверку условий выплаты по конкретной Сделке без клиентского выпуска денег.',
    eyebrow: 'Выплата · основание · внешний банковский callback',
    title: 'Проверка выплаты не является кнопкой выпуска денег',
    description: 'Выбери серверно доступную Сделку. Backend проверяет резерв, сумму, удержания, спор, документы, ФГИС/СДИЗ, транспорт, приёмку, качество и ручные остановки до создания запроса банку.',
    status: 'release подтверждает только банк',
    priorityTitle: 'Открой Сделку и проверь её фактические блокеры',
    priorityDescription: 'Глобальный экран не имеет права вычислять готовность на fixture-данных. Решение принимается только по текущему серверному состоянию конкретной Сделки и полномочиям участника.',
    amount: 'определяется сервером внутри Сделки',
    blocker: 'готовность не подтверждена без выбранной Сделки',
    owner: 'участники закрывают условия; банк подтверждает операцию',
    result: 'release request → callback → reconciliation → audit',
    registryAction: 'Выбрать Сделку',
    bankAction: 'Вернуться в кабинет банка',
    reserveLabel: 'Резерв',
    reserveValue: 'должен быть подтверждён',
    reserveHint: 'запрос резерва сам по себе не открывает выплату',
    evidenceLabel: 'Основание',
    evidenceValue: 'полный evidence pack',
    evidenceHint: 'документы, приёмка, качество, транспорт и отсутствие открытого спора',
    requestLabel: 'Release request',
    requestValue: 'идемпотентная команда',
    requestHint: 'создаёт outbox-запись, но не меняет деньги на RELEASED',
    callbackLabel: 'Финальное подтверждение',
    callbackValue: 'verified bank callback',
    callbackHint: 'подпись, event ID, operation ID, replay protection и последующая сверка',
    boundary: 'Платформа не может вручную присвоить RESERVED или RELEASED. Даже при закрытых условиях она только создаёт запрос. Денежное состояние меняется после проверенного банковского callback; ошибка, конфликт или расхождение переводят операцию в manual review.',
    noticeTitle: 'Порядок безопасной проверки',
    noticeBody: 'Выбери Сделку ниже. В её рабочем месте сервер показывает реальный следующий шаг и блокеры. Закрой обязательные условия, затем уполномоченная денежная роль с актуальной MFA может отправить release request. До callback банка деньги считаются неподтверждёнными.',
    labels: { money: 'Сумма', blocker: 'Блокер', owner: 'Ответственный', result: 'Цепочка результата', nextAction: 'Следующее безопасное действие', prioritySection: 'Главная задача проверки выплаты', factsSection: 'Неизменяемые границы выплаты' },
  },
  en: {
    metadataTitle: 'Payout readiness', metadataDescription: 'Server-authorized access to payout-condition checks for a specific Deal without client-side fund release.', eyebrow: 'Payout · basis · external bank callback', title: 'Payout readiness is not a release button', description: 'Select a server-accessible Deal. The backend checks reserve, amount, holds, dispute, documents, regulatory status, transport, acceptance, quality and manual stops before creating a bank request.', status: 'release is confirmed by the bank only', priorityTitle: 'Open a Deal and inspect its actual blockers', priorityDescription: 'A global screen must not calculate readiness from fixtures. The decision uses only the current server state of a specific Deal and the participant’s authority.', amount: 'determined by the server inside the Deal', blocker: 'readiness is unconfirmed without a selected Deal', owner: 'participants close conditions; the bank confirms the operation', result: 'release request → callback → reconciliation → audit', registryAction: 'Select a Deal', bankAction: 'Return to bank workspace', reserveLabel: 'Reserve', reserveValue: 'must be confirmed', reserveHint: 'a reserve request does not by itself enable payout', evidenceLabel: 'Basis', evidenceValue: 'complete evidence pack', evidenceHint: 'documents, acceptance, quality, transport and no open dispute', requestLabel: 'Release request', requestValue: 'idempotent command', requestHint: 'creates an outbox record but does not set money to RELEASED', callbackLabel: 'Final confirmation', callbackValue: 'verified bank callback', callbackHint: 'signature, event ID, operation ID, replay protection and reconciliation', boundary: 'The platform cannot manually assign RESERVED or RELEASED. Even when all conditions are closed, it only creates a request. Money state changes after a verified bank callback; an error, conflict or mismatch routes the operation to manual review.', noticeTitle: 'Safe verification sequence', noticeBody: 'Select a Deal below. Its workspace shows the real next action and blockers from the server. Close the mandatory conditions, then an authorized money role with current MFA may send a release request. Until the bank callback arrives, the funds remain unconfirmed.', labels: { money: 'Amount', blocker: 'Blocker', owner: 'Owner', result: 'Result chain', nextAction: 'Next safe action', prioritySection: 'Primary payout-readiness task', factsSection: 'Non-negotiable payout boundaries' },
  },
  zh: {
    metadataTitle: '付款就绪检查', metadataDescription: '进入具体交易的付款条件检查，访问权限由服务器确认，客户端不能放款。', eyebrow: '付款 · 依据 · 外部银行回调', title: '付款就绪检查不是放款按钮', description: '请选择服务器确认可访问的交易。Backend 会在创建银行申请前检查预留、金额、冻结、争议、文件、监管状态、运输、验收、质量和人工停止项。', status: '只有银行可以确认付款', priorityTitle: '打开交易并检查实际阻塞项', priorityDescription: '全局页面不得根据 fixture 数据计算付款就绪状态。判断只能基于具体交易的当前服务器状态和参与方权限。', amount: '由服务器在具体交易中确定', blocker: '未选择交易时，付款就绪状态无法确认', owner: '参与方关闭条件，银行确认操作', result: '付款申请 → 回调 → 对账 → 审计', registryAction: '选择交易', bankAction: '返回银行工作区', reserveLabel: '资金预留', reserveValue: '必须已确认', reserveHint: '预留申请本身不能开启付款', evidenceLabel: '付款依据', evidenceValue: '完整证据包', evidenceHint: '文件、验收、质量、运输以及不存在未结争议', requestLabel: '付款申请', requestValue: '幂等命令', requestHint: '创建 outbox 记录，但不会把资金状态设为 RELEASED', callbackLabel: '最终确认', callbackValue: '经过验证的银行回调', callbackHint: '签名、事件 ID、操作 ID、防重放和后续对账', boundary: '平台不能手动设置 RESERVED 或 RELEASED。即使所有条件已关闭，平台也只能创建申请。只有经过验证的银行回调才能改变资金状态；错误、冲突或不一致会转入人工复核。', noticeTitle: '安全检查顺序', noticeBody: '请在下方选择交易。交易工作区会显示服务器返回的实际下一步和阻塞项。关闭必备条件后，具有当前 MFA 的授权资金角色可以发送付款申请。在银行回调到达之前，资金仍视为未确认。', labels: { money: '金额', blocker: '阻塞项', owner: '负责人', result: '结果链', nextAction: '下一项安全操作', prioritySection: '主要付款检查任务', factsSection: '不可绕过的付款边界' },
  },
};

const SELECTED_COPY: Record<Locale, SelectedCopy> = {
  ru: {
    unavailableTitle: 'Серверная проверка выплаты недоступна', unavailableDescription: 'Экран закрыт: Сделка не указана, недоступна участнику или канонический Deal workspace вернул неполное либо противоречивое денежное основание.', openDeals: 'Открыть реестр Сделок', openDeal: 'Открыть рабочее место Сделки', openDocuments: 'Проверить документы', boundary: 'Источник истины — tenant-scoped PostgreSQL Deal workspace. Этот экран только читает сумму, резерв, документы, спор, банковскую операцию и outbox. Он не вызывает legacy SettlementEngine, не создаёт release request и не меняет денежный статус.', sourceNoticeTitle: 'Разделение полномочий сохранено', sourceNoticeBody: 'Уполномоченная роль инициирует каноническую команду в Сделке с актуальной MFA. Выплату подтверждает только проверенный callback банка. Reconciliation не подменяется визуальным статусом.', facts: { amount: 'Сумма Сделки', reserve: 'Резерв', documents: 'Документное основание', disputes: 'Открытые споры / удержание', request: 'Release request', callback: 'Callback банка' }, values: { confirmed: 'подтверждён', missing: 'не зафиксирован', ready: 'готово', blocked: 'заблокировано', none: 'нет', sent: 'отправлен', waiting: 'ожидается', released: 'выплата подтверждена', notExposed: 'результат reconciliation не опубликован' }, states: {
      blocked: { status: 'выплата заблокирована', title: 'Закрой серверные блокеры Сделки', description: 'Запрос выплаты недоступен, пока канонические факты не подтверждают резерв, приёмку, документы и отсутствие активного спора или удержания.', owner: 'участники Сделки', result: 'блокеры → исправление фактов → повторная серверная проверка' },
      ready_to_request: { status: 'готово к запросу выплаты', title: 'Сделка готова к каноническому release request', description: 'Все серверные условия закрыты. Этот read-only экран не отправляет запрос: действие выполняется в рабочем месте Сделки уполномоченной ролью с актуальной MFA.', owner: 'ACCOUNTING или ADMIN', result: 'каноническая команда → durable outbox → банк' },
      awaiting_bank: { status: 'ожидается callback банка', title: 'Release request зафиксирован и передан во внешний контур', description: 'Деньги ещё не считаются выпущенными. Ожидается проверенный callback, связанный с точной банковской операцией и outbox-записью.', owner: 'банк / integration operations', result: 'request → verified callback → ledger → reconciliation' },
      released: { status: 'выплата подтверждена банком', title: 'Канонические факты подтверждают RELEASED', description: 'Payment, банковская операция и callback согласованы. Результат внешней reconciliation должен подтверждаться отдельным серверным фактом.', owner: 'банк и reconciliation operations', result: 'verified callback → RELEASED → reconciliation → закрытие' },
      manual_review: { status: 'требуется ручная проверка', title: 'Денежные факты противоречат друг другу или операция завершилась ошибкой', description: 'Автоматическое продолжение запрещено. Нужна проверка банковской операции, callback, outbox и audit trail без ручной подмены статуса.', owner: 'bank operations / security / support', result: 'изоляция операции → проверка доказательств → контролируемое восстановление' },
    }, queue: { documents: 'Документы и приёмка', reserve: 'Подтверждённый резерв', request: 'Запрос выплаты и outbox', callback: 'Банковская операция и callback', reconciliation: 'Сверка и закрытие' }, warnings: 'Ограничения и неполные внешние факты',
  },
  en: {
    unavailableTitle: 'Server payout review is unavailable', unavailableDescription: 'The screen is closed because the Deal is missing, inaccessible to the participant, or its canonical workspace returned an incomplete or contradictory money basis.', openDeals: 'Open Deal registry', openDeal: 'Open Deal workspace', openDocuments: 'Review documents', boundary: 'The authority is the tenant-scoped PostgreSQL Deal workspace. This screen only reads amount, reserve, documents, disputes, bank operations and outbox. It never calls the legacy SettlementEngine, creates a release request or changes money state.', sourceNoticeTitle: 'Separation of authority is preserved', sourceNoticeBody: 'An authorized role initiates the canonical Deal command with current MFA. Only a verified bank callback confirms payout. Reconciliation is never replaced by a visual status.', facts: { amount: 'Deal amount', reserve: 'Reserve', documents: 'Document basis', disputes: 'Open disputes / hold', request: 'Release request', callback: 'Bank callback' }, values: { confirmed: 'confirmed', missing: 'not recorded', ready: 'ready', blocked: 'blocked', none: 'none', sent: 'sent', waiting: 'waiting', released: 'payout confirmed', notExposed: 'reconciliation result is not exposed' }, states: {
      blocked: { status: 'payout blocked', title: 'Close the Deal’s server blockers', description: 'A payout request is unavailable until canonical facts prove reserve, acceptance, documents and the absence of active disputes or holds.', owner: 'Deal participants', result: 'blockers → corrected facts → server re-check' },
      ready_to_request: { status: 'ready for payout request', title: 'The Deal is ready for a canonical release request', description: 'All server conditions are closed. This read-only screen does not send the request; an authorized role with current MFA acts in the Deal workspace.', owner: 'ACCOUNTING or ADMIN', result: 'canonical command → durable outbox → bank' },
      awaiting_bank: { status: 'awaiting bank callback', title: 'The release request is persisted and handed to the external contour', description: 'Funds are not released yet. A verified callback bound to the exact bank operation and outbox entry is required.', owner: 'bank / integration operations', result: 'request → verified callback → ledger → reconciliation' },
      released: { status: 'payout confirmed by bank', title: 'Canonical facts confirm RELEASED', description: 'Payment, bank operation and callback agree. External reconciliation still requires its own server fact.', owner: 'bank and reconciliation operations', result: 'verified callback → RELEASED → reconciliation → closure' },
      manual_review: { status: 'manual review required', title: 'Money facts contradict each other or the operation failed', description: 'Automatic continuation is forbidden. Review the bank operation, callback, outbox and audit trail without manually manufacturing a status.', owner: 'bank operations / security / support', result: 'isolate operation → review evidence → controlled recovery' },
    }, queue: { documents: 'Documents and acceptance', reserve: 'Confirmed reserve', request: 'Payout request and outbox', callback: 'Bank operation and callback', reconciliation: 'Reconciliation and closure' }, warnings: 'Constraints and incomplete external facts',
  },
  zh: {
    unavailableTitle: '服务器付款检查不可用', unavailableDescription: '页面已关闭：未指定交易、参与方无权访问，或规范交易工作区返回不完整或矛盾的资金依据。', openDeals: '打开交易列表', openDeal: '打开交易工作区', openDocuments: '检查文件', boundary: '权威来源是租户范围内的 PostgreSQL 交易工作区。本页面只读取金额、预留、文件、争议、银行操作和 outbox；不会调用旧 SettlementEngine、创建付款申请或改变资金状态。', sourceNoticeTitle: '权限分离保持不变', sourceNoticeBody: '授权角色在交易工作区中使用当前 MFA 发起规范命令。只有经过验证的银行回调才能确认付款。界面状态不能替代对账。', facts: { amount: '交易金额', reserve: '资金预留', documents: '文件依据', disputes: '未结争议 / 冻结', request: '付款申请', callback: '银行回调' }, values: { confirmed: '已确认', missing: '未记录', ready: '已就绪', blocked: '已阻塞', none: '无', sent: '已发送', waiting: '等待中', released: '付款已确认', notExposed: '未发布对账结果' }, states: {
      blocked: { status: '付款已阻塞', title: '关闭交易的服务器阻塞项', description: '在规范事实确认预留、验收、文件且不存在活动争议或冻结之前，不能申请付款。', owner: '交易参与方', result: '阻塞项 → 修正事实 → 服务器复查' },
      ready_to_request: { status: '可以申请付款', title: '交易已准备好发送规范付款申请', description: '服务器条件已全部关闭。本只读页面不会发送申请；授权角色必须在交易工作区中使用当前 MFA 操作。', owner: 'ACCOUNTING 或 ADMIN', result: '规范命令 → durable outbox → 银行' },
      awaiting_bank: { status: '等待银行回调', title: '付款申请已持久化并交给外部银行流程', description: '资金尚未释放。必须收到与准确银行操作及 outbox 记录绑定的验证回调。', owner: '银行 / 集成运营', result: '申请 → 验证回调 → 账本 → 对账' },
      released: { status: '银行已确认付款', title: '规范事实确认 RELEASED', description: '付款、银行操作和回调一致。外部对账仍需独立的服务器事实。', owner: '银行与对账运营', result: '验证回调 → RELEASED → 对账 → 关闭' },
      manual_review: { status: '需要人工复核', title: '资金事实矛盾或操作失败', description: '禁止自动继续。必须检查银行操作、回调、outbox 和审计链，不能手动伪造状态。', owner: '银行运营 / 安全 / 支持', result: '隔离操作 → 核验证据 → 受控恢复' },
    }, queue: { documents: '文件与验收', reserve: '已确认预留', request: '付款申请与 outbox', callback: '银行操作与回调', reconciliation: '对账与关闭' }, warnings: '限制条件和不完整的外部事实',
  },
};

function normalizeLocale(value: string): Locale {
  if (value.startsWith('en')) return 'en';
  if (value.startsWith('zh')) return 'zh';
  return 'ru';
}

export async function generateMetadata(): Promise<Metadata> {
  const copy = COPY[normalizeLocale(await getLocale())];
  return { title: copy.metadataTitle, description: copy.metadataDescription };
}

export default async function BankReleaseSafetyPage({ searchParams }: { searchParams?: PageSearchParams }) {
  const locale = normalizeLocale(await getLocale());
  const dealId = firstParam(searchParams?.dealId);
  const shipmentId = firstParam(searchParams?.shipmentId);
  if (!dealId) return renderRegistry(locale);

  const workspace = await getCanonicalBankReleaseWorkspace(dealId);
  const projection = workspace ? buildBankReleaseProjection(workspace, shipmentId) : null;
  return projection ? renderSelected(projection, locale) : renderUnavailable(locale);
}

function renderRegistry(locale: Locale) {
  const copy = COPY[locale];
  return (
    <MoneyObligationCockpit testId='platform-v7-bank-release-safety-v8' eyebrow={copy.eyebrow} title={copy.title} description={copy.description} statusLabel={copy.status} statusTone='warning' labels={copy.labels}
      priority={{ state: 'waiting', title: copy.priorityTitle, description: copy.priorityDescription, amount: copy.amount, blocker: copy.blocker, owner: copy.owner, result: copy.result, primaryAction: <Link className={moneyCockpitClasses.primaryLink} href='/platform-v7/deals'>{copy.registryAction}</Link>, secondaryAction: <Link className={moneyCockpitClasses.secondaryLink} href='/platform-v7/bank'>{copy.bankAction}</Link> }}
      facts={[{ label: copy.reserveLabel, value: copy.reserveValue, hint: copy.reserveHint }, { label: copy.evidenceLabel, value: copy.evidenceValue, hint: copy.evidenceHint }, { label: copy.requestLabel, value: copy.requestValue, hint: copy.requestHint }, { label: copy.callbackLabel, value: copy.callbackValue, hint: copy.callbackHint }]}
    >
      <MoneyBoundary>{copy.boundary}</MoneyBoundary>
      <MoneyCockpitSection id='release-deals'><InlineNotice tone='warning' title={copy.noticeTitle}>{copy.noticeBody}</InlineNotice><CanonicalDealsList /></MoneyCockpitSection>
    </MoneyObligationCockpit>
  );
}

function renderSelected(projection: BankReleaseProjection, locale: Locale) {
  const common = COPY[locale];
  const copy = SELECTED_COPY[locale];
  const stateCopy = copy.states[projection.state];
  const context = `dealId=${encodeURIComponent(projection.dealId)}&shipmentId=${encodeURIComponent(projection.shipmentId)}`;
  const dealHref = `/platform-v7/deals/${encodeURIComponent(projection.dealId)}/clean`;
  const documentsHref = `/platform-v7/deal-documents-basis?${context}`;
  const blockers = projection.blockers.join(' · ');
  const warningText = projection.warnings.join(' · ');
  const statusTone = projection.state === 'released' || projection.state === 'ready_to_request' ? 'success' : projection.state === 'awaiting_bank' ? 'information' : projection.state === 'manual_review' ? 'critical' : 'warning';

  return (
    <MoneyObligationCockpit testId='platform-v7-bank-release-safety-v8' eyebrow={common.eyebrow} title={`${common.metadataTitle} · ${projection.dealId}`} description={stateCopy.description} statusLabel={stateCopy.status} statusTone={statusTone} labels={common.labels}
      priority={{ state: projection.state === 'ready_to_request' || projection.state === 'released' ? 'ready' : projection.state === 'manual_review' ? 'critical' : 'waiting', title: stateCopy.title, description: stateCopy.description, amount: formatKopecks(projection.amountKopecks, projection.currency), blocker: blockers || copy.values.none, owner: stateCopy.owner, result: stateCopy.result, primaryAction: <Link className={moneyCockpitClasses.primaryLink} href={dealHref}>{copy.openDeal}</Link>, secondaryAction: <Link className={moneyCockpitClasses.secondaryLink} href={documentsHref}>{copy.openDocuments}</Link> }}
      facts={[
        { label: copy.facts.amount, value: formatKopecks(projection.amountKopecks, projection.currency), hint: `Deal v${projection.dealVersion} · ${projection.dealStatus}` },
        { label: copy.facts.reserve, value: projection.reserveConfirmed ? copy.values.confirmed : copy.values.blocked, hint: projection.reserveOperation?.id ?? copy.values.missing },
        { label: copy.facts.documents, value: projection.documentsReady && projection.acceptanceReady ? copy.values.ready : copy.values.blocked, hint: `${projection.documents.filter((item) => item.ready).length}/${projection.documents.length}` },
        { label: copy.facts.disputes, value: projection.activeDisputeCount === 0 && projection.activeHoldKopecks === '0' ? copy.values.none : `${projection.activeDisputeCount} / ${formatKopecks(projection.activeHoldKopecks, projection.currency)}` },
        { label: copy.facts.request, value: projection.releaseRequested ? copy.values.sent : copy.values.missing, hint: projection.releaseOutbox?.id ?? copy.values.missing },
        { label: copy.facts.callback, value: projection.releaseConfirmed ? copy.values.released : projection.releaseRequested ? copy.values.waiting : copy.values.missing, hint: projection.releaseOperation?.bankRef ?? copy.values.notExposed },
      ]}
    >
      <MoneyBoundary>{copy.boundary}</MoneyBoundary>
      <MoneyCockpitSection id='release-authority'>
        <InlineNotice tone={projection.state === 'manual_review' ? 'critical' : 'information'} title={copy.sourceNoticeTitle}>{copy.sourceNoticeBody}</InlineNotice>
        <MoneyQueue>
          <MoneyQueueLink href={documentsHref} title={copy.queue.documents} detail={`${projection.documents.filter((item) => item.ready).length}/${projection.documents.length}`} status={<StatusChip tone={projection.documentsReady && projection.acceptanceReady ? 'success' : 'critical'}>{projection.documentsReady && projection.acceptanceReady ? copy.values.ready : copy.values.blocked}</StatusChip>} />
          <MoneyQueueLink href={dealHref} title={copy.queue.reserve} detail={projection.reserveOperation?.id ?? copy.values.missing} status={<StatusChip tone={projection.reserveConfirmed ? 'success' : 'critical'}>{projection.reserveConfirmed ? copy.values.confirmed : copy.values.blocked}</StatusChip>} />
          <MoneyQueueLink href={dealHref} title={copy.queue.request} detail={projection.releaseOutbox?.id ?? copy.values.missing} status={<StatusChip tone={projection.releaseRequested ? 'information' : 'neutral'}>{projection.releaseRequested ? copy.values.sent : copy.values.missing}</StatusChip>} />
          <MoneyQueueLink href={dealHref} title={copy.queue.callback} detail={projection.releaseOperation?.id ?? copy.values.missing} status={<StatusChip tone={projection.releaseConfirmed ? 'success' : projection.releaseRequested ? 'warning' : 'neutral'}>{projection.releaseConfirmed ? copy.values.released : projection.releaseRequested ? copy.values.waiting : copy.values.missing}</StatusChip>} />
          <MoneyQueueLink href={dealHref} title={copy.queue.reconciliation} detail={copy.values.notExposed} status={<StatusChip tone='warning'>{copy.values.waiting}</StatusChip>} />
        </MoneyQueue>
        {blockers || warningText ? <InlineNotice tone={projection.state === 'manual_review' ? 'critical' : 'warning'} title={copy.warnings}>{[blockers, warningText].filter(Boolean).join(' · ')}</InlineNotice> : null}
      </MoneyCockpitSection>
    </MoneyObligationCockpit>
  );
}

function renderUnavailable(locale: Locale) {
  const common = COPY[locale];
  const copy = SELECTED_COPY[locale];
  return (
    <MoneyObligationCockpit testId='platform-v7-bank-release-safety-v8' eyebrow={common.eyebrow} title={copy.unavailableTitle} description={copy.unavailableDescription} statusLabel={copy.values.blocked} statusTone='critical' labels={common.labels}
      priority={{ state: 'critical', title: copy.unavailableTitle, description: copy.unavailableDescription, blocker: copy.unavailableDescription, owner: common.owner, result: common.result, primaryAction: <Link className={moneyCockpitClasses.primaryLink} href='/platform-v7/deals'>{copy.openDeals}</Link>, secondaryAction: <Link className={moneyCockpitClasses.secondaryLink} href='/platform-v7/bank'>{common.bankAction}</Link> }} facts={[]}
    ><MoneyBoundary>{copy.boundary}</MoneyBoundary></MoneyObligationCockpit>
  );
}

function firstParam(value: string | string[] | undefined): string | undefined {
  const candidate = Array.isArray(value) ? value[0] : value;
  const normalized = candidate?.trim();
  return normalized || undefined;
}

function formatKopecks(value: string, currency: string): string {
  const amount = BigInt(value);
  const sign = amount < 0n ? '-' : '';
  const absolute = amount < 0n ? -amount : amount;
  const rubles = (absolute / 100n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  const kopecks = (absolute % 100n).toString().padStart(2, '0');
  return `${sign}${rubles},${kopecks} ${currency}`;
}
