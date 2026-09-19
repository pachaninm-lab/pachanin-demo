import { describe, expect, it } from 'vitest';
import { logisticsIncidentAdjustment, logisticsIncidentBlockers } from '@/lib/platform-v7/grain-execution/automation/logistics-incident-engine';
import { calculateMoneyProjection } from '@/lib/platform-v7/grain-execution/automation/money-release-engine';
import { money } from '@/lib/platform-v7/grain-execution/format';
import type { LogisticsIncident } from '@/lib/platform-v7/grain-execution/types';

const createdAt = '2026-05-05T09:00:00.000Z';

const routeDeviation: LogisticsIncident = {
  id: 'INC-ROUTE-01',
  dealId: 'DL-1',
  logisticsOrderId: 'LOG-1',
  type: 'route_deviation',
  severity: 'warning',
  title: 'Отклонение маршрута',
  moneyImpact: money(45_000),
  status: 'open',
  createdAt,
};

describe('platform-v7 logistics incident money consistency', () => {
  it('creates money adjustment and money blocker for open route deviation', () => {
    expect(logisticsIncidentAdjustment(routeDeviation)).toMatchObject({
      id: 'MA-INC-ROUTE-01',
      dealId: 'DL-1',
      type: 'logistics_penalty',
      title: 'Удержание до проверки маршрута',
      amount: money(45_000),
      sourceEntityType: 'logistics_incident',
      sourceEntityId: 'INC-ROUTE-01',
      status: 'applied',
      blocksFullRelease: false,
      allowsPartialRelease: true,
    });

    expect(logisticsIncidentBlockers([routeDeviation])).toEqual([
      expect.objectContaining({
        id: 'INC-ROUTE-01-money-release-block',
        type: 'logistics',
        severity: 'warning',
        title: 'Отклонение маршрута требует проверки',
        blocks: 'money_release',
        responsibleRole: 'logistics',
        relatedEntityType: 'logistics_incident',
        relatedEntityId: 'INC-ROUTE-01',
        moneyImpact: money(45_000),
      }),
    ]);
  });

  it('keeps closed route deviation from holding money', () => {
    const closedIncident = { ...routeDeviation, status: 'closed' as const };

    expect(logisticsIncidentAdjustment(closedIncident)).toBeNull();
    expect(logisticsIncidentBlockers([closedIncident])).toEqual([]);
  });

  it('connects route deviation to money projection without allowing release', () => {
    const projection = calculateMoneyProjection({
      dealId: 'DL-1',
      grossDealAmount: 1_000_000,
      reservedAmount: 1_000_000,
      logisticsIncidents: [routeDeviation],
      bankConfirmationStatus: 'confirmed',
    });

    expect(projection.heldAmount.value).toBe(45_000);
    expect(projection.releaseAllowed).toBe(false);
    expect(projection.releaseBlockedReasons).toEqual([
      expect.objectContaining({
        id: 'INC-ROUTE-01-money-release-block',
        blocks: 'money_release',
        responsibleRole: 'logistics',
      }),
    ]);
    expect(projection.nextAction?.description).toContain('логистический инцидент');
  });

  it('moves critical logistics incidents into manual review before money release', () => {
    const criticalIncident = { ...routeDeviation, severity: 'critical' as const, moneyImpact: money(120_000) };
    const projection = calculateMoneyProjection({
      dealId: 'DL-1',
      grossDealAmount: 1_000_000,
      reservedAmount: 1_000_000,
      logisticsIncidents: [criticalIncident],
      bankConfirmationStatus: 'confirmed',
    });

    expect(projection.readyToReleaseAmount.value).toBe(0);
    expect(projection.manualReviewAmount.value).toBe(880_000);
    expect(projection.disputedAmount.value).toBe(120_000);
    expect(projection.releaseBlockedReasons[0]?.severity).toBe('critical');
  });
});
