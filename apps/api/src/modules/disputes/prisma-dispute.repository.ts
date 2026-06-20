import { Injectable, Optional } from '@nestjs/common';
import type {
  Dispute,
  DisputeOutcome,
  DisputeStatus,
} from './disputes.service';
import type { DisputeRepository } from './dispute.repository';
import { PrismaService } from '../../common/prisma/prisma.service';

/**
 * DB-backed dispute repository skeleton (pre-integration, disabled by default).
 * Selected only under PLATFORM_V7_DISPUTE_REPOSITORY=prisma. Supports the
 * `list()` read snapshot only; getById/add are not supported and fail loudly.
 *
 * Money safety: the DB-backed mutation path (which carries money holds and
 * decision money instructions) is intentionally NOT activated here. There is no
 * silent fallback to the runtime store and no live integration. Money logic
 * stays in DisputesService.
 */
@Injectable()
export class PrismaDisputeRepository implements DisputeRepository {
  constructor(@Optional() private readonly prisma?: PrismaService) {
    if (!this.prisma) {
      throw new Error(
        'PrismaDisputeRepository requires PrismaService, but it is not available. ' +
          'DB-backed dispute path is not active.',
      );
    }
  }

  private get db(): PrismaService {
    if (!this.prisma) {
      throw new Error(
        'PrismaDisputeRepository: PrismaService unavailable — DB-backed dispute path not active.',
      );
    }
    return this.prisma;
  }

  async list(): Promise<Dispute[]> {
    const rows = await this.db.dispute.findMany({
      include: { evidence: true, moneyHold: true },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((r) => prismaRowToDispute(r));
  }

  getById(): Dispute | undefined {
    throw new Error(
      'PrismaDisputeRepository.getById is not supported — DB-backed dispute mutation path is not active.',
    );
  }

  add(): void {
    throw new Error(
      'PrismaDisputeRepository.add is not supported — DB-backed dispute write path is not active.',
    );
  }
}

/**
 * Maps a Prisma dispute row (with evidence + moneyHold relations) onto the
 * domain Dispute shape. Read-only projection; identical to the mapping that
 * previously lived inline in DisputesService.
 */
function prismaRowToDispute(r: any): Dispute {
  return {
    id: r.id,
    dealId: r.dealId,
    shipmentId: r.shipmentId ?? undefined,
    status: r.status as DisputeStatus,
    type: r.type,
    claimAmountRub: r.claimAmountRub ?? undefined,
    description: r.description,
    initiatorOrgId: r.initiatorOrgId,
    severity: (r.severity ?? 'MEDIUM') as any,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt?.toISOString(),
    resolvedAt: r.resolvedAt?.toISOString(),
    outcome: r.outcome as DisputeOutcome | undefined,
    evidence: (r.evidence ?? []).map((e: any) => ({
      id: e.id,
      type: e.type as any,
      description: e.description,
      source: e.submittedBy,
      uploadedAt: e.submittedAt.toISOString(),
      uploadedBy: e.submittedBy,
      trusted: e.trusted,
    })),
    moneyHold: r.moneyHold
      ? {
          amountRub: r.moneyHold.amountRub,
          reason: r.moneyHold.reason,
          heldAt: r.moneyHold.heldAt.toISOString(),
        }
      : undefined,
  };
}
