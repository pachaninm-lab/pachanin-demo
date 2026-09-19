export type DisclosureStage = 'DISCOVERY' | 'QUALIFIED_INTENT' | 'DEAL_FORMATION' | 'EXECUTION';

type LotLike = {
  id: string;
  seller?: string;
  sellerRating?: number;
  status?: string;
  address?: string;
  region?: string;
  paymentTerms?: string;
  deliveryWindow?: string;
  culture?: string;
  volume?: number;
  price?: number;
  bids?: Array<{ trust?: number; buyerName?: string; amount?: number; price?: number; status?: string }>;
};

function trustBand(score?: number) {
  const value = Number(score || 0);
  if (value >= 90) return 'Tier A';
  if (value >= 80) return 'Tier B';
  if (value >= 70) return 'Tier C';
  return 'Tier Review';
}

function statusStage(status?: string, hasBids?: boolean, hasRelatedDeal?: boolean): DisclosureStage {
  if (String(status || '').toUpperCase().includes('CLOSED')) return 'EXECUTION';
  if (hasRelatedDeal) return 'DEAL_FORMATION';
  if (hasBids || ['MATCHED', 'AUCTION_ACTIVE', 'ACTIVE', 'PUBLISHED'].includes(String(status || '').toUpperCase())) return 'QUALIFIED_INTENT';
  return 'DISCOVERY';
}

function stageLabel(stage: DisclosureStage) {
  return {
    DISCOVERY: 'Discovery',
    QUALIFIED_INTENT: 'Qualified intent',
    DEAL_FORMATION: 'Deal formation',
    EXECUTION: 'Execution',
  }[stage];
}

function maskAddress(address?: string, region?: string) {
  if (!address) return region || 'Точный адрес откроется после входа в сделку';
  const parts = String(address).split(',').map((item) => item.trim()).filter(Boolean);
  if (parts.length <= 2) return region || parts[0] || 'Адрес откроется после входа в сделку';
  return `${parts[0]}, ${parts[1]} · точка погрузки скрыта до входа в rail`;
}

function maskCompany(kind: 'seller' | 'buyer', score?: number, index?: number) {
  const band = trustBand(score);
  const suffix = typeof index === 'number' ? ` #${index + 1}` : '';
  return `${kind === 'seller' ? 'Верифицированный продавец' : 'Допущенный buyer'} ${band}${suffix}`;
}

export function buildLotDisclosureProfile(input: { lot: LotLike; hasRelatedDeal?: boolean }) {
  const { lot, hasRelatedDeal = false } = input;
  const bids = Array.isArray(lot.bids) ? lot.bids : [];
  const stage = statusStage(lot.status, bids.length > 0, hasRelatedDeal);
  const paymentLane = stage === 'DISCOVERY' ? 'offer / auction' : stage === 'QUALIFIED_INTENT' ? 'buyer selection / reserve prep' : stage === 'DEAL_FORMATION' ? 'deal / docs / reserve' : 'execution / receiving / settlement';

  const visibleNow = [
    lot.culture ? `Культура: ${lot.culture}` : 'Культура и параметры партии',
    lot.volume ? `Объём: ${lot.volume} т` : 'Объём партии',
    lot.price ? `Ориентир цены: ${lot.price}` : 'Ценовой ориентир / netback readiness',
    lot.deliveryWindow ? `Окно: ${lot.deliveryWindow}` : 'Окно поставки',
    `Trust tier: ${trustBand(lot.sellerRating)}`,
  ];

  const hiddenNow = [
    'Прямые контакты и точное ФИО ЛПР',
    'Точная точка погрузки до rail-lock',
    'Полный документный пакет до qualified intent',
    'Bank/payment routing до deal formation',
  ];

  const unlockRules = [
    'Контакты и полная точка исполнения раскрываются только после qualified intent или фиксации сделки.',
    'Договорный и банковский контур раскрывается после deal formation и прохождения gate policy.',
    'Во время execution платформа показывает только то, что нужно для исполнения, а не для обхода rail.',
  ];

  return {
    stage,
    stageLabel: stageLabel(stage),
    maskedSeller: maskCompany('seller', lot.sellerRating),
    maskedAddress: maskAddress(lot.address, lot.region),
    sellerTrustBand: trustBand(lot.sellerRating),
    paymentLane,
    visibleNow,
    hiddenNow,
    unlockRules,
    antiBypassNote: 'Раннее раскрытие контактов и точной точки исполнения создаёт bypass-риск. Платформа раскрывает чувствительные данные по мере входа в rail.',
  };
}

export function buildMaskedBidView(bids: Array<{ trust?: number; buyerName?: string; amount?: number; price?: number; status?: string }> = []) {
  return bids.map((bid, index) => ({
    id: `masked-bid-${index + 1}`,
    buyer: maskCompany('buyer', bid.trust, index),
    price: bid.price || bid.amount || null,
    trustBand: trustBand(bid.trust),
    status: bid.status || 'ACTIVE',
  }));
}

export function buildLotEntryRail(input: { lot: LotLike; bids?: Array<{ trust?: number; price?: number; amount?: number; status?: string }>; hasRelatedDeal?: boolean }) {
  const lot = input.lot;
  const bids = input.bids || lot.bids || [];
  const hasRelatedDeal = Boolean(input.hasRelatedDeal);

  const recommendedMode = hasRelatedDeal
    ? 'DEAL_ACCOUNT'
    : bids.length >= 4
      ? 'OPEN_AUCTION'
      : bids.length >= 1
        ? 'PRIVATE_AUCTION'
        : lot.price
          ? 'INSTANT_EXECUTION'
          : 'TARGET_ORDER';

  const rails = [
    { code: 'OPEN_AUCTION', title: 'Open auction', useCase: 'Когда нужен discovery цены и несколько покупателей.', recommended: recommendedMode === 'OPEN_AUCTION', fit: bids.length >= 3 },
    { code: 'PRIVATE_AUCTION', title: 'Private auction', useCase: 'Когда нужна shortlist-модель и ограниченный круг buyer.', recommended: recommendedMode === 'PRIVATE_AUCTION', fit: bids.length >= 1 && bids.length < 4 },
    { code: 'TARGET_ORDER', title: 'Target order', useCase: 'Когда нужно ждать целевую цену без постоянного участия.', recommended: recommendedMode === 'TARGET_ORDER', fit: !bids.length },
    { code: 'OPERATOR_ASSISTED', title: 'Operator-assisted', useCase: 'Когда рынок тонкий и нужен ручной orchestration.', recommended: (recommendedMode as string) === 'OPERATOR_ASSISTED', fit: true },
    { code: 'INSTANT_EXECUTION', title: 'Instant execution', useCase: 'Когда важнее скорость, чем price discovery.', recommended: recommendedMode === 'INSTANT_EXECUTION', fit: !!lot.price && !bids.length },
    { code: 'DEAL_ACCOUNT', title: 'Deal account', useCase: 'Когда лот уже перешёл в подтверждённую сделку.', recommended: recommendedMode === 'DEAL_ACCOUNT', fit: hasRelatedDeal },
  ];

  return {
    recommendedMode,
    reason: hasRelatedDeal
      ? 'Лот уже должен жить как часть сделки, а не как отдельный торговый объект.'
      : bids.length >= 4
        ? 'Достаточно рыночного отклика для открытого price discovery.'
        : bids.length >= 1
          ? 'Есть интерес, но рынок ещё не широкий — уместен закрытый rail.'
          : lot.price
            ? 'Есть понятный фиксированный оффер и можно идти в быстрый execution.'
            : 'Пока нужен режим ожидания цены или операторский поиск встречной стороны.',
    stageWarning: hasRelatedDeal ? 'После winner lock главным объектом должна быть сделка.' : 'Лот — это вход в rail, а не отдельный мир вне исполнения.',
    factualSignals: [
      bids.length ? `${bids.length} ставок` : 'нет ставок',
      lot.region || 'регион',
      lot.deliveryWindow || 'окно не уточнено',
      trustBand(lot.sellerRating),
    ],
    rails,
  };
}
