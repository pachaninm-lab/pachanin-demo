import { describe, expect, it } from 'vitest';
import { selectRuntimeDealById, selectRuntimeDealByLotId } from '@/lib/domain/selectors';
import {
  PLATFORM_V7_EXECUTION_SOURCE,
  selectDealExecutionCase,
} from '@/lib/platform-v7/deal-execution-source-of-truth';
import { getDeal360Scenario } from '@/lib/platform-v7/deal360-source-of-truth';

function normalizedGrain(crop: string, cropClass: string): string {
  return `${crop} ${cropClass}`.replace('класса', 'класс').trim();
}

describe('deal-data-consistency', () => {
  it('keeps DL-9106 on one deal / lot / trip / money spine across runtime fixtures and execution sources', () => {
    const executionCase = selectDealExecutionCase('DL-9106');
    expect(executionCase).toBeDefined();
    if (!executionCase) return;

    const runtimeDeal = selectRuntimeDealByLotId(executionCase.lotId);
    const scenario = getDeal360Scenario(executionCase.dealId);
    const tripId = executionCase.logistics.trips[0]?.tripId;

    expect(runtimeDeal?.id).toBe(executionCase.dealId);
    expect(runtimeDeal?.lotId).toBe(executionCase.lotId);
    expect(runtimeDeal?.grain).toBe(normalizedGrain(executionCase.commodity.crop, executionCase.commodity.class));
    expect(runtimeDeal?.quantity).toBe(executionCase.commodity.volumeDeclaredTons);
    expect(runtimeDeal?.pricePerTon).toBe(executionCase.price.pricePerTon);
    expect(runtimeDeal?.totalAmount).toBe(executionCase.price.grossGoodsAmount);
    expect(runtimeDeal?.reservedAmount).toBe(executionCase.price.reserveAmount);

    expect(PLATFORM_V7_EXECUTION_SOURCE.deal.id).toBe(executionCase.dealId);
    expect(PLATFORM_V7_EXECUTION_SOURCE.deal.lotId).toBe(executionCase.lotId);
    expect(PLATFORM_V7_EXECUTION_SOURCE.deal.crop).toBe(runtimeDeal?.grain);
    expect(PLATFORM_V7_EXECUTION_SOURCE.deal.volumeTons).toBe(executionCase.commodity.volumeDeclaredTons);
    expect(PLATFORM_V7_EXECUTION_SOURCE.money.reservedRub).toBe(executionCase.price.reserveAmount);
    expect(PLATFORM_V7_EXECUTION_SOURCE.logistics.orderId).toBe(executionCase.logistics.logisticsOrderId);
    expect(PLATFORM_V7_EXECUTION_SOURCE.logistics.tripId).toBe(tripId);

    expect(scenario.dealId).toBe(executionCase.dealId);
    expect(scenario.lotId).toBe(executionCase.lotId);
    expect(scenario.logisticsOrderId).toBe(executionCase.logistics.logisticsOrderId);
    expect(scenario.tripId).toBe(tripId);
  });

  it('keeps DL-9102 free from DL-9106 lot, logistics and trip identifiers', () => {
    const executionCase = selectDealExecutionCase('DL-9106');
    const runtimeDeal = selectRuntimeDealById('DL-9102');
    const scenario = getDeal360Scenario('DL-9102');
    expect(executionCase).toBeDefined();
    expect(runtimeDeal).toBeDefined();
    if (!executionCase || !runtimeDeal) return;

    const forbidden = [
      executionCase.dealId,
      executionCase.lotId,
      executionCase.logistics.logisticsOrderId,
      ...executionCase.logistics.trips.map((trip) => trip.tripId),
    ].filter((value): value is string => Boolean(value));

    const runtimePayload = JSON.stringify(runtimeDeal);
    const scenarioPayload = JSON.stringify({
      dealId: scenario.dealId,
      lotId: scenario.lotId,
      logisticsOrderId: scenario.logisticsOrderId,
      tripId: scenario.tripId,
      chain: scenario.chain,
      cockpit: scenario.cockpit,
    });

    for (const value of forbidden) {
      expect(runtimePayload).not.toContain(value);
      expect(scenarioPayload).not.toContain(value);
    }

    expect(runtimeDeal.lotId).toBe('LOT-2401');
    expect(runtimeDeal.routeId).toBe('ТМБ-14');
    expect(scenario.lotId).toBe('LOT-2401');
    expect(scenario.tripId).toBe('ТМБ-14');
  });
});
