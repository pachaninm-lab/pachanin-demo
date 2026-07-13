import type { OperationalCockpitLabels } from './OperationalDecisionCockpit';
import type {
  PhysicalExecutionPhase,
  PhysicalExecutionPhaseId,
  PhysicalExecutionPhaseState,
} from './PhysicalExecutionCockpit';
import type { AcceptanceFactStatus, AcceptanceStage } from '@/lib/platform-v7/dealAcceptanceEngine';
import type { DealLogisticsStage, DealVehicle } from '@/lib/platform-v7/dealLogisticsEngine';

export type PhysicalExecutionLocale = 'ru' | 'en' | 'zh';

type RouteCopy = {
  eyebrow: string;
  title: string;
  description: string;
  statusReady: string;
  statusBlocked: string;
  priorityReadyTitle: string;
  priorityBlockedTitle: string;
  priorityReadyDescription: string;
  priorityBlockedDescription: string;
  blockerReady: string;
  blockerBlocked: string;
  owner: string;
  impactReady: string;
  impactBlocked: string;
  result: string;
};

type Copy = {
  meta: OperationalCockpitLabels;
  phaseNavLabel: string;
  phases: Record<PhysicalExecutionPhaseId, { label: string; description: string }>;
  phaseStates: Record<PhysicalExecutionPhaseState, string>;
  common: {
    complete: string;
    review: string;
    blocked: string;
    required: string;
    sourceSnapshot: string;
    projectionBoundary: string;
    externalBoundary: string;
    openLogistics: string;
    openAcceptance: string;
    openDocuments: string;
    openDeal: string;
    openLab: string;
    openDisputes: string;
    bankReadiness: string;
    owner: string;
  };
  logistics: RouteCopy & {
    facts: Record<'deal' | 'lot' | 'certificate' | 'seller' | 'buyer' | 'volume', string>;
    routeTitle: string;
    routeDescription: string;
    vehicleTitle: string;
    vehicleDescription: string;
    controlsTitle: string;
    controlsDescription: string;
    carrier: string;
    vehicle: string;
    driver: string;
    contact: string;
    capacity: string;
    admission: string;
    nextTitle: string;
    nextDescription: string;
  };
  acceptance: RouteCopy & {
    facts: Record<'deal' | 'route' | 'lot' | 'certificate' | 'vehicle' | 'elevator', string>;
    weightTitle: string;
    weightDescription: string;
    qualityTitle: string;
    qualityDescription: string;
    evidenceTitle: string;
    evidenceDescription: string;
    arrivalWindow: string;
    arrivalFact: string;
    geo: string;
    gross: string;
    tare: string;
    net: string;
    delta: string;
    contract: string;
    actual: string;
  };
  documents: RouteCopy & {
    facts: Record<'deal' | 'route' | 'lot' | 'certificate' | 'package' | 'bank', string>;
    packageTitle: string;
    packageDescription: string;
    sourceTitle: string;
    sourceDescription: string;
    items: Record<'contract' | 'certificate' | 'weight' | 'quality' | 'acceptance' | 'invoice', string>;
    statuses: Record<'ready' | 'review' | 'required', string>;
  };
  logisticsStages: Record<DealLogisticsStage, string>;
  admissions: Record<DealVehicle['admission'], string>;
  acceptanceStages: Record<AcceptanceStage, string>;
  factStatuses: Record<AcceptanceFactStatus, string>;
};

export function normalizePhysicalExecutionLocale(value: string): PhysicalExecutionLocale {
  if (value.startsWith('en')) return 'en';
  if (value.startsWith('zh')) return 'zh';
  return 'ru';
}

export function formatPhysicalNumber(value: number, locale: PhysicalExecutionLocale): string {
  return new Intl.NumberFormat(locale === 'zh' ? 'zh-CN' : locale === 'en' ? 'en-GB' : 'ru-RU', {
    maximumFractionDigits: 3,
  }).format(value);
}

export function buildPhysicalExecutionPhases(
  locale: PhysicalExecutionLocale,
  current: PhysicalExecutionPhaseId,
  states: Record<PhysicalExecutionPhaseId, PhysicalExecutionPhaseState>,
): PhysicalExecutionPhase[] {
  const copy = PHYSICAL_EXECUTION_COPY[locale];
  const paths: Record<PhysicalExecutionPhaseId, string> = {
    logistics: '/platform-v7/deal-logistics',
    acceptance: '/platform-v7/deal-acceptance',
    documents: '/platform-v7/deal-documents-basis',
    bank: '/platform-v7/bank/release-safety',
  };

  return (Object.keys(paths) as PhysicalExecutionPhaseId[]).map((id) => {
    const state = id === current && states[id] !== 'blocked' ? 'current' : states[id];
    return {
      id,
      href: state === 'blocked' ? paths[current] : paths[id],
      label: copy.phases[id].label,
      description: copy.phases[id].description,
      state,
      stateLabel: copy.phaseStates[state],
    };
  });
}

const commonRu = {
  complete: 'готово', review: 'проверка', blocked: 'заблокировано', required: 'требуется', sourceSnapshot: 'локальный снимок исполнения',
  projectionBoundary: 'Экран показывает локальную проекцию исполнения и не доказывает PostgreSQL-authority или подтверждённую эксплуатацию.',
  externalBoundary: 'Внешний статус должен прийти из проверенного интеграционного события; интерфейс не подписывает документы и не двигает деньги.',
  openLogistics: 'Открыть логистику', openAcceptance: 'Открыть приёмку', openDocuments: 'Открыть документное основание', openDeal: 'Открыть Сделку', openLab: 'Открыть лабораторию', openDisputes: 'Открыть споры', bankReadiness: 'Проверка выплаты', owner: 'ответственный',
};

const commonEn = {
  complete: 'complete', review: 'review', blocked: 'blocked', required: 'required', sourceSnapshot: 'local execution snapshot',
  projectionBoundary: 'This screen is a local execution projection and does not prove PostgreSQL authority or confirmed production operation.',
  externalBoundary: 'An external status must arrive through a verified integration event; the interface cannot sign documents or move money.',
  openLogistics: 'Open logistics', openAcceptance: 'Open acceptance', openDocuments: 'Open document basis', openDeal: 'Open Deal', openLab: 'Open laboratory', openDisputes: 'Open disputes', bankReadiness: 'Payout readiness', owner: 'owner',
};

const commonZh = {
  complete: '已完成', review: '待审核', blocked: '已阻止', required: '必需', sourceSnapshot: '本地执行快照',
  projectionBoundary: '本页面是本地执行投影，不能证明 PostgreSQL 权威状态或已验证的生产运行。',
  externalBoundary: '外部状态必须来自经过验证的集成事件；界面不能签署文件或移动资金。',
  openLogistics: '打开物流', openAcceptance: '打开验收', openDocuments: '打开文件依据', openDeal: '打开交易', openLab: '打开实验室', openDisputes: '打开争议', bankReadiness: '付款就绪检查', owner: '负责人',
};

export const PHYSICAL_EXECUTION_COPY: Record<PhysicalExecutionLocale, Copy> = {
  ru: {
    meta: { blocker: 'Блокер', owner: 'Ответственный', impact: 'Влияние', result: 'Результат', nextAction: 'Следующее действие', prioritySection: 'Главная задача исполнения', factsSection: 'Ключевые факты исполнения' },
    phaseNavLabel: 'Этапы физического исполнения Сделки',
    phases: {
      logistics: { label: 'Логистика', description: 'Маршрут, перевозчик, машина и водитель.' },
      acceptance: { label: 'Приёмка', description: 'Прибытие, вес, качество и доказательства.' },
      documents: { label: 'Документы', description: 'Пакет основания после приёмки.' },
      bank: { label: 'Банк', description: 'Проверка основания, callback и reconciliation.' },
    },
    phaseStates: { complete: 'готово', current: 'текущий этап', available: 'доступно', blocked: 'заблокировано' },
    common: commonRu,
    logistics: {
      eyebrow: 'Основание Сделки → логистика', title: 'Рейс создаётся только из проверяемого основания', description: 'Лот, СДИЗ, стороны, объём и базис остаются связаны с маршрутом, перевозчиком, водителем, приёмкой и документами.',
      statusReady: 'перевозчик допущен', statusBlocked: 'допуск перевозчика не закрыт', priorityReadyTitle: 'Передать рейс водителю и приёмке', priorityBlockedTitle: 'Закрыть допуск перевозчика',
      priorityReadyDescription: 'Машина и водитель допущены. Следующий этап фиксирует физическое прибытие и доказательства.', priorityBlockedDescription: 'Переход к приёмке закрыт, пока перевозчик, машина и водитель не прошли серверную проверку.',
      blockerReady: 'нет', blockerBlocked: 'допуск перевозчика', owner: 'логистика + комплаенс', impactReady: 'рейс можно передать на исполнение', impactBlocked: 'приёмка и банковский путь недоступны', result: 'назначенный рейс с привязанными лотом и СДИЗ',
      facts: { deal: 'Сделка', lot: 'ФГИС-лот', certificate: 'СДИЗ', seller: 'Продавец', buyer: 'Покупатель', volume: 'Объём' },
      routeTitle: 'Маршрут', routeDescription: 'Точки, временные окна и ответственные.', vehicleTitle: 'Машина и водитель', vehicleDescription: 'Назначение не означает допуск.', controlsTitle: 'Контроль', controlsDescription: 'Условия до передачи рейса дальше.',
      carrier: 'Перевозчик', vehicle: 'Машина', driver: 'Водитель', contact: 'Контакт', capacity: 'Грузоподъёмность', admission: 'Допуск', nextTitle: 'Следующие этапы', nextDescription: 'Недоступные этапы не открываются обходным переходом.',
    },
    acceptance: {
      eyebrow: 'Рейс → приёмка', title: 'Приёмка превращает физический факт в доказательства', description: 'Время, место, машина, СДИЗ, вес, качество, источник и отклонения остаются привязаны к одной Сделке.',
      statusReady: 'приёмка закрыта', statusBlocked: 'приёмка требует решения', priorityReadyTitle: 'Сформировать документное основание', priorityBlockedTitle: 'Закрыть отклонения качества и подписать приёмку',
      priorityReadyDescription: 'Вес, качество и доказательства подтверждены. Пакет можно передать в документы.', priorityBlockedDescription: 'Документное и банковское основание закрыты, пока есть проверка качества или отсутствует подписанная приёмка.',
      blockerReady: 'нет', blockerBlocked: 'качество или акт приёмки', owner: 'элеватор + лаборатория + оператор', impactReady: 'документы могут использовать подтверждённые факты', impactBlocked: 'документы и деньги остаются остановлены', result: 'подписанная приёмка с весом, качеством и доказательствами',
      facts: { deal: 'Сделка', route: 'Рейс', lot: 'ФГИС-лот', certificate: 'СДИЗ', vehicle: 'Машина', elevator: 'Элеватор' },
      weightTitle: 'Прибытие и вес', weightDescription: 'Источник, время и расчёт нетто.', qualityTitle: 'Качество', qualityDescription: 'Договорные и фактические значения.', evidenceTitle: 'Доказательства', evidenceDescription: 'Каждый факт имеет источник и время.',
      arrivalWindow: 'Окно прибытия', arrivalFact: 'Факт прибытия', geo: 'Геоточка', gross: 'Брутто', tare: 'Тара', net: 'Нетто', delta: 'Отклонение', contract: 'договор', actual: 'факт',
    },
    documents: {
      eyebrow: 'Приёмка → документы', title: 'Документное основание собирается из фактов Сделки', description: 'Пакет не существует отдельно от приёмки, качества, СДИЗ и журнала. Неполный пакет не передаётся в банковский контур.',
      statusReady: 'пакет готов', statusBlocked: 'пакет неполный', priorityReadyTitle: 'Передать пакет на банковскую проверку', priorityBlockedTitle: 'Закрыть недостающие документы',
      priorityReadyDescription: 'Все обязательные элементы подтверждены и привязаны к Сделке.', priorityBlockedDescription: 'Проверка выплаты закрыта до подписанного акта приёмки, протокола качества и расчётных документов.',
      blockerReady: 'нет', blockerBlocked: 'неполный документный пакет', owner: 'оператор + стороны + лаборатория + элеватор', impactReady: 'банк может проверить основание', impactBlocked: 'запрос выплаты недоступен', result: 'версионированный пакет документов в канонической Сделке',
      facts: { deal: 'Сделка', route: 'Рейс', lot: 'ФГИС-лот', certificate: 'СДИЗ', package: 'Готовность пакета', bank: 'Банковский шаг' },
      packageTitle: 'Пакет основания', packageDescription: 'Каждый элемент должен иметь источник, версию и статус.', sourceTitle: 'Граница источника', sourceDescription: 'Локальная проекция не заменяет серверный реестр документов.',
      items: { contract: 'Договор поставки', certificate: 'СДИЗ', weight: 'Акт веса', quality: 'Протокол качества', acceptance: 'Акт приёмки', invoice: 'УПД или счёт' }, statuses: { ready: 'готово', review: 'проверка', required: 'требуется' },
    },
    logisticsStages: { deal_basis: 'основание Сделки', route_planning: 'планирование рейса', carrier_admission: 'проверка перевозчика', vehicle_assigned: 'машина назначена', loading_window: 'окно погрузки', in_transit: 'в пути', arrival: 'прибытие', acceptance: 'приёмка', documents_ready: 'документы готовы' },
    admissions: { ok: 'допущен', review: 'проверка', blocked: 'не допущен' },
    acceptanceStages: { arrival_expected: 'ожидается прибытие', arrival_fixed: 'прибытие зафиксировано', gross_weight_fixed: 'брутто зафиксировано', sampling_started: 'отбор пробы', quality_checked: 'качество проверено', net_weight_fixed: 'нетто зафиксировано', acceptance_signed: 'приёмка подписана', documents_basis_ready: 'основание документов готово' },
    factStatuses: { ok: 'готово', review: 'проверка', dispute: 'спор' },
  },
  en: {
    meta: { blocker: 'Blocker', owner: 'Owner', impact: 'Impact', result: 'Result', nextAction: 'Next action', prioritySection: 'Primary execution task', factsSection: 'Key execution facts' },
    phaseNavLabel: 'Physical Deal execution stages',
    phases: { logistics: { label: 'Logistics', description: 'Route, carrier, vehicle and driver.' }, acceptance: { label: 'Acceptance', description: 'Arrival, weight, quality and evidence.' }, documents: { label: 'Documents', description: 'Basis package after acceptance.' }, bank: { label: 'Bank', description: 'Basis review, callback and reconciliation.' } },
    phaseStates: { complete: 'complete', current: 'current stage', available: 'available', blocked: 'blocked' },
    common: commonEn,
    logistics: {
      eyebrow: 'Deal basis → logistics', title: 'A trip starts only from a verifiable basis', description: 'Lot, certificate, parties, volume and terms remain linked to the route, carrier, driver, acceptance and documents.',
      statusReady: 'carrier admitted', statusBlocked: 'carrier admission incomplete', priorityReadyTitle: 'Hand the trip to the driver and acceptance', priorityBlockedTitle: 'Complete carrier admission', priorityReadyDescription: 'Vehicle and driver are admitted. The next stage records physical arrival and evidence.', priorityBlockedDescription: 'Acceptance remains blocked until carrier, vehicle and driver pass server verification.', blockerReady: 'none', blockerBlocked: 'carrier admission', owner: 'logistics + compliance', impactReady: 'trip may enter execution', impactBlocked: 'acceptance and bank path unavailable', result: 'assigned trip linked to lot and certificate',
      facts: { deal: 'Deal', lot: 'Registry lot', certificate: 'Certificate', seller: 'Seller', buyer: 'Buyer', volume: 'Volume' }, routeTitle: 'Route', routeDescription: 'Points, time windows and owners.', vehicleTitle: 'Vehicle and driver', vehicleDescription: 'Assignment does not equal admission.', controlsTitle: 'Controls', controlsDescription: 'Conditions before the trip moves forward.', carrier: 'Carrier', vehicle: 'Vehicle', driver: 'Driver', contact: 'Contact', capacity: 'Capacity', admission: 'Admission', nextTitle: 'Next stages', nextDescription: 'Blocked stages cannot be opened through a bypass link.',
    },
    acceptance: {
      eyebrow: 'Trip → acceptance', title: 'Acceptance turns physical facts into evidence', description: 'Time, place, vehicle, certificate, weight, quality, source and deviations stay linked to one Deal.',
      statusReady: 'acceptance complete', statusBlocked: 'acceptance requires a decision', priorityReadyTitle: 'Build the document basis', priorityBlockedTitle: 'Resolve quality deviations and sign acceptance', priorityReadyDescription: 'Weight, quality and evidence are confirmed. The package may move to documents.', priorityBlockedDescription: 'Document and bank bases remain blocked while quality is under review or acceptance is unsigned.', blockerReady: 'none', blockerBlocked: 'quality or acceptance act', owner: 'elevator + laboratory + operator', impactReady: 'documents may use confirmed facts', impactBlocked: 'documents and money remain stopped', result: 'signed acceptance with weight, quality and evidence',
      facts: { deal: 'Deal', route: 'Trip', lot: 'Registry lot', certificate: 'Certificate', vehicle: 'Vehicle', elevator: 'Elevator' }, weightTitle: 'Arrival and weight', weightDescription: 'Source, time and net calculation.', qualityTitle: 'Quality', qualityDescription: 'Contract and actual values.', evidenceTitle: 'Evidence', evidenceDescription: 'Every fact has a source and timestamp.', arrivalWindow: 'Arrival window', arrivalFact: 'Actual arrival', geo: 'Geopoint', gross: 'Gross', tare: 'Tare', net: 'Net', delta: 'Deviation', contract: 'contract', actual: 'actual',
    },
    documents: {
      eyebrow: 'Acceptance → documents', title: 'The document basis is assembled from Deal facts', description: 'The package is not separate from acceptance, quality, certificate and journal. An incomplete package cannot enter the bank contour.',
      statusReady: 'package ready', statusBlocked: 'package incomplete', priorityReadyTitle: 'Send the package to bank review', priorityBlockedTitle: 'Complete missing documents', priorityReadyDescription: 'All mandatory elements are confirmed and linked to the Deal.', priorityBlockedDescription: 'Payout review remains blocked until acceptance, quality protocol and settlement documents are complete.', blockerReady: 'none', blockerBlocked: 'incomplete document package', owner: 'operator + parties + laboratory + elevator', impactReady: 'bank may review the basis', impactBlocked: 'payout request unavailable', result: 'versioned document package inside the canonical Deal',
      facts: { deal: 'Deal', route: 'Trip', lot: 'Registry lot', certificate: 'Certificate', package: 'Package readiness', bank: 'Bank step' }, packageTitle: 'Basis package', packageDescription: 'Every item requires source, version and status.', sourceTitle: 'Source boundary', sourceDescription: 'A local projection does not replace the server document registry.', items: { contract: 'Supply contract', certificate: 'Certificate', weight: 'Weight act', quality: 'Quality protocol', acceptance: 'Acceptance act', invoice: 'Invoice or universal transfer document' }, statuses: { ready: 'ready', review: 'review', required: 'required' },
    },
    logisticsStages: { deal_basis: 'Deal basis', route_planning: 'trip planning', carrier_admission: 'carrier review', vehicle_assigned: 'vehicle assigned', loading_window: 'loading window', in_transit: 'in transit', arrival: 'arrival', acceptance: 'acceptance', documents_ready: 'documents ready' }, admissions: { ok: 'admitted', review: 'review', blocked: 'not admitted' }, acceptanceStages: { arrival_expected: 'arrival expected', arrival_fixed: 'arrival recorded', gross_weight_fixed: 'gross recorded', sampling_started: 'sampling', quality_checked: 'quality checked', net_weight_fixed: 'net recorded', acceptance_signed: 'acceptance signed', documents_basis_ready: 'document basis ready' }, factStatuses: { ok: 'ready', review: 'review', dispute: 'dispute' },
  },
  zh: {
    meta: { blocker: '阻塞项', owner: '负责人', impact: '影响', result: '结果', nextAction: '下一步', prioritySection: '主要执行任务', factsSection: '执行关键事实' }, phaseNavLabel: '交易实物执行阶段',
    phases: { logistics: { label: '物流', description: '路线、承运商、车辆和司机。' }, acceptance: { label: '验收', description: '到达、重量、质量和证据。' }, documents: { label: '文件', description: '验收后的依据包。' }, bank: { label: '银行', description: '依据审核、回调和对账。' } }, phaseStates: { complete: '已完成', current: '当前阶段', available: '可用', blocked: '已阻止' }, common: commonZh,
    logistics: {
      eyebrow: '交易依据 → 物流', title: '运输任务只能从可验证依据创建', description: '批次、凭证、交易方、数量和条款始终与路线、承运商、司机、验收和文件关联。', statusReady: '承运商已准入', statusBlocked: '承运商准入未完成', priorityReadyTitle: '将运输任务交给司机和验收方', priorityBlockedTitle: '完成承运商准入', priorityReadyDescription: '车辆和司机已准入。下一阶段记录实际到达和证据。', priorityBlockedDescription: '承运商、车辆和司机通过服务器验证前，验收保持阻止。', blockerReady: '无', blockerBlocked: '承运商准入', owner: '物流 + 合规', impactReady: '运输任务可以进入执行', impactBlocked: '验收和银行路径不可用', result: '与批次和凭证关联的已分配运输任务', facts: { deal: '交易', lot: '登记批次', certificate: '凭证', seller: '卖方', buyer: '买方', volume: '数量' }, routeTitle: '路线', routeDescription: '地点、时间窗口和负责人。', vehicleTitle: '车辆和司机', vehicleDescription: '分配不等于准入。', controlsTitle: '控制条件', controlsDescription: '运输任务继续前的条件。', carrier: '承运商', vehicle: '车辆', driver: '司机', contact: '联系方式', capacity: '载重', admission: '准入', nextTitle: '后续阶段', nextDescription: '被阻止的阶段不能通过绕过链接打开。',
    },
    acceptance: {
      eyebrow: '运输任务 → 验收', title: '验收把实物事实转化为证据', description: '时间、地点、车辆、凭证、重量、质量、来源和偏差始终关联到同一交易。', statusReady: '验收已完成', statusBlocked: '验收需要处理', priorityReadyTitle: '形成文件依据', priorityBlockedTitle: '解决质量偏差并签署验收', priorityReadyDescription: '重量、质量和证据已确认，可以进入文件阶段。', priorityBlockedDescription: '质量仍在审核或验收未签署时，文件和银行依据保持阻止。', blockerReady: '无', blockerBlocked: '质量或验收单', owner: '粮库 + 实验室 + 运营人员', impactReady: '文件可以使用已确认事实', impactBlocked: '文件和资金保持停止', result: '包含重量、质量和证据的已签署验收', facts: { deal: '交易', route: '运输任务', lot: '登记批次', certificate: '凭证', vehicle: '车辆', elevator: '粮库' }, weightTitle: '到达和重量', weightDescription: '来源、时间和净重计算。', qualityTitle: '质量', qualityDescription: '合同值和实际值。', evidenceTitle: '证据', evidenceDescription: '每个事实都有来源和时间。', arrivalWindow: '到达窗口', arrivalFact: '实际到达', geo: '地理位置', gross: '毛重', tare: '皮重', net: '净重', delta: '偏差', contract: '合同', actual: '实际',
    },
    documents: {
      eyebrow: '验收 → 文件', title: '文件依据由交易事实组成', description: '文件包不能脱离验收、质量、凭证和日志。文件包不完整时不能进入银行链路。', statusReady: '文件包已准备', statusBlocked: '文件包不完整', priorityReadyTitle: '将文件包提交银行审核', priorityBlockedTitle: '补齐缺失文件', priorityReadyDescription: '所有强制要素已确认并关联到交易。', priorityBlockedDescription: '验收单、质量报告和结算文件完成前，付款审核保持阻止。', blockerReady: '无', blockerBlocked: '文件包不完整', owner: '运营人员 + 交易方 + 实验室 + 粮库', impactReady: '银行可以审核依据', impactBlocked: '付款请求不可用', result: '规范交易中的版本化文件包', facts: { deal: '交易', route: '运输任务', lot: '登记批次', certificate: '凭证', package: '文件包就绪度', bank: '银行步骤' }, packageTitle: '依据包', packageDescription: '每个要素都需要来源、版本和状态。', sourceTitle: '来源边界', sourceDescription: '本地投影不能替代服务器文件登记册。', items: { contract: '供应合同', certificate: '凭证', weight: '重量单', quality: '质量报告', acceptance: '验收单', invoice: '发票或通用转让文件' }, statuses: { ready: '已准备', review: '待审核', required: '必需' },
    },
    logisticsStages: { deal_basis: '交易依据', route_planning: '运输规划', carrier_admission: '承运商审核', vehicle_assigned: '车辆已分配', loading_window: '装货窗口', in_transit: '运输中', arrival: '到达', acceptance: '验收', documents_ready: '文件已准备' }, admissions: { ok: '已准入', review: '待审核', blocked: '未准入' }, acceptanceStages: { arrival_expected: '等待到达', arrival_fixed: '到达已记录', gross_weight_fixed: '毛重已记录', sampling_started: '取样', quality_checked: '质量已检查', net_weight_fixed: '净重已记录', acceptance_signed: '验收已签署', documents_basis_ready: '文件依据已准备' }, factStatuses: { ok: '已准备', review: '待审核', dispute: '争议' },
  },
};
