import { createHash } from 'crypto';
import type { DealEvent, DealEventPayload } from './deal-event-chain';
import { buildDealEvent, GENESIS_HASH } from './deal-event-chain';
import type { AppendOnlyLedger } from './double-entry-ledger';
import type { AuditLog } from './audit-log';

export interface UkepSignatureRef {
  documentHash: string;
  signatureBase64: string;
  certificateId: string;
  signerUserId: string;
  signedAt: string;
  algorithm: string;
}

export interface ContractDocument {
  id: string;
  dealId: string;
  contentHash: string;
  sellerSignature?: UkepSignatureRef;
  buyerSignature?: UkepSignatureRef;
  status: 'DRAFT' | 'PENDING_SELLER' | 'PENDING_BUYER' | 'FULLY_SIGNED' | 'REJECTED';
  generatedAt: string;
}

export interface DealSigningState {
  dealId: string;
  contract: ContractDocument;
  events: DealEvent[];
  lastHash: string;
}

export interface SignContractParams {
  userId: string;
  userRole: 'FARMER' | 'BUYER';
  certificateId: string;
  signature: UkepSignatureRef;
}

export class DealSigningService {
  private readonly states = new Map<string, DealSigningState>();

  constructor(
    private readonly ledger: AppendOnlyLedger,
    private readonly auditLog: AuditLog,
  ) {}

  initContract(params: { dealId: string; sellerId: string; buyerId: string; amount: number }): ContractDocument {
    const { dealId, sellerId, buyerId, amount } = params;
    const contentSource = JSON.stringify({ dealId, sellerId, buyerId, amount, v: 1 });
    const contentHash = createHash('sha256').update(contentSource, 'utf8').digest('hex');
    const contract: ContractDocument = {
      id: `contract-${dealId}`,
      dealId,
      contentHash,
      status: 'PENDING_SELLER',
      generatedAt: new Date().toISOString(),
    };

    const eventPayload: DealEventPayload = { actorId: 'system', actorRole: 'SYSTEM', meta: { sellerId, buyerId, amount } };
    const ev = buildDealEvent({ id: `${dealId}-ev-1`, dealId, eventType: 'DEAL_CREATED', payload: eventPayload, prevHash: GENESIS_HASH });

    this.states.set(dealId, { dealId, contract, events: [ev], lastHash: ev.hash });

    this.auditLog.append({ id: `${dealId}-audit-created`, actorId: 'system', actorRole: 'SYSTEM', action: 'DEAL_CREATED', resourceType: 'deal', resourceId: dealId });

    return contract;
  }

  signContract(dealId: string, params: SignContractParams): ContractDocument {
    const state = this.states.get(dealId);
    if (!state) throw new Error(`Deal ${dealId} not found`);
    const { contract } = state;

    if (params.signature.documentHash !== contract.contentHash) {
      throw new Error('Signature document hash does not match contract content hash');
    }

    if (params.userRole === 'FARMER') {
      if (contract.status !== 'PENDING_SELLER') throw new Error('Contract not awaiting seller signature');
      contract.sellerSignature = params.signature;
      contract.status = 'PENDING_BUYER';
    } else if (params.userRole === 'BUYER') {
      if (contract.status !== 'PENDING_BUYER') throw new Error('Contract not awaiting buyer signature');
      contract.buyerSignature = params.signature;
      contract.status = 'FULLY_SIGNED';
    } else {
      throw new Error('Only FARMER or BUYER can sign the contract');
    }

    const evPayload: DealEventPayload = { actorId: params.userId, actorRole: params.userRole, newStatus: contract.status === 'FULLY_SIGNED' ? 'SIGNED' : undefined, meta: { certificateId: params.certificateId } };
    const evId = `${dealId}-ev-sign-${params.userRole.toLowerCase()}`;
    const ev = buildDealEvent({ id: evId, dealId, eventType: 'DEAL_SIGNED', payload: evPayload, prevHash: state.lastHash });
    state.events.push(ev);
    state.lastHash = ev.hash;

    this.auditLog.append({ id: `${evId}-audit`, actorId: params.userId, actorRole: params.userRole, action: 'DOCUMENT_SIGNED', resourceType: 'contract', resourceId: contract.id });

    return contract;
  }

  reservePayment(dealId: string, params: { actorId: string; amountKopecks: number }): void {
    const state = this.states.get(dealId);
    if (!state) throw new Error(`Deal ${dealId} not found`);
    if (state.contract.status !== 'FULLY_SIGNED') throw new Error('Contract must be fully signed before payment reserve');

    this.ledger.reserve({ id: `${dealId}-reserve`, dealId, actorId: params.actorId, amountKopecks: params.amountKopecks });

    const evPayload: DealEventPayload = { actorId: params.actorId, actorRole: 'BUYER', newStatus: 'PREPAYMENT_RESERVED', meta: { amountKopecks: params.amountKopecks } };
    const ev = buildDealEvent({ id: `${dealId}-ev-reserve`, dealId, eventType: 'PAYMENT_RESERVED', payload: evPayload, prevHash: state.lastHash });
    state.events.push(ev);
    state.lastHash = ev.hash;

    this.auditLog.append({ id: `${dealId}-audit-reserve`, actorId: params.actorId, actorRole: 'BUYER', action: 'PAYMENT_RESERVED', resourceType: 'deal', resourceId: dealId });
  }

  getState(dealId: string): DealSigningState | undefined {
    return this.states.get(dealId);
  }
}
