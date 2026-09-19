export type DealSpineView = {
  dealId: string;
  title: string;
  status: string;
  culture?: string;
  volume?: number;
  sections: Array<{ key: string; title: string; owner: string; status: string; summary: string; href: string }>;
  evidence: Array<{ id: string; label: string; value: string; tone: string }>;
  nextStep: string;
  blockers: string[];
  primaryCtaHref: string;
  primaryCtaLabel: string;
};

export type RoleCurrentFocus = {
  roleId: string;
  title: string;
  detail: string;
  chips: string[];
  nextStep: string;
  href: string;
  primaryHref: string;
  primaryLabel: string;
};

export async function getIndustrializationData() {
  return {
    trustGraph: {
      buyers: [
        { id: 'buyer-1', name: 'Buyer One', admission: 'GREEN', trusted: true },
        { id: 'buyer-2', name: 'Buyer Two', admission: 'YELLOW', trusted: false },
      ],
    },
    liquidity: {
      targetOrders: [
        { id: 'to-1', title: 'Target order · wheat', culture: 'WHEAT', status: 'open', detail: 'Нужен controlled routing в private buyer network.' },
      ],
      recommendations: [
        { id: 'rec-1', title: 'Перевести лот в private mode', mode: 'private', detail: 'Слабая открытая ликвидность, лучше private buyer route.' },
      ],
      rescueFlows: [
        { id: 'rf-1', title: 'Rescue flow for slow lot', status: 'active', pain: 'Недостаточно ставок в open mode.' },
      ],
      strongestBuyers: [
        { id: 'b-1', name: 'Buyer One', score: 92, detail: 'Быстрые деньги и высокий trust.' },
      ],
    },
  };
}
