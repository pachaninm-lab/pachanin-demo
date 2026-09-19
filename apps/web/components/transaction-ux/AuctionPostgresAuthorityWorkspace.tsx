import type { Metadata } from 'next';
import Link from 'next/link';
import { getLocale } from 'next-intl/server';
import { InlineNotice, StatusChip } from '@pc/design-system-v8';
import { CollapsibleSection } from '@/components/platform-v7/CollapsibleSection';
import {
  getAccessibleAuctionLotsCanonical,
  getAuctionWorkspaceCanonical,
  type AccessibleAuctionLot,
  type AuctionAuthorityProof,
  type CanonicalAuctionWorkspace,
} from '@/lib/auction-server';
import {
  OperationalCockpitSection,
  OperationalDecisionCockpit,
  OperationalQueue,
  OperationalQueueLink,
  operationalCockpitClasses,
  type OperationalCockpitLabels,
} from './OperationalDecisionCockpit';

export type AuctionAuthorityStage = 'overview' | 'import' | 'admission' | 'bids' | 'deal-basis';
type Locale = 'ru' | 'en' | 'zh';
type Tone = 'neutral' | 'success' | 'warning' | 'critical' | 'information';

type Copy = {
  eyebrow: string;
  title: Record<AuctionAuthorityStage, string>;
  description: Record<AuctionAuthorityStage, string>;
  meta: OperationalCockpitLabels;
  status: { choose: string; unavailable: string; blocked: string; ready: string; deal: string };
  priority: {
    choose: [string, string];
    unavailable: [string, string];
    blocked: [string, string];
    ready: [string, string];
    deal: [string, string];
  };
  labels: {
    blocker: string;
    owner: string;
    impact: string;
    result: string;
    lot: string;
    lotStatus: string;
    authority: string;
    readiness: string;
    bids: string;
    bestBid: string;
    deal: string;
    notSelected: string;
    unavailable: string;
    noBid: string;
    noDeal: string;
    points: string;
    chooseLot: string;
    retry: string;
    openDeal: string;
    openDeals: string;
  };
  phaseTitle: string;
  phaseSummary: string;
  lotTitle: string;
  lotSummary: string;
  checksTitle: string;
  checksSummary: string;
  phases: Record<AuctionAuthorityStage, [string, string]>;
  phaseStates: { current: string; available: string; blocked: string; complete: string };
  emptyLots: [string, string];
  unavailableLots: [string, string];
  noBlockers: string;
  milestone: string;
  boundaryTitle: string;
  boundary: string;
  importBoundary: string;
  bidBoundary: string;
  dealBoundary: string;
  authorityMismatch: string;
  lotMeta: (lot: AccessibleAuctionLot) => string;
};

const COPY: Record<Locale, Copy> = {
  ru: {
    eyebrow: 'Аукцион · PostgreSQL authority → допуск → ставки → Сделка',
    title: {
      overview: 'Аукцион начинается только с подтверждённого сервером лота',
      import: 'Источник партии должен быть подтверждён внешним контуром',
      admission: 'Допуск предшествует цене',
      bids: 'Ставки читаются только из серверного журнала',
      'deal-basis': 'Победитель становится Сделкой только на сервере',
    },
    description: {
      overview: 'Лот, статус, готовность, ставки, победитель и dealId не создаются в интерфейсе. Экран принимает только ответ с явным PostgreSQL authority proof.',
      import: 'Локальная карточка не заменяет ФГИС и СДИЗ. Пока серверный контракт не вернул подтверждённые реквизиты, импорт считается незавершённым.',
      admission: 'Торги закрыты, пока сервер не подтвердил лот, документы, объём, цену, режим торгов и отсутствие блокеров.',
      bids: 'Интерфейс не сортирует локальный массив и не назначает победителя. Он показывает только агрегаты подтверждённого workspace.',
      'deal-basis': 'Переход разрешён только при dealCreated=true и непустом каноническом dealId в подтверждённом серверном ответе.',
    },
    meta: { blocker: 'Блокер', owner: 'Ответственный', impact: 'Влияние', result: 'Результат', nextAction: 'Следующее безопасное действие', prioritySection: 'Главная задача аукциона', factsSection: 'Подтверждённые факты аукциона' },
    status: { choose: 'выбери лот', unavailable: 'authority недоступна', blocked: 'есть серверные блокеры', ready: 'готовность подтверждена', deal: 'Сделка создана сервером' },
    priority: {
      choose: ['Выбери доступный лот', 'Реестр появится только из tenant-scoped ответа с PostgreSQL authority proof.'],
      unavailable: ['Не подменять отсутствующую authority', 'Legacy seed, публичный report и локальные fixtures не используются. Торги остаются закрытыми.'],
      blocked: ['Закрыть серверные блокеры', 'До устранения блокеров нельзя открывать торги, назначать победителя или создавать основание Сделки.'],
      ready: ['Продолжить серверный торговый процесс', 'Готовность подтверждена, но любое изменение остаётся отдельной серверной командой.'],
      deal: ['Открыть каноническую Сделку', 'Сервер связал торговый origin с dealId; дальнейшее исполнение идёт внутри одной Сделки.'],
    },
    labels: { blocker: 'auction authority или её блокеры', owner: 'продавец · комплаенс · покупатели · оператор', impact: 'цена не входит в исполнение без server award', result: 'лот → допуск → журнал ставок → award → dealId', lot: 'Выбранный лот', lotStatus: 'Статус лота', authority: 'Authority proof', readiness: 'Готовность', bids: 'Ставок', bestBid: 'Лучшая ставка', deal: 'Связь со Сделкой', notSelected: 'не выбран', unavailable: 'не подтверждено', noBid: 'нет подтверждённой ставки', noDeal: 'Сделка не создана', points: 'баллов', chooseLot: 'Выбрать лот', retry: 'Повторить проверку', openDeal: 'Открыть Сделку', openDeals: 'Реестр Сделок' },
    phaseTitle: 'Контур исполнения аукциона', phaseSummary: 'lotId сохраняется на каждом этапе', lotTitle: 'Лоты текущей организации', lotSummary: 'только PostgreSQL authority envelope', checksTitle: 'Блокеры и обязательные вехи', checksSummary: 'только данные подтверждённого workspace',
    phases: { overview: ['Обзор', 'Выбор лота и общий статус'], import: ['Импорт', 'Внешний источник и реквизиты партии'], admission: ['Допуск', 'Проверки до открытия цены'], bids: ['Ставки', 'Агрегаты серверного журнала'], 'deal-basis': ['Основание Сделки', 'Переход только по server dealId'] },
    phaseStates: { current: 'текущий этап', available: 'доступен', blocked: 'заблокирован', complete: 'завершён' },
    emptyLots: ['Доступных лотов нет', 'Лот появится после подтверждения сервером участия текущей организации.'],
    unavailableLots: ['Реестр лотов недоступен', 'Ответ без PostgreSQL authority proof отклонён. Локальные лоты не подставлены.'],
    noBlockers: 'Сервер не вернул блокеров', milestone: 'Следующая обязательная веха', boundaryTitle: 'Граница доказанности',
    boundary: 'UI работает только на чтение: он не размещает ставку, не отменяет запись журнала, не назначает победителя и не создаёт Сделку. При отсутствии PostgreSQL authority proof весь торговый контур fail-closed.',
    importBoundary: 'Текущий workspace не содержит подтверждённых реквизитов ФГИС/СДИЗ. Импорт нельзя считать завершённым.',
    bidBoundary: 'Полный неизменяемый журнал ставок не входит в текущий read envelope. Экран не дорисовывает ставки и победителя.',
    dealBoundary: 'Ссылка на Сделку появляется только при dealCreated=true и непустом dealId.',
    authorityMismatch: 'Authority proof лота и workspace не совпадает по tenant/actor или workspace вернул другой lotId.',
    lotMeta: (lot) => `${lot.culture}${lot.grade ? ` · ${lot.grade}` : ''} · ${lot.volumeTons} т · ${lot.region}`,
  },
  en: {
    eyebrow: 'Auction · PostgreSQL authority → admission → bids → Deal',
    title: { overview: 'An auction starts only from a server-confirmed lot', import: 'The external lot source must be confirmed', admission: 'Admission comes before price discovery', bids: 'Bids come only from the server journal', 'deal-basis': 'A winner becomes a Deal only on the server' },
    description: { overview: 'The UI does not create a lot, status, readiness, bid, winner or dealId. It accepts only an explicit PostgreSQL authority proof.', import: 'A local card cannot replace the grain registry or certificate. Import remains incomplete until the server contract returns confirmed identifiers.', admission: 'Trading stays closed until the server confirms the lot, documents, volume, price, mode and absence of blockers.', bids: 'The interface does not sort a local array or appoint a winner. It shows only aggregates from the confirmed workspace.', 'deal-basis': 'Navigation is allowed only when a confirmed server response contains dealCreated=true and a canonical dealId.' },
    meta: { blocker: 'Blocker', owner: 'Owner', impact: 'Impact', result: 'Result', nextAction: 'Next safe action', prioritySection: 'Primary auction task', factsSection: 'Confirmed auction facts' },
    status: { choose: 'select a lot', unavailable: 'authority unavailable', blocked: 'server blockers exist', ready: 'readiness confirmed', deal: 'Deal created by server' },
    priority: { choose: ['Select an accessible lot', 'The registry appears only from a tenant-scoped response carrying PostgreSQL authority proof.'], unavailable: ['Do not substitute missing authority', 'Legacy seeds, public reports and local fixtures are not used. Trading stays closed.'], blocked: ['Close server blockers', 'Trading, winner selection and Deal creation remain unavailable until blockers are resolved.'], ready: ['Continue the server trading process', 'Readiness is confirmed, but every mutation remains a separate server command.'], deal: ['Open the canonical Deal', 'The server linked the trading origin to a dealId; execution continues inside one Deal.'] },
    labels: { blocker: 'auction authority or its blockers', owner: 'seller · compliance · buyers · operator', impact: 'price cannot enter execution without server award', result: 'lot → admission → bid journal → award → dealId', lot: 'Selected lot', lotStatus: 'Lot status', authority: 'Authority proof', readiness: 'Readiness', bids: 'Bids', bestBid: 'Best bid', deal: 'Deal bridge', notSelected: 'not selected', unavailable: 'not confirmed', noBid: 'no confirmed bid', noDeal: 'Deal not created', points: 'points', chooseLot: 'Select lot', retry: 'Retry check', openDeal: 'Open Deal', openDeals: 'Deal registry' },
    phaseTitle: 'Auction execution contour', phaseSummary: 'lotId persists across every phase', lotTitle: 'Current organization lots', lotSummary: 'PostgreSQL authority envelope only', checksTitle: 'Blockers and required milestones', checksSummary: 'confirmed workspace values only',
    phases: { overview: ['Overview', 'Lot selection and overall status'], import: ['Import', 'External source and lot identifiers'], admission: ['Admission', 'Checks before price discovery'], bids: ['Bids', 'Server-journal aggregates'], 'deal-basis': ['Deal basis', 'Transition only through server dealId'] },
    phaseStates: { current: 'current phase', available: 'available', blocked: 'blocked', complete: 'complete' },
    emptyLots: ['No accessible lots', 'A lot appears only after the server confirms participation of the current organization.'], unavailableLots: ['Lot registry unavailable', 'A response without PostgreSQL authority proof was rejected. No local lot was substituted.'],
    noBlockers: 'The server returned no blockers', milestone: 'Next required milestone', boundaryTitle: 'Evidence boundary',
    boundary: 'The UI is read-only: it cannot place or cancel a bid, appoint a winner or create a Deal. Without PostgreSQL authority proof, the entire trading contour fails closed.',
    importBoundary: 'The current workspace does not include confirmed registry/certificate identifiers. Import cannot be treated as complete.', bidBoundary: 'The full immutable bid journal is not part of the current read envelope. The UI does not invent bids or a winner.', dealBoundary: 'The Deal link appears only when dealCreated=true and dealId is non-empty.', authorityMismatch: 'Lot and workspace authority proofs differ by tenant/actor, or the workspace returned another lotId.',
    lotMeta: (lot) => `${lot.culture}${lot.grade ? ` · ${lot.grade}` : ''} · ${lot.volumeTons} t · ${lot.region}`,
  },
  zh: {
    eyebrow: '竞价 · PostgreSQL 权威 → 准入 → 报价 → 交易',
    title: { overview: '竞价只能从服务器确认的批次开始', import: '批次外部来源必须得到确认', admission: '先准入，再形成价格', bids: '报价只能来自服务器日志', 'deal-basis': '中标方只能在服务器端转为交易' },
    description: { overview: '界面不会创建批次、状态、就绪度、报价、中标方或 dealId。只接受带明确 PostgreSQL 权威证明的响应。', import: '本地卡片不能替代粮食登记或凭证。服务器合同返回已确认标识前，导入仍未完成。', admission: '服务器确认批次、文件、数量、价格、交易模式且无阻塞项前，竞价保持关闭。', bids: '界面不会排序本地数组或指定中标方，只显示已确认工作区的汇总。', 'deal-basis': '只有已确认服务器响应包含 dealCreated=true 和规范 dealId 时才允许跳转。' },
    meta: { blocker: '阻塞项', owner: '负责人', impact: '影响', result: '结果', nextAction: '下一项安全操作', prioritySection: '主要竞价任务', factsSection: '已确认竞价事实' },
    status: { choose: '选择批次', unavailable: '权威不可用', blocked: '存在服务器阻塞项', ready: '就绪度已确认', deal: '服务器已创建交易' },
    priority: { choose: ['选择可访问批次', '只有带 PostgreSQL 权威证明的租户范围响应才能形成列表。'], unavailable: ['不得替代缺失权威', '不使用旧 seed、公开 report 或本地 fixture，竞价保持关闭。'], blocked: ['关闭服务器阻塞项', '阻塞项解决前，不得开盘、指定中标方或创建交易。'], ready: ['继续服务器交易流程', '就绪度已确认，但任何变更仍必须是独立服务器命令。'], deal: ['打开规范交易', '服务器已把交易来源绑定到 dealId，后续执行在同一交易中继续。'] },
    labels: { blocker: '竞价权威或其阻塞项', owner: '卖方 · 合规 · 买方 · 运营', impact: '没有服务器 award，价格不能进入执行', result: '批次 → 准入 → 报价日志 → award → dealId', lot: '所选批次', lotStatus: '批次状态', authority: '权威证明', readiness: '就绪度', bids: '报价数', bestBid: '最佳报价', deal: '交易关联', notSelected: '未选择', unavailable: '未确认', noBid: '没有已确认报价', noDeal: '尚未创建交易', points: '分', chooseLot: '选择批次', retry: '重新检查', openDeal: '打开交易', openDeals: '交易登记' },
    phaseTitle: '竞价履约流程', phaseSummary: '每个阶段保留 lotId', lotTitle: '当前组织批次', lotSummary: '仅接受 PostgreSQL 权威信封', checksTitle: '阻塞项和必需里程碑', checksSummary: '仅显示已确认工作区值',
    phases: { overview: ['概览', '选择批次和总体状态'], import: ['导入', '外部来源和批次标识'], admission: ['准入', '价格发现前检查'], bids: ['报价', '服务器日志汇总'], 'deal-basis': ['交易依据', '仅通过服务器 dealId 转换'] },
    phaseStates: { current: '当前阶段', available: '可用', blocked: '已阻塞', complete: '已完成' },
    emptyLots: ['没有可访问批次', '服务器确认当前组织参与后，批次才会出现。'], unavailableLots: ['批次登记不可用', '缺少 PostgreSQL 权威证明的响应已被拒绝，未替换本地批次。'],
    noBlockers: '服务器未返回阻塞项', milestone: '下一项必需里程碑', boundaryTitle: '证据边界',
    boundary: '界面仅供读取：不能提交或取消报价、指定中标方或创建交易。没有 PostgreSQL 权威证明时，整个交易流程 fail-closed。',
    importBoundary: '当前工作区不包含已确认的登记/凭证标识，因此不能视为导入完成。', bidBoundary: '当前读取信封不含完整且不可变的报价日志，界面不会虚构报价或中标方。', dealBoundary: '只有 dealCreated=true 且 dealId 非空时才显示交易链接。', authorityMismatch: '批次与工作区权威证明的 tenant/actor 不一致，或工作区返回了其他 lotId。',
    lotMeta: (lot) => `${lot.culture}${lot.grade ? ` · ${lot.grade}` : ''} · ${lot.volumeTons} 吨 · ${lot.region}`,
  },
};

const STAGES: AuctionAuthorityStage[] = ['overview', 'import', 'admission', 'bids', 'deal-basis'];

function normalizeLocale(value: string): Locale {
  if (value.startsWith('en')) return 'en';
  if (value.startsWith('zh')) return 'zh';
  return 'ru';
}

function routeFor(stage: AuctionAuthorityStage, lotId?: string): string {
  const base = stage === 'overview' ? '/platform-v7/auction' : `/platform-v7/auction/${stage}`;
  return lotId ? `${base}?lotId=${encodeURIComponent(lotId)}` : base;
}

function sameAuthority(left: AuctionAuthorityProof | null, right: AuctionAuthorityProof | null): boolean {
  return Boolean(left && right && left.tenantId === right.tenantId && left.actorId === right.actorId);
}

function authorityLabel(proof: AuctionAuthorityProof | null, locale: Locale, unavailable: string): string {
  if (!proof) return unavailable;
  const observed = new Intl.DateTimeFormat(locale === 'zh' ? 'zh-CN' : locale === 'en' ? 'en-GB' : 'ru-RU', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(proof.observedAt));
  return `${proof.source} · v${proof.version} · ${observed}`;
}

function money(value: number | null, locale: Locale, missing: string): string {
  if (value === null || !Number.isFinite(value)) return missing;
  return new Intl.NumberFormat(locale === 'zh' ? 'zh-CN' : locale === 'en' ? 'en-GB' : 'ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 }).format(value);
}

function statusTone(status: string): Tone {
  if (status === 'BIDDING' || status === 'OPEN') return 'information';
  if (status === 'IN_DEAL' || status === 'MATCHED' || status === 'CLOSED') return 'success';
  if (status === 'CANCELLED') return 'critical';
  return 'neutral';
}

function phaseState(stage: AuctionAuthorityStage, current: AuctionAuthorityStage, workspace: CanonicalAuctionWorkspace | null): { label: keyof Copy['phaseStates']; tone: Tone } {
  if (stage === current) return { label: 'current', tone: 'information' };
  if (!workspace) return { label: 'blocked', tone: 'critical' };
  if (stage === 'overview') return { label: 'complete', tone: 'success' };
  if (stage === 'import') return { label: 'available', tone: 'warning' };
  if (stage === 'admission') return workspace.readiness.readyForLive ? { label: 'complete', tone: 'success' } : { label: 'blocked', tone: 'critical' };
  if (stage === 'bids') return workspace.readiness.readyForLive ? { label: 'available', tone: 'information' } : { label: 'blocked', tone: 'critical' };
  return workspace.executionBridge.dealCreated ? { label: 'complete', tone: 'success' } : { label: 'blocked', tone: 'critical' };
}

export async function getAuctionAuthorityMetadata(stage: AuctionAuthorityStage): Promise<Metadata> {
  const copy = COPY[normalizeLocale(await getLocale())];
  return { title: copy.title[stage], description: copy.description[stage] };
}

export async function AuctionPostgresAuthorityWorkspace({ stage, lotId }: { stage: AuctionAuthorityStage; lotId?: string }) {
  const locale = normalizeLocale(await getLocale());
  const copy = COPY[locale];
  const lotsResult = await getAccessibleAuctionLotsCanonical();
  const lots = lotsResult.data ?? [];
  const selectedLot = lotId ? lots.find((lot) => lot.id === lotId) ?? null : null;
  const accessDenied = Boolean(lotId && lotsResult.available && !selectedLot);
  const workspaceResult = lotId && selectedLot ? await getAuctionWorkspaceCanonical(lotId) : null;
  const authorityConsistent = Boolean(
    workspaceResult?.available && workspaceResult.data && selectedLot
    && sameAuthority(lotsResult.authority, workspaceResult.authority)
    && workspaceResult.data.lotId === selectedLot.id,
  );
  const workspace = authorityConsistent ? workspaceResult?.data ?? null : null;
  const authorityConflict = Boolean(workspaceResult?.available && !authorityConsistent);
  const unavailable = Boolean(lotId && (accessDenied || !selectedLot || !workspace || authorityConflict));
  const dealCreated = Boolean(workspace?.executionBridge.dealCreated && workspace.executionBridge.dealId);
  const blocked = Boolean(workspace && !workspace.readiness.readyForLive);

  const stateKey = !lotId ? 'choose' : unavailable ? 'unavailable' : dealCreated ? 'deal' : blocked ? 'blocked' : 'ready';
  const [priorityTitle, priorityDescription] = copy.priority[stateKey];
  const tone: Tone = stateKey === 'unavailable' ? 'critical' : stateKey === 'blocked' ? 'warning' : stateKey === 'deal' ? 'success' : stateKey === 'ready' ? 'information' : 'neutral';
  const primaryAction = dealCreated && workspace?.executionBridge.dealId
    ? <Link className={operationalCockpitClasses.primaryLink} href={`/platform-v7/deals/${encodeURIComponent(workspace.executionBridge.dealId)}/execution`}>{copy.labels.openDeal}</Link>
    : !lotId
      ? <a className={operationalCockpitClasses.primaryLink} href='#auction-lots'>{copy.labels.chooseLot}</a>
      : <Link className={operationalCockpitClasses.primaryLink} href={routeFor(stage, lotId)}>{copy.labels.retry}</Link>;

  const proof = workspaceResult?.authority ?? lotsResult.authority;
  const sourceError = authorityConflict ? copy.authorityMismatch : workspaceResult?.error ?? lotsResult.error;

  return (
    <OperationalDecisionCockpit
      testId={`platform-v7-auction-${stage}-postgres-authority-v8`}
      eyebrow={copy.eyebrow}
      title={copy.title[stage]}
      description={copy.description[stage]}
      statusLabel={copy.status[stateKey]}
      statusTone={tone}
      labels={copy.meta}
      priority={{
        state: stateKey === 'ready' || stateKey === 'deal' ? 'ready' : stateKey === 'choose' ? 'active' : 'critical',
        title: priorityTitle,
        description: priorityDescription,
        blocker: sourceError || (workspace?.readiness.blockers.length ? String(workspace.readiness.blockers.length) : copy.labels.unavailable),
        owner: copy.labels.owner,
        impact: copy.labels.impact,
        result: copy.labels.result,
        primaryAction,
        secondaryAction: <Link className={operationalCockpitClasses.secondaryLink} href='/platform-v7/deals'>{copy.labels.openDeals}</Link>,
      }}
      facts={[
        { label: copy.labels.lot, value: selectedLot?.title ?? lotId ?? copy.labels.notSelected, hint: selectedLot ? selectedLot.id : copy.labels.unavailable },
        { label: copy.labels.lotStatus, value: workspace?.lotStatus ?? selectedLot?.status ?? copy.labels.unavailable, hint: selectedLot ? copy.labels.authority : copy.labels.unavailable },
        { label: copy.labels.authority, value: authorityLabel(proof, locale, copy.labels.unavailable), hint: proof?.scope ?? copy.labels.unavailable },
        { label: copy.labels.readiness, value: workspace ? `${workspace.readiness.score} ${copy.labels.points}` : copy.labels.unavailable, hint: workspace?.readiness.band ?? copy.labels.unavailable },
        { label: copy.labels.bids, value: workspace ? String(workspace.bidCount) : copy.labels.unavailable, hint: copy.bidBoundary },
        { label: copy.labels.bestBid, value: money(workspace?.bestBid?.amount ?? null, locale, copy.labels.noBid), hint: workspace?.bestBid?.status ?? copy.labels.unavailable },
        { label: copy.labels.deal, value: workspace?.executionBridge.dealId ?? copy.labels.noDeal, hint: copy.dealBoundary },
      ]}
      boundary={copy.boundary}
    >
      <OperationalCockpitSection id='auction-phases'>
        <CollapsibleSection title={copy.phaseTitle} summary={copy.phaseSummary} defaultOpen>
          <OperationalQueue>
            {STAGES.map((item) => {
              const phase = phaseState(item, stage, workspace);
              return <OperationalQueueLink key={item} href={routeFor(item, lotId)} title={copy.phases[item][0]} detail={copy.phases[item][1]} status={<StatusChip tone={phase.tone}>{copy.phaseStates[phase.label]}</StatusChip>} />;
            })}
          </OperationalQueue>
        </CollapsibleSection>
      </OperationalCockpitSection>

      <OperationalCockpitSection id='auction-lots'>
        <CollapsibleSection title={copy.lotTitle} summary={copy.lotSummary} defaultOpen={!lotId}>
          {!lotsResult.available ? (
            <InlineNotice tone='critical' title={copy.unavailableLots[0]}>{copy.unavailableLots[1]}</InlineNotice>
          ) : lots.length === 0 ? (
            <InlineNotice tone='information' title={copy.emptyLots[0]}>{copy.emptyLots[1]}</InlineNotice>
          ) : (
            <OperationalQueue>
              {lots.map((lot) => <OperationalQueueLink key={lot.id} href={routeFor(stage, lot.id)} title={lot.title} detail={copy.lotMeta(lot)} status={<StatusChip tone={statusTone(lot.status)}>{lot.status}</StatusChip>} />)}
            </OperationalQueue>
          )}
        </CollapsibleSection>
      </OperationalCockpitSection>

      <OperationalCockpitSection id='auction-checks'>
        <CollapsibleSection title={copy.checksTitle} summary={copy.checksSummary} defaultOpen={Boolean(lotId)}>
          {stage === 'import' ? <InlineNotice tone='warning' title={copy.phases.import[0]}>{copy.importBoundary}</InlineNotice> : null}
          {stage === 'bids' ? <InlineNotice tone='information' title={copy.phases.bids[0]}>{copy.bidBoundary}</InlineNotice> : null}
          {stage === 'deal-basis' ? <InlineNotice tone={dealCreated ? 'success' : 'warning'} title={copy.phases['deal-basis'][0]}>{copy.dealBoundary}</InlineNotice> : null}
          {workspace ? (
            <OperationalQueue>
              {(workspace.readiness.blockers.length ? workspace.readiness.blockers : [copy.noBlockers]).map((item, index) => <OperationalQueueLink key={`blocker-${index}`} href={routeFor(stage, lotId)} title={workspace.readiness.blockers.length ? copy.labels.blocker : copy.noBlockers} detail={item} status={<StatusChip tone={workspace.readiness.blockers.length ? 'critical' : 'success'}>{workspace.readiness.blockers.length ? copy.phaseStates.blocked : copy.phaseStates.complete}</StatusChip>} />)}
              {workspace.executionBridge.nextRequiredMilestones.map((item, index) => <OperationalQueueLink key={`milestone-${index}`} href={routeFor(stage, lotId)} title={copy.milestone} detail={item} status={<StatusChip tone='information'>{copy.phaseStates.available}</StatusChip>} />)}
            </OperationalQueue>
          ) : (
            <InlineNotice tone={lotId ? 'critical' : 'information'} title={priorityTitle}>{sourceError || priorityDescription}</InlineNotice>
          )}
        </CollapsibleSection>
      </OperationalCockpitSection>

      <OperationalCockpitSection>
        <InlineNotice tone='warning' title={copy.boundaryTitle}>{copy.boundary}</InlineNotice>
      </OperationalCockpitSection>
    </OperationalDecisionCockpit>
  );
}
