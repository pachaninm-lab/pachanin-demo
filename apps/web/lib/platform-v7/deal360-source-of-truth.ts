export type Deal360State = 'ok' | 'wait' | 'stop' | 'manual';

export type Deal360Cockpit = {
  currentStage: string;
  nextActor: string;
  moneyStatus: { label: string; state: Deal360State };
  docStatus: { label: string; state: Deal360State };
  tripStatus: { label: string; state: Deal360State };
  qualityStatus: { label: string; state: Deal360State };
  disputeStatus: { label: string; state: Deal360State };
  cannotHappenReason: string;
};

export type Deal360Scenario = {
  dealId: string;
  lotId: string;
  acceptedBid: string;
  logisticsOrderId: string;
  tripId: string;
  route: string;
  releaseAllowed: boolean;
  nextAction: string;
  cockpit: Deal360Cockpit;
  chain: Array<{ title: string; value: string; state: Deal360State }>;
  money: Array<{ title: string; value: string; note: string; state: Deal360State }>;
  providerGates: Array<{ provider: string; object: string; status: string; impact: string; state: Deal360State }>;
  documents: Array<{ title: string; source: string; responsible: string; status: string; blocksMoney: boolean }>;
};

const BASE: Deal360Scenario = {
  dealId: 'DL-9106',
  lotId: 'LOT-2403',
  acceptedBid: 'Покупатель 1 · 91/100 · Воронежская область',
  logisticsOrderId: 'LOG-REQ-2403',
  tripId: 'TRIP-SIM-001',
  route: 'Тамбовская область → Элеватор ВРЖ-08',
  releaseAllowed: false,
  nextAction: 'закрыть СДИЗ, ЭТрН, ГИС ЭПД, УПД, акт приёмки, акт расхождения и протокол качества перед выплатой продавцу',
  cockpit: {
    currentStage: 'Документы — неполный пакет',
    nextActor: 'продавец (СДИЗ) · покупатель (УПД) · грузополучатель (ЭТрН)',
    moneyStatus: { label: 'резерв ожидает подтверждения · к выплате 0 ₽', state: 'stop' },
    docStatus: { label: '5 из 9 документов блокируют выплату', state: 'stop' },
    tripStatus: { label: 'TRIP-SIM-001 · в пути · 62%', state: 'ok' },
    qualityStatus: { label: 'приёмка ожидает финального веса · качество не поступило', state: 'wait' },
    disputeStatus: { label: 'споров нет', state: 'ok' },
    cannotHappenReason: 'деньги продавцу не выпускаются: СДИЗ не подтверждён · ЭТрН не закрыта · УПД ждёт подписи · акт приёмки готовится · протокол качества ожидается',
  },
  chain: [
    { title: 'Лот', value: 'LOT-2403', state: 'ok' },
    { title: 'Ставка', value: 'принята', state: 'ok' },
    { title: 'Сделка', value: 'DL-9106', state: 'ok' },
    { title: 'Деньги', value: 'резерв ожидает подтверждения', state: 'wait' },
    { title: 'Логистика', value: 'LOG-REQ-2403', state: 'ok' },
    { title: 'Водитель', value: 'TRIP-SIM-001 · 62% пути', state: 'ok' },
    { title: 'Приёмка', value: 'ожидает финального веса', state: 'wait' },
    { title: 'Документы', value: 'неполный пакет', state: 'stop' },
    { title: 'Выплата', value: 'остановлена', state: 'stop' },
  ],
  money: [
    { title: 'Сумма сделки', value: '9,65 млн ₽', note: 'расчёт по принятой ставке', state: 'ok' },
    { title: 'Резерв покупателя', value: 'ожидает подтверждения', note: 'Сбер · Безопасные сделки', state: 'wait' },
    { title: 'К выплате сейчас', value: '0 ₽', note: 'есть документные и приёмочные условия', state: 'stop' },
    { title: 'Потенциальная выплата', value: 'до 9,65 млн ₽', note: 'после закрытия всех условий сделки', state: 'manual' },
  ],
  providerGates: [
    { provider: 'Сбер · Безопасные сделки', object: 'резерв и выплата', status: 'ждёт полного набора условий', impact: 'деньги продавцу не выпускаются', state: 'wait' },
    { provider: 'Сбер · Оплата в кредит', object: 'кредитный лимит покупателя', status: 'сценарий доступен у покупателя', impact: 'не является кредитной линией продавца', state: 'manual' },
    { provider: 'ФГИС «Зерно»', object: 'СДИЗ по партии', status: 'СДИЗ не подтверждён', impact: 'останавливает финальную выплату', state: 'stop' },
    { provider: 'Контур.Диадок', object: 'договор, УПД, акт', status: 'УПД ждёт подписи покупателя', impact: 'останавливает финальную выплату', state: 'stop' },
    { provider: 'СБИС / Saby ЭТрН', object: 'электронная транспортная накладная', status: 'ждёт подписи грузополучателя', impact: 'останавливает финальную выплату', state: 'stop' },
    { provider: 'ГИС ЭПД', object: 'перевозочный документ', status: 'ожидает закрытия ЭТрН', impact: 'останавливает транспортное основание', state: 'wait' },
    { provider: 'КриптоПро DSS', object: 'КЭП / полномочия подписанта', status: 'сертификат доступен для проверки полномочий', impact: 'ошибка подписи остановит ЭДО', state: 'ok' },
    { provider: 'ATI.SU', object: 'расчёт перевозчика', status: 'перевозчик выбран для рейса', impact: 'показывает транспортный сценарий', state: 'ok' },
    { provider: 'Wialon', object: 'телематика рейса', status: 'точка водителя 62% пути', impact: 'отклонение создаст инцидент', state: 'ok' },
    { provider: 'Яндекс.Карты', object: 'карта маршрута', status: 'визуализация маршрута', impact: 'показывает маршрут водителю и логисту', state: 'ok' },
    { provider: 'Лабораторный контур качества', object: 'протокол качества', status: 'протокол качества ожидается', impact: 'без качества выплата не разрешается', state: 'stop' },
    { provider: 'GigaChat Enterprise', object: 'помощник оператора', status: 'объясняет причины остановки и готовит черновики', impact: 'не принимает решений и не выпускает деньги', state: 'manual' },
  ],
  documents: [
    { title: 'Договор', source: 'Контур.Диадок', responsible: 'продавец + покупатель', status: 'подписан', blocksMoney: false },
    { title: 'УПД', source: 'Контур.Диадок', responsible: 'покупатель', status: 'ждёт подписи', blocksMoney: true },
    { title: 'ЭТрН', source: 'СБИС / Saby ЭТрН', responsible: 'грузополучатель', status: 'не закрыта всеми сторонами', blocksMoney: true },
    { title: 'ГИС ЭПД', source: 'ГИС ЭПД', responsible: 'логист + перевозчик', status: 'ожидает закрытия ЭТрН', blocksMoney: true },
    { title: 'СДИЗ', source: 'ФГИС «Зерно»', responsible: 'продавец', status: 'не подтверждён', blocksMoney: true },
    { title: 'КЭП / МЧД', source: 'КриптоПро DSS', responsible: 'уполномоченный подписант', status: 'сертификат доступен', blocksMoney: false },
    { title: 'Акт приёмки', source: 'приёмка + Контур.Диадок', responsible: 'элеватор', status: 'готовится', blocksMoney: true },
    { title: 'Акт расхождения', source: 'элеватор + стороны сделки', responsible: 'элеватор + оператор', status: 'требуется при отклонении веса', blocksMoney: true },
    { title: 'Протокол качества', source: 'лабораторный контур качества', responsible: 'лаборатория', status: 'ожидается', blocksMoney: true },
  ],
};

const DL_9102: Deal360Scenario = {
  ...BASE,
  dealId: 'DL-9102',
  lotId: 'LOT-2401',
  acceptedBid: 'Покупатель 2 · 82/100 · Краснодарский край',
  logisticsOrderId: 'LOG-REQ-9102',
  tripId: 'ТМБ-14',
  route: 'Тамбовская область → Элеватор Черноземный',
  nextAction: 'закрыть отклонение веса и акт удержания',
  cockpit: {
    currentStage: 'Спор по весу — удержание 624 тыс. ₽',
    nextActor: 'арбитр + оператор',
    moneyStatus: { label: 'резерв отмечен · 624 тыс. ₽ под удержанием', state: 'manual' },
    docStatus: { label: 'документы в порядке', state: 'ok' },
    tripStatus: { label: 'ТМБ-14 · рейс завершён · приёмка закрыта', state: 'ok' },
    qualityStatus: { label: 'качество зафиксировано · отклонение веса в споре', state: 'wait' },
    disputeStatus: { label: 'DSP-9102-WEIGHT · 624 тыс. ₽ · открыт', state: 'stop' },
    cannotHappenReason: 'спорная сумма 624 тыс. ₽ не выпускается до решения DSP-9102-WEIGHT · арбитр должен вынести решение',
  },
  chain: [
    { title: 'Лот', value: 'LOT-2401', state: 'ok' },
    { title: 'Ставка', value: 'принята', state: 'ok' },
    { title: 'Сделка', value: 'DL-9102', state: 'ok' },
    { title: 'Деньги', value: '624 тыс. ₽ под удержанием', state: 'manual' },
    { title: 'Логистика', value: 'LOG-REQ-9102', state: 'ok' },
    { title: 'Водитель', value: 'ТМБ-14 · рейс завершён', state: 'ok' },
    { title: 'Приёмка', value: 'отклонение веса', state: 'wait' },
    { title: 'Документы', value: 'акт удержания требуется', state: 'stop' },
    { title: 'Выплата', value: 'спорная часть остановлена', state: 'stop' },
  ],
  money: [
    { title: 'Сумма сделки', value: '6,24 млн ₽', note: 'расчёт по условиям сделки', state: 'ok' },
    { title: 'Удержание', value: '624 тыс. ₽', note: 'спор по весу', state: 'stop' },
    { title: 'К выплате сейчас', value: '5,616 млн ₽', note: 'без спорной части, после банковского подтверждения', state: 'manual' },
    { title: 'Спорная часть', value: '624 тыс. ₽', note: 'до решения спора', state: 'stop' },
  ],
};

export const DEAL360_SCENARIOS: Record<string, Deal360Scenario> = {
  'DL-9106': BASE,
  'DL-9102': DL_9102,
};

export function getDeal360Scenario(dealId: string): Deal360Scenario {
  return DEAL360_SCENARIOS[dealId] ?? { ...BASE, dealId, nextAction: 'проверить резерв, документы, приёмку и открытые споры' };
}
