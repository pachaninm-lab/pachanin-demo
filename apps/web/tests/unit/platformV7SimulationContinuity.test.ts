import { PLATFORM_V7_EXECUTION_SOURCE, executionSummary, expectedDealAmountRub } from '@/lib/platform-v7/deal-execution-source-of-truth';
import { PLATFORM_V7_TRADING_SOURCE, tradingSummary } from '@/lib/platform-v7/trading-source-of-truth';

describe('platform-v7 connected simulation continuity', () => {
  it('keeps auction, deal, logistics and driver simulation on one chain', () => {
    const trading = tradingSummary();
    const execution = executionSummary();

    expect(trading.lotId).toBe('LOT-2403');
    expect(execution.lotId).toBe(trading.lotId);
    expect(execution.dealId).toBe('DL-9106');
    expect(execution.logisticsOrderId).toBe('LOG-REQ-2403');
    expect(execution.tripId).toBe('TRIP-SIM-001');
    expect(PLATFORM_V7_EXECUTION_SOURCE.deal.buyerAlias).toBe(PLATFORM_V7_TRADING_SOURCE.acceptedOffer.buyerAlias);
    expect(PLATFORM_V7_EXECUTION_SOURCE.deal.priceRubPerTon).toBe(PLATFORM_V7_TRADING_SOURCE.acceptedOffer.priceRubPerTon);
    expect(PLATFORM_V7_EXECUTION_SOURCE.deal.volumeTons).toBe(PLATFORM_V7_TRADING_SOURCE.acceptedOffer.volumeTons);
    expect(PLATFORM_V7_EXECUTION_SOURCE.money.reservedRub).toBe(expectedDealAmountRub());
  });
});
