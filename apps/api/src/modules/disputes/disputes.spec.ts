import { ForbiddenException, BadRequestException } from '@nestjs/common';
import { DisputesService } from './disputes.service';
import { RequestUser, Role } from '../../common/types/request-user';

function makeUser(role: Role, extra?: Partial<RequestUser>): RequestUser {
  return {
    id: `user-${role.toLowerCase()}`,
    email: `${role.toLowerCase()}@demo.ru`,
    orgId: 'org-buyer-1',
    role,
    ...extra,
  };
}

describe('DisputesService — access control', () => {
  let svc: DisputesService;

  beforeEach(() => {
    svc = new DisputesService();
  });

  it('BUYER can only see own org disputes', async () => {
    const buyer = makeUser(Role.BUYER, { orgId: 'org-buyer-1' });
    const list = await svc.list(buyer);
    expect(list.every((d) => d.initiatorOrgId === 'org-buyer-1')).toBe(true);
  });

  it('SUPPORT_MANAGER sees all disputes', async () => {
    const operator = makeUser(Role.SUPPORT_MANAGER);
    expect(await svc.list(operator)).toHaveLength(2);
  });

  it('DRIVER cannot create dispute', () => {
    const driver = makeUser(Role.DRIVER, { orgId: 'org-buyer-1' });
    expect(() =>
      svc.create({ dealId: 'DEAL-001', reason: 'quality', detail: 'test', claimAmountRub: 10000 }, driver),
    ).toThrow(ForbiddenException);
  });

  it('BUYER can create dispute with money hold', () => {
    const buyer = makeUser(Role.BUYER, { orgId: 'org-buyer-new' });
    const dispute = svc.create(
      { dealId: 'DEAL-001', reason: 'quality', claimAmountRub: 50000 },
      buyer,
    );
    expect(dispute.status).toBe('OPEN');
    expect(dispute.moneyHold?.amountRub).toBe(50000);
    expect(dispute.initiatorOrgId).toBe('org-buyer-new');
  });

  it('BUYER cannot view another org dispute', () => {
    const buyer = makeUser(Role.BUYER, { orgId: 'org-buyer-OTHER' });
    expect(() => svc.getOne('DISPUTE-001', buyer)).toThrow(ForbiddenException);
  });

  it('BUYER can view own dispute', () => {
    const buyer = makeUser(Role.BUYER, { orgId: 'org-buyer-1' });
    expect(() => svc.getOne('DISPUTE-001', buyer)).not.toThrow();
  });
});

describe('DisputesService — triage', () => {
  let svc: DisputesService;

  beforeEach(() => {
    svc = new DisputesService();
  });

  it('SUPPORT_MANAGER can triage OPEN dispute', () => {
    const operator = makeUser(Role.SUPPORT_MANAGER);
    const dispute = svc.triage('DISPUTE-002', operator);
    expect(dispute.status).toBe('UNDER_REVIEW');
    expect(dispute.owner).toBe(operator.email);
  });

  it('BUYER cannot triage', () => {
    const buyer = makeUser(Role.BUYER);
    expect(() => svc.triage('DISPUTE-002', buyer)).toThrow(ForbiddenException);
  });

  it('cannot triage already reviewed dispute', () => {
    const operator = makeUser(Role.SUPPORT_MANAGER);
    expect(() => svc.triage('DISPUTE-001', operator)).toThrow(BadRequestException);
  });
});

describe('DisputesService — decision with money instructions', () => {
  let svc: DisputesService;

  beforeEach(() => {
    svc = new DisputesService();
  });

  it('BUYER_WIN decision generates REFUND_BUYER instruction', () => {
    const operator = makeUser(Role.SUPPORT_MANAGER);
    svc.triage('DISPUTE-002', operator);
    const result = svc.decision('DISPUTE-002', { outcome: 'BUYER_WIN', note: 'test' }, operator);
    expect(result.status).toBe('RESOLVED');
    expect(result.moneyInstruction.action).toBe('REFUND_BUYER');
    expect(result.moneyInstruction.amountRub).toBe(86250);
    expect(result.bankBasisDocumentId).toBeDefined();
  });

  it('SELLER_WIN decision generates RELEASE_TO_SELLER instruction', () => {
    const operator = makeUser(Role.SUPPORT_MANAGER);
    svc.triage('DISPUTE-002', operator);
    const result = svc.decision('DISPUTE-002', { outcome: 'SELLER_WIN', note: 'test' }, operator);
    expect(result.moneyInstruction.action).toBe('RELEASE_TO_SELLER');
  });

  it('SPLIT decision generates proportional instructions', () => {
    const operator = makeUser(Role.SUPPORT_MANAGER);
    svc.triage('DISPUTE-002', operator);
    const result = svc.decision('DISPUTE-002', { outcome: 'SPLIT', note: 'test' }, operator);
    expect(result.moneyInstruction.action).toBe('SPLIT_RELEASE');
    expect(result.moneyInstruction.sellerShareRub).toBeDefined();
    expect(result.moneyInstruction.buyerRefundRub).toBeDefined();
    const total =
      (result.moneyInstruction.sellerShareRub ?? 0) + (result.moneyInstruction.buyerRefundRub ?? 0);
    expect(total).toBe(result.moneyInstruction.amountRub);
  });

  it('cannot decide already resolved dispute', () => {
    const operator = makeUser(Role.SUPPORT_MANAGER);
    svc.triage('DISPUTE-002', operator);
    svc.decision('DISPUTE-002', { outcome: 'BUYER_WIN', note: 'first' }, operator);
    expect(() =>
      svc.decision('DISPUTE-002', { outcome: 'SELLER_WIN', note: 'second' }, operator),
    ).toThrow(BadRequestException);
  });

  it('FARMER cannot make decision', () => {
    const farmer = makeUser(Role.FARMER);
    expect(() =>
      svc.decision('DISPUTE-001', { outcome: 'SELLER_WIN', note: 'test' }, farmer),
    ).toThrow(ForbiddenException);
  });
});

describe('DisputesService — evidence', () => {
  let svc: DisputesService;

  beforeEach(() => {
    svc = new DisputesService();
  });

  it('LAB evidence is marked as trusted', () => {
    const lab = makeUser(Role.LAB);
    const result = svc.addEvidence(
      'DISPUTE-001',
      { type: 'lab', source: 'laboratory', description: 'Lab protocol deviation', trusted: false },
      lab,
    );
    const lastEvidence = result.evidence.at(-1)!;
    expect(lastEvidence.trusted).toBe(true);
    expect(lastEvidence.uploadedBy).toBe(lab.id);
  });

  it('BUYER evidence is not automatically trusted', () => {
    const buyer = makeUser(Role.BUYER, { orgId: 'org-buyer-1' });
    const result = svc.addEvidence(
      'DISPUTE-001',
      { type: 'photo', source: 'mobile_app', description: 'Photo', trusted: false },
      buyer,
    );
    const lastEvidence = result.evidence.at(-1)!;
    expect(lastEvidence.trusted).toBe(false);
  });

  it('cannot add evidence to resolved dispute', () => {
    const operator = makeUser(Role.SUPPORT_MANAGER);
    svc.triage('DISPUTE-002', operator);
    svc.decision('DISPUTE-002', { outcome: 'NO_CLAIM', note: 'test' }, operator);
    expect(() =>
      svc.addEvidence(
        'DISPUTE-002',
        { type: 'photo', source: 'mobile', trusted: false },
        makeUser(Role.BUYER),
      ),
    ).toThrow(BadRequestException);
  });
});
