import { describe, expect, it } from 'vitest';
import {
  selectDealLogisticsTripPlan,
  selectDealTransportDocumentPack,
} from '@/lib/platform-v7/deal-execution-source-of-truth';

describe('logistics-n-trips', () => {
  it('supports one logistics request with N machines and N trips for DL-9106', () => {
    const plan = selectDealLogisticsTripPlan('DL-9106');

    expect(plan.logisticsOrderId).toBe('LOG-REQ-2403');
    expect(plan.vehicleCount).toBeGreaterThan(1);
    expect(plan.tripIds).toEqual(['TRIP-SIM-001', 'TRIP-SIM-002', 'TRIP-SIM-003']);
    expect(plan.declaredTons).toBe(600);
    expect(plan.plannedTons).toBe(600);
    expect(plan.isCompletePlan).toBe(true);
    expect(plan.trips.every((trip) => trip.plannedLoadTons === 200)).toBe(true);
  });

  it('keeps the shared transport package visible for all trips', () => {
    const plan = selectDealLogisticsTripPlan('DL-9106');
    const pack = selectDealTransportDocumentPack('DL-9106');

    expect(pack?.etrnId).toBe('ETRN-DL-9106-001');
    expect(plan.epdPackage?.etrnId).toBe(pack?.etrnId);
    expect(plan.trips.every((trip) => trip.epdTitleId === 'ETRN-DL-9106-001-T3')).toBe(true);
    expect(pack?.gisEpdTransferStatus).toBe('ожидает закрытия ЭТрН');
    expect(pack?.manualCheckStatus).toBe('ручная проверка');
  });
});
