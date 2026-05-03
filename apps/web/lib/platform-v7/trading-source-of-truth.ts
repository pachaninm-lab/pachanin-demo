export const PLATFORM_V7_TRADING_SOURCE = {
  lot: {
    id: 'LOT-2403',
    fgisPartyId: 'ФГИС-68-2403-001',
    crop: 'Пшеница 4 класса',
    harvestYear: '2025',
    totalVolumeTons: 1200,
    availableVolumeTons: 1050,
    minVolumeTons: 300,
    basis: 'Тамбовская область · элеватор',
    seller: 'КФХ «Северное поле»',
    sellerPriceRubPerTon: 15900,
    shipmentWindow: '7–14 дней',
    paymentCondition: 'резерв денег до приёмки',
    status: 'Допущен к ставкам',
  },
  acceptedOffer: {
    buyerAlias: 'Покупатель 1',
    buyerRating: 'A-',
    priceRubPerTon: 16080,
    volumeTons: 600,
    basis: 'самовывоз с элеватора',
    removalTerm: '10 дней',
    paymentReadiness: 'готов к резерву',
    risk: 'низкий',
  },
  offers: [
    { buyerAlias: 'Покупатель 1', buyerRating: 'A-', priceRubPerTon: 16080, volumeTons: 600, basis: 'самовывоз с элеватора', removalTerm: '10 дней', paymentReadiness: 'готов к резерву', risk: 'низкий', status: 'Лучшая ставка' },
    { buyerAlias: 'Покупатель 2', buyerRating: 'B+', priceRubPerTon: 15970, volumeTons: 1000, basis: 'доставка продавца', removalTerm: '14 дней', paymentReadiness: 'нужна проверка', risk: 'средний', status: 'Активна' },
    { buyerAlias: 'Покупатель 3', buyerRating: 'A', priceRubPerTon: 15850, volumeTons: 500, basis: 'самовывоз с элеватора', removalTerm: '7 дней', paymentReadiness: 'готов к резерву', risk: 'низкий', status: 'Активна' },
  ],
} as const;

export function rubPerTon(value: number): string {
  return `${new Intl.NumberFormat('ru-RU').format(value)} ₽/т`;
}

export function tons(value: number): string {
  return `${new Intl.NumberFormat('ru-RU').format(value)} т`;
}

export function tradingSummary() {
  const { lot, offers, acceptedOffer } = PLATFORM_V7_TRADING_SOURCE;
  return {
    lotId: lot.id,
    fgisPartyId: lot.fgisPartyId,
    offersCount: offers.length,
    bestPrice: Math.max(...offers.map((offer) => offer.priceRubPerTon)),
    acceptedPrice: acceptedOffer.priceRubPerTon,
    acceptedVolume: acceptedOffer.volumeTons,
    availableVolume: lot.availableVolumeTons,
    sellerPrice: lot.sellerPriceRubPerTon,
  };
}
