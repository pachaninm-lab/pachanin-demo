export const companyProfiles = [
  {
    id: 'cmp-farm-1',
    name: 'ООО ЗерноПоле',
    segment: 'farmer',
    region: 'Тамбовская область',
    verification: 'green',
    financeReadiness: 'green',
    paymentDiscipline: 'stable',
    lastSignal: 'готов к поставке пшеницы 3 кл.',
    value: 'высокий',
    focus: ['пшеница', 'ячмень'],
  },
  {
    id: 'cmp-buyer-1',
    name: 'АО Мукомол',
    segment: 'buyer',
    region: 'Липецкая область',
    verification: 'verified',
    financeReadiness: 'ready',
    paymentDiscipline: 'fast',
    lastSignal: 'нужен объём под июньские окна',
    value: 'стратегический',
    focus: ['пшеница', 'кукуруза'],
  },
  {
    id: 'cmp-log-1',
    name: 'ТрансЛог Агро',
    segment: 'logistics',
    region: 'Воронежская область',
    verification: 'green',
    financeReadiness: 'manual',
    paymentDiscipline: 'stable',
    lastSignal: 'свободные машины на короткое плечо',
    value: 'средний',
    focus: ['логистика'],
  }
];

export const carrierMarketplaceOffers = [
  {
    id: 'car-offer-1',
    provider: 'ТрансЛог Агро',
    carrierName: 'ТрансЛог Агро',
    route: 'Тамбов → Липецк',
    priceRub: 18200,
    etaHours: 6,
    eta: '6ч',
    reliability: 'green' as const,
    truckNumber: 'А123ВС77',
    pickupWindow: '08:00–10:00',
    offerRate: 18200,
    rating: 4.8,
    fleetTag: 'Зерновоз',
  },
  {
    id: 'car-offer-2',
    provider: 'Регион Карго',
    carrierName: 'Регион Карго',
    route: 'Тамбов → Воронеж',
    priceRub: 19500,
    etaHours: 8,
    eta: '8ч',
    reliability: 'amber' as const,
    truckNumber: 'В456ЕК61',
    pickupWindow: '10:00–12:00',
    offerRate: 19500,
    rating: 4.2,
    fleetTag: 'Зерновоз',
  }
];

export const purchaseRequestPresets = [
  {
    id: 'rfq-001',
    title: 'Пшеница 3 кл.',
    volumeTons: 500,
    basis: 'EXW Тамбов',
    buyerName: 'АО Мукомол'
  },
  {
    id: 'rfq-002',
    title: 'Подсолнечник',
    volumeTons: 220,
    basis: 'FCA элеватор',
    buyerName: 'МаслоТрейд'
  }
] as const;
