// Кросс-ролевая согласованность пилотной сделки DL-9106.
//
// Доказывает, что одна сделка связно проходит ВСЕ кабинеты из единой «точки
// правды»: идентичность сделки совпадает между источниками, денежный гейт
// согласован с документами и СДИЗ, а каждый блокирующий документ маршрутизируется
// в реально существующий ролевой кабинет (нет «осиротевших» ролей).

import { describe, expect, it } from 'vitest';
import {
  DL_9106_EXECUTION_CASE,
  PLATFORM_V7_EXECUTION_SOURCE,
  isSdizLifecycleBlockingMoneyRelease,
  selectBlockingDealDocuments,
  selectDealExecutionCase,
  selectDealLogisticsTripPlan,
  selectDealMoneyState,
  selectDealSdizLifecycle,
} from '@/lib/platform-v7/deal-execution-source-of-truth';
import { PLATFORM_V7_ROLE_DIRECTORY } from '@/lib/platform-v7/role-directory';

const DEAL_ID = 'DL-9106';

// Слаги кабинетов из единого справочника ролей (последний сегмент href).
const cabinetSlugs = new Set(
  PLATFORM_V7_ROLE_DIRECTORY.map((role) => role.href.replace('/platform-v7/', '').split('/')[0]),
);

describe('DL-9106 — кросс-ролевая согласованность пилотной сделки', () => {
  it('идентичность сделки совпадает между всеми источниками правды', () => {
    const executionCase = selectDealExecutionCase(DEAL_ID);
    expect(executionCase).toBeDefined();
    expect(DL_9106_EXECUTION_CASE.dealId).toBe(DEAL_ID);

    // Канонический кейс ↔ агрегат витрины исполнения.
    expect(PLATFORM_V7_EXECUTION_SOURCE.deal.id).toBe(DEAL_ID);
    expect(PLATFORM_V7_EXECUTION_SOURCE.deal.lotId).toBe(DL_9106_EXECUTION_CASE.lotId);
    expect(PLATFORM_V7_EXECUTION_SOURCE.deal.volumeTons).toBe(
      DL_9106_EXECUTION_CASE.commodity.volumeDeclaredTons,
    );
    expect(PLATFORM_V7_EXECUTION_SOURCE.deal.priceRubPerTon).toBe(
      DL_9106_EXECUTION_CASE.price.pricePerTon,
    );
  });

  it('деньги внутренне согласованы: резерв = объём × цена, выпуск 0 до оснований', () => {
    const money = selectDealMoneyState(DEAL_ID);
    expect(money).toBeDefined();

    const expectedGross =
      DL_9106_EXECUTION_CASE.commodity.volumeDeclaredTons * DL_9106_EXECUTION_CASE.price.pricePerTon;
    expect(money?.goodsAmount).toBe(expectedGross);
    expect(money?.reserveAmount).toBe(expectedGross);
    // До закрытия оснований деньги не выпущены и не готовы к выпуску.
    expect(money?.readyToReleaseAmount).toBe(0);
    expect(money?.releasedAmount).toBe(0);
    expect(PLATFORM_V7_EXECUTION_SOURCE.money.reservedRub).toBe(expectedGross);
  });

  it('каждый блокирующий документ маршрутизируется в реальный кабинет', () => {
    const blocking = selectBlockingDealDocuments(DEAL_ID);
    expect(blocking.length).toBeGreaterThan(0);

    for (const doc of blocking) {
      // ответственная роль документа должна иметь свой кабинет в справочнике
      // (allow seller+buyer-подписантов: проверяем именно responsibleRole)
      expect(cabinetSlugs.has(doc.responsibleRole)).toBe(true);
    }
  });

  it('денежный гейт согласован с жизненным циклом СДИЗ (СДИЗ не закрыт → выпуск заблокирован)', () => {
    const lifecycle = selectDealSdizLifecycle(DEAL_ID);
    expect(lifecycle.length).toBeGreaterThan(0);

    const anyStepBlocks = lifecycle.some((step) => step.blocksMoneyRelease);
    expect(anyStepBlocks).toBe(true);
    expect(isSdizLifecycleBlockingMoneyRelease(DEAL_ID)).toBe(true);

    // Все ответственные роли в цикле СДИЗ — это реальные кабинеты.
    for (const step of lifecycle) {
      expect(cabinetSlugs.has(step.responsibleRole)).toBe(true);
    }
  });

  it('логистика связывает сделку с конкретным рейсом и согласована с витриной', () => {
    const plan = selectDealLogisticsTripPlan(DEAL_ID);
    expect(plan).toBeDefined();

    const firstTripId = DL_9106_EXECUTION_CASE.logistics.trips[0]?.tripId;
    expect(firstTripId).toBe('TRIP-2403-001');
    expect(PLATFORM_V7_EXECUTION_SOURCE.logistics.tripId).toBe(firstTripId);
  });
});
