/**
 * Живые агрегаты по списку сделок из /api/proxy/deals (getDealsCanonical).
 *
 * Список отдаёт по каждой сделке: status, totalKopecks (bigint как строка),
 * последний payment {status, amountKopecks} и shipments {status}. Считаем из
 * этого честные сводные числа для кокпитов кабинета — без мок-констант.
 */

type PaymentLike = { status?: string | null; amountKopecks?: string | number | null };
type ShipmentLike = { status?: string | null };
type DealLike = {
  status?: string | null;
  totalKopecks?: string | number | null;
  payments?: PaymentLike[] | null;
  shipments?: ShipmentLike[] | null;
};

const IN_TRANSIT_SHIPMENT = new Set(['DRIVER_ASSIGNED', 'LOADED', 'IN_TRANSIT', 'ARRIVED']);

function kopecks(value: unknown): number {
  const n = typeof value === 'string' ? Number(value) : typeof value === 'number' ? value : 0;
  return Number.isFinite(n) ? n : 0;
}

export interface DealsSummary {
  count: number;
  active: number;
  closed: number;
  reservedKopecks: number;
  releasedKopecks: number;
  totalKopecks: number;
  inTransit: number;
}

export function summarizeDeals(input: unknown): DealsSummary {
  const deals = Array.isArray(input) ? (input as DealLike[]) : [];
  let reserved = 0;
  let released = 0;
  let total = 0;
  let inTransit = 0;
  let closed = 0;

  for (const deal of deals) {
    total += kopecks(deal?.totalKopecks);
    const payment = Array.isArray(deal?.payments) ? deal?.payments?.[0] : undefined;
    if (payment?.status === 'RESERVED') reserved += kopecks(payment.amountKopecks);
    if (payment?.status === 'RELEASED') released += kopecks(payment.amountKopecks);
    const shipment = Array.isArray(deal?.shipments) ? deal?.shipments?.[0] : undefined;
    if (shipment?.status && IN_TRANSIT_SHIPMENT.has(shipment.status)) inTransit += 1;
    if (deal?.status === 'CLOSED') closed += 1;
  }

  return {
    count: deals.length,
    active: deals.length - closed,
    closed,
    reservedKopecks: reserved,
    releasedKopecks: released,
    totalKopecks: total,
    inTransit,
  };
}

/** Компактный формат рублей из копеек для сводок кабинета. */
export function formatRubFromKopecks(value: number): string {
  const rub = value / 100;
  if (Math.abs(rub) >= 1_000_000) return `${(rub / 1_000_000).toFixed(2)} млн ₽`;
  if (Math.abs(rub) >= 1_000) return `${(rub / 1_000).toFixed(0)} тыс. ₽`;
  return `${rub.toFixed(0)} ₽`;
}

/** Строка живой сводки для LiveApiStatusBar/кокпита. */
export function dealsSummaryLine(summary: DealsSummary): string {
  return [
    `${summary.count} сделок`,
    `${summary.active} активных`,
    `резерв ${formatRubFromKopecks(summary.reservedKopecks)}`,
    `выплачено ${formatRubFromKopecks(summary.releasedKopecks)}`,
  ].join(' · ');
}
