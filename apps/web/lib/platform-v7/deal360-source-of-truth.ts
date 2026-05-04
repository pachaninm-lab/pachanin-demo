export type Deal360State = 'ok' | 'wait' | 'stop' | 'manual';
export type Deal360Readiness = 'demo' | 'sandbox' | 'test' | 'prelive' | 'live';
export type Deal360DocumentLegalLevel = 'internal' | 'external_edo' | 'government' | 'bank';

export const DEAL360_READINESS_LABELS: Record<Deal360Readiness, string> = {
  demo: 'демо-режим',
  sandbox: 'песочница',
  test: 'тестовый контур',
  prelive: 'предбоевой контур',
  live: 'боевой контур',
};

export const DEAL360_DOCUMENT_LEVEL_LABELS: Record<Deal360DocumentLegalLevel, string> = {
  internal: 'внутренний след платформы',
  external_edo: 'внешний ЭДО / подпись',
  government: 'обязательный государственный контур',
  bank: 'банковое основание',
};

export const DEAL360_WORKSPACE_TABS = [
  'Условия',
  'Деньги',
  'Логистика',
  'Приёмка',
  'Качество',
  'Документы',
  'Спор',
  'Доказательства',
  'Журнал',
] as const;

export type Deal360ProviderGate = {
  provider: string;
  object: string;
  status: string;
  impact: string;
  state: Deal360State;
  readiness: Deal360Readiness;
  evidence: string;
  blocksIrreversibleAction: boolean;
};

export type Deal360DocumentGate = {
  title: string;
  source: string;
  responsible: string;
  status: string;
  blocksMoney: boolean;
  legalLevel: Deal360DocumentLegalLevel;
  externalStatus: string;
  requiredForRelease: boolean;
};

export type Deal360Scenario = {
  dealId: string;
  lotId: string;
  acceptedBid: string;
  logisticsOrderId: string;
  tripId: string;
  route: string;
  releaseAllowed: boolean;
  maturityLabel: string;
  runtimeStatus: string;
  releasePolicy: string;
  nextAction: string;
  chain: Array<{ title: string; value: string; state: Deal360State }>;
  money: Array<{ title: string; value: string; note: string; state: Deal360State }>;
  providerGates: Deal360ProviderGate[];
  documents: Deal360DocumentGate[];
};

const BASE: Deal360Scenario = {
  dealId: 'DL-9106',
  lotId: 'LOT-2403',
  acceptedBid: 'Покупатель 1 · 91/100 · Воронежская область',
  logisticsOrderId: 'LOG-REQ-2403',
  tripId: 'TRIP-SIM-001',
  route: 'Тамбовская область → Элеватор ВРЖ-08',
  releaseAllowed: false,
  maturityLabel: 'controlled-pilot / simulation-grade',
  runtimeStatus: 'Боевой промышленный контур не подтверждён: внешние провайдеры ниже разделены на демо, песочницу, тестовый и предбоевой режим.',
  releasePolicy: 'Финальный выпуск денег запрещён до закрытия банкового события, СДИЗ, ЭДО, ЭПД, приёмки, качества и спорного контура.',
  nextAction: 'закрыть СДИЗ, ЭТрН, УПД и протокол качества перед выплатой продавцу',
  chain: [
    { title: 'Лот', value: 'LOT-2403', state: 'ok' },
    { title: 'Ставка', value: 'принята', state: 'ok' },
    { title: 'Сделка', value: 'DL-9106', state: 'ok' },
    { title: 'Деньги', value: 'резерв ждёт банковского подтверждения', state: 'wait' },
    { title: 'Логистика', value: 'LOG-REQ-2403', state: 'ok' },
    { title: 'Водитель', value: 'TRIP-SIM-001 · 62% пути', state: 'ok' },
    { title: 'Приёмка', value: 'ожидает финального веса', state: 'wait' },
    { title: 'Документы', value: 'неполный юридический пакет', state: 'stop' },
    { title: 'Выплата', value: 'остановлена guard-ом', state: 'stop' },
  ],
  money: [
    { title: 'Сумма сделки', value: '9,65 млн ₽', note: 'расчёт по принятой ставке', state: 'ok' },
    { title: 'Резерв покупателя', value: 'ждёт подтверждения банка', note: 'Сбер · Безопасные сделки · песочница', state: 'wait' },
    { title: 'К выплате сейчас', value: '0 ₽', note: 'есть документные, приёмочные и банковские условия', state: 'stop' },
    { title: 'Потенциальная выплата', value: 'до 9,65 млн ₽', note: 'после закрытия всех условий сделки', state: 'manual' },
  ],
  providerGates: [
    {
      provider: 'Сбер · Безопасные сделки',
      object: 'резерв, удержание, выпуск и возврат денег',
      status: 'песочница · боевое банковское событие не подтверждено',
      impact: 'финальный выпуск денег продавцу запрещён',
      state: 'stop',
      readiness: 'sandbox',
      evidence: 'нет признака production-договора, боевого счёта и подтверждённого события банка в этом сценарии',
      blocksIrreversibleAction: true,
    },
    {
      provider: 'Сбер · Оплата в кредит',
      object: 'кредитный сценарий покупателя',
      status: 'тестовый сценарий · кредит не считается выданным',
      impact: 'может быть показан покупателю только как путь заявки',
      state: 'manual',
      readiness: 'test',
      evidence: 'нет решения банка по конкретному покупателю внутри сделки',
      blocksIrreversibleAction: false,
    },
    {
      provider: 'ФГИС «Зерно»',
      object: 'СДИЗ и прослеживаемость партии',
      status: 'предынтеграционный gate · СДИЗ не подтверждён',
      impact: 'останавливает юридическое закрытие партии и финальную выплату',
      state: 'stop',
      readiness: 'prelive',
      evidence: 'внутренняя карточка платформы не заменяет подтверждение государственного контура',
      blocksIrreversibleAction: true,
    },
    {
      provider: 'Контур.Диадок',
      object: 'договор, УПД, акт',
      status: 'тестовый контур · УПД ждёт подписи покупателя',
      impact: 'останавливает финальную выплату',
      state: 'stop',
      readiness: 'test',
      evidence: 'нет полного внешнего статуса подписания по всем участникам',
      blocksIrreversibleAction: true,
    },
    {
      provider: 'СБИС / Saby ЭТрН',
      object: 'электронная транспортная накладная',
      status: 'тестовый контур · ждёт подписи грузополучателя',
      impact: 'останавливает финальную выплату и закрытие рейса',
      state: 'stop',
      readiness: 'test',
      evidence: 'перевозочный документ не закрыт всеми сторонами',
      blocksIrreversibleAction: true,
    },
    {
      provider: 'КриптоПро DSS',
      object: 'КЭП / полномочия подписанта',
      status: 'тестовый контур · требуется проверка полномочий',
      impact: 'ошибка подписи или полномочий остановит ЭДО',
      state: 'wait',
      readiness: 'test',
      evidence: 'роль в интерфейсе не равна юридическому праву подписи',
      blocksIrreversibleAction: true,
    },
    {
      provider: 'ATI.SU',
      object: 'расчёт перевозчика и заявка на рейс',
      status: 'демо-режим · перевозчик выбран для сценария',
      impact: 'подтверждает транспортный сценарий, но не live-диспетчеризацию',
      state: 'manual',
      readiness: 'demo',
      evidence: 'назначение перевозчика не считается внешним подтверждением без договора и обмена событиями',
      blocksIrreversibleAction: false,
    },
    {
      provider: 'Wialon',
      object: 'телематика рейса',
      status: 'песочница · точка водителя 62% пути',
      impact: 'отклонение создаст инцидент, но не заменяет подтверждение рейса',
      state: 'wait',
      readiness: 'sandbox',
      evidence: 'маршрут показан как контрольная симуляция, а не боевой поток телематики',
      blocksIrreversibleAction: false,
    },
    {
      provider: 'Яндекс.Карты',
      object: 'карта маршрута',
      status: 'демо-режим · визуализация маршрута',
      impact: 'помогает водителю и логисту, но не является доказательством приёмки',
      state: 'manual',
      readiness: 'demo',
      evidence: 'карта отделена от юридически значимого события рейса',
      blocksIrreversibleAction: false,
    },
    {
      provider: 'ФГБУ ЦОК АПК',
      object: 'протокол качества',
      status: 'предбоевой контур · протокол ожидается',
      impact: 'без качества выплата не разрешается',
      state: 'stop',
      readiness: 'prelive',
      evidence: 'качественная дельта не рассчитана по внешнему протоколу',
      blocksIrreversibleAction: true,
    },
    {
      provider: 'GigaChat Enterprise',
      object: 'помощник оператора',
      status: 'демо-режим · готовит объяснения и черновики',
      impact: 'не принимает решений, не меняет деньги и не закрывает спор',
      state: 'manual',
      readiness: 'demo',
      evidence: 'решение остаётся за уполномоченной ролью и журналируется',
      blocksIrreversibleAction: false,
    },
  ],
  documents: [
    {
      title: 'Договор',
      source: 'Контур.Диадок',
      responsible: 'продавец + покупатель',
      status: 'подписан в тестовом контуре',
      blocksMoney: false,
      legalLevel: 'external_edo',
      externalStatus: 'внешний статус подтверждён только для тестового маршрута',
      requiredForRelease: true,
    },
    {
      title: 'УПД',
      source: 'Контур.Диадок',
      responsible: 'покупатель',
      status: 'ждёт подписи',
      blocksMoney: true,
      legalLevel: 'external_edo',
      externalStatus: 'нет полного внешнего закрытия',
      requiredForRelease: true,
    },
    {
      title: 'ЭТрН',
      source: 'СБИС / Saby ЭТрН',
      responsible: 'грузополучатель',
      status: 'не закрыта всеми сторонами',
      blocksMoney: true,
      legalLevel: 'external_edo',
      externalStatus: 'не считается завершённым транспортным ЭДО',
      requiredForRelease: true,
    },
    {
      title: 'СДИЗ',
      source: 'ФГИС «Зерно»',
      responsible: 'продавец',
      status: 'не подтверждён',
      blocksMoney: true,
      legalLevel: 'government',
      externalStatus: 'внутренний статус платформы не заменяет ФГИС',
      requiredForRelease: true,
    },
    {
      title: 'Акт приёмки',
      source: 'приёмка + Контур.Диадок',
      responsible: 'элеватор',
      status: 'готовится',
      blocksMoney: true,
      legalLevel: 'external_edo',
      externalStatus: 'нет финального акта приёмки',
      requiredForRelease: true,
    },
    {
      title: 'Протокол качества',
      source: 'ФГБУ ЦОК АПК',
      responsible: 'лаборатория',
      status: 'ожидается',
      blocksMoney: true,
      legalLevel: 'external_edo',
      externalStatus: 'нет внешнего протокола качества',
      requiredForRelease: true,
    },
    {
      title: 'Банковское основание выпуска',
      source: 'Сбер · Безопасные сделки',
      responsible: 'банк + оператор по регламенту',
      status: 'боевое событие не получено',
      blocksMoney: true,
      legalLevel: 'bank',
      externalStatus: 'нет подтверждённого банкового события',
      requiredForRelease: true,
    },
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
  nextAction: 'закрыть отклонение веса, акт удержания и банковское основание частичного выпуска',
  money: [
    { title: 'Сумма сделки', value: '6,24 млн ₽', note: 'резерв подтверждён в сценарии', state: 'ok' },
    { title: 'Удержание', value: '624 тыс. ₽', note: 'спор по весу', state: 'stop' },
    { title: 'К выплате сейчас', value: '5,616 млн ₽', note: 'только при банковом основании частичного выпуска', state: 'manual' },
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

export function getDeal360ProviderReadinessSummary(scenario: Deal360Scenario): Record<Deal360Readiness, number> {
  return scenario.providerGates.reduce<Record<Deal360Readiness, number>>(
    (acc, gate) => {
      acc[gate.readiness] += 1;
      return acc;
    },
    { demo: 0, sandbox: 0, test: 0, prelive: 0, live: 0 },
  );
}

export function getBlockedIrreversibleActions(scenario: Deal360Scenario): string[] {
  const providerStops = scenario.providerGates
    .filter((gate) => gate.blocksIrreversibleAction)
    .map((gate) => `${gate.provider}: ${gate.impact}`);

  const documentStops = scenario.documents
    .filter((doc) => doc.requiredForRelease && doc.blocksMoney)
    .map((doc) => `${doc.title}: ${doc.status}`);

  return [...providerStops, ...documentStops];
}

export function canShowProviderAsLive(gate: Deal360ProviderGate): boolean {
  const lower = `${gate.status} ${gate.evidence}`.toLowerCase();
  const hasNonLiveMarker = ['демо', 'песочниц', 'тестов', 'предбоев', 'предынтеграц', 'симуляц'].some((marker) => lower.includes(marker));
  return gate.readiness === 'live' && gate.state === 'ok' && !hasNonLiveMarker;
}
