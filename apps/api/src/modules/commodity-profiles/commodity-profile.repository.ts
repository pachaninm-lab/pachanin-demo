import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
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

type ProfileRow = {
  id: string;
  canonicalCode: string;
  archetype: string;
  authoritativeNameRu: string;
  displayNameEn: string | null;
  displayNameZh: string | null;
  classification: CommodityProfileClassification;
  version: bigint;
  updatedAt: Date;
  profileVersionId: string | null;
  sequence: number | null;
  lifecycle: CommodityProfileLifecycle | null;
  sourceStatus: string | null;
  effectiveFrom: Date | null;
  effectiveTo: Date | null;
  contentHash: string | null;
  content: Prisma.JsonValue | null;
};

export type CommodityProfileListQuery = {
  limit?: number;
  cursor?: string;
  lifecycle?: CommodityProfileLifecycle;
  archetype?: string;
  sourceStatus?: string;
  search?: string;
  effectiveAt?: string;
  hasJitAuthority?: boolean;
};

export type CommodityProfileReadModel = {
  id: string;
  canonicalCode: string;
  archetype: string;
  authoritativeNameRu: string;
  displayNameEn: string | null;
  displayNameZh: string | null;
  classification: CommodityProfileClassification;
  version: string;
  updatedAt: string;
  selectedVersion: null | {
    id: string;
    sequence: number;
    lifecycle: CommodityProfileLifecycle;
    sourceStatus: string;
    effectiveFrom: string | null;
    effectiveTo: string | null;
    contentHash: string;
    content: Prisma.JsonValue;
  };
  actions: ReturnType<typeof deriveCommodityProfileActions>;
  primaryAction: ReturnType<typeof deriveCommodityProfilePrimaryAction>;
};

export type CommodityProfileListResult = {
  items: CommodityProfileReadModel[];
  nextCursor: string | null;
};

function boundedLimit(value: number | undefined): number {
  if (value === undefined) return 30;
  if (!Number.isInteger(value) || value < 1 || value > 100) {
    throw new RangeError('limit must be an integer between 1 and 100');
  }
  return value;
}

function parseDate(value: string | undefined, field: string): Date | null {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) throw new RangeError(`${field} must be an ISO-8601 timestamp`);
  return parsed;
}

function encodeCursor(row: Pick<ProfileRow, 'updatedAt' | 'id'>): string {
  return Buffer.from(JSON.stringify({ updatedAt: row.updatedAt.toISOString(), id: row.id }), 'utf8').toString('base64url');
}

function decodeCursor(value: string | undefined): { updatedAt: Date; id: string } | null {
  if (!value) return null;
  try {
    const candidate = JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as Record<string, unknown>;
    if (typeof candidate.id !== 'string' || !candidate.id || typeof candidate.updatedAt !== 'string') throw new Error();
    const updatedAt = new Date(candidate.updatedAt);
    if (Number.isNaN(updatedAt.getTime())) throw new Error();
    return { updatedAt, id: candidate.id };
  } catch {
    throw new RangeError('cursor is invalid');
  }
}

function normalizedOptional(value: string | undefined, maxLength: number): string | null {
  const normalized = value?.trim();
  if (!normalized) return null;
  if (normalized.length > maxLength) throw new RangeError('filter is too long');
  return normalized;
}

@Injectable()
export class CommodityProfileRepository {
  constructor(private readonly rls: RlsTransactionService) {}

  async list(
    user: RequestUser,
    query: CommodityProfileListQuery = {},
  ): Promise<CommodityProfileListResult> {
    this.assertReadAllowed(user, 'INTERNAL');
    const limit = boundedLimit(query.limit);
    const cursor = decodeCursor(query.cursor);
    const lifecycle = query.lifecycle ?? null;
    const archetype = normalizedOptional(query.archetype, 40);
    const sourceStatus = normalizedOptional(query.sourceStatus, 32);
    const search = normalizedOptional(query.search, 200);
    const effectiveAt = parseDate(query.effectiveAt, 'effectiveAt');

    return this.rls.withTrustedContext(user, async (tx) => {
      const rows = await tx.$queryRaw<ProfileRow[]>(Prisma.sql`
        SELECT
          profile."id",
          profile."canonicalCode",
          profile."archetype",
          profile."authoritativeNameRu",
          profile."displayNameEn",
          profile."displayNameZh",
          profile."classification",
          profile."version",
          profile."updatedAt",
          selected."id" AS "profileVersionId",
          selected."sequence",
          selected."status" AS "lifecycle",
          selected."sourceStatus",
          selected."effectiveFrom",
          selected."effectiveTo",
          selected."contentHash",
          selected."content"
        FROM public."commodity_profiles" profile
        LEFT JOIN LATERAL (
          SELECT version.*
          FROM public."commodity_profile_versions" version
          WHERE version."profileId" = profile."id"
            AND (${lifecycle}::text IS NULL OR version."status" = ${lifecycle})
            AND (${sourceStatus}::text IS NULL OR version."sourceStatus" = ${sourceStatus})
            AND (
              ${effectiveAt}::timestamptz IS NULL
              OR (
                version."effectiveFrom" <= ${effectiveAt}
                AND (version."effectiveTo" IS NULL OR version."effectiveTo" > ${effectiveAt})
              )
            )
          ORDER BY
            CASE WHEN ${effectiveAt}::timestamptz IS NOT NULL AND version."status" = 'EFFECTIVE' THEN 0 ELSE 1 END,
            version."sequence" DESC,
            version."id" DESC
          LIMIT 1
        ) selected ON TRUE
        WHERE (${archetype}::text IS NULL OR profile."archetype" = ${archetype})
          AND (
            ${search}::text IS NULL
            OR profile."canonicalCode" ILIKE '%' || ${search} || '%'
            OR profile."authoritativeNameRu" ILIKE '%' || ${search} || '%'
            OR profile."displayNameEn" ILIKE '%' || ${search} || '%'
            OR profile."displayNameZh" ILIKE '%' || ${search} || '%'
          )
          AND (${lifecycle}::text IS NULL OR selected."id" IS NOT NULL)
          AND (${sourceStatus}::text IS NULL OR selected."id" IS NOT NULL)
          AND (${effectiveAt}::timestamptz IS NULL OR selected."id" IS NOT NULL)
          AND (
            ${cursor?.updatedAt ?? null}::timestamptz IS NULL
            OR (profile."updatedAt", profile."id") < (${cursor?.updatedAt ?? null}, ${cursor?.id ?? null})
          )
        ORDER BY profile."updatedAt" DESC, profile."id" DESC
        LIMIT ${limit + 1}
      `);

      const visible = rows.filter((row) => this.readAllowed(user, row.classification));
      const page = visible.slice(0, limit);
      return {
        items: page.map((row) => this.map(row, user, Boolean(query.hasJitAuthority))),
        nextCursor: rows.length > limit && page.length > 0 ? encodeCursor(page[page.length - 1]) : null,
      };
    });
  }

  async getById(
    user: RequestUser,
    profileId: string,
    options: { versionId?: string; effectiveAt?: string; hasJitAuthority?: boolean } = {},
  ): Promise<CommodityProfileReadModel> {
    this.assertReadAllowed(user, 'INTERNAL');
    const effectiveAt = parseDate(options.effectiveAt, 'effectiveAt');
    const versionId = normalizedOptional(options.versionId, 240);

    return this.rls.withTrustedContext(user, async (tx) => {
      const rows = await tx.$queryRaw<ProfileRow[]>(Prisma.sql`
        SELECT
          profile."id", profile."canonicalCode", profile."archetype",
          profile."authoritativeNameRu", profile."displayNameEn", profile."displayNameZh",
          profile."classification", profile."version", profile."updatedAt",
          selected."id" AS "profileVersionId", selected."sequence",
          selected."status" AS "lifecycle", selected."sourceStatus",
          selected."effectiveFrom", selected."effectiveTo",
          selected."contentHash", selected."content"
        FROM public."commodity_profiles" profile
        LEFT JOIN LATERAL (
          SELECT version.*
          FROM public."commodity_profile_versions" version
          WHERE version."profileId" = profile."id"
            AND (${versionId}::text IS NULL OR version."id" = ${versionId})
            AND (
              ${effectiveAt}::timestamptz IS NULL
              OR (
                version."effectiveFrom" <= ${effectiveAt}
                AND (version."effectiveTo" IS NULL OR version."effectiveTo" > ${effectiveAt})
              )
            )
          ORDER BY version."sequence" DESC, version."id" DESC
          LIMIT 1
        ) selected ON TRUE
        WHERE profile."id" = ${profileId}
        LIMIT 1
      `);
      const row = rows[0];
      if (!row || (versionId && !row.profileVersionId) || (effectiveAt && !row.profileVersionId)) {
        throw new NotFoundException({ code: 'COMMODITY_PROFILE_NOT_FOUND' });
      }
      if (!this.readAllowed(user, row.classification)) {
        throw new ForbiddenException({ code: 'COMMODITY_PROFILE_CLASSIFICATION_DENIED' });
      }
      return this.map(row, user, Boolean(options.hasJitAuthority));
    });
  }

  private map(row: ProfileRow, user: RequestUser, hasJitAuthority: boolean): CommodityProfileReadModel {
    const actions = row.lifecycle
      ? deriveCommodityProfileActions(user, row.lifecycle, row.classification, hasJitAuthority)
      : [];
    const primaryAction = row.lifecycle
      ? deriveCommodityProfilePrimaryAction(user, row.lifecycle, row.classification, hasJitAuthority)
      : null;

    return {
      id: row.id,
      canonicalCode: row.canonicalCode,
      archetype: row.archetype,
      authoritativeNameRu: row.authoritativeNameRu,
      displayNameEn: row.displayNameEn,
      displayNameZh: row.displayNameZh,
      classification: row.classification,
      version: row.version.toString(),
      updatedAt: row.updatedAt.toISOString(),
      selectedVersion: row.profileVersionId && row.sequence && row.lifecycle && row.sourceStatus && row.contentHash && row.content
        ? {
            id: row.profileVersionId,
            sequence: row.sequence,
            lifecycle: row.lifecycle,
            sourceStatus: row.sourceStatus,
            effectiveFrom: row.effectiveFrom?.toISOString() ?? null,
            effectiveTo: row.effectiveTo?.toISOString() ?? null,
            contentHash: row.contentHash,
            content: row.content,
          }
        : null,
      actions,
      primaryAction,
    };
  }

  private readAllowed(user: RequestUser, classification: CommodityProfileClassification): boolean {
    return decideCommodityProfileAction({
      user,
      action: CommodityProfileAction.READ,
      classification,
    }).allowed;
  }

  private assertReadAllowed(user: RequestUser, classification: CommodityProfileClassification): void {
    const decision = decideCommodityProfileAction({ user, action: CommodityProfileAction.READ, classification });
    if (!decision.allowed) throw new ForbiddenException({ code: decision.reasonCode });
  }
}
