import { Injectable } from '@nestjs/common';
import type { Dispute } from './disputes.service';
import type { DisputeRepository } from './dispute.repository';

/**
 * Default dispute repository adapter. Owns the in-memory dispute store and its
 * pilot seed data, exactly as DisputesService held it before the boundary was
 * extracted. Only active adapter in controlled-pilot.
 *
 * `getById` returns the live store object so the service can apply in-place
 * status/evidence/decision mutations without changing behavior.
 */
@Injectable()
export class RuntimeDisputeRepository implements DisputeRepository {
  private readonly store: Dispute[] = [
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
  ];

  async list(): Promise<Dispute[]> {
    return [...this.store];
  }

  getById(id: string): Dispute | undefined {
    return this.store.find((d) => d.id === id);
  }

  add(dispute: Dispute): void {
    this.store.push(dispute);
  }
}
