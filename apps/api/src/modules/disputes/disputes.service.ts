import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { CreateDisputeDto } from './dto/create-dispute.dto';
import { DecideDisputeDto } from './dto/decide-dispute.dto';
import { RequestUser, Role } from '../../common/types/request-user';

export type DisputeStatus =
  | 'OPEN'
  | 'UNDER_REVIEW'
  | 'EXPERTISE'
  | 'DECISION'
  | 'PARTIAL_OUTCOME'
  | 'RESOLVED'
  | 'CLOSED';

export type DisputeOutcome =
  | 'BUYER_WIN'
  | 'SELLER_WIN'
  | 'SPLIT'
  | 'NO_CLAIM';

export interface DisputeEvidence {
  id: string;
  type: 'photo' | 'document' | 'gps' | 'weight' | 'lab' | 'statement';
  url?: string;
  description?: string;
  source: string;
  uploadedAt: string;
  uploadedBy?: string;
  trusted: boolean;
}

export interface MoneyHold {
  amountRub: number;
  reason: string;
  heldAt: string;
}

export interface Dispute {
  id: string;
  dealId: string;
  shipmentId?: string;
  status: DisputeStatus;
  type: string;
  claimAmountRub?: number;
  description: string;
  initiatorOrgId: string;
  severity?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  createdAt: string;
  updatedAt?: string;
  resolvedAt?: string;
  evidence: DisputeEvidence[];
  owner?: string;
  slaMinutes?: number;
  outcome?: DisputeOutcome;
  decisionNote?: string;
  moneyHold?: MoneyHold;
  bankBasisDocumentId?: string;
  slaDeadline?: string;
}

const ARBITRATOR_ROLES: Set<Role> = new Set([Role.SUPPORT_MANAGER, Role.ADMIN]);
const INITIATE_ROLES: Set<Role> = new Set([Role.BUYER, Role.FARMER, Role.LAB, Role.SUPPORT_MANAGER, Role.ADMIN]);

@Injectable()
export class DisputesService {
  private readonly store: Dispute[] = [];
  private counter = 10;

  constructor() {
    this.store.push(
      {
        id: 'DISPUTE-001',
        dealId: 'DEAL-001',
        status: 'UNDER_REVIEW',
        type: 'quality',
        claimAmountRub: 127500,
        description: 'Влажность зерна 15.2% вместо заявленных 13%',
        initiatorOrgId: 'org-buyer-1',
        severity: 'MEDIUM',
        createdAt: '2026-04-01T14:00:00Z',
        evidence: [],
        owner: 'operator@demo.ru',
        slaMinutes: 180,
        slaDeadline: new Date('2026-04-01T14:00:00Z').toISOString(),
        moneyHold: {
          amountRub: 127500,
          reason: 'Удержание по спору качества',
          heldAt: '2026-04-01T14:05:00Z',
        },
      },
      {
        id: 'DISPUTE-002',
        dealId: 'DEAL-002',
        status: 'OPEN',
        type: 'weight',
        claimAmountRub: 86250,
        description: 'Расхождение веса на 7.5 тонн по весовой квитанции',
        initiatorOrgId: 'org-buyer-2',
        severity: 'HIGH',
        createdAt: '2026-04-03T09:00:00Z',
        evidence: [],
        slaMinutes: 30,
        slaDeadline: new Date('2026-04-03T09:30:00Z').toISOString(),
        moneyHold: {
          amountRub: 86250,
          reason: 'Удержание по спору веса',
          heldAt: '2026-04-03T09:05:00Z',
        },
      },
    );
  }

  list(user: RequestUser): Dispute[] {
    if (user.role === Role.SUPPORT_MANAGER || user.role === Role.ADMIN) {
      return [...this.store];
    }
    if (user.role === Role.BUYER || user.role === Role.FARMER) {
      return this.store.filter((d) => d.initiatorOrgId === user.orgId);
    }
    return [...this.store];
  }

  getOne(id: string, user: RequestUser): Dispute {
    const dispute = this.findOrThrow(id);
    // Initiating org can view their own dispute; others need arbitrator role
    if (user.role !== Role.SUPPORT_MANAGER && user.role !== Role.ADMIN) {
      if (dispute.initiatorOrgId !== user.orgId) {
        throw new ForbiddenException('Access denied to dispute');
      }
    }
    return dispute;
  }

  create(dto: CreateDisputeDto, user: RequestUser): Dispute {
    if (!INITIATE_ROLES.has(user.role)) {
      throw new ForbiddenException(`Role ${user.role} cannot create disputes`);
    }
    const slaMinutes = 240;
    const dispute: Dispute = {
      id: `DISPUTE-${String(++this.counter).padStart(3, '0')}`,
      dealId: dto.dealId,
      shipmentId: dto.shipmentId,
      status: 'OPEN',
      type: dto.reason,
      description: dto.detail || dto.reason,
      initiatorOrgId: user.orgId,
      severity: dto.claimAmountRub && dto.claimAmountRub > 500000 ? 'HIGH' : 'MEDIUM',
      claimAmountRub: dto.claimAmountRub,
      createdAt: new Date().toISOString(),
      evidence: [],
      slaMinutes,
      slaDeadline: new Date(Date.now() + slaMinutes * 60 * 1000).toISOString(),
      // Immediately create money hold for the claimed amount
      moneyHold: dto.claimAmountRub
        ? {
            amountRub: dto.claimAmountRub,
            reason: `Удержание по спору: ${dto.reason}`,
            heldAt: new Date().toISOString(),
          }
        : undefined,
    };
    this.store.push(dispute);
    return dispute;
  }

  triage(id: string, user: RequestUser): Dispute {
    if (!ARBITRATOR_ROLES.has(user.role)) {
      throw new ForbiddenException('Only arbitrators can triage disputes');
    }
    const dispute = this.findOrThrow(id);
    if (dispute.status !== 'OPEN') {
      throw new BadRequestException(
        `Dispute ${id} has status ${dispute.status}, expected OPEN for triage`,
      );
    }
    dispute.status = 'UNDER_REVIEW';
    dispute.updatedAt = new Date().toISOString();
    dispute.owner = user.email;
    return dispute;
  }

  addEvidence(id: string, evidence: Omit<DisputeEvidence, 'id' | 'uploadedAt'>, user: RequestUser): Dispute {
    const dispute = this.findOrThrow(id);
    const terminalStatuses: DisputeStatus[] = ['RESOLVED', 'CLOSED'];
    if (terminalStatuses.includes(dispute.status)) {
      throw new BadRequestException('Cannot add evidence to resolved dispute');
    }
    const TRUSTED_ROLES = new Set<Role>([Role.SUPPORT_MANAGER, Role.ADMIN, Role.LAB]);
    const trustedByRole = TRUSTED_ROLES.has(user.role);
    dispute.evidence.push({
      id: `EV-DISP-${Date.now()}`,
      uploadedAt: new Date().toISOString(),
      ...evidence,
      uploadedBy: user.id,
      // Role-based trust always wins over caller-provided flag
      trusted: trustedByRole,
    });
    dispute.updatedAt = new Date().toISOString();
    return dispute;
  }

  decision(id: string, dto: DecideDisputeDto, user: RequestUser): Dispute & { moneyInstruction: MoneyInstruction } {
    if (!ARBITRATOR_ROLES.has(user.role)) {
      throw new ForbiddenException('Only arbitrators can decide disputes');
    }
    const dispute = this.findOrThrow(id);
    const terminalStatuses: DisputeStatus[] = ['RESOLVED', 'CLOSED'];
    if (terminalStatuses.includes(dispute.status)) {
      throw new BadRequestException(`Dispute ${id} is already resolved (${dispute.status})`);
    }
    dispute.outcome = dto.outcome as DisputeOutcome;
    dispute.decisionNote = dto.note;
    dispute.status = 'RESOLVED';
    dispute.resolvedAt = new Date().toISOString();
    dispute.updatedAt = dispute.resolvedAt;
    dispute.bankBasisDocumentId = `BANK-BASIS-${dispute.id}`;

    const moneyInstruction = this.buildMoneyInstruction(dispute, dto);

    return { ...dispute, moneyInstruction };
  }

  private buildMoneyInstruction(dispute: Dispute, dto: DecideDisputeDto): MoneyInstruction {
    const holdAmount = dispute.moneyHold?.amountRub ?? dispute.claimAmountRub ?? 0;
    switch (dispute.outcome) {
      case 'BUYER_WIN':
        return {
          action: 'REFUND_BUYER',
          amountRub: holdAmount,
          note: dto.note ?? 'Решение в пользу покупателя — возврат удержания',
          bankBasisDocumentId: dispute.bankBasisDocumentId,
        };
      case 'SELLER_WIN':
        return {
          action: 'RELEASE_TO_SELLER',
          amountRub: holdAmount,
          note: dto.note ?? 'Решение в пользу продавца — снятие удержания',
          bankBasisDocumentId: dispute.bankBasisDocumentId,
        };
      case 'SPLIT': {
        const sellerShare = Math.round(holdAmount * 0.5);
        return {
          action: 'SPLIT_RELEASE',
          amountRub: holdAmount,
          sellerShareRub: sellerShare,
          buyerRefundRub: holdAmount - sellerShare,
          note: dto.note ?? 'Пропорциональное разделение удержания',
          bankBasisDocumentId: dispute.bankBasisDocumentId,
        };
      }
      default:
        return {
          action: 'RELEASE_TO_SELLER',
          amountRub: holdAmount,
          note: dto.note ?? 'Спор закрыт без претензий',
          bankBasisDocumentId: dispute.bankBasisDocumentId,
        };
    }
  }

  private findOrThrow(id: string): Dispute {
    const dispute = this.store.find((d) => d.id === id);
    if (!dispute) throw new NotFoundException(`Спор ${id} не найден`);
    return dispute;
  }
}

export interface MoneyInstruction {
  action: 'REFUND_BUYER' | 'RELEASE_TO_SELLER' | 'SPLIT_RELEASE';
  amountRub: number;
  sellerShareRub?: number;
  buyerRefundRub?: number;
  note?: string;
  bankBasisDocumentId?: string;
}
