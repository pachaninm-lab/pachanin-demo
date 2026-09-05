import { describe, expect, it } from 'vitest';
import {
  SERVICE_MARKETPLACE_ACTIONS,
  SERVICE_MARKETPLACE_STATUSES,
  ServiceMarketplaceError,
  serviceSettlementReference,
  transitionServiceMarketplace,
} from './service-marketplace';

describe('service marketplace lifecycle', () => {
  it('keeps the exact closed lifecycle vocabulary', () => {
    expect(SERVICE_MARKETPLACE_STATUSES).toEqual([
      'REQUESTED', 'QUOTED', 'PROVIDER_SELECTED', 'PAYER_ASSIGNED', 'PAYER_CONFIRMED',
      'EXECUTING', 'EVIDENCE_SUBMITTED', 'ACCEPTED', 'SETTLEMENT_RECORDED',
    ]);
    expect(SERVICE_MARKETPLACE_ACTIONS).toHaveLength(9);
  });

  it('advances the complete happy path in order', () => {
    const actions = SERVICE_MARKETPLACE_ACTIONS;
    let status = null as (typeof SERVICE_MARKETPLACE_STATUSES)[number] | null;
    for (const action of actions) status = transitionServiceMarketplace(status, action);
    expect(status).toBe('SETTLEMENT_RECORDED');
  });

  it('accepts multiple quotes before selection', () => {
    expect(transitionServiceMarketplace('REQUESTED', 'SUBMIT_QUOTE')).toBe('QUOTED');
    expect(transitionServiceMarketplace('QUOTED', 'SUBMIT_QUOTE')).toBe('QUOTED');
  });

  it('accepts payer reassignment only before confirmation', () => {
    expect(transitionServiceMarketplace('PAYER_ASSIGNED', 'ASSIGN_PAYER')).toBe('PAYER_ASSIGNED');
    expect(() => transitionServiceMarketplace('PAYER_CONFIRMED', 'ASSIGN_PAYER'))
      .toThrowError(ServiceMarketplaceError);
  });

  for (const [status, action] of [
    ['REQUESTED', 'SELECT_PROVIDER'],
    ['QUOTED', 'CONFIRM_PAYER'],
    ['PROVIDER_SELECTED', 'START_EXECUTION'],
    ['PAYER_ASSIGNED', 'START_EXECUTION'],
    ['PAYER_CONFIRMED', 'SUBMIT_EVIDENCE'],
    ['EXECUTING', 'ACCEPT_SERVICE'],
    ['EVIDENCE_SUBMITTED', 'RECORD_SETTLEMENT'],
  ] as const) {
    it(`fails closed for ${action} from ${status}`, () => {
      expect(() => transitionServiceMarketplace(status, action)).toThrowError(/cannot advance/u);
    });
  }

  it('cannot recreate an existing request', () => {
    expect(() => transitionServiceMarketplace('REQUESTED', 'CREATE_REQUEST'))
      .toThrowError(/only be created from no state/u);
  });

  it('requires an existing request for lifecycle commands', () => {
    expect(() => transitionServiceMarketplace(null, 'SUBMIT_QUOTE')).toThrowError(/requires an existing request/u);
  });

  it('creates an explicitly non-financial settlement reference', () => {
    expect(serviceSettlementReference('SETTLEMENT_PLAN_PENDING', 'service:req-001')).toEqual({
      referenceType: 'SETTLEMENT_PLAN_PENDING',
      reference: 'service:req-001',
      createsFinancialObligation: false,
    });
  });

  it('rejects unsafe settlement references', () => {
    expect(() => serviceSettlementReference('EXTERNAL', '../secret')).toThrowError(/unsafe/u);
  });
});
