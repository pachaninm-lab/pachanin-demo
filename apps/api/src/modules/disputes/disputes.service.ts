import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { CreateDisputeDto } from './dto/create-dispute.dto';
import { DecideDisputeDto } from './dto/decide-dispute.dto';
import type { RequestUser } from '../../common/types/request-user';
import {
  DisputeCommandService,
  type DisputeOutcome as CanonicalDisputeOutcome,
} from './dispute-command.service';
import { DisputeQueryService } from './dispute-query.service';

export type DisputeStatus =
  | 'OPEN'
  | 'UNDER_REVIEW'
  | 'ARBITRATION'
  | 'RESOLVED'
  | 'APPEALED'
  | 'FINAL';

export type DisputeOutcome =
  | 'BUYER_WIN'
  | 'SELLER_WIN'
  | 'SPLIT'
  | 'NO_CLAIM'
  | CanonicalDisputeOutcome;

export interface DisputeEvidence {
  id: string;
  type: 'photo' | 'document' | 'gps' | 'weight' | 'lab' | 'statement' | string;
  url?: string;
  fileId?: string;
  description?: string;
  source: string;
  uploadedAt: string;
  uploadedBy?: string;
  trusted: boolean;
  hash?: string;
  prevHash?: string;
}

export interface MoneyHold {
  amountRub: number;
  amountKopecks?: string;
  status?: string;
  reason: string;
  heldAt: string;
  releasedAt?: string;
}

export interface Dispute {
  id: string;
  dealId: string;
  shipmentId?: string;
  status: DisputeStatus;
  type: string;
  claimAmountRub?: number;
  claimAmountKopecks?: string;
  description: string;
  initiatorOrgId: string;
  respondentOrgId?: string;
  severity?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  createdAt: string;
  updatedAt?: string;
  resolvedAt?: string;
  evidence: DisputeEvidence[];
  owner?: string;
  arbitratorId?: string;
  arbitratorNotes?: string;
  outcome?: DisputeOutcome;
  decisionNote?: string;
  moneyHold?: MoneyHold;
  bankBasisDocumentId?: string;
  slaDeadline?: string;
  appealDeadlineAt?: string;
  appeals?: unknown[];
  version?: string;
  commandId?: string;
  duplicate?: boolean;
}

@Injectable()
export class DisputesService {
  constructor(
    private readonly queries: DisputeQueryService,
    private readonly commands: DisputeCommandService,
  ) {}

  async list(user: RequestUser): Promise<Dispute[]> {
    return (await this.queries.list(user)).map(presentDispute);
  }

  async getOne(id: string, user: RequestUser): Promise<Dispute> {
    return presentDispute(await this.queries.get(id, user));
  }

  async create(dto: CreateDisputeDto, user: RequestUser): Promise<Dispute> {
    const claimAmountKopecks = amountKopecks(dto.claimAmountKopecks, dto.claimAmountRub);
    const result = await this.commands.open({
      dealId: dto.dealId,
      shipmentId: dto.shipmentId,
      type: dto.reason,
      description: dto.detail?.trim() || dto.reason,
      claimAmountKopecks,
      severity: dto.severity ?? (BigInt(claimAmountKopecks) > 50_000_000n ? 'HIGH' : 'MEDIUM'),
      idempotencyKey: dto.idempotencyKey ?? `dispute-open:${randomUUID()}`,
    }, user);
    return presentDispute(result);
  }

  async triage(id: string, user: RequestUser, idempotencyKey = `dispute-triage:${randomUUID()}`): Promise<Dispute> {
    return presentDispute(await this.commands.triage(id, idempotencyKey, user));
  }

  async addEvidence(
    id: string,
    evidence: Omit<DisputeEvidence, 'id' | 'uploadedAt'> & { idempotencyKey?: string },
    user: RequestUser,
  ): Promise<Dispute> {
    const result = await this.commands.addEvidence(id, {
      type: evidence.type,
      description: evidence.description?.trim() || evidence.source,
      source: evidence.source,
      fileId: evidence.fileId ?? evidence.url,
      idempotencyKey: evidence.idempotencyKey ?? `dispute-evidence:${randomUUID()}`,
    }, user);
    return presentDispute(result);
  }

  async decision(
    id: string,
    dto: DecideDisputeDto,
    user: RequestUser,
  ): Promise<Dispute & { moneyInstruction: MoneyInstruction }> {
    const outcome = canonicalOutcome(dto.outcome);
    const result = presentDispute(await this.commands.resolve(id, {
      outcome,
      splitBuyerPct: outcome === 'SPLIT' ? dto.splitBuyerPct ?? 50 : null,
      reason: dto.note?.trim() || 'Arbitrator decision',
      idempotencyKey: dto.idempotencyKey ?? `dispute-resolve:${randomUUID()}`,
    }, user));
    return { ...result, moneyInstruction: moneyInstruction(result, outcome, dto.splitBuyerPct ?? 50) };
  }

  async openAppeal(
    id: string,
    input: { outcome: string; splitBuyerPct?: number; reason: string; idempotencyKey?: string },
    user: RequestUser,
  ): Promise<Dispute> {
    return presentDispute(await this.commands.openAppeal(id, {
      requestedOutcome: canonicalOutcome(input.outcome),
      requestedSplitBuyerPct: input.splitBuyerPct,
      reason: input.reason,
      idempotencyKey: input.idempotencyKey ?? `dispute-appeal:${randomUUID()}`,
    }, user));
  }

  async resolveAppeal(
    id: string,
    input: { granted: boolean; outcome?: string; splitBuyerPct?: number; note: string; idempotencyKey?: string },
    user: RequestUser,
  ): Promise<Dispute> {
    return presentDispute(await this.commands.resolveAppeal(id, {
      granted: input.granted,
      finalOutcome: input.granted ? canonicalOutcome(input.outcome) : null,
      finalSplitBuyerPct: input.splitBuyerPct,
      note: input.note,
      idempotencyKey: input.idempotencyKey ?? `dispute-appeal-resolve:${randomUUID()}`,
    }, user));
  }
}

function amountKopecks(explicit: string | undefined, rubles: number | undefined): string {
  if (explicit !== undefined) return explicit;
  if (rubles === undefined) return '0';
  if (!Number.isFinite(rubles) || rubles < 0) return String(rubles);
  const scaled = rubles * 100;
  if (!Number.isSafeInteger(scaled)) return String(scaled);
  return String(scaled);
}

function canonicalOutcome(value: unknown): CanonicalDisputeOutcome {
  switch (value) {
    case 'BUYER_WIN':
    case 'BUYER_WINS': return 'BUYER_WINS';
    case 'SELLER_WIN':
    case 'SELLER_WINS': return 'SELLER_WINS';
    case 'SPLIT': return 'SPLIT';
    case 'NO_CLAIM':
    case 'CANCELLED': return 'CANCELLED';
    default: return value as CanonicalDisputeOutcome;
  }
}

function presentDispute(raw: Record<string, unknown>): Dispute {
  const kopecks = typeof raw.claimAmountKopecks === 'string' ? raw.claimAmountKopecks : '0';
  const rawHold = isRecord(raw.moneyHold) ? raw.moneyHold : null;
  const evidence = Array.isArray(raw.evidence) ? raw.evidence.map((item) => {
    const row = isRecord(item) ? item : {};
    return {
      id: String(row.id ?? ''),
      type: String(row.type ?? 'document'),
      description: typeof row.description === 'string' ? row.description : undefined,
      source: String(row.source ?? ''),
      fileId: typeof row.fileId === 'string' ? row.fileId : undefined,
      uploadedAt: String(row.submittedAt ?? row.uploadedAt ?? ''),
      uploadedBy: typeof row.submittedBy === 'string' ? row.submittedBy : undefined,
      trusted: row.trusted === true,
      hash: typeof row.hash === 'string' ? row.hash : undefined,
      prevHash: typeof row.prevHash === 'string' ? row.prevHash : undefined,
    } satisfies DisputeEvidence;
  }) : [];
  return {
    id: String(raw.id ?? ''),
    dealId: String(raw.dealId ?? ''),
    shipmentId: typeof raw.shipmentId === 'string' ? raw.shipmentId : undefined,
    status: String(raw.status ?? 'OPEN') as DisputeStatus,
    type: String(raw.type ?? ''),
    claimAmountKopecks: kopecks,
    claimAmountRub: Number(kopecks) / 100,
    description: String(raw.description ?? ''),
    initiatorOrgId: String(raw.initiatorOrgId ?? ''),
    respondentOrgId: typeof raw.respondentOrgId === 'string' ? raw.respondentOrgId : undefined,
    severity: raw.severity as Dispute['severity'],
    createdAt: String(raw.createdAt ?? ''),
    updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : undefined,
    resolvedAt: typeof raw.resolvedAt === 'string' ? raw.resolvedAt : undefined,
    evidence,
    owner: typeof raw.operatorUserId === 'string' ? raw.operatorUserId : undefined,
    arbitratorId: typeof raw.arbitratorId === 'string' ? raw.arbitratorId : undefined,
    arbitratorNotes: typeof raw.arbitratorNotes === 'string' ? raw.arbitratorNotes : undefined,
    outcome: raw.outcome as DisputeOutcome | undefined,
    decisionNote: typeof raw.decisionReason === 'string' ? raw.decisionReason : undefined,
    moneyHold: rawHold ? {
      amountKopecks: String(rawHold.amountKopecks ?? '0'),
      amountRub: Number(rawHold.amountKopecks ?? 0) / 100,
      status: typeof rawHold.status === 'string' ? rawHold.status : undefined,
      reason: String(rawHold.reason ?? ''),
      heldAt: String(rawHold.heldAt ?? ''),
      releasedAt: typeof rawHold.releasedAt === 'string' ? rawHold.releasedAt : undefined,
    } : undefined,
    bankBasisDocumentId: typeof raw.bankBasisDocumentId === 'string' ? raw.bankBasisDocumentId : undefined,
    slaDeadline: typeof raw.slaDeadlineAt === 'string' ? raw.slaDeadlineAt : undefined,
    appealDeadlineAt: typeof raw.appealDeadlineAt === 'string' ? raw.appealDeadlineAt : undefined,
    appeals: Array.isArray(raw.appeals) ? raw.appeals : [],
    version: typeof raw.version === 'string' ? raw.version : undefined,
    commandId: typeof raw.commandId === 'string' ? raw.commandId : undefined,
    duplicate: raw.duplicate === true,
  };
}

function moneyInstruction(dispute: Dispute, outcome: CanonicalDisputeOutcome, buyerPct: number): MoneyInstruction {
  const amountRub = dispute.moneyHold?.amountRub ?? dispute.claimAmountRub ?? 0;
  if (outcome === 'BUYER_WINS') return { action: 'REFUND_BUYER', amountRub, bankBasisDocumentId: dispute.bankBasisDocumentId };
  if (outcome === 'SELLER_WINS') return { action: 'RELEASE_TO_SELLER', amountRub, bankBasisDocumentId: dispute.bankBasisDocumentId };
  if (outcome === 'SPLIT') {
    const buyerRefundRub = Math.round(amountRub * buyerPct) / 100;
    return { action: 'SPLIT_RELEASE', amountRub, buyerRefundRub, sellerShareRub: amountRub - buyerRefundRub, bankBasisDocumentId: dispute.bankBasisDocumentId };
  }
  return { action: 'RETURN_TO_ESCROW', amountRub, bankBasisDocumentId: dispute.bankBasisDocumentId };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export interface MoneyInstruction {
  action: 'REFUND_BUYER' | 'RELEASE_TO_SELLER' | 'SPLIT_RELEASE' | 'RETURN_TO_ESCROW';
  amountRub: number;
  sellerShareRub?: number;
  buyerRefundRub?: number;
  note?: string;
  bankBasisDocumentId?: string;
}
