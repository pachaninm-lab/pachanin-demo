import { BadRequestException } from '@nestjs/common';
import {
  RuntimeStateMachine,
  DEAL_TRANSITIONS,
  SHIPMENT_TRANSITIONS,
} from './runtime-state-machine';

describe('RuntimeStateMachine — deal transitions', () => {
  const sm = new RuntimeStateMachine();

  it('allows every edge declared in the deal map', () => {
    for (const [from, tos] of Object.entries(DEAL_TRANSITIONS)) {
      for (const to of tos) {
        expect(() => sm.assertDealTransition(from, to)).not.toThrow();
      }
    }
  });

  it('rejects a disallowed deal transition with the exact message', () => {
    expect(() => sm.assertDealTransition('DRAFT', 'SIGNED')).toThrow(BadRequestException);
    expect(() => sm.assertDealTransition('DRAFT', 'SIGNED')).toThrow('Переход DRAFT → SIGNED не разрешён');
  });

  it('treats an unknown source state as having no allowed transitions', () => {
    expect(() => sm.assertDealTransition('NOPE', 'SIGNED')).toThrow(BadRequestException);
  });

  it('keeps the known lifecycle edges (regression guard)', () => {
    expect(() => sm.assertDealTransition('SIGNED', 'PREPAYMENT_RESERVED')).not.toThrow();
    expect(() => sm.assertDealTransition('QUALITY_CHECK', 'EXPERTISE')).not.toThrow();
    expect(() => sm.assertDealTransition('SETTLED', 'CLOSED')).not.toThrow();
    // Dispute is reachable from every active state.
    expect(() => sm.assertDealTransition('IN_TRANSIT', 'DISPUTE_OPEN')).not.toThrow();
  });
});

describe('RuntimeStateMachine — shipment transitions', () => {
  const sm = new RuntimeStateMachine();

  it('returns the declared next states for each shipment status', () => {
    for (const [status, tos] of Object.entries(SHIPMENT_TRANSITIONS)) {
      expect(sm.availableShipmentTransitions(status)).toEqual(tos);
    }
  });

  it('returns an empty list for an unknown shipment status', () => {
    expect(sm.availableShipmentTransitions('NOPE')).toEqual([]);
  });

  it('asserts a valid shipment transition and rejects an invalid one', () => {
    expect(() => sm.assertShipmentTransition('PENDING', 'IN_TRANSIT')).not.toThrow();
    expect(() => sm.assertShipmentTransition('PENDING', 'DELIVERED')).toThrow(BadRequestException);
    expect(() => sm.assertShipmentTransition('PENDING', 'DELIVERED')).toThrow(
      'Переход рейса PENDING → DELIVERED не разрешён',
    );
  });

  it('treats terminal states as having no further transitions', () => {
    expect(sm.availableShipmentTransitions('COMPLETED')).toEqual([]);
    expect(sm.availableShipmentTransitions('CANCELLED')).toEqual([]);
  });
});
