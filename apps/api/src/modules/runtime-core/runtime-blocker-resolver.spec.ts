import {
  RuntimeBlockerResolver,
  type DealStateSnapshot,
} from './runtime-blocker-resolver';

const resolver = new RuntimeBlockerResolver();

function snapshot(overrides: Partial<DealStateSnapshot> = {}): DealStateSnapshot {
  return {
    deal: { status: 'IN_TRANSIT', owner: null, nextAction: null },
    payment: { status: 'REQUIRES_BANK', callbackState: 'NOT_SENT' },
    completeness: { isComplete: true, missing: [] },
    shipment: { status: 'AT_UNLOADING', handoff: { lab: true } },
    sample: { status: 'FINALIZED' },
    ...overrides,
  };
}

describe('RuntimeBlockerResolver — resolveOwner', () => {
  it('routes by the same priority ladder as before', () => {
    expect(resolver.resolveOwner(snapshot({ deal: { status: 'DISPUTE_OPEN' } }))).toBe('Контроль');
    expect(resolver.resolveOwner(snapshot({ deal: { status: 'QUALITY_CHECK' } }))).toBe('Лаборатория');
    expect(resolver.resolveOwner(snapshot({ shipment: { status: 'IN_TRANSIT' } }))).toBe('Логистика');
    expect(
      resolver.resolveOwner(snapshot({ completeness: { isComplete: false, missing: ['contract'] }, shipment: null })),
    ).toBe('Документы');
    expect(resolver.resolveOwner(snapshot({ payment: { status: 'MANUAL_REVIEW' }, shipment: null }))).toBe('Банк');
    expect(resolver.resolveOwner(snapshot({ shipment: null, deal: { status: 'SETTLED', owner: 'Сделка' } }))).toBe('Сделка');
  });
});

describe('RuntimeBlockerResolver — resolveNextAction', () => {
  it('returns the first matching prompt down the ladder', () => {
    expect(resolver.resolveNextAction(snapshot({ payment: { status: 'RESERVE_PENDING' } }))).toBe(
      'Дождаться callback по резерву',
    );
    expect(
      resolver.resolveNextAction(snapshot({ completeness: { isComplete: false, missing: ['contract', 'acceptance_act'] } })),
    ).toBe('Закрыть документы: contract, acceptance_act');
    expect(
      resolver.resolveNextAction(snapshot({ shipment: { status: 'AT_UNLOADING', handoff: { lab: false } } })),
    ).toBe('Передать партию в лабораторию');
    expect(resolver.resolveNextAction(snapshot({ sample: null }))).toBe('Финализировать лабораторный протокол');
    expect(resolver.resolveNextAction(snapshot({ payment: { status: 'READY_FOR_RELEASE' } }))).toBe(
      'Выпустить деньги или подтвердить release',
    );
    expect(resolver.resolveNextAction(snapshot({ payment: { status: 'MISMATCH' } }))).toBe('Открыть ручную сверку');
    expect(resolver.resolveNextAction(snapshot({ deal: { status: 'SETTLED', nextAction: 'Закрыть сделку' } }))).toBe(
      'Закрыть сделку',
    );
  });
});

describe('RuntimeBlockerResolver — resolveBlockers', () => {
  it('returns no blockers for a fully ready deal', () => {
    expect(resolver.resolveBlockers(snapshot())).toEqual([]);
  });

  it('accumulates every gating condition', () => {
    const blockers = resolver.resolveBlockers(
      snapshot({
        payment: { status: 'MISMATCH', callbackState: 'PENDING' },
        completeness: { isComplete: false, missing: ['contract'] },
        shipment: { status: 'IN_TRANSIT' },
        sample: null,
        deal: { status: 'DISPUTE_OPEN' },
      }),
    );
    expect(blockers).toEqual([
      'Нет callback банка',
      'Нет документов: contract',
      'Рейс не передан в приёмку',
      'Нет финального протокола качества',
      'Есть открытый спор',
      'Есть банковое расхождение',
    ]);
  });
});

describe('RuntimeBlockerResolver — resolveShipmentBlockers', () => {
  it('flags pin / checkpoints / handoff', () => {
    expect(
      resolver.resolveShipmentBlockers({ pinVerified: false, checkpoints: [], handoff: {}, status: 'AT_UNLOADING' }),
    ).toEqual(['ПИН водителя не подтверждён', 'Нет контрольных точек', 'Нет передачи в приёмку']);
  });

  it('is clean when pin verified, checkpoints present and handed off', () => {
    expect(
      resolver.resolveShipmentBlockers({ pinVerified: true, checkpoints: [{}], handoff: { receiving: true }, status: 'AT_UNLOADING' }),
    ).toEqual([]);
  });

  it('does not require handoff outside AT_UNLOADING', () => {
    expect(
      resolver.resolveShipmentBlockers({ pinVerified: true, checkpoints: [{}], handoff: {}, status: 'IN_TRANSIT' }),
    ).toEqual([]);
  });
});
