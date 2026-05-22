import { serverApiUrl, serverAuthHeaders } from './server-api';

export type ShipmentServerItem = {
  id: string;
  dealId: string;
  status: string;
  driverUserId?: string;
  driverName?: string;
  vehicleNumber?: string;
  carrierName?: string;
  routeFrom?: string;
  routeTo?: string;
  etaHours?: number;
  loadedTons?: number;
  pinVerified?: boolean;
  checkpoints?: Array<{ id: string; type: string; completedAt: string; lat?: number; lng?: number }>;
  handoff?: { receiving: boolean; lab: boolean };
  blockers?: string[];
  nextAction?: string;
  createdAt: string;
};

const STATIC_FALLBACK: ShipmentServerItem[] = [
  {
    id: 'SHIP-001',
    dealId: 'DEAL-001',
    status: 'IN_TRANSIT',
    driverUserId: 'user-driver-1',
    driverName: 'Иванов Петр',
    vehicleNumber: 'А123ВС68',
    carrierName: 'ТамбовЛогистик',
    routeFrom: 'Тамбов',
    routeTo: 'Воронеж',
    etaHours: 4,
    loadedTons: 500,
    pinVerified: false,
    checkpoints: [
      { id: 'CP-001', type: 'LOADING', completedAt: '2026-03-28T08:00:00Z', lat: 52.72, lng: 41.45 },
    ],
    handoff: { receiving: false, lab: false },
    blockers: ['ПИН водителя не подтверждён'],
    nextAction: 'Подтвердить прибытие',
    createdAt: '2026-03-28T06:00:00Z',
  },
  {
    id: 'SHIP-002',
    dealId: 'DEAL-002',
    status: 'AT_UNLOADING',
    driverUserId: 'user-driver-2',
    driverName: 'Петров Сергей',
    vehicleNumber: 'В456КМ23',
    carrierName: 'ЦЧР АгроТранс',
    routeFrom: 'Краснодар',
    routeTo: 'Ростов-на-Дону',
    etaHours: 0,
    loadedTons: 750,
    pinVerified: true,
    checkpoints: [],
    handoff: { receiving: true, lab: true },
    blockers: [],
    nextAction: 'Открыть приёмку',
    createdAt: '2026-04-01T06:00:00Z',
  },
];

export async function getShipments(): Promise<ShipmentServerItem[]> {
  try {
    const res = await fetch(serverApiUrl('/logistics/shipments'), {
      cache: 'no-store',
      headers: serverAuthHeaders(),
    });
    if (!res.ok) throw new Error(`shipments ${res.status}`);
    const data = await res.json();
    return Array.isArray(data) ? data : STATIC_FALLBACK;
  } catch {
    return STATIC_FALLBACK;
  }
}

export async function getShipment(id: string): Promise<ShipmentServerItem | null> {
  try {
    const res = await fetch(serverApiUrl(`/logistics/shipments/${id}`), {
      cache: 'no-store',
      headers: serverAuthHeaders(),
    });
    if (!res.ok) throw new Error(`shipment ${id} ${res.status}`);
    return res.json();
  } catch {
    return STATIC_FALLBACK.find((s) => s.id === id) ?? null;
  }
}

export async function getShipmentWorkspace(id: string) {
  try {
    const res = await fetch(serverApiUrl(`/logistics/shipments/${id}/workspace`), {
      cache: 'no-store',
      headers: serverAuthHeaders(),
    });
    if (!res.ok) throw new Error(`shipment workspace ${id} ${res.status}`);
    return res.json();
  } catch {
    const shipment = STATIC_FALLBACK.find((s) => s.id === id);
    return shipment ? { shipment, blockers: shipment.blockers ?? [], nextAction: shipment.nextAction } : null;
  }
}

export function activeShipmentCount(shipments: ShipmentServerItem[]): number {
  return shipments.filter((s) => ['IN_TRANSIT', 'AT_UNLOADING', 'PENDING'].includes(s.status)).length;
}

export function shipmentsWithBlockers(shipments: ShipmentServerItem[]): ShipmentServerItem[] {
  return shipments.filter((s) => (s.blockers?.length ?? 0) > 0);
}
