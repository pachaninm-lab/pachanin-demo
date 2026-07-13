import type { AuctionPhase, AuctionPhaseId, AuctionPhaseState } from './AuctionExecutionCockpit';
import type { OperationalCockpitLabels } from './OperationalDecisionCockpit';
import type {
  AuctionAdmissionStatus,
  AuctionBuyerGate,
  AuctionGateCheck,
  FgisImportStatus,
} from '@/lib/platform-v7/fgisAuctionEngine';
import type { AuctionDealBasisGuard, AuctionStage } from '@/lib/platform-v7/auctionDealBridge';

export type AuctionLocale = 'ru' | 'en' | 'zh';

type PhaseCopy = Record<AuctionPhaseId, { label: string; description: string }>;

type AuctionCopy = {
  meta: OperationalCockpitLabels;
  phaseNavLabel: string;
  phases: PhaseCopy;
  phaseStates: Record<AuctionPhaseState, string>;
  common: {
    boundary: string;
    externalBoundary: string;
    openAuction: string;
    openImport: string;
    openAdmission: string;
    openBids: string;
    openBasis: string;
    openLogistics: string;
    back: string;
    details: string;
    sourceSnapshot: string;
    notConfirmed: string;
    complete: string;
    review: string;
    blocked: string;
    required: string;
    available: string;
    owner: string;
  };
  root: {
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
    facts: { lot: string; certificate: string; import: string; admission: string; volume: string; basis: string };
    rulesTitle: string;
    rulesDescription: string;
    controlsTitle: string;
    controlsDescription: string;
  };
  importPage: {
    eyebrow: string;
    title: string;
    description: string;
    status: string;
    priorityTitle: string;
    priorityDescription: string;
    blocker: string;
    owner: string;
    impact: string;
    result: string;
    facts: { status: string; lot: string; certificate: string; owner: string; batch: string; volume: string };
    qualityTitle: string;
    qualityDescription: string;
    documentsTitle: string;
    documentsDescription: string;
  };
  admissionPage: {
    eyebrow: string;
    titleReady: string;
    titleReview: string;
    description: string;
    statusReady: string;
    statusReview: string;
    priorityReadyTitle: string;
    priorityReviewTitle: string;
    priorityReadyDescription: string;
    priorityReviewDescription: string;
    blockerReady: string;
    blockerReview: string;
    owner: string;
    impactReady: string;
    impactReview: string;
    result: string;
    facts: { checks: string; passed: string; review: string; buyers: string; admittedBuyers: string; limit: string };
    checksTitle: string;
    checksDescription: string;
    buyersTitle: string;
    buyersDescription: string;
  };
  bidsPage: {
    eyebrow: string;
    title: string;
    descriptionReady: string;
    descriptionBlocked: string;
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
    facts: { leader: string; bid: string; lot: string; volume: string; bids: string; journal: string };
    journalTitle: string;
    journalDescription: string;
    rulesTitle: string;
    rulesDescription: string;
    winner: string;
    historical: string;
  };
  basisPage: {
    eyebrow: string;
    title: string;
    noBasisTitle: string;
    descriptionReady: string;
    descriptionBlocked: string;
    noBasisDescription: string;
    statusReady: string;
    statusBlocked: string;
    statusMissing: string;
    priorityReadyTitle: string;
    priorityBlockedTitle: string;
    priorityMissingTitle: string;
    priorityReadyDescription: string;
    priorityBlockedDescription: string;
    priorityMissingDescription: string;
    blockerReady: string;
    blockerBlocked: string;
    blockerMissing: string;
    owner: string;
    impactReady: string;
    impactBlocked: string;
    resultReady: string;
    resultBlocked: string;
    facts: { winner: string; price: string; lot: string; certificate: string; seller: string; buyer: string; volume: string; amount: string; terms: string; storage: string };
    journalTitle: string;
    journalDescription: string;
    readinessTitle: string;
    readinessDescription: string;
    guardsTitle: string;
    guardsDescription: string;
    nextTitle: string;
    nextDescription: string;
    moneyTitle: string;
    moneyDescription: string;
  };
  importStatuses: Record<FgisImportStatus, string>;
  admissionStatuses: Record<AuctionAdmissionStatus, string>;
  checkStatuses: Record<AuctionGateCheck['status'], string>;
  buyerStatuses: Record<AuctionBuyerGate['admission'], string>;
  documentStatuses: Record<'ok' | 'required' | 'review', string>;
  stageStatuses: Record<AuctionStage, string>;
  qualityLabels: Record<string, string>;
  documentLabels: Record<string, string>;
  checkLabels: Record<string, string>;
  ruleLabels: Record<string, string>;
  guardLabels: Record<string, string>;
  owners: Record<string, string>;
  controls: string[];
  risks: string[];
  journalLocks: string[];
  readinessReasons: string[];
  nextActions: Record<string, { label: string; result: string }>;
};

export function normalizeAuctionLocale(value: string): AuctionLocale {
  if (value.startsWith('en')) return 'en';
  if (value.startsWith('zh')) return 'zh';
  return 'ru';
}

export function formatAuctionMoney(valueRub: number, locale: AuctionLocale): string {
  return new Intl.NumberFormat(locale === 'zh' ? 'zh-CN' : locale === 'en' ? 'en-GB' : 'ru-RU', {
    style: 'currency',
    currency: 'RUB',
    maximumFractionDigits: 0,
  }).format(valueRub);
}

export function formatAuctionNumber(value: number, locale: AuctionLocale): string {
  return new Intl.NumberFormat(locale === 'zh' ? 'zh-CN' : locale === 'en' ? 'en-GB' : 'ru-RU').format(value);
}

export function buildAuctionPhases(
  locale: AuctionLocale,
  current: AuctionPhaseId,
  states: Record<AuctionPhaseId, AuctionPhaseState>,
): AuctionPhase[] {
  const copy = AUCTION_COPY[locale];
  const paths: Record<AuctionPhaseId, string> = {
    import: '/platform-v7/auction/import',
    admission: '/platform-v7/auction/admission',
    bids: '/platform-v7/auction/bids',
    'deal-basis': '/platform-v7/auction/deal-basis',
  };
  return (Object.keys(paths) as AuctionPhaseId[]).map((id) => {
    const state = id === current && states[id] !== 'blocked' ? 'current' : states[id];
    return {
      id,
      href: paths[id],
      label: copy.phases[id].label,
      description: copy.phases[id].description,
      state,
      stateLabel: copy.phaseStates[state],
    };
  });
}

export function translateOwner(owner: string, locale: AuctionLocale): string {
  return AUCTION_COPY[locale].owners[owner] ?? owner;
}

export function translateCheck(check: AuctionGateCheck, locale: AuctionLocale): string {
  return AUCTION_COPY[locale].checkLabels[check.key] ?? check.label;
}

export function translateRule(key: string, fallback: string, locale: AuctionLocale): string {
  return AUCTION_COPY[locale].ruleLabels[key] ?? fallback;
}

export function translateGuard(guard: AuctionDealBasisGuard, locale: AuctionLocale): string {
  return AUCTION_COPY[locale].guardLabels[guard.key] ?? guard.label;
}

export const AUCTION_COPY: Record<AuctionLocale, AuctionCopy> = {
  ru: {
    meta: { blocker: 'Блокер', owner: 'Ответственный', impact: 'Влияние', result: 'Результат', nextAction: 'Следующее действие', prioritySection: 'Главная задача аукциона', factsSection: 'Ключевые факты аукциона' },
    phaseNavLabel: 'Этапы аукциона',
    phases: {
      import: { label: 'Импорт ФГИС', description: 'Партия, СДИЗ, владелец, масса и документы.' },
      admission: { label: 'Допуск', description: 'Проверки партии и покупателей до цены.' },
      bids: { label: 'Ставки', description: 'Неизменяемый журнал допущенных ставок.' },
      'deal-basis': { label: 'Основание Сделки', description: 'Победитель, цена, объём и следующий этап.' },
    },
    phaseStates: { complete: 'готово', current: 'текущий этап', available: 'доступно', blocked: 'заблокировано' },
    common: { boundary: 'Аукцион создаёт цену и основание Сделки, но не платёж.', externalBoundary: 'Показанный снимок не подтверждает live-подключение ФГИС. Внешний статус должен прийти из проверенного интеграционного события.', openAuction: 'Обзор аукциона', openImport: 'Открыть импорт', openAdmission: 'Открыть допуск', openBids: 'Открыть ставки', openBasis: 'Открыть основание', openLogistics: 'Перейти к логистике', back: 'Назад', details: 'Детали', sourceSnapshot: 'Снимок источника', notConfirmed: 'внешне не подтверждено', complete: 'готово', review: 'проверка', blocked: 'блокировка', required: 'требуется', available: 'доступно', owner: 'ответственный' },
    root: {
      eyebrow: 'ФГИС-аукцион → Сделка', title: 'Цена появляется только после допуска', description: 'Канонический путь связывает ФГИС-партию, СДИЗ, владельца, покупателей, ставки и победителя с одной Сделкой. Контакт и деньги не отделяются от исполнения.', statusReady: 'готов к следующему этапу', statusBlocked: 'нужно закрыть допуск', priorityReadyTitle: 'Перейти к основанию Сделки', priorityBlockedTitle: 'Закрыть проверки качества и покупателя', priorityReadyDescription: 'Лот допущен, журнал ставок закрыт, победитель зафиксирован. Следующий шаг создаёт проверяемое основание для логистики.', priorityBlockedDescription: 'Текущий снимок содержит исторические ставки, но допуск ещё требует проверки. Новые торги и переход в логистику должны оставаться закрытыми.', blockerReady: 'нет', blockerBlocked: 'качество и полномочия покупателя', owner: 'комплаенс + лаборатория + оператор', impactReady: 'победитель может сформировать основание Сделки', impactBlocked: 'цена не должна создавать новый этап исполнения', result: 'допущенный лот → неизменяемые ставки → основание Сделки', facts: { lot: 'ФГИС-лот', certificate: 'СДИЗ', import: 'Импорт', admission: 'Допуск', volume: 'Доступный объём', basis: 'Основание' }, rulesTitle: 'Правила торгов', rulesDescription: 'Правила применяются до и после ставки без ручного обхода.', controlsTitle: 'Контроль риска', controlsDescription: 'Риски обхода, разрыва логистики и доказательности остаются внутри Сделки.'
    },
    importPage: {
      eyebrow: 'ФГИС → импорт', title: 'Сначала подтвердить источник партии', description: 'Импорт связывает партию, СДИЗ, владельца, доступную массу, качество и документы. Локальная отметка не заменяет подтверждение ФГИС.', status: 'снимок требует внешнего подтверждения', priorityTitle: 'Проверить снимок партии и источник', priorityDescription: 'До допуска нужно подтвердить владельца, СДИЗ, доступную массу, качество и документы. После проверки пакет передаётся комплаенсу.', blocker: 'live ФГИС не подтверждён', owner: 'оператор + комплаенс', impact: 'торги не должны открываться по неподтверждённой партии', result: 'неизменяемый снимок партии с источником и временем', facts: { status: 'Статус импорта', lot: 'Лот ФГИС', certificate: 'СДИЗ', owner: 'Владелец', batch: 'Партия', volume: 'Доступно' }, qualityTitle: 'Показатели качества', qualityDescription: 'Значения требуют подтверждения лабораторного источника.', documentsTitle: 'Документы партии', documentsDescription: 'Каждый статус должен иметь внешний источник или ответственного за ручную проверку.'
    },
    admissionPage: {
      eyebrow: 'Импорт → допуск', titleReady: 'Лот допущен к торгам', titleReview: 'Допуск требует решения', description: 'Цена не появляется раньше проверки партии, документов, качества и полномочий покупателей.', statusReady: 'торги можно открыть', statusReview: 'торги заблокированы', priorityReadyTitle: 'Открыть окно ставок', priorityReviewTitle: 'Закрыть проверки до торгов', priorityReadyDescription: 'Все блокирующие проверки закрыты. Ставки доступны только допущенным покупателям.', priorityReviewDescription: 'Пока есть статус review или block, новые ставки не принимаются. Исторический журнал остаётся только для чтения.', blockerReady: 'нет', blockerReview: 'не закрыты проверки допуска', owner: 'комплаенс + лаборатория', impactReady: 'допущенные покупатели могут ставить', impactReview: 'новые ставки и выбор победителя запрещены', result: 'объяснимое решение по партии и каждому покупателю', facts: { checks: 'Проверок партии', passed: 'Пройдено', review: 'Требует решения', buyers: 'Покупателей', admittedBuyers: 'Допущено', limit: 'Совокупный лимит' }, checksTitle: 'Партия и документы', checksDescription: 'Каждая проверка имеет владельца и статус.', buyersTitle: 'Допуск покупателей', buyersDescription: 'Ставку может сделать только покупатель со статусом ok.'
    },
    bidsPage: {
      eyebrow: 'Допуск → ставки', title: 'Журнал ставок по ФГИС-лоту', descriptionReady: 'Ставки принимаются только от допущенных покупателей, в пределах доступной массы и с неизменяемой записью в журнале.', descriptionBlocked: 'Допуск не закрыт. Исторические записи видны только для проверки; новые ставки и переход к победителю заблокированы.', statusReady: 'окно ставок доступно', statusBlocked: 'ставки только для чтения', priorityReadyTitle: 'Проверить победителя и закрыть журнал', priorityBlockedTitle: 'Вернуться к допуску', priorityReadyDescription: 'Сверьте цену, объём, время и допуск покупателя перед фиксацией победителя.', priorityBlockedDescription: 'Закройте проверки качества и полномочий покупателя. Нельзя использовать исторический журнал как разрешение на новые торги.', blockerReady: 'нет', blockerBlocked: 'допуск не подтверждён', owner: 'оператор + комплаенс', impactReady: 'победитель создаст основание Сделки', impactBlocked: 'победитель не может запускать следующий этап', result: 'неизменяемый журнал + зафиксированный победитель', facts: { leader: 'Лидер', bid: 'Ставка', lot: 'Лот', volume: 'Доступно', bids: 'Ставок', journal: 'Режим журнала' }, journalTitle: 'Журнал ставок', journalDescription: 'Записи не удаляются и не исправляются задним числом.', rulesTitle: 'Правила', rulesDescription: 'Одинаково применяются ко всем покупателям.', winner: 'победитель', historical: 'только чтение' 
    },
    basisPage: {
      eyebrow: 'Победитель → основание Сделки', title: 'Проверяемое основание Сделки', noBasisTitle: 'Победитель не зафиксирован', descriptionReady: 'Победившая ставка связана с ФГИС-лотом, СДИЗ, сторонами, объёмом и суммой. Следующий этап — логистика, не автоматический платёж.', descriptionBlocked: 'Основание рассчитано, но текущий допуск не закрыт. Переход в логистику должен оставаться заблокированным.', noBasisDescription: 'Без победившей ставки нельзя создать основание Сделки. Вернитесь к журналу и зафиксируйте результат по правилам.', statusReady: 'основание готово', statusBlocked: 'основание заблокировано', statusMissing: 'основания нет', priorityReadyTitle: 'Создать рейс из основания', priorityBlockedTitle: 'Закрыть допуск перед логистикой', priorityMissingTitle: 'Зафиксировать победителя', priorityReadyDescription: 'Guard основания и допуск пройдены. Логистика получает только зафиксированные поля.', priorityBlockedDescription: 'Историческая ставка и рассчитанная сумма не заменяют текущий допуск партии и покупателя.', priorityMissingDescription: 'Основание появляется только после неизменяемой записи победителя.', blockerReady: 'нет', blockerBlocked: 'допуск не закрыт', blockerMissing: 'нет победителя', owner: 'оператор + комплаенс + логистика', impactReady: 'можно сформировать рейс', impactBlocked: 'логистика и денежный контур не запускаются', resultReady: 'каноническая Сделка с источником цены и журналом', resultBlocked: 'возврат к допуску без потери истории', facts: { winner: 'Победитель', price: 'Цена победителя', lot: 'ФГИС-лот', certificate: 'СДИЗ', seller: 'Продавец', buyer: 'Покупатель', volume: 'Объём', amount: 'Сумма', terms: 'Условия поставки', storage: 'Место хранения' }, journalTitle: 'Что фиксируется в журнале', journalDescription: 'Поля основания остаются связанными с источником и владельцем.', readinessTitle: 'Почему можно формировать рейс', readinessDescription: 'Проверки не дают перескочить через допуск или документы.', guardsTitle: 'Guard основания Сделки', guardsDescription: 'Каждое обязательное поле проверяется отдельно.', nextTitle: 'Следующие маршруты', nextDescription: 'Действия остаются внутри контура исполнения Сделки.', moneyTitle: 'Граница денег', moneyDescription: 'Экран не подтверждает live banking и не выпускает деньги. Банк получает только проверяемое основание после событий исполнения.'
    },
    importStatuses: { not_connected: 'ожидает подключения', requested: 'запрос отправлен', matched: 'лот сверен', requires_review: 'требует проверки', rejected: 'отклонён' },
    admissionStatuses: { blocked: 'заблокирован', review_required: 'требует проверки', admitted: 'допущен' },
    checkStatuses: { ok: 'готово', review: 'проверка', block: 'заблокировано' },
    buyerStatuses: { ok: 'допущен', review: 'проверка', blocked: 'заблокирован' },
    documentStatuses: { ok: 'есть', review: 'проверка', required: 'требуется' },
    stageStatuses: { lot_draft: 'черновик', lot_admitted: 'лот допущен', bidding_window: 'окно ставок', winner_locked: 'победитель зафиксирован', deal_basis_ready: 'основание рассчитано', deal_created: 'Сделка создана' },
    qualityLabels: { 'Влажность': 'Влажность', 'Клейковина': 'Клейковина', 'Сорная примесь': 'Сорная примесь', 'Зараженность': 'Зараженность' },
    documentLabels: { 'Партия ФГИС': 'Партия ФГИС', 'СДИЗ': 'СДИЗ', 'Качество': 'Качество', 'Договор поставки': 'Договор поставки' },
    checkLabels: { 'fgis-match': 'лот ФГИС совпадает с владельцем', 'weight-free': 'масса не заблокирована другой Сделкой', 'sdiz-present': 'СДИЗ привязан к партии', 'quality-review': 'качество подтверждено до торгов', 'bank-basis': 'банк получит основание только после Сделки' },
    ruleLabels: { 'admitted-buyer-only': 'ставку делает только допущенный покупатель', 'volume-lock': 'объём ставки не превышает доступную массу', 'journal-fixed': 'ставка фиксируется и не удаляется задним числом', 'no-direct-contact': 'контакт после цены остаётся внутри платформы', 'winner-to-deal': 'победитель создаёт основание Сделки, а не платёж' },
    guardLabels: { winner: 'победитель зафиксирован', lotNumber: 'номер лота сохранён', sdizNumber: 'СДИЗ сохранён', priceRubPerTon: 'цена победителя положительная', 'deal-logistics': 'маршрут логистики присутствует', 'route-icons': 'следующие маршруты определены', 'winner-price-match': 'цена победителя совпадает', 'volume-within-available': 'объём в пределах доступной массы' },
    owners: { 'Комплаенс': 'Комплаенс', 'Оператор': 'Оператор', 'Лаборатория': 'Лаборатория', 'Банк': 'Банк', 'Покупатель': 'Покупатель', 'Логистика': 'Логистика', 'Арбитр': 'Арбитр', 'UX': 'UX' },
    controls: ['ставка после фиксации не отменяется интерфейсом', 'победитель создаёт основание, но не деньги', 'логистика начинается после связки лот → победитель → Сделка', 'спор открывается из фактов приёмки, качества или документов'],
    risks: ['обход платформы после выявления цены', 'ставка без проверенного допуска', 'разрыв цены и логистики', 'отсутствие доказательств качества и веса'],
    journalLocks: ['победившая ставка и цена', 'ФГИС-лот, СДИЗ и владелец партии', 'покупатель, объём и сумма Сделки', 'основание для рейса и приёмки'],
    readinessReasons: ['победитель зафиксирован в журнале', 'лот ФГИС и СДИЗ сохранены', 'объём не превышает доступную массу', 'следующий этап ведёт в рейс, а не в самостоятельный платёж'],
    nextActions: {
      '/platform-v7/deal-logistics': { label: 'Назначить рейс', result: 'создать рейс из основания Сделки' },
      '/platform-v7/deal-documents-basis': { label: 'Открыть документы', result: 'проверить договор, СДИЗ, вес, качество и УПД' },
      '/platform-v7/disputes': { label: 'Открыть споры', result: 'связать спор со Сделкой и доказательствами' },
      '/platform-v7/auction/bids': { label: 'Вернуться к ставкам', result: 'сверить неизменяемый журнал' },
    },
  },
  en: {
    meta: { blocker: 'Blocker', owner: 'Owner', impact: 'Impact', result: 'Result', nextAction: 'Next action', prioritySection: 'Primary auction task', factsSection: 'Key auction facts' },
    phaseNavLabel: 'Auction stages',
    phases: {
      import: { label: 'Registry import', description: 'Batch, certificate, owner, mass and documents.' },
      admission: { label: 'Admission', description: 'Batch and buyer checks before price discovery.' },
      bids: { label: 'Bids', description: 'Immutable journal of admitted bids.' },
      'deal-basis': { label: 'Deal basis', description: 'Winner, price, volume and next stage.' },
    },
    phaseStates: { complete: 'complete', current: 'current stage', available: 'available', blocked: 'blocked' },
    common: { boundary: 'The auction creates a price and a Deal basis, not a payment.', externalBoundary: 'The displayed snapshot does not prove a live public-registry connection. An external status must arrive through a verified integration event.', openAuction: 'Auction overview', openImport: 'Open import', openAdmission: 'Open admission', openBids: 'Open bids', openBasis: 'Open basis', openLogistics: 'Open logistics', back: 'Back', details: 'Details', sourceSnapshot: 'Source snapshot', notConfirmed: 'not externally confirmed', complete: 'complete', review: 'review', blocked: 'blocked', required: 'required', available: 'available', owner: 'owner' },
    root: {
      eyebrow: 'Public registry auction → Deal', title: 'Price appears only after admission', description: 'The canonical flow binds the public-registry batch, certificate, owner, buyers, bids and winner to one Deal. Contact and money remain inside execution.', statusReady: 'ready for the next stage', statusBlocked: 'admission must be completed', priorityReadyTitle: 'Open the Deal basis', priorityBlockedTitle: 'Close quality and buyer checks', priorityReadyDescription: 'The lot is admitted, the journal is closed and the winner is locked. The next step creates a verifiable logistics basis.', priorityBlockedDescription: 'The snapshot contains historical bids, but admission still requires review. New bidding and logistics transition must remain closed.', blockerReady: 'none', blockerBlocked: 'quality and buyer authority', owner: 'compliance + laboratory + operator', impactReady: 'the winner may form a Deal basis', impactBlocked: 'price cannot start a new execution stage', result: 'admitted lot → immutable bids → Deal basis', facts: { lot: 'Registry lot', certificate: 'Grain certificate', import: 'Import', admission: 'Admission', volume: 'Available volume', basis: 'Basis' }, rulesTitle: 'Trading rules', rulesDescription: 'Rules apply before and after a bid without manual bypass.', controlsTitle: 'Risk controls', controlsDescription: 'Bypass, logistics gaps and evidence risks remain inside the Deal.'
    },
    importPage: {
      eyebrow: 'Registry → import', title: 'Verify the batch source first', description: 'Import binds the batch, certificate, owner, available mass, quality and documents. A local mark cannot replace registry confirmation.', status: 'snapshot requires external confirmation', priorityTitle: 'Verify the batch snapshot and source', priorityDescription: 'Before admission, confirm owner, certificate, available mass, quality and documents. The verified package then moves to compliance.', blocker: 'live registry not confirmed', owner: 'operator + compliance', impact: 'trading must not open for an unverified batch', result: 'immutable batch snapshot with source and time', facts: { status: 'Import status', lot: 'Registry lot', certificate: 'Certificate', owner: 'Owner', batch: 'Batch', volume: 'Available' }, qualityTitle: 'Quality indicators', qualityDescription: 'Values require a verified laboratory source.', documentsTitle: 'Batch documents', documentsDescription: 'Every status needs an external source or a named manual-review owner.'
    },
    admissionPage: {
      eyebrow: 'Import → admission', titleReady: 'Lot admitted to trading', titleReview: 'Admission requires a decision', description: 'Price discovery cannot start before batch, document, quality and buyer-authority checks.', statusReady: 'bidding may open', statusReview: 'bidding blocked', priorityReadyTitle: 'Open the bidding window', priorityReviewTitle: 'Close checks before bidding', priorityReadyDescription: 'All blocking checks are complete. Only admitted buyers may bid.', priorityReviewDescription: 'While review or block remains, new bids are not accepted. Historical records remain read-only.', blockerReady: 'none', blockerReview: 'admission checks incomplete', owner: 'compliance + laboratory', impactReady: 'admitted buyers may bid', impactReview: 'new bids and winner selection are forbidden', result: 'explainable decision for the batch and each buyer', facts: { checks: 'Batch checks', passed: 'Passed', review: 'Needs decision', buyers: 'Buyers', admittedBuyers: 'Admitted', limit: 'Combined limit' }, checksTitle: 'Batch and documents', checksDescription: 'Each check has an owner and status.', buyersTitle: 'Buyer admission', buyersDescription: 'Only a buyer with an ok status may bid.'
    },
    bidsPage: {
      eyebrow: 'Admission → bids', title: 'Bid journal for the registry lot', descriptionReady: 'Bids are accepted only from admitted buyers, within available mass and with an immutable journal record.', descriptionBlocked: 'Admission is incomplete. Historical records are visible for review only; new bids and winner transition are blocked.', statusReady: 'bidding window available', statusBlocked: 'bids read-only', priorityReadyTitle: 'Verify the winner and close the journal', priorityBlockedTitle: 'Return to admission', priorityReadyDescription: 'Check price, volume, time and buyer admission before locking the winner.', priorityBlockedDescription: 'Close quality and buyer-authority checks. A historical journal cannot authorise new trading.', blockerReady: 'none', blockerBlocked: 'admission not confirmed', owner: 'operator + compliance', impactReady: 'the winner will create a Deal basis', impactBlocked: 'the winner cannot start the next stage', result: 'immutable journal + locked winner', facts: { leader: 'Leader', bid: 'Bid', lot: 'Lot', volume: 'Available', bids: 'Bids', journal: 'Journal mode' }, journalTitle: 'Bid journal', journalDescription: 'Records cannot be deleted or rewritten retrospectively.', rulesTitle: 'Rules', rulesDescription: 'Applied equally to all buyers.', winner: 'winner', historical: 'read-only' 
    },
    basisPage: {
      eyebrow: 'Winner → Deal basis', title: 'Verifiable Deal basis', noBasisTitle: 'No winner is locked', descriptionReady: 'The winning bid is bound to the registry lot, certificate, parties, volume and amount. The next stage is logistics, not an automatic payment.', descriptionBlocked: 'The basis is calculated, but current admission is incomplete. Logistics transition must remain blocked.', noBasisDescription: 'A Deal basis cannot exist without a winning bid. Return to the journal and lock the result under the rules.', statusReady: 'basis ready', statusBlocked: 'basis blocked', statusMissing: 'basis missing', priorityReadyTitle: 'Create a trip from the basis', priorityBlockedTitle: 'Close admission before logistics', priorityMissingTitle: 'Lock a winner', priorityReadyDescription: 'The basis guard and admission are complete. Logistics receives only locked fields.', priorityBlockedDescription: 'A historical bid and calculated amount cannot replace current batch and buyer admission.', priorityMissingDescription: 'The basis appears only after an immutable winner record.', blockerReady: 'none', blockerBlocked: 'admission incomplete', blockerMissing: 'no winner', owner: 'operator + compliance + logistics', impactReady: 'a trip may be formed', impactBlocked: 'logistics and money flow remain closed', resultReady: 'canonical Deal with price source and journal', resultBlocked: 'return to admission without losing history', facts: { winner: 'Winner', price: 'Winning price', lot: 'Registry lot', certificate: 'Certificate', seller: 'Seller', buyer: 'Buyer', volume: 'Volume', amount: 'Amount', terms: 'Delivery terms', storage: 'Storage place' }, journalTitle: 'Journal locks', journalDescription: 'Basis fields remain linked to their source and owner.', readinessTitle: 'Why a trip may be formed', readinessDescription: 'Checks prevent skipping admission or documents.', guardsTitle: 'Deal-basis guard', guardsDescription: 'Every mandatory field is checked separately.', nextTitle: 'Next routes', nextDescription: 'Actions remain inside Deal execution.', moneyTitle: 'Money boundary', moneyDescription: 'This screen does not prove live banking and cannot release money. The bank receives a verifiable basis only after execution events.'
    },
    importStatuses: { not_connected: 'awaiting connection', requested: 'request sent', matched: 'lot matched', requires_review: 'review required', rejected: 'rejected' },
    admissionStatuses: { blocked: 'blocked', review_required: 'review required', admitted: 'admitted' },
    checkStatuses: { ok: 'complete', review: 'review', block: 'blocked' },
    buyerStatuses: { ok: 'admitted', review: 'review', blocked: 'blocked' },
    documentStatuses: { ok: 'available', review: 'review', required: 'required' },
    stageStatuses: { lot_draft: 'draft', lot_admitted: 'lot admitted', bidding_window: 'bidding window', winner_locked: 'winner locked', deal_basis_ready: 'basis calculated', deal_created: 'Deal created' },
    qualityLabels: { 'Влажность': 'Moisture', 'Клейковина': 'Gluten', 'Сорная примесь': 'Foreign matter', 'Зараженность': 'Infestation' },
    documentLabels: { 'Партия ФГИС': 'Registry batch', 'СДИЗ': 'Grain certificate', 'Качество': 'Quality', 'Договор поставки': 'Supply contract' },
    checkLabels: { 'fgis-match': 'registry lot matches the owner', 'weight-free': 'mass is not locked by another Deal', 'sdiz-present': 'certificate is bound to the batch', 'quality-review': 'quality confirmed before bidding', 'bank-basis': 'the bank receives a basis only after the Deal' },
    ruleLabels: { 'admitted-buyer-only': 'only an admitted buyer may bid', 'volume-lock': 'bid volume cannot exceed available mass', 'journal-fixed': 'a bid is recorded and cannot be deleted retrospectively', 'no-direct-contact': 'contact after price remains inside the platform', 'winner-to-deal': 'the winner creates a Deal basis, not a payment' },
    guardLabels: { winner: 'winner is locked', lotNumber: 'lot number is stored', sdizNumber: 'certificate is stored', priceRubPerTon: 'winning price is positive', 'deal-logistics': 'logistics route exists', 'route-icons': 'next routes are defined', 'winner-price-match': 'winner price matches', 'volume-within-available': 'volume is within available mass' },
    owners: { 'Комплаенс': 'Compliance', 'Оператор': 'Operator', 'Лаборатория': 'Laboratory', 'Банк': 'Bank', 'Покупатель': 'Buyer', 'Логистика': 'Logistics', 'Арбитр': 'Arbitrator', 'UX': 'UX' },
    controls: ['the interface cannot cancel a recorded bid', 'the winner creates a basis, not money', 'logistics starts after lot → winner → Deal linkage', 'a dispute opens from acceptance, quality or document facts'],
    risks: ['platform bypass after price discovery', 'bid without verified admission', 'price and logistics becoming disconnected', 'missing quality and weight evidence'],
    journalLocks: ['winning bid and price', 'registry lot, certificate and batch owner', 'buyer, volume and Deal amount', 'basis for trip and acceptance'],
    readinessReasons: ['winner locked in the journal', 'registry lot and certificate stored', 'volume does not exceed available mass', 'the next stage is a trip, not an independent payment'],
    nextActions: {
      '/platform-v7/deal-logistics': { label: 'Assign a trip', result: 'create a trip from the Deal basis' },
      '/platform-v7/deal-documents-basis': { label: 'Open documents', result: 'check contract, certificate, weight, quality and transfer document' },
      '/platform-v7/disputes': { label: 'Open disputes', result: 'link a dispute to the Deal and evidence' },
      '/platform-v7/auction/bids': { label: 'Return to bids', result: 'verify the immutable journal' },
    },
  },
  zh: {
    meta: { blocker: '阻塞项', owner: '负责人', impact: '影响', result: '结果', nextAction: '下一步', prioritySection: '拍卖主要任务', factsSection: '拍卖关键事实' },
    phaseNavLabel: '拍卖阶段',
    phases: {
      import: { label: '登记导入', description: '批次、凭证、所有者、重量和文件。' },
      admission: { label: '准入', description: '价格形成前检查批次和买方。' },
      bids: { label: '报价', description: '已准入报价的不可变日志。' },
      'deal-basis': { label: '交易依据', description: '获胜者、价格、数量和下一阶段。' },
    },
    phaseStates: { complete: '已完成', current: '当前阶段', available: '可用', blocked: '已阻止' },
    common: { boundary: '拍卖形成价格和交易依据，而不是付款。', externalBoundary: '显示的快照不能证明政府登记系统已实时连接。外部状态必须通过已验证的集成事件返回。', openAuction: '拍卖概览', openImport: '打开导入', openAdmission: '打开准入', openBids: '打开报价', openBasis: '打开依据', openLogistics: '进入物流', back: '返回', details: '详情', sourceSnapshot: '来源快照', notConfirmed: '外部未确认', complete: '已完成', review: '审查', blocked: '阻止', required: '必需', available: '可用', owner: '负责人' },
    root: {
      eyebrow: '政府登记拍卖 → 交易', title: '只有完成准入后才形成价格', description: '规范流程将政府登记批次、粮食凭证、所有者、买方、报价和获胜者绑定到同一交易。联系和资金仍在履约流程内。', statusReady: '可进入下一阶段', statusBlocked: '必须完成准入', priorityReadyTitle: '打开交易依据', priorityBlockedTitle: '完成质量和买方检查', priorityReadyDescription: '批次已准入，报价日志已关闭，获胜者已锁定。下一步形成可验证的物流依据。', priorityBlockedDescription: '快照包含历史报价，但准入仍需审查。新报价和进入物流必须保持关闭。', blockerReady: '无', blockerBlocked: '质量和买方权限', owner: '合规 + 实验室 + 运营人员', impactReady: '获胜者可以形成交易依据', impactBlocked: '价格不能启动新的履约阶段', result: '已准入批次 → 不可变报价 → 交易依据', facts: { lot: '登记批次', certificate: '粮食凭证', import: '导入', admission: '准入', volume: '可用数量', basis: '依据' }, rulesTitle: '交易规则', rulesDescription: '规则在报价前后同样适用，禁止人工绕过。', controlsTitle: '风险控制', controlsDescription: '绕过、物流断裂和证据风险都留在交易内。'
    },
    importPage: {
      eyebrow: '登记系统 → 导入', title: '先验证批次来源', description: '导入将批次、凭证、所有者、可用重量、质量和文件关联起来。平台内部标记不能替代政府登记确认。', status: '快照需要外部确认', priorityTitle: '验证批次快照和来源', priorityDescription: '准入前必须确认所有者、凭证、可用重量、质量和文件。验证后的文件包交给合规。', blocker: '实时登记连接未确认', owner: '运营人员 + 合规', impact: '未验证批次不得开始交易', result: '带来源和时间的不可变批次快照', facts: { status: '导入状态', lot: '登记批次', certificate: '粮食凭证', owner: '所有者', batch: '批次', volume: '可用' }, qualityTitle: '质量指标', qualityDescription: '数值需要已验证的实验室来源。', documentsTitle: '批次文件', documentsDescription: '每个状态都需要外部来源或明确的人工审查负责人。'
    },
    admissionPage: {
      eyebrow: '导入 → 准入', titleReady: '批次已准入交易', titleReview: '准入需要决策', description: '完成批次、文件、质量和买方权限检查前不得形成价格。', statusReady: '可以开启报价', statusReview: '报价已阻止', priorityReadyTitle: '开启报价窗口', priorityReviewTitle: '报价前完成检查', priorityReadyDescription: '所有阻塞检查已完成。只有已准入买方可以报价。', priorityReviewDescription: '只要存在审查或阻塞，新报价就不可用。历史记录保持只读。', blockerReady: '无', blockerReview: '准入检查未完成', owner: '合规 + 实验室', impactReady: '已准入买方可以报价', impactReview: '禁止新报价和选择获胜者', result: '对批次和每个买方形成可解释的决策', facts: { checks: '批次检查', passed: '通过', review: '需要决策', buyers: '买方', admittedBuyers: '已准入', limit: '总额度' }, checksTitle: '批次和文件', checksDescription: '每项检查都有负责人和状态。', buyersTitle: '买方准入', buyersDescription: '只有状态为 ok 的买方可以报价。'
    },
    bidsPage: {
      eyebrow: '准入 → 报价', title: '登记批次报价日志', descriptionReady: '只有已准入买方可以在可用重量内报价，并形成不可变日志记录。', descriptionBlocked: '准入未完成。历史记录仅供审查；新报价和获胜者转换均被阻止。', statusReady: '报价窗口可用', statusBlocked: '报价只读', priorityReadyTitle: '验证获胜者并关闭日志', priorityBlockedTitle: '返回准入', priorityReadyDescription: '锁定获胜者前检查价格、数量、时间和买方准入。', priorityBlockedDescription: '完成质量和买方权限检查。历史日志不能授权新交易。', blockerReady: '无', blockerBlocked: '准入未确认', owner: '运营人员 + 合规', impactReady: '获胜者将形成交易依据', impactBlocked: '获胜者不能启动下一阶段', result: '不可变日志 + 已锁定获胜者', facts: { leader: '领先者', bid: '报价', lot: '批次', volume: '可用', bids: '报价数量', journal: '日志模式' }, journalTitle: '报价日志', journalDescription: '记录不能删除，也不能事后改写。', rulesTitle: '规则', rulesDescription: '对所有买方一视同仁。', winner: '获胜者', historical: '只读' 
    },
    basisPage: {
      eyebrow: '获胜者 → 交易依据', title: '可验证的交易依据', noBasisTitle: '尚未锁定获胜者', descriptionReady: '获胜报价与登记批次、凭证、交易方、数量和金额绑定。下一阶段是物流，而不是自动付款。', descriptionBlocked: '依据已计算，但当前准入未完成。进入物流必须保持阻止。', noBasisDescription: '没有获胜报价就不能形成交易依据。返回日志并按规则锁定结果。', statusReady: '依据已准备', statusBlocked: '依据已阻止', statusMissing: '没有依据', priorityReadyTitle: '从依据创建运输任务', priorityBlockedTitle: '进入物流前完成准入', priorityMissingTitle: '锁定获胜者', priorityReadyDescription: '依据 guard 和准入均已完成。物流只接收已锁定字段。', priorityBlockedDescription: '历史报价和计算金额不能替代当前批次和买方准入。', priorityMissingDescription: '只有不可变的获胜者记录才能形成依据。', blockerReady: '无', blockerBlocked: '准入未完成', blockerMissing: '没有获胜者', owner: '运营人员 + 合规 + 物流', impactReady: '可以形成运输任务', impactBlocked: '物流和资金流程保持关闭', resultReady: '带价格来源和日志的规范交易', resultBlocked: '返回准入且不丢失历史', facts: { winner: '获胜者', price: '获胜价格', lot: '登记批次', certificate: '粮食凭证', seller: '卖方', buyer: '买方', volume: '数量', amount: '金额', terms: '交付条件', storage: '存储地点' }, journalTitle: '日志锁定内容', journalDescription: '依据字段始终与来源和负责人关联。', readinessTitle: '为何可以形成运输任务', readinessDescription: '检查防止跳过准入或文件。', guardsTitle: '交易依据 guard', guardsDescription: '每个强制字段单独检查。', nextTitle: '下一路径', nextDescription: '所有操作都留在交易履约内。', moneyTitle: '资金边界', moneyDescription: '该页面不能证明银行实时连接，也不能释放资金。只有完成履约事件后，银行才接收可验证依据。'
    },
    importStatuses: { not_connected: '等待连接', requested: '已发送请求', matched: '批次已匹配', requires_review: '需要审查', rejected: '已拒绝' },
    admissionStatuses: { blocked: '已阻止', review_required: '需要审查', admitted: '已准入' },
    checkStatuses: { ok: '已完成', review: '审查', block: '已阻止' },
    buyerStatuses: { ok: '已准入', review: '审查', blocked: '已阻止' },
    documentStatuses: { ok: '已有', review: '审查', required: '必需' },
    stageStatuses: { lot_draft: '草稿', lot_admitted: '批次已准入', bidding_window: '报价窗口', winner_locked: '获胜者已锁定', deal_basis_ready: '依据已计算', deal_created: '交易已创建' },
    qualityLabels: { 'Влажность': '水分', 'Клейковина': '面筋', 'Сорная примесь': '杂质', 'Зараженность': '虫害' },
    documentLabels: { 'Партия ФГИС': '登记批次', 'СДИЗ': '粮食凭证', 'Качество': '质量', 'Договор поставки': '供货合同' },
    checkLabels: { 'fgis-match': '登记批次与所有者一致', 'weight-free': '重量未被其他交易锁定', 'sdiz-present': '粮食凭证已关联批次', 'quality-review': '报价前质量已确认', 'bank-basis': '银行只在交易形成后接收依据' },
    ruleLabels: { 'admitted-buyer-only': '只有已准入买方可以报价', 'volume-lock': '报价数量不得超过可用重量', 'journal-fixed': '报价记录固定且不能事后删除', 'no-direct-contact': '价格形成后的联系仍留在平台内', 'winner-to-deal': '获胜者形成交易依据，而不是付款' },
    guardLabels: { winner: '获胜者已锁定', lotNumber: '批次编号已保存', sdizNumber: '粮食凭证已保存', priceRubPerTon: '获胜价格为正数', 'deal-logistics': '存在物流路径', 'route-icons': '下一路径已定义', 'winner-price-match': '获胜价格一致', 'volume-within-available': '数量在可用重量内' },
    owners: { 'Комплаенс': '合规', 'Оператор': '运营人员', 'Лаборатория': '实验室', 'Банк': '银行', 'Покупатель': '买方', 'Логистика': '物流', 'Арбитр': '仲裁员', 'UX': 'UX' },
    controls: ['界面不能取消已记录报价', '获胜者形成依据，而不是资金', '物流在批次 → 获胜者 → 交易关联后开始', '争议从验收、质量或文件事实触发'],
    risks: ['价格形成后绕过平台', '未验证准入的报价', '价格与物流断裂', '缺少质量和重量证据'],
    journalLocks: ['获胜报价和价格', '登记批次、凭证和所有者', '买方、数量和交易金额', '运输任务和验收依据'],
    readinessReasons: ['获胜者已记录在日志', '登记批次和凭证已保存', '数量未超过可用重量', '下一阶段是运输任务，而不是独立付款'],
    nextActions: {
      '/platform-v7/deal-logistics': { label: '分配运输任务', result: '根据交易依据创建运输任务' },
      '/platform-v7/deal-documents-basis': { label: '打开文件', result: '检查合同、凭证、重量、质量和转让文件' },
      '/platform-v7/disputes': { label: '打开争议', result: '将争议与交易和证据关联' },
      '/platform-v7/auction/bids': { label: '返回报价', result: '核对不可变日志' },
    },
  },
};
