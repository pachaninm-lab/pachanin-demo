export type Deal360State = 'ok' | 'wait' | 'stop' | 'manual';

export type Deal360Scenario = {
  dealId: string;
  lotId: string;
  acceptedBid: string;
  logisticsOrderId: string;
  tripId: string;
  route: string;
  releaseAllowed: boolean;
  nextAction: string;
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
  nextAction: 'закрыть СДИЗ, ЭТрН, УПД и протокол качества перед выплатой продавцу',
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
    { provider: 'Сбер · Безопасные сделки', object: 'резерв и выплата', status: 'симуляция резерва · ждёт полного набора условий', impact: 'деньги продавцу не выпускаются', state: 'wait' },
    { provider: 'Сбер · Оплата в кредит', object: 'кредитный лимит покупателя', status: 'сценарий доступен у покупателя', impact: 'не является кредитной линией продавца', state: 'manual' },
    { provider: 'ФГИС «Зерно»', object: 'СДИЗ по партии', status: 'СДИЗ не подтверждён', impact: 'останавливает финальную выплату', state: 'stop' },
    { provider: 'Контур.Диадок', object: 'договор, УПД, акт', status: 'УПД ждёт подписи покупателя', impact: 'останавливает финальную выплату', state: 'stop' },
    { provider: 'СБИС / Saby ЭТрН', object: 'электронная транспортная накладная', status: 'ждёт подписи грузополучателя', impact: 'останавливает финальную выплату', state: 'stop' },
    { provider: 'КриптоПро DSS', object: 'КЭП / полномочия подписанта', status: 'сертификат доступен в тестовом контуре', impact: 'ошибка подписи остановит ЭДО', state: 'ok' },
    { provider: 'ATI.SU', object: 'расчёт перевозчика', status: 'перевозчик выбран в симуляции', impact: 'подтверждает транспортный сценарий', state: 'ok' },
    { provider: 'Wialon', object: 'телематика рейса', status: 'точка водителя 62% пути', impact: 'отклонение создаст инцидент', state: 'ok' },
    { provider: 'Яндекс.Карты', object: 'карта маршрута', status: 'визуальная симуляция маршрута', impact: 'показывает маршрут водителю и логисту', state: 'ok' },
    { provider: 'ФГБУ ЦОК АПК', object: 'протокол качества', status: 'протокол ожидается', impact: 'без качества выплата не разрешается', state: 'stop' },
    { provider: 'GigaChat Enterprise', object: 'помощник оператора', status: 'объясняет причины остановки и готовит черновики', impact: 'не принимает решений и не выпускает деньги', state: 'manual' },
  ],
  documents: [
    { title: 'Договор', source: 'Контур.Диадок', responsible: 'продавец + покупатель', status: 'подписан в тестовом контуре', blocksMoney: false },
    { title: 'УПД', source: 'Контур.Диадок', responsible: 'покупатель', status: 'ждёт подписи', blocksMoney: true },
    { title: 'ЭТрН', source: 'СБИС / Saby ЭТрН', responsible: 'грузополучатель', status: 'не закрыта всеми сторонами', blocksMoney: true },
    { title: 'СДИЗ', source: 'ФГИС «Зерно»', responsible: 'продавец', status: 'не подтверждён', blocksMoney: true },
    { title: 'Акт приёмки', source: 'приёмка + Контур.Диадок', responsible: 'элеватор', status: 'готовится', blocksMoney: true },
    { title: 'Протокол качества', source: 'ФГБУ ЦОК АПК', responsible: 'лаборатория', status: 'ожидается', blocksMoney: true },
  ],
};

const DL_9102: Deal360Scenario = {
  ...BASE,
  dealId: 'DL-9102',
  lotId: 'LOT-2402',
  acceptedBid: 'Покупатель 2 · 82/100 · Краснодарский край',
  logisticsOrderId: 'LOG-9102',
  tripId: 'TRIP-SIM-002',
  route: 'Воронежская область → Курская область',
  nextAction: 'закрыть отклонение веса и акт удержания',
  money: [
    { title: 'Сумма сделки', value: '6,24 млн ₽', note: 'резерв подтверждён', state: 'ok' },
    { title: 'Удержание', value: '624 тыс. ₽', note: 'спор по весу', state: 'stop' },
    { title: 'К выплате сейчас', value: '5,616 млн ₽', note: 'без спорной части', state: 'manual' },
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
