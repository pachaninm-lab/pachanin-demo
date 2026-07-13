import Link from 'next/link';
import { getLocale } from 'next-intl/server';
import { InlineNotice, StatusChip } from '@pc/design-system-v8';
import { CollapsibleSection } from '@/components/platform-v7/CollapsibleSection';
import {
  getAccessibleAuctionLotsCanonical,
  getAuctionWorkspaceCanonical,
  type AccessibleAuctionLot,
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
  stages: Record<AuctionAuthorityStage, { title: string; description: string }>;
  status: {
    choose: string;
    unavailable: string;
    blocked: string;
    ready: string;
    dealCreated: string;
  };
  priority: {
    chooseTitle: string;
    chooseDescription: string;
    unavailableTitle: string;
    unavailableDescription: string;
    blockedTitle: string;
    blockedDescription: string;
    readyTitle: string;
    readyDescription: string;
    dealTitle: string;
    dealDescription: string;
  };
  meta: OperationalCockpitLabels;
  labels: {
    blocker: string;
    owner: string;
    impact: string;
    result: string;
    selectedLot: string;
    lotStatus: string;
    readiness: string;
    bids: string;
    bestBid: string;
    deal: string;
    notSelected: string;
    unavailable: string;
    notConfirmed: string;
    noBid: string;
    noDeal: string;
    points: string;
    openDeal: string;
    chooseLot: string;
    retry: string;
    serverSource: string;
    accessConfirmed: string;
    accessUnconfirmed: string;
  };
  boundary: string;
  lotsTitle: string;
  lotsSummary: string;
  lotsEmptyTitle: string;
  lotsEmptyBody: string;
  lotsErrorTitle: string;
  lotsErrorBody: string;
  stagesTitle: string;
  stagesSummary: string;
  checksTitle: string;
  checksSummary: string;
  limitationsTitle: string;
  limitationsBody: string;
  stageNames: Record<AuctionAuthorityStage, string>;
  stageDescriptions: Record<AuctionAuthorityStage, string>;
  stageStates: { current: string; available: string; blocked: string; complete: string };
  lotMeta: (lot: AccessibleAuctionLot) => string;
  serverBlocker: string;
  noBlockers: string;
  milestones: string;
  bidJournalBoundary: string;
  importBoundary: string;
  dealBoundary: string;
};

const COPY: Record<Locale, Copy> = {
  ru: {
    eyebrow: 'Аукцион · серверный лот → допуск → ставки → Сделка',
    stages: {
      overview: { title: 'Аукцион начинается с серверно доступного лота', description: 'Общий экран не создаёт лот, ставку, победителя или Сделку локально. Сначала сервер подтверждает доступ к лоту, затем отдельный auction workspace возвращает готовность, ставки и связь со Сделкой.' },
      import: { title: 'Импорт партии подтверждает внешний источник', description: 'Экран не подменяет ФГИС и СДИЗ локальной карточкой. Он показывает только то, что вернул серверный workspace; отсутствие регуляторных реквизитов считается блокером, а не поводом дорисовать их.' },
      admission: { title: 'Допуск предшествует цене', description: 'Торги нельзя считать открытыми, пока сервер не подтвердил обязательные поля, объём, цену, документы, режим торгов и допуск участников.' },
      bids: { title: 'Ставки читаются только из серверного журнала', description: 'Интерфейс не выбирает победителя сортировкой локального массива. Он показывает только агрегаты и лучшую ставку из серверного auction workspace.' },
      'deal-basis': { title: 'Победитель становится Сделкой только на сервере', description: 'Цена и победитель сами по себе не создают Сделку. Переход разрешён только когда сервер вернул dealCreated=true и канонический dealId.' },
    },
    status: { choose: 'выбери лот', unavailable: 'workspace недоступен', blocked: 'есть блокеры', ready: 'готовность подтверждена сервером', dealCreated: 'Сделка создана сервером' },
    priority: {
      chooseTitle: 'Выбери доступный лот', chooseDescription: 'Реестр ниже формируется ответом /lots/my с учётом текущей серверной роли и организации.',
      unavailableTitle: 'Не подменять отсутствующий auction workspace', unavailableDescription: 'Сервер не подтвердил рабочее состояние выбранного лота. Цена, победитель и основание сделки не вычисляются локально.',
      blockedTitle: 'Закрыть серверные блокеры допуска', blockedDescription: 'До устранения блокеров нельзя объявлять торги готовыми, фиксировать победителя или создавать основание Сделки.',
      readyTitle: 'Продолжить серверный торговый процесс', readyDescription: 'Готовность подтверждена серверной проекцией. Следующий шаг остаётся серверной командой, а не изменением состояния в интерфейсе.',
      dealTitle: 'Открыть созданную каноническую Сделку', dealDescription: 'Сервер уже связал торговый origin с dealId. Дальнейшие логистика, документы и деньги выполняются внутри одной Сделки.',
    },
    meta: { blocker: 'Блокер', owner: 'Ответственный', impact: 'Влияние', result: 'Результат', nextAction: 'Следующее безопасное действие', prioritySection: 'Главная задача аукциона', factsSection: 'Серверные факты аукциона' },
    labels: {
      blocker: 'auction workspace или его блокеры', owner: 'продавец · комплаенс · покупатели · оператор', impact: 'цена не конвертируется в исполнение без server award', result: 'лот → допуск → журнал ставок → server award → dealId', selectedLot: 'Выбранный лот', lotStatus: 'Статус лота', readiness: 'Готовность', bids: 'Ставок', bestBid: 'Лучшая ставка', deal: 'Связь со Сделкой', notSelected: 'не выбран', unavailable: 'недоступно', notConfirmed: 'не подтверждено', noBid: 'нет подтверждённой ставки', noDeal: 'Сделка не создана', points: 'баллов', openDeal: 'Открыть Сделку', chooseLot: 'Выбрать лот', retry: 'Повторить серверную проверку', serverSource: 'Источник', accessConfirmed: 'доступ подтверждён сервером', accessUnconfirmed: 'доступ не подтверждён',
    },
    boundary: 'UI работает только на чтение: он не размещает ставку, не отменяет запись журнала, не назначает победителя и не создаёт Сделку. ФГИС/СДИЗ, допуск, award и dealId должны прийти из серверного или внешнего подтверждённого контура. Текущий UI acceptance не доказывает PostgreSQL-authoritative auction backend или live-интеграцию ФГИС.',
    lotsTitle: 'Доступные серверу лоты', lotsSummary: 'без локального seed и публичного report fallback', lotsEmptyTitle: 'Доступных лотов нет', lotsEmptyBody: 'Лот появится только после того, как сервер подтвердит доступ текущей организации или роли.', lotsErrorTitle: 'Реестр лотов недоступен', lotsErrorBody: 'Локальные демонстрационные лоты не подставлены. Проверь авторизацию и серверный контур.',
    stagesTitle: 'Контур исполнения аукциона', stagesSummary: 'каждый этап сохраняет выбранный lotId', checksTitle: 'Блокеры и обязательные вехи', checksSummary: 'только значения серверного workspace', limitationsTitle: 'Граница доказанности', limitationsBody: 'Серверный workspace сейчас является read boundary. До отдельного PostgreSQL auction authority и команд bid/award интерфейс обязан оставаться fail-closed.',
    stageNames: { overview: 'Обзор', import: 'Импорт', admission: 'Допуск', bids: 'Ставки', 'deal-basis': 'Основание Сделки' },
    stageDescriptions: { overview: 'Выбор лота и общий статус', import: 'Внешний источник и реквизиты партии', admission: 'Проверки до открытия цены', bids: 'Агрегаты серверного журнала', 'deal-basis': 'Переход только по server dealId' },
    stageStates: { current: 'текущий этап', available: 'доступен', blocked: 'заблокирован', complete: 'завершён' },
    lotMeta: (lot) => `${lot.culture}${lot.grade ? ` · ${lot.grade}` : ''} · ${lot.volumeTons} т · ${lot.region}`,
    serverBlocker: 'Серверный блокер', noBlockers: 'Сервер не вернул блокеров', milestones: 'Следующие обязательные вехи', bidJournalBoundary: 'Полный неизменяемый журнал ставок не входит в текущий workspace envelope. Поэтому экран не показывает вымышленные ставки и не определяет победителя самостоятельно.', importBoundary: 'Текущий workspace не содержит подтверждённых реквизитов ФГИС/СДИЗ. До расширения серверного контракта импорт нельзя считать доказанным.', dealBoundary: 'Кнопка перехода в Сделку появляется только при dealCreated=true и непустом dealId в серверном ответе.',
  },
  en: {
    eyebrow: 'Auction · server lot → admission → bids → Deal',
    stages: {
      overview: { title: 'An auction starts with a server-accessible lot', description: 'The global screen does not create a lot, bid, winner or Deal locally. The server confirms lot access first; a separate auction workspace then returns readiness, bid aggregates and the Deal bridge.' },
      import: { title: 'Lot import requires an external source', description: 'The screen does not replace the grain registry or certificate with a local card. It shows only the server workspace; missing regulatory identifiers remain blockers.' },
      admission: { title: 'Admission comes before price discovery', description: 'Trading cannot be treated as open until the server confirms required fields, volume, price, documents, trading mode and participant admission.' },
      bids: { title: 'Bids come only from the server journal', description: 'The interface does not choose a winner by sorting a local array. It displays only aggregates and the best bid returned by the server workspace.' },
      'deal-basis': { title: 'A winner becomes a Deal only on the server', description: 'Price and winner do not create a Deal by themselves. Navigation is allowed only when the server returns dealCreated=true and a canonical dealId.' },
    },
    status: { choose: 'select a lot', unavailable: 'workspace unavailable', blocked: 'blockers exist', ready: 'readiness confirmed by server', dealCreated: 'Deal created by server' },
    priority: {
      chooseTitle: 'Select an accessible lot', chooseDescription: 'The registry below is returned by /lots/my under the current server role and organization.',
      unavailableTitle: 'Do not substitute a missing auction workspace', unavailableDescription: 'The server did not confirm the selected lot workspace. Price, winner and Deal basis are not calculated locally.',
      blockedTitle: 'Close server admission blockers', blockedDescription: 'Trading, winner selection and Deal creation remain unavailable until blockers are resolved.',
      readyTitle: 'Continue the server trading process', readyDescription: 'The server projection confirms readiness. The next step remains a server command, not a UI state change.',
      dealTitle: 'Open the canonical Deal', dealDescription: 'The server linked the trading origin to a dealId. Logistics, documents and money continue inside that Deal.',
    },
    meta: { blocker: 'Blocker', owner: 'Owner', impact: 'Impact', result: 'Result', nextAction: 'Next safe action', prioritySection: 'Primary auction task', factsSection: 'Server auction facts' },
    labels: {
      blocker: 'auction workspace or its blockers', owner: 'seller · compliance · buyers · operator', impact: 'price cannot enter execution without a server award', result: 'lot → admission → bid journal → server award → dealId', selectedLot: 'Selected lot', lotStatus: 'Lot status', readiness: 'Readiness', bids: 'Bids', bestBid: 'Best bid', deal: 'Deal bridge', notSelected: 'not selected', unavailable: 'unavailable', notConfirmed: 'not confirmed', noBid: 'no confirmed bid', noDeal: 'Deal not created', points: 'points', openDeal: 'Open Deal', chooseLot: 'Select lot', retry: 'Retry server check', serverSource: 'Source', accessConfirmed: 'access confirmed by server', accessUnconfirmed: 'access not confirmed',
    },
    boundary: 'The UI is read-only: it does not place a bid, delete a journal entry, appoint a winner or create a Deal. Registry/certificate, admission, award and dealId must come from verified server or external paths. This UI acceptance does not prove a PostgreSQL-authoritative auction backend or live registry integration.',
    lotsTitle: 'Server-accessible lots', lotsSummary: 'without local seeds or public report fallback', lotsEmptyTitle: 'No accessible lots', lotsEmptyBody: 'A lot appears only after the server confirms access for the current organization or role.', lotsErrorTitle: 'Lot registry unavailable', lotsErrorBody: 'No local demonstration lots were substituted. Check authentication and the server contour.',
    stagesTitle: 'Auction execution contour', stagesSummary: 'each stage preserves the selected lotId', checksTitle: 'Blockers and required milestones', checksSummary: 'server workspace values only', limitationsTitle: 'Evidence boundary', limitationsBody: 'The server workspace is currently a read boundary. Until PostgreSQL auction authority and bid/award commands are proven, the UI must fail closed.',
    stageNames: { overview: 'Overview', import: 'Import', admission: 'Admission', bids: 'Bids', 'deal-basis': 'Deal basis' },
    stageDescriptions: { overview: 'Lot selection and overall status', import: 'External source and lot identifiers', admission: 'Checks before price discovery', bids: 'Server journal aggregates', 'deal-basis': 'Transition only via server dealId' },
    stageStates: { current: 'current stage', available: 'available', blocked: 'blocked', complete: 'complete' },
    lotMeta: (lot) => `${lot.culture}${lot.grade ? ` · ${lot.grade}` : ''} · ${lot.volumeTons} t · ${lot.region}`,
    serverBlocker: 'Server blocker', noBlockers: 'The server returned no blockers', milestones: 'Next required milestones', bidJournalBoundary: 'The immutable full bid journal is not part of the current workspace envelope. The screen therefore shows no invented bids and never selects a winner itself.', importBoundary: 'The current workspace contains no confirmed registry/certificate identifiers. Import cannot be treated as proven until the server contract is extended.', dealBoundary: 'The Deal link appears only when the server returns dealCreated=true and a non-empty dealId.',
  },
  zh: {
    eyebrow: '竞价 · 服务器批次 → 准入 → 报价 → 交易',
    stages: {
      overview: { title: '竞价必须从服务器确认可访问的批次开始', description: '全局页面不会在本地创建批次、报价、中标方或交易。服务器先确认批次访问权限，再由独立的竞价工作区返回就绪度、报价汇总和交易关联。' },
      import: { title: '批次导入必须由外部来源确认', description: '页面不会用本地卡片替代粮食登记或凭证。只显示服务器工作区；缺失的监管标识仍是阻塞项。' },
      admission: { title: '准入必须先于价格发现', description: '服务器确认必填字段、数量、价格、文件、交易模式和参与方准入之前，不得视为已开盘。' },
      bids: { title: '报价只能来自服务器日志', description: '界面不会通过排序本地数组选择中标方，只显示服务器工作区返回的汇总和最佳报价。' },
      'deal-basis': { title: '中标方只能在服务器端转为交易', description: '价格和中标方本身不会创建交易。只有服务器返回 dealCreated=true 和规范 dealId 时才能进入交易。' },
    },
    status: { choose: '请选择批次', unavailable: '工作区不可用', blocked: '存在阻塞项', ready: '服务器已确认就绪', dealCreated: '服务器已创建交易' },
    priority: {
      chooseTitle: '选择可访问的批次', chooseDescription: '下方登记由 /lots/my 根据当前服务器角色和组织返回。',
      unavailableTitle: '不得替代缺失的竞价工作区', unavailableDescription: '服务器未确认所选批次的工作状态。价格、中标方和交易依据不会在本地计算。',
      blockedTitle: '关闭服务器准入阻塞项', blockedDescription: '阻塞项解决前，不得开盘、确定中标方或创建交易。',
      readyTitle: '继续服务器交易流程', readyDescription: '服务器投影已确认就绪。下一步仍是服务器命令，而不是界面状态变更。',
      dealTitle: '打开规范交易', dealDescription: '服务器已将交易来源关联到 dealId。运输、文件和资金继续在同一交易中执行。',
    },
    meta: { blocker: '阻塞项', owner: '负责人', impact: '影响', result: '结果', nextAction: '下一项安全操作', prioritySection: '主要竞价任务', factsSection: '服务器竞价事实' },
    labels: {
      blocker: '竞价工作区或其阻塞项', owner: '卖方 · 合规 · 买方 · 运营人员', impact: '没有服务器 award，价格不能进入履约', result: '批次 → 准入 → 报价日志 → 服务器 award → dealId', selectedLot: '所选批次', lotStatus: '批次状态', readiness: '就绪度', bids: '报价数', bestBid: '最佳报价', deal: '交易关联', notSelected: '未选择', unavailable: '不可用', notConfirmed: '未确认', noBid: '无已确认报价', noDeal: '尚未创建交易', points: '分', openDeal: '打开交易', chooseLot: '选择批次', retry: '重新检查服务器', serverSource: '来源', accessConfirmed: '服务器已确认访问', accessUnconfirmed: '访问未确认',
    },
    boundary: '界面仅供读取：不能提交报价、删除日志记录、指定中标方或创建交易。粮食登记/凭证、准入、award 和 dealId 必须来自经过验证的服务器或外部路径。本次 UI 验收不证明 PostgreSQL 权威竞价后端或实时登记集成。',
    lotsTitle: '服务器可访问批次', lotsSummary: '不使用本地 seed 或公开报告 fallback', lotsEmptyTitle: '没有可访问批次', lotsEmptyBody: '只有服务器确认当前组织或角色的访问权限后，批次才会出现。', lotsErrorTitle: '批次登记不可用', lotsErrorBody: '没有替换为本地演示批次。请检查认证和服务器链路。',
    stagesTitle: '竞价履约流程', stagesSummary: '每个阶段保留所选 lotId', checksTitle: '阻塞项和必需里程碑', checksSummary: '只显示服务器工作区值', limitationsTitle: '证据边界', limitationsBody: '当前服务器工作区只是读取边界。在 PostgreSQL 竞价权威和 bid/award 命令得到证明之前，界面必须 fail-closed。',
    stageNames: { overview: '概览', import: '导入', admission: '准入', bids: '报价', 'deal-basis': '交易依据' },
    stageDescriptions: { overview: '选择批次和总体状态', import: '外部来源和批次标识', admission: '价格发现前检查', bids: '服务器日志汇总', 'deal-basis': '仅通过服务器 dealId 转换' },
    stageStates: { current: '当前阶段', available: '可用', blocked: '已阻塞', complete: '已完成' },
    lotMeta: (lot) => `${lot.culture}${lot.grade ? ` · ${lot.grade}` : ''} · ${lot.volumeTons} 吨 · ${lot.region}`,
    serverBlocker: '服务器阻塞项', noBlockers: '服务器未返回阻塞项', milestones: '下一项必需里程碑', bidJournalBoundary: '当前工作区响应不包含完整且不可变的报价日志。因此页面不会展示虚构报价，也不会自行选择中标方。', importBoundary: '当前工作区不包含已确认的登记/凭证标识。服务器合同扩展前，不能视为已完成导入。', dealBoundary: '只有服务器返回 dealCreated=true 和非空 dealId 时才显示交易链接。',
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

function formatMoney(value: number | null, locale: Locale, missing: string): string {
  if (value === null || !Number.isFinite(value)) return missing;
  return new Intl.NumberFormat(locale === 'zh' ? 'zh-CN' : locale === 'en' ? 'en-GB' : 'ru-RU', {
    style: 'currency', currency: 'RUB', maximumFractionDigits: 0,
  }).format(value);
}

function lotStatusTone(status: string): Tone {
  if (status === 'BIDDING' || status === 'OPEN') return 'information';
  if (status === 'IN_DEAL' || status === 'MATCHED' || status === 'CLOSED') return 'success';
  if (status === 'CANCELLED') return 'critical';
  return 'neutral';
}

function stageState(stage: AuctionAuthorityStage, current: AuctionAuthorityStage, workspace: CanonicalAuctionWorkspace | null): { label: string; tone: Tone } {
  if (stage === current) return { label: 'current', tone: 'information' };
  if (!workspace) return { label: 'blocked', tone: 'critical' };
  if (stage === 'overview') return { label: 'complete', tone: 'success' };
  if (stage === 'import') return { label: 'available', tone: 'warning' };
  if (stage === 'admission') return workspace.readiness.readyForLive ? { label: 'complete', tone: 'success' } : { label: 'blocked', tone: 'critical' };
  if (stage === 'bids') return workspace.readiness.readyForLive ? { label: 'available', tone: 'information' } : { label: 'blocked', tone: 'critical' };
  return workspace.executionBridge.dealCreated ? { label: 'complete', tone: 'success' } : { label: 'blocked', tone: 'critical' };
}

function translateBlocker(value: string, locale: Locale): string {
  const key = value.trim();
  const map: Record<string, [string, string]> = {
    'Не заполнены обязательные поля лота.': ['Required lot fields are incomplete.', '批次必填字段不完整。'],
    'Не задана стартовая цена.': ['Start price is missing.', '缺少起拍价。'],
    'Не указан объём партии.': ['Lot volume is missing.', '缺少批次数量。'],
    'Для private auction нужен whitelist покупателей.': ['A private auction requires a buyer whitelist.', '私密竞价需要买方白名单。'],
    'Для target order нужна целевая цена.': ['A target order requires a target price.', '目标订单需要目标价格。'],
    'Для instant offer нужна фиксированная цена.': ['An instant offer requires a fixed price.', '即时报价需要固定价格。'],
    'Нет хотя бы одного документа или photo/evidence в профиле лота.': ['The lot profile has no document or photo evidence.', '批次资料中没有文件或照片证据。'],
  };
  if (locale === 'ru') return key;
  const translated = map[key];
  return translated ? translated[locale === 'en' ? 0 : 1] : key;
}

function translateMilestone(value: string, locale: Locale): string {
  const map: Record<string, Record<Locale, string>> = {
    'docs checklist': { ru: 'чек-лист документов', en: 'document checklist', zh: '文件清单' },
    'transport handoff': { ru: 'передача в логистику', en: 'transport handoff', zh: '转交运输' },
    'money readiness': { ru: 'готовность денег', en: 'money readiness', zh: '资金就绪' },
    'evidence timeline': { ru: 'лента доказательств', en: 'evidence timeline', zh: '证据时间线' },
    award: { ru: 'серверная фиксация победителя', en: 'server award', zh: '服务器确定中标方' },
    'winner admission': { ru: 'допуск победителя', en: 'winner admission', zh: '中标方准入' },
    'deal passport': { ru: 'паспорт Сделки', en: 'Deal passport', zh: '交易档案' },
  };
  return map[value]?.[locale] ?? value;
}

export async function AuctionServerAuthorityWorkspace({ stage, lotId }: { stage: AuctionAuthorityStage; lotId?: string }) {
  const locale = normalizeLocale(await getLocale());
  const copy = COPY[locale];
  const lotsResult = await getAccessibleAuctionLotsCanonical();
  const lots = lotsResult.data ?? [];
  const selectedLot = lotId ? lots.find((lot) => lot.id === lotId) ?? null : null;
  const accessDenied = Boolean(lotId && lotsResult.available && !selectedLot);
  const workspaceResult = lotId && selectedLot ? await getAuctionWorkspaceCanonical(lotId) : null;
  const workspace = workspaceResult?.available ? workspaceResult.data : null;
  const workspaceUnavailable = Boolean(lotId && selectedLot && !workspace);
  const dealCreated = Boolean(workspace?.executionBridge.dealCreated && workspace.executionBridge.dealId);
  const blocked = Boolean(workspace && !workspace.readiness.readyForLive);

  const statusLabel = !lotId
    ? copy.status.choose
    : accessDenied || workspaceUnavailable
      ? copy.status.unavailable
      : dealCreated
        ? copy.status.dealCreated
        : blocked
          ? copy.status.blocked
          : copy.status.ready;
  const statusTone: Tone = !lotId ? 'neutral' : accessDenied || workspaceUnavailable ? 'critical' : dealCreated ? 'success' : blocked ? 'warning' : 'information';

  const priority = !lotId
    ? { title: copy.priority.chooseTitle, description: copy.priority.chooseDescription, state: 'active' as const }
    : accessDenied || workspaceUnavailable
      ? { title: copy.priority.unavailableTitle, description: copy.priority.unavailableDescription, state: 'critical' as const }
      : dealCreated
        ? { title: copy.priority.dealTitle, description: copy.priority.dealDescription, state: 'ready' as const }
        : blocked
          ? { title: copy.priority.blockedTitle, description: copy.priority.blockedDescription, state: 'critical' as const }
          : { title: copy.priority.readyTitle, description: copy.priority.readyDescription, state: 'ready' as const };

  const primaryAction = dealCreated && workspace?.executionBridge.dealId
    ? <Link className={operationalCockpitClasses.primaryLink} href={`/platform-v7/deals/${encodeURIComponent(workspace.executionBridge.dealId)}/execution`}>{copy.labels.openDeal}</Link>
    : !lotId
      ? <a className={operationalCockpitClasses.primaryLink} href='#auction-lots'>{copy.labels.chooseLot}</a>
      : <Link className={operationalCockpitClasses.primaryLink} href={routeFor(stage, lotId)}>{copy.labels.retry}</Link>;

  const selectedLabel = selectedLot?.title ?? lotId ?? copy.labels.notSelected;
  const sourceLabel = workspaceResult?.source ?? lotsResult.source;

  return (
    <OperationalDecisionCockpit
      testId={`platform-v7-auction-${stage}-server-authority-v8`}
      eyebrow={copy.eyebrow}
      title={copy.stages[stage].title}
      description={copy.stages[stage].description}
      statusLabel={statusLabel}
      statusTone={statusTone}
      labels={copy.meta}
      priority={{
        ...priority,
        blocker: accessDenied ? copy.labels.accessUnconfirmed : workspaceUnavailable ? copy.labels.unavailable : workspace?.readiness.blockers.length ? `${workspace.readiness.blockers.length}` : copy.labels.notConfirmed,
        owner: copy.labels.owner,
        impact: copy.labels.impact,
        result: copy.labels.result,
        primaryAction,
        secondaryAction: <Link className={operationalCockpitClasses.secondaryLink} href='/platform-v7/deals'>{copy.labels.openDeal}</Link>,
      }}
      facts={[
        { label: copy.labels.selectedLot, value: selectedLabel, hint: selectedLot ? copy.labels.accessConfirmed : copy.labels.accessUnconfirmed },
        { label: copy.labels.lotStatus, value: workspace?.lotStatus ?? selectedLot?.status ?? copy.labels.unavailable, hint: copy.labels.serverSource },
        { label: copy.labels.readiness, value: workspace ? `${workspace.readiness.score} ${copy.labels.points}` : copy.labels.notConfirmed, hint: workspace?.readiness.band ?? sourceLabel },
        { label: copy.labels.bids, value: workspace ? String(workspace.bidCount) : copy.labels.notConfirmed, hint: copy.bidJournalBoundary },
        { label: copy.labels.bestBid, value: formatMoney(workspace?.bestBid?.amount ?? null, locale, copy.labels.noBid), hint: workspace?.bestBid?.status ?? copy.labels.notConfirmed },
        { label: copy.labels.deal, value: workspace?.executionBridge.dealId ?? copy.labels.noDeal, hint: copy.dealBoundary },
      ]}
      boundary={copy.boundary}
    >
      <OperationalCockpitSection id='auction-stages'>
        <CollapsibleSection title={copy.stagesTitle} summary={copy.stagesSummary} defaultOpen>
          <OperationalQueue>
            {STAGES.map((item) => {
              const state = stageState(item, stage, workspace);
              return (
                <OperationalQueueLink
                  key={item}
                  href={routeFor(item, lotId)}
                  title={copy.stageNames[item]}
                  detail={copy.stageDescriptions[item]}
                  status={<StatusChip tone={state.tone}>{copy.stageStates[state.label as keyof Copy['stageStates']]}</StatusChip>}
                />
              );
            })}
          </OperationalQueue>
        </CollapsibleSection>
      </OperationalCockpitSection>

      <OperationalCockpitSection id='auction-lots'>
        <CollapsibleSection title={copy.lotsTitle} summary={copy.lotsSummary} defaultOpen={!lotId}>
          {!lotsResult.available ? (
            <InlineNotice tone='critical' title={copy.lotsErrorTitle}>{copy.lotsErrorBody}</InlineNotice>
          ) : lots.length === 0 ? (
            <InlineNotice tone='information' title={copy.lotsEmptyTitle}>{copy.lotsEmptyBody}</InlineNotice>
          ) : (
            <OperationalQueue>
              {lots.map((lot) => (
                <OperationalQueueLink
                  key={lot.id}
                  href={routeFor(stage, lot.id)}
                  title={lot.title}
                  detail={copy.lotMeta(lot)}
                  status={<StatusChip tone={lotStatusTone(lot.status)}>{lot.status}</StatusChip>}
                />
              ))}
            </OperationalQueue>
          )}
        </CollapsibleSection>
      </OperationalCockpitSection>

      <OperationalCockpitSection id='auction-checks'>
        <CollapsibleSection title={copy.checksTitle} summary={copy.checksSummary} defaultOpen={Boolean(lotId)}>
          {stage === 'import' ? <InlineNotice tone='warning' title={copy.labels.notConfirmed}>{copy.importBoundary}</InlineNotice> : null}
          {stage === 'bids' ? <InlineNotice tone='information' title={copy.stageNames.bids}>{copy.bidJournalBoundary}</InlineNotice> : null}
          {stage === 'deal-basis' ? <InlineNotice tone={dealCreated ? 'success' : 'warning'} title={copy.stageNames['deal-basis']}>{copy.dealBoundary}</InlineNotice> : null}
          {workspace ? (
            <OperationalQueue>
              {(workspace.readiness.blockers.length ? workspace.readiness.blockers : [copy.noBlockers]).map((blocker, index) => (
                <OperationalQueueLink
                  key={`blocker-${index}`}
                  href={routeFor(stage, lotId)}
                  title={workspace.readiness.blockers.length ? copy.serverBlocker : copy.noBlockers}
                  detail={workspace.readiness.blockers.length ? translateBlocker(blocker, locale) : copy.labels.accessConfirmed}
                  status={<StatusChip tone={workspace.readiness.blockers.length ? 'critical' : 'success'}>{workspace.readiness.blockers.length ? copy.stageStates.blocked : copy.stageStates.complete}</StatusChip>}
                />
              ))}
              {workspace.executionBridge.nextRequiredMilestones.map((milestone, index) => (
                <OperationalQueueLink
                  key={`milestone-${index}`}
                  href={routeFor(stage, lotId)}
                  title={copy.milestones}
                  detail={translateMilestone(milestone, locale)}
                  status={<StatusChip tone='information'>{copy.stageStates.available}</StatusChip>}
                />
              ))}
            </OperationalQueue>
          ) : (
            <InlineNotice tone={lotId ? 'critical' : 'information'} title={lotId ? copy.status.unavailable : copy.status.choose}>
              {lotId ? copy.priority.unavailableDescription : copy.priority.chooseDescription}
            </InlineNotice>
          )}
        </CollapsibleSection>
      </OperationalCockpitSection>

      <OperationalCockpitSection>
        <InlineNotice tone='warning' title={copy.limitationsTitle}>{copy.limitationsBody}</InlineNotice>
      </OperationalCockpitSection>
    </OperationalDecisionCockpit>
  );
}
