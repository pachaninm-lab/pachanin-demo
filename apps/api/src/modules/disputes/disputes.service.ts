import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { CreateDisputeDto } from './dto/create-dispute.dto';
import { DecideDisputeDto } from './dto/decide-dispute.dto';

export type DisputeStatus =
  | 'OPEN'
  | 'UNDER_REVIEW'
  | 'EXPERTISE'
  | 'DECISION'
  | 'PARTIAL_OUTCOME'
  | 'RESOLVED'
  | 'CLOSED';

export interface DisputeEvidence {
  id: string;
  type: string;
  url?: string;
  uploadedAt: string;
  uploadedBy?: string;
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
  outcome?: string;
  decisionNote?: string;
}

@Injectable()
export class DisputesService {
  private readonly store: Dispute[] = [];

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
      },
    );
  }

  list(user: any): Dispute[] {
    const role: string = user?.role || user?.roles?.[0] || '';
    const orgId: string = user?.orgId || user?.org?.id || '';

    if (role === 'SUPPORT_MANAGER') {
      return [...this.store];
    }
    if (role === 'BUYER' || role === 'FARMER') {
      return this.store.filter((d) => d.initiatorOrgId === orgId);
    }
    return [...this.store];
  }

  getOne(id: string, user: any): Dispute {
    return this.findOrThrow(id);
  }

  create(dto: CreateDisputeDto, user: any): Dispute {
    const dispute: Dispute = {
      id: `DISPUTE-${Date.now()}`,
      dealId: dto.dealId,
      shipmentId: dto.shipmentId,
      status: 'OPEN',
      type: dto.reason,
      description: dto.detail || dto.reason,
      initiatorOrgId: user?.orgId || user?.org?.id || 'demo-org',
      createdAt: new Date().toISOString(),
      evidence: [],
    };
    this.store.push(dispute);
    return dispute;
  }

  triage(id: string, user: any): Dispute {
    const dispute = this.findOrThrow(id);
    if (dispute.status !== 'OPEN') {
      throw new BadRequestException(
        `Спор ${id} имеет статус ${dispute.status}, ожидался OPEN для триажа`,
      );
    }
    dispute.status = 'UNDER_REVIEW';
    dispute.updatedAt = new Date().toISOString();
    if (!dispute.owner && user?.email) {
      dispute.owner = user.email;
    }
    return dispute;
  }

  decision(id: string, dto: DecideDisputeDto, user: any): Dispute {
    const dispute = this.findOrThrow(id);
    const terminalStatuses: DisputeStatus[] = ['RESOLVED', 'CLOSED'];
    if (terminalStatuses.includes(dispute.status)) {
      throw new BadRequestException(
        `Спор ${id} уже завершён (статус: ${dispute.status})`,
      );
    }
    dispute.outcome = dto.outcome;
    dispute.decisionNote = dto.note;
    dispute.status = 'RESOLVED';
    dispute.resolvedAt = new Date().toISOString();
    dispute.updatedAt = dispute.resolvedAt;
    return dispute;
  }

  private findOrThrow(id: string): Dispute {
    const dispute = this.store.find((d) => d.id === id);
    if (!dispute) throw new NotFoundException(`Спор ${id} не найден`);
    return dispute;
  }
}
