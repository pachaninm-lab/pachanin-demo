import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { RlsTransactionService } from '../../common/prisma/rls-transaction.service';
import type { RequestUser } from '../../common/types/request-user';
import {
  CommodityProfileAction,
  decideCommodityProfileAction,
  deriveCommodityProfileActions,
  deriveCommodityProfilePrimaryAction,
  type CommodityProfileClassification,
  type CommodityProfileLifecycle,
} from './commodity-profile.policy';

type VersionCursor = {
  sequence: number;
  id: string;
};

export type CommodityProfileVersionHistoryQuery = {
  limit?: number;
  cursor?: string;
  hasJitAuthority?: boolean;
};

export type CommodityProfileVersionHistoryItem = {
  id: string;
  sequence: number;
  lifecycle: CommodityProfileLifecycle;
  sourceStatus: string;
  contentHash: string;
  effectiveFrom: string | null;
  effectiveTo: string | null;
  approvalReason: string | null;
  approvedByUserId: string | null;
  approvedAt: string | null;
  version: string;
  createdAt: string;
  createdByUserId: string;
  updatedAt: string;
  updatedByUserId: string;
  actions: ReturnType<typeof deriveCommodityProfileActions>;
  primaryAction: ReturnType<typeof deriveCommodityProfilePrimaryAction>;
};

export type CommodityProfileVersionHistoryResult = {
  profileId: string;
  aggregateVersion: string;
  items: CommodityProfileVersionHistoryItem[];
  nextCursor: string | null;
};

function boundedLimit(value: number | undefined): number {
  if (value === undefined) return 30;
  if (!Number.isInteger(value) || value < 1 || value > 100) {
    throw new RangeError('limit must be an integer between 1 and 100');
  }
  return value;
}

function encodeCursor(cursor: VersionCursor): string {
  return Buffer.from(JSON.stringify(cursor), 'utf8').toString('base64url');
}

function decodeCursor(value: string | undefined): VersionCursor | null {
  if (!value) return null;
  try {
    const candidate = JSON.parse(
      Buffer.from(value, 'base64url').toString('utf8'),
    ) as Record<string, unknown>;
    if (
      !Number.isInteger(candidate.sequence)
      || Number(candidate.sequence) < 1
      || typeof candidate.id !== 'string'
      || !candidate.id
      || candidate.id.length > 240
    ) {
      throw new Error('invalid cursor');
    }
    return { sequence: Number(candidate.sequence), id: candidate.id };
  } catch {
    throw new RangeError('cursor is invalid');
  }
}

@Injectable()
export class CommodityProfileVersionHistoryRepository {
  constructor(private readonly rls: RlsTransactionService) {}

  async list(
    user: RequestUser,
    profileId: string,
    query: CommodityProfileVersionHistoryQuery = {},
  ): Promise<CommodityProfileVersionHistoryResult> {
    const limit = boundedLimit(query.limit);
    const cursor = decodeCursor(query.cursor);

    return this.rls.withTrustedContext(user, async (tx) => {
      const profile = await tx.commodityProfile.findUnique({
        where: { id: profileId },
        select: { id: true, classification: true, version: true },
      });
      if (!profile) {
        throw new NotFoundException({ code: 'COMMODITY_PROFILE_NOT_FOUND' });
      }

      const classification = profile.classification as CommodityProfileClassification;
      const decision = decideCommodityProfileAction({
        user,
        action: CommodityProfileAction.READ,
        classification,
      });
      if (!decision.allowed) {
        throw new ForbiddenException({ code: decision.reasonCode });
      }

      const rows = await tx.commodityProfileVersion.findMany({
        where: {
          profileId,
          ...(cursor
            ? {
                OR: [
                  { sequence: { lt: cursor.sequence } },
                  { sequence: cursor.sequence, id: { lt: cursor.id } },
                ],
              }
            : {}),
        },
        orderBy: [{ sequence: 'desc' }, { id: 'desc' }],
        take: limit + 1,
        select: {
          id: true,
          sequence: true,
          status: true,
          sourceStatus: true,
          contentHash: true,
          effectiveFrom: true,
          effectiveTo: true,
          approvalReason: true,
          approvedByUserId: true,
          approvedAt: true,
          version: true,
          createdAt: true,
          createdByUserId: true,
          updatedAt: true,
          updatedByUserId: true,
        },
      });

      const page = rows.slice(0, limit);
      return {
        profileId: profile.id,
        aggregateVersion: profile.version.toString(),
        items: page.map((row) => {
          const lifecycle = row.status as CommodityProfileLifecycle;
          return {
            id: row.id,
            sequence: row.sequence,
            lifecycle,
            sourceStatus: row.sourceStatus,
            contentHash: row.contentHash,
            effectiveFrom: row.effectiveFrom?.toISOString() ?? null,
            effectiveTo: row.effectiveTo?.toISOString() ?? null,
            approvalReason: row.approvalReason,
            approvedByUserId: row.approvedByUserId,
            approvedAt: row.approvedAt?.toISOString() ?? null,
            version: row.version.toString(),
            createdAt: row.createdAt.toISOString(),
            createdByUserId: row.createdByUserId,
            updatedAt: row.updatedAt.toISOString(),
            updatedByUserId: row.updatedByUserId,
            actions: deriveCommodityProfileActions(
              user,
              lifecycle,
              classification,
              Boolean(query.hasJitAuthority),
            ),
            primaryAction: deriveCommodityProfilePrimaryAction(
              user,
              lifecycle,
              classification,
              Boolean(query.hasJitAuthority),
            ),
          };
        }),
        nextCursor: rows.length > limit && page.length > 0
          ? encodeCursor({
              sequence: page[page.length - 1]!.sequence,
              id: page[page.length - 1]!.id,
            })
          : null,
      };
    });
  }
}
