import { BadRequestException } from '@nestjs/common';
import { RuntimeCoreService } from './runtime-core.service';

function makeService() {
  return new RuntimeCoreService();
}

const DEMO_USER = { id: 'user-test', orgId: 'org-farmer-1', role: 'FARMER' };

describe('RuntimeCoreService — state machine', () => {
  it('allows valid transition DRAFT → AWAITING_SIGN', () => {
    const svc = makeService();
    const deal = svc.createDeal({ lotId: 'LOT-X', buyerOrgId: 'org-buyer-1' }, DEMO_USER);
    expect(() => svc.transitionDeal(deal.id, 'AWAITING_SIGN', DEMO_USER)).not.toThrow();
  });

  it('blocks invalid transition DRAFT → SETTLED', () => {
    const svc = makeService();
    const deal = svc.createDeal({ lotId: 'LOT-X', buyerOrgId: 'org-buyer-1' }, DEMO_USER);
    expect(() => svc.transitionDeal(deal.id, 'SETTLED', DEMO_USER)).toThrow(BadRequestException);
  });

  it('blocks transition SIGNED → LOADING (skipping PREPAYMENT_RESERVED)', () => {
    const svc = makeService();
    const deal = svc.createDeal({ lotId: 'LOT-X', buyerOrgId: 'org-buyer-1' }, DEMO_USER);
    svc.transitionDeal(deal.id, 'AWAITING_SIGN', DEMO_USER);
    svc.transitionDeal(deal.id, 'SIGNED', DEMO_USER);
    expect(() => svc.transitionDeal(deal.id, 'LOADING', DEMO_USER)).toThrow(BadRequestException);
  });

  it('blocks terminal state → any further mutation (CLOSED → anything)', () => {
    const svc = makeService();
    const deal = svc.createDeal({ lotId: 'LOT-X', buyerOrgId: 'org-buyer-1' }, DEMO_USER);
    // Walk through all required states
    svc.transitionDeal(deal.id, 'AWAITING_SIGN', DEMO_USER);
    svc.transitionDeal(deal.id, 'SIGNED', DEMO_USER);
    svc.transitionDeal(deal.id, 'PREPAYMENT_RESERVED', DEMO_USER);
    svc.transitionDeal(deal.id, 'LOADING', DEMO_USER);
    svc.transitionDeal(deal.id, 'IN_TRANSIT', DEMO_USER);
    svc.transitionDeal(deal.id, 'ARRIVED', DEMO_USER);
    svc.transitionDeal(deal.id, 'QUALITY_CHECK', DEMO_USER);
    svc.transitionDeal(deal.id, 'ACCEPTED', DEMO_USER);
    svc.transitionDeal(deal.id, 'FINAL_PAYMENT', DEMO_USER);
    svc.transitionDeal(deal.id, 'SETTLED', DEMO_USER);
    svc.transitionDeal(deal.id, 'CLOSED', DEMO_USER);
    expect(() => svc.transitionDeal(deal.id, 'DRAFT', DEMO_USER)).toThrow(BadRequestException);
    expect(() => svc.transitionDeal(deal.id, 'SIGNED', DEMO_USER)).toThrow(BadRequestException);
  });

  it('DISPUTE_OPEN can be entered from LOADING/IN_TRANSIT', () => {
    const svc = makeService();
    const deal = svc.createDeal({ lotId: 'LOT-X', buyerOrgId: 'org-buyer-1' }, DEMO_USER);
    svc.transitionDeal(deal.id, 'AWAITING_SIGN', DEMO_USER);
    svc.transitionDeal(deal.id, 'SIGNED', DEMO_USER);
    svc.transitionDeal(deal.id, 'PREPAYMENT_RESERVED', DEMO_USER);
    svc.transitionDeal(deal.id, 'LOADING', DEMO_USER);
    expect(() => svc.transitionDeal(deal.id, 'DISPUTE_OPEN', DEMO_USER)).not.toThrow();
  });
});

describe('RuntimeCoreService — document completeness', () => {
  it('marks completeness.isComplete=false when required docs are missing', () => {
    const svc = makeService();
    const ws = svc.dealWorkspace('DEAL-003'); // DEAL-003 only has draft contract
    expect(ws.completeness.isComplete).toBe(false);
    expect(ws.completeness.missing).toContain('transport_waybill');
  });

  it('document upload improves completeness rate', () => {
    const svc = makeService();
    const before = svc.dealWorkspace('DEAL-003');
    const beforeRate = before.completeness.completionRate;

    svc.uploadDocument(
      { originalname: 'ttn.pdf', mimetype: 'application/pdf', size: 1024 },
      { dealId: 'DEAL-003', type: 'transport_waybill', name: 'ТТН' },
      DEMO_USER,
    );

    const after = svc.dealWorkspace('DEAL-003');
    expect(after.completeness.completionRate).toBeGreaterThan(beforeRate);
  });
});

describe('RuntimeCoreService — money blockers', () => {
  it('resolves blockers when deal is in DISPUTE_OPEN', () => {
    const svc = makeService();
    const deal = svc.createDeal({ lotId: 'LOT-X', buyerOrgId: 'org-buyer-1' }, DEMO_USER);
    svc.transitionDeal(deal.id, 'AWAITING_SIGN', DEMO_USER);
    svc.transitionDeal(deal.id, 'SIGNED', DEMO_USER);
    svc.transitionDeal(deal.id, 'DISPUTE_OPEN', DEMO_USER);

    const ws = svc.dealWorkspace(deal.id);
    const hasDisputeBlocker = ws.blockers.some((b: string) => b.toLowerCase().includes('спор'));
    expect(hasDisputeBlocker).toBe(true);
  });

  it('releasePayment returns blockers when not all gates are cleared', () => {
    const svc = makeService();
    // DEAL-003 has no lab protocol and missing docs
    const result = svc.releasePayment('DEAL-003', DEMO_USER);
    expect(result.released).toBe(false);
    expect(result.blockers.length).toBeGreaterThan(0);
  });

  it('payment status remains RESERVE_PENDING after reservePrepayment (not auto-confirmed)', () => {
    const svc = makeService();
    const result = svc.reservePrepayment('DEAL-003', DEMO_USER);
    expect(result.status).toBe('RESERVE_PENDING');
    // Payment should NOT jump to RESERVED without bank callback
    const ws = svc.dealWorkspace('DEAL-003');
    expect(ws.payment.status).toBe('RESERVE_PENDING');
  });
});

describe('RuntimeCoreService — driver isolation (shipment)', () => {
  it('createShipment sets driverUserId from DTO', () => {
    const svc = makeService();
    const shipment = svc.createShipment(
      {
        dealId: 'DEAL-001',
        vehicleNumber: 'А777ВС77',
        driverUserId: 'driver-specific-001',
        plannedLoadAt: new Date().toISOString(),
      },
      DEMO_USER,
    );
    expect(shipment.driverUserId).toBe('driver-specific-001');
  });

  it('verifyPin does not auto-confirm for wrong pin', () => {
    const svc = makeService();
    const result = svc.verifyPin('SHIP-001', '0000');
    expect(result.pinValid).toBe(false);
  });

  it('verifyPin confirms for correct pin', () => {
    const svc = makeService();
    const result = svc.verifyPin('SHIP-001', '1234');
    expect(result.pinValid).toBe(true);
  });
});
