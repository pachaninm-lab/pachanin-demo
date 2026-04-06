export type TradingOriginMode = 'OPEN_AUCTION' | 'PRIVATE_AUCTION' | 'INSTANT_OFFER' | 'TARGET_ORDER' | 'OPERATOR_MANAGED_SALE';

export type TradingOriginConfig = {
  mode: TradingOriginMode;
  reservePriceRubPerTon?: number | null;
  minimumStepRubPerTon?: number | null;
  autoExtendMinutes?: number | null;
  antiSnipingWindowMinutes?: number | null;
  targetPriceRubPerTon?: number | null;
  quantitySplitAllowed?: boolean;
  invitedBuyerOrgIds?: string[];
  operatorAssist?: boolean;
  publishedByOperator?: boolean;
  recommendedStartPriceRubPerTon?: number | null;
  modeReason?: string | null;
};

const DEFAULT_CONFIG: TradingOriginConfig = {
  mode: 'OPEN_AUCTION',
  reservePriceRubPerTon: null,
  minimumStepRubPerTon: 100,
  autoExtendMinutes: 10,
  antiSnipingWindowMinutes: 5,
  targetPriceRubPerTon: null,
  quantitySplitAllowed: false,
  invitedBuyerOrgIds: [],
  operatorAssist: false,
  publishedByOperator: false,
  recommendedStartPriceRubPerTon: null,
  modeReason: null
};

export function getTradingOriginModes() {
  return [
    {
      id: 'OPEN_AUCTION',
      title: 'Открытый аукцион',
      description: 'Публичные торги для всех допущенных покупателей. Даёт лучшее рыночное price discovery.',
      bestFor: ['ликвидный массовый объём', 'понятный базис', 'нужна живая конкуренция'],
      nextStep: 'Запустить короткое окно торгов и перевести победителя в deal rail.'
    },
    {
      id: 'PRIVATE_AUCTION',
      title: 'Приватный аукцион',
      description: 'Торги только для белого списка покупателей. Подходит для чувствительных объёмов и private demand.',
      bestFor: ['крупный buyer list', 'нельзя шуметь рынку', 'нужен controlled award'],
      nextStep: 'Пригласить whitelist buyers и контролировать award внутри карточки.'
    },
    {
      id: 'INSTANT_OFFER',
      title: 'Продать сразу',
      description: 'Фиксированная цена без долгих торгов. Нужна, когда скорость важнее аукционной глубины.',
      bestFor: ['быстрый кэш', 'известный buyer', 'нет смысла ждать стакан'],
      nextStep: 'Подтвердить оффер и сразу создать deal passport.'
    },
    {
      id: 'TARGET_ORDER',
      title: 'Целевая цена',
      description: 'Фермер задаёт уровень цены и дедлайн. Система ждёт достижение цели и помогает конвертировать её в сделку.',
      bestFor: ['не хочется сидеть в торгах', 'есть минимально приемлемая цена', 'нужен алерт по срабатыванию'],
      nextStep: 'Следить за target trigger и открывать negotiation только при достижении цели.'
    },
    {
      id: 'OPERATOR_MANAGED_SALE',
      title: 'Продать через оператора',
      description: 'Оператор сам доупаковывает лот, выбирает режим и доводит до award и execution.',
      bestFor: ['новый фермер', 'слабый digital profile', 'сложная партия'],
      nextStep: 'Назначить owner, повысить readiness и запустить private/open flow без потери контроля.'
    }
  ] as const;
}

function toNumber(value: any, fallback: number | null = null) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function uniqueStrings(values: any[] = []) {
  return Array.from(new Set(values.map((value) => String(value || '').trim()).filter(Boolean)));
}

export function normalizeTradingOriginConfig(qualityJson?: any): TradingOriginConfig {
  const trading = qualityJson?.trading || qualityJson?.auction || {};
  const mode = String(trading.mode || trading.originType || 'OPEN_AUCTION').trim().toUpperCase() as TradingOriginMode;
  return {
    mode: (getTradingOriginModes().some((item) => item.id === mode) ? mode : DEFAULT_CONFIG.mode) as TradingOriginMode,
    reservePriceRubPerTon: toNumber(trading.reservePriceRubPerTon ?? trading.reservePrice ?? trading.floorPrice, null),
    minimumStepRubPerTon: toNumber(trading.minimumStepRubPerTon ?? trading.minimumStep ?? trading.stepPrice, DEFAULT_CONFIG.minimumStepRubPerTon),
    autoExtendMinutes: toNumber(trading.autoExtendMinutes ?? trading.autoExtend, DEFAULT_CONFIG.autoExtendMinutes),
    antiSnipingWindowMinutes: toNumber(trading.antiSnipingWindowMinutes ?? trading.antiSnipingWindow, DEFAULT_CONFIG.antiSnipingWindowMinutes),
    targetPriceRubPerTon: toNumber(trading.targetPriceRubPerTon ?? trading.targetPrice, null),
    quantitySplitAllowed: Boolean(trading.quantitySplitAllowed ?? trading.splitAllowed ?? false),
    invitedBuyerOrgIds: uniqueStrings(trading.invitedBuyerOrgIds || trading.whitelistBuyerOrgIds || trading.invites || []),
    operatorAssist: Boolean(trading.operatorAssist ?? trading.assisted ?? false),
    publishedByOperator: Boolean(trading.publishedByOperator ?? false),
    recommendedStartPriceRubPerTon: toNumber(trading.recommendedStartPriceRubPerTon ?? trading.recommendedPrice, null),
    modeReason: trading.modeReason ? String(trading.modeReason) : null
  };
}

export function mergeTradingOriginConfig(qualityJson: any, patch: Partial<TradingOriginConfig>) {
  const existing = normalizeTradingOriginConfig(qualityJson);
  return {
    ...(qualityJson || {}),
    trading: {
      ...existing,
      ...patch,
      invitedBuyerOrgIds: patch.invitedBuyerOrgIds ? uniqueStrings(patch.invitedBuyerOrgIds) : existing.invitedBuyerOrgIds,
      mode: String(patch.mode || existing.mode).trim().toUpperCase()
    }
  };
}

export function buildAuctionReadiness(input: { lot: any; bids?: any[]; deal?: any | null }) {
  const lot = input.lot || {};
  const bids = input.bids || [];
  const deal = input.deal || null;
  const config = normalizeTradingOriginConfig(lot.qualityJson);
  const startPrice = toNumber(lot.startPrice, 0) || 0;
  const volumeTons = toNumber(lot.volumeTons, 0) || 0;
  const bestBid = bids.slice().sort((a, b) => Number(b.amount || b.pricePerTon || 0) - Number(a.amount || a.pricePerTon || 0))[0] || null;
  const requiredFields = [lot.title, lot.culture, lot.region, lot.address];
  const qualityKeys = ['basis', 'paymentTerms', 'moisture', 'protein', 'gluten'];
  const filledQuality = qualityKeys.filter((key) => lot.qualityJson?.[key] != null && lot.qualityJson?.[key] !== '').length;
  const docsCount = Array.isArray(lot.qualityJson?.docs) ? lot.qualityJson.docs.length : 0;
  const readySignals = [
    requiredFields.filter(Boolean).length === requiredFields.length,
    startPrice > 0,
    volumeTons > 0,
    filledQuality >= 2,
    config.mode !== 'PRIVATE_AUCTION' || (config.invitedBuyerOrgIds || []).length > 0,
    config.mode !== 'TARGET_ORDER' || Number(config.targetPriceRubPerTon || 0) > 0,
    config.mode !== 'INSTANT_OFFER' || Number(config.reservePriceRubPerTon || startPrice) > 0,
    docsCount > 0 || Boolean(lot.qualityJson?.qualityPassport)
  ];
  const score = Math.min(100, readySignals.reduce((sum, signal) => sum + (signal ? 12 : 0), 4));
  const band = score >= 84 ? 'GREEN' : score >= 64 ? 'AMBER' : 'RED';
  const blockers = [
    requiredFields.filter(Boolean).length !== requiredFields.length ? 'Не заполнены обязательные поля лота.' : null,
    !startPrice ? 'Не задана стартовая цена.' : null,
    !volumeTons ? 'Не указан объём партии.' : null,
    config.mode === 'PRIVATE_AUCTION' && !(config.invitedBuyerOrgIds || []).length ? 'Для private auction нужен whitelist покупателей.' : null,
    config.mode === 'TARGET_ORDER' && !config.targetPriceRubPerTon ? 'Для target order нужна целевая цена.' : null,
    config.mode === 'INSTANT_OFFER' && !(config.reservePriceRubPerTon || startPrice) ? 'Для instant offer нужна фиксированная цена.' : null,
    docsCount === 0 ? 'Нет хотя бы одного документа или photo/evidence в профиле лота.' : null
  ].filter(Boolean) as string[];

  const recommendedMode: TradingOriginMode =
    config.operatorAssist ? 'OPERATOR_MANAGED_SALE' :
    deal ? config.mode :
    (config.invitedBuyerOrgIds || []).length >= 2 ? 'PRIVATE_AUCTION' :
    score < 60 ? 'OPERATOR_MANAGED_SALE' :
    volumeTons > 1500 ? 'PRIVATE_AUCTION' :
    'OPEN_AUCTION';

  const nextAction = deal
    ? 'Торговый origin уже конвертирован в execution rail. Дальше нужен только deal passport и milestones.'
    : bestBid
      ? 'Есть живая ставка. Проверь reserve, admission и переведи победителя в deal passport.'
      : config.mode === 'TARGET_ORDER'
        ? 'Следить за target price и запускать managed negotiation при достижении цели.'
        : config.mode === 'INSTANT_OFFER'
          ? 'Подтвердить instant offer и сразу создать deal passport без лишней торговой трения.'
          : 'Сначала допаковать readiness и только потом запускать live окно торгов.';

  return {
    score,
    band,
    blockers,
    readyForLive: blockers.length === 0,
    recommendedMode,
    config,
    bestBid: bestBid ? Number(bestBid.amount || bestBid.pricePerTon || 0) : null,
    nextAction
  };
}

export function buildAuctionWorkspace(input: { lot: any; bids?: any[]; deal?: any | null }) {
  const lot = input.lot || {};
  const bids = input.bids || [];
  const deal = input.deal || null;
  const config = normalizeTradingOriginConfig(lot.qualityJson);
  const readiness = buildAuctionReadiness({ lot, bids, deal });
  const bestBid = bids.slice().sort((a, b) => Number(b.amount || b.pricePerTon || 0) - Number(a.amount || a.pricePerTon || 0))[0] || null;
  const msToEnd = new Date(lot.auctionEndsAt || Date.now()).getTime() - Date.now();
  const minutesToEnd = Math.round(msToEnd / 60000);
  const shouldAutoExtend = minutesToEnd <= Number(config.antiSnipingWindowMinutes || 0);
  const originMode = getTradingOriginModes().find((item) => item.id === config.mode) || getTradingOriginModes()[0];

  return {
    lotId: lot.id,
    title: lot.title,
    lotStatus: lot.status,
    originMode,
    config,
    readiness,
    timer: {
      auctionEndsAt: lot.auctionEndsAt,
      minutesToEnd,
      shouldAutoExtend,
      autoExtendMinutes: config.autoExtendMinutes || 0
    },
    bestBid: bestBid ? {
      id: bestBid.id,
      amount: Number(bestBid.amount || bestBid.pricePerTon || 0),
      buyerName: bestBid.buyerUser?.org?.legalName || bestBid.buyerName || bestBid.buyerUser?.email || 'Покупатель',
      buyerOrgId: bestBid.buyerUser?.orgId || bestBid.buyerOrgId || null,
      status: bestBid.status
    } : null,
    bidCount: bids.length,
    allowedModes: getTradingOriginModes(),
    nextAction: readiness.nextAction,
    executionBridge: {
      dealCreated: Boolean(deal),
      dealId: deal?.id || null,
      nextRequiredMilestones: deal ? ['docs checklist', 'transport handoff', 'money readiness', 'evidence timeline'] : ['award', 'winner admission', 'deal passport']
    }
  };
}

export function buildUniversalDealSummary(input: { deal?: any; lot?: any; bid?: any | null }) {
  const deal = input.deal || {};
  const lot = input.lot || {};
  const bid = input.bid || null;
  const config = normalizeTradingOriginConfig(lot.qualityJson);
  return {
    originType: config.mode,
    originId: lot.id || deal.lotId || null,
    originLabel: getTradingOriginModes().find((item) => item.id === config.mode)?.title || config.mode,
    reservePriceRubPerTon: config.reservePriceRubPerTon,
    targetPriceRubPerTon: config.targetPriceRubPerTon,
    awardPriceRubPerTon: bid ? Number(bid.amount || bid.pricePerTon || 0) : Number(deal.price || 0),
    admissionMode: config.mode === 'PRIVATE_AUCTION' ? 'WHITELIST' : 'OPEN',
    executionRule: 'Любой trading origin обязан конвертироваться в один execution rail.',
    passports: {
      commercial: { title: lot.title || null, culture: lot.culture || null, volumeTons: Number(lot.volumeTons || deal.volumeTons || 0), basis: lot.qualityJson?.basis || null },
      quality: { grade: lot.grade || lot.qualityJson?.grade || null, profilePresent: Boolean(lot.qualityJson) },
      transport: { address: lot.address || null, operatorAssist: Boolean(config.operatorAssist) },
      docs: { docsDeclared: Array.isArray(lot.qualityJson?.docs) ? lot.qualityJson.docs.length : 0 },
      settlement: { paymentTerms: lot.qualityJson?.paymentTerms || deal.paymentTerms?.paymentTerms || null },
      dispute: { ready: true },
      trust: { whitelistBuyers: (config.invitedBuyerOrgIds || []).length }
    }
  };
}
