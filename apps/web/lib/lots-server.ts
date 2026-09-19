type LotSeed = {
  id: string;
  title: string;
  culture: string;
  volumeTons: number;
  basis: string;
  status: string;
  targetPriceRub: number;
};

const LOTS: LotSeed[] = [
  {
    id: 'lot-001',
    title: 'Пшеница 3 кл. · Тамбов',
    culture: 'Пшеница 3 кл.',
    volumeTons: 480,
    basis: 'EXW Тамбов',
    status: 'PUBLISHED',
    targetPriceRub: 16300,
  },
  {
    id: 'lot-002',
    title: 'Подсолнечник · Липецк',
    culture: 'Подсолнечник',
    volumeTons: 220,
    basis: 'FCA элеватор',
    status: 'AUCTION',
    targetPriceRub: 25200,
  },
  {
    id: 'lot-003',
    title: 'Ячмень фуражный · Воронеж',
    culture: 'Ячмень',
    volumeTons: 360,
    basis: 'EXW Воронеж',
    status: 'DRAFT',
    targetPriceRub: 14100,
  },
];

export function getLotSeeds() {
  return LOTS;
}

export async function getLotReports(source?: Array<any>) {
  const base = Array.isArray(source) && source.length
    ? source.map((item, index) => ({
        id: item.id || `seed-${index + 1}`,
        title: item.title || item.name || `Lot ${index + 1}`,
        culture: item.culture || item.product || 'Зерновая культура',
        volumeTons: Number(item.volumeTons || item.volume || 0),
        basis: item.basis || 'EXW',
        status: String(item.status || 'DRAFT'),
        targetPriceRub: Number(item.targetPriceRub || item.priceRub || 0),
      }))
    : LOTS;

  return base.map((item) => ({
    ...item,
    statusLabel: item.status,
    href: `/lots/${item.id}`,
    shortMeta: `${item.culture} · ${item.volumeTons} т · ${item.basis}`,
  }));
}
