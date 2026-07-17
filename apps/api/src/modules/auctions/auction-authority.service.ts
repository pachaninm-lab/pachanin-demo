import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  RlsTransactionService,
  type TrustedRlsContext,
} from '../../common/prisma/rls-transaction.service';
import { Role, type RequestUser } from '../../common/types/request-user';

const LOT_ID_PATTERN = /^[^\u0000-\u001F\u007F]{1,200}$/;
const MAX_SAFE_BIGINT = BigInt(Number.MAX_SAFE_INTEGER);
const LOT_PAGE_LIMIT = 500;

type DatabaseClockRow = Readonly<{
  observed_at: Date;
  tx_id: bigint;
  database_name: string;
}>;

type AuctionLotRow = Readonly<{
  id: string;
  tenant_id: string;
  seller_org_id: string;
  title: string;
  culture: string;
  grade: string | null;
  volume_tons: string;
  start_price_rub_per_ton: string;
  step_price_rub_per_ton: string;
  region: string;
  address: string | null;
  status: string;
  auction_ends_at: Date;
  source_type: string;
  source_external_id: string | null;
  source_certificate_id: string | null;
  source_verified_at: Date | null;
  admission_status: string;
  auto_extend_enabled: boolean;
  auto_extend_window_minutes: number;
  auto_extend_minutes: number;
  version: bigint;
  updated_at: Date;
}>;

type AuctionBidRow = Readonly<{
  id: string;
  buyer_org_id: string;
  buyer_name: string;
  amount_rub_per_ton: string;
  status: string;
  version: bigint;
}>;

type AuctionBidSummaryRow = Readonly<{
  active_count: bigint;
  winner_count: bigint;
  max_version: bigint | null;
}>;

type AuctionAwardRow = Readonly<{
  id: string;
  winning_bid_id: string;
  deal_id: string | null;
  award_status: string;
  award_version: bigint;
  deal_exists: string | null;
  deal_tenant_id: string | null;
  deal_source_lot_id: string | null;
  deal_version: bigint | null;
}>;

type OriginModeRow = Readonly<{
  source_type: string;
  lot_count: bigint;
  version: bigint;
}>;

type AuctionAuthorityProof = Readonly<{
  source: 'POSTGRESQL';
  scope: 'AUCTION';
  tenantId: string;
  actorId: string;
  observedAt: string;
  version: number;
  transactionId: string;
  database: string;
}>;

@Injectable()
export class AuctionAuthorityService {
  constructor(private readonly rls: RlsTransactionService) {}

  async listAccessibleLots(user: RequestUser) {
    return this.rls.withTrustedContext(user, async (tx, context) => {
      const clock = await readDatabaseClock(tx);
      const scope = lotVisibilityScope(user, context);
      const rows = await tx.$queryRaw<AuctionLotRow[]>(Prisma.sql`
        SELECT
          l.id,
          l.tenant_id,
          l.seller_org_id,
          l.title,
          l.culture,
          l.grade,
          l.volume_tons::text AS volume_tons,
          l.start_price_rub_per_ton::text AS start_price_rub_per_ton,
          l.step_price_rub_per_ton::text AS step_price_rub_per_ton,
          l.region,
          l.address,
          l.status,
          l.auction_ends_at,
          l.source_type,
          l.source_external_id,
          l.source_certificate_id,
          l.source_verified_at,
          l.admission_status,
          l.auto_extend_enabled,
          l.auto_extend_window_minutes,
          l.auto_extend_minutes,
          l.version,
          l.updated_at
        FROM auction.lots l
        WHERE l.tenant_id = ${context.tenantId}
          AND (${scope})
        ORDER BY l.updated_at DESC, l.id ASC
        LIMIT ${LOT_PAGE_LIMIT + 1}
      `);
      const hasMore = rows.length > LOT_PAGE_LIMIT;
      const page = rows.slice(0, LOT_PAGE_LIMIT);

      return {
        authority: authorityProof(context, clock, page.map((row) => row.version)),
        items: page.map(toAccessibleLot),
        pageInfo: {
          limit: LOT_PAGE_LIMIT,
          returned: page.length,
          hasMore,
        },
      };
    });
  }

  async listOriginModes(user: RequestUser) {
    return this.rls.withTrustedContext(user, async (tx, context) => {
      const clock = await readDatabaseClock(tx);
      const scope = lotVisibilityScope(user, context);
      const rows = await tx.$queryRaw<OriginModeRow[]>(Prisma.sql`
        SELECT
          l.source_type,
          count(*)::bigint AS lot_count,
          max(l.version)::bigint AS version
        FROM auction.lots l
        WHERE l.tenant_id = ${context.tenantId}
          AND (${scope})
        GROUP BY l.source_type
        ORDER BY l.source_type ASC
      `);

      return {
        authority: authorityProof(context, clock, rows.map((row) => row.version)),
        items: rows.map((row) => ({
          id: row.source_type,
          title: row.source_type,
          description: 'Server-persisted auction lot source',
          nextStep: null,
          lotCount: safeInteger(row.lot_count, 'origin lot count'),
        })),
      };
    });
  }

  async getWorkspace(lotIdInput: string, user: RequestUser) {
    const lotId = normalizeLotId(lotIdInput);

    return this.rls.withTrustedContext(user, async (tx, context) => {
      const clock = await readDatabaseClock(tx);
      const scope = lotVisibilityScope(user, context);
      const lots = await tx.$queryRaw<AuctionLotRow[]>(Prisma.sql`
        SELECT
          l.id,
          l.tenant_id,
          l.seller_org_id,
          l.title,
          l.culture,
          l.grade,
          l.volume_tons::text AS volume_tons,
          l.start_price_rub_per_ton::text AS start_price_rub_per_ton,
          l.step_price_rub_per_ton::text AS step_price_rub_per_ton,
          l.region,
          l.address,
          l.status,
          l.auction_ends_at,
          l.source_type,
          l.source_external_id,
          l.source_certificate_id,
          l.source_verified_at,
          l.admission_status,
          l.auto_extend_enabled,
          l.auto_extend_window_minutes,
          l.auto_extend_minutes,
          l.version,
          l.updated_at
        FROM auction.lots l
        WHERE l.id = ${lotId}
          AND (
            l.tenant_id = ${context.tenantId}
            OR EXISTS (
              SELECT 1
              FROM auction.admissions adm
              WHERE adm.lot_id = l.id
                AND adm.tenant_id = l.tenant_id
                AND adm.participant_org_id = ${context.orgId}
                AND adm.status = 'ADMITTED'
                AND adm.valid_until > now()
            )
          )
          AND (${scope})
        LIMIT 1
      `);
      const lot = lots[0];
      if (!lot) {
        throw new NotFoundException({ code: 'AUCTION_LOT_NOT_ACCESSIBLE' });
      }
      // Допущенный участник из другого tenant работает в контуре лота: все
      // дочерние выборки идут по tenant лота, доступ уже проверен допуском.
      const crossTenantParticipant = lot.tenant_id !== context.tenantId;

      const awards = await tx.$queryRaw<AuctionAwardRow[]>(Prisma.sql`
        SELECT
          a.id,
          a.winning_bid_id,
          a.deal_id,
          a.status AS award_status,
          a.version AS award_version,
          d.id AS deal_exists,
          d."tenantId" AS deal_tenant_id,
          COALESCE(d."sourceLotId", d."lotId") AS deal_source_lot_id,
          d.version AS deal_version
        FROM auction.awards a
        LEFT JOIN public.deals d ON d.id = a.deal_id
        WHERE a.tenant_id = ${lot.tenant_id}
          AND a.lot_id = ${lotId}
          AND a.status <> 'REVOKED'
        LIMIT 1
      `);
      const award = awards[0] ?? null;

      const summaries = await tx.$queryRaw<AuctionBidSummaryRow[]>(Prisma.sql`
        SELECT
          count(*) FILTER (
            WHERE b.status NOT IN ('REJECTED', 'CANCELLED')
          )::bigint AS active_count,
          count(*) FILTER (
            WHERE b.status IN ('WINNING', 'ACCEPTED')
          )::bigint AS winner_count,
          max(b.version) FILTER (
            WHERE b.status NOT IN ('REJECTED', 'CANCELLED')
          )::bigint AS max_version
        FROM auction.bids b
        WHERE b.tenant_id = ${lot.tenant_id}
          AND b.lot_id = ${lotId}
      `);
      const summary = summaries[0];
      if (!summary) {
        throw new InternalServerErrorException({ code: 'AUCTION_BID_SUMMARY_UNAVAILABLE' });
      }
      const bidCount = safeInteger(summary.active_count, 'auction bid count');
      const winnerCount = safeInteger(summary.winner_count, 'auction winner count');

      const selectedBidFilter = award
        ? Prisma.sql`AND b.id = ${award.winning_bid_id}`
        : Prisma.empty;
      const selectedBids = await tx.$queryRaw<AuctionBidRow[]>(Prisma.sql`
        SELECT
          b.id,
          b.buyer_org_id,
          b.buyer_name,
          b.amount_rub_per_ton::text AS amount_rub_per_ton,
          b.status,
          b.version
        FROM auction.bids b
        WHERE b.tenant_id = ${lot.tenant_id}
          AND b.lot_id = ${lotId}
          AND b.status NOT IN ('REJECTED', 'CANCELLED')
          ${selectedBidFilter}
        ORDER BY b.amount_rub_per_ton DESC, b.placed_at ASC, b.id ASC
        LIMIT 1
      `);
      const bestBid = selectedBids[0] ?? null;

      assertPersistedAuctionConsistency(
        lot,
        bidCount,
        winnerCount,
        bestBid,
        award,
        context,
        crossTenantParticipant,
      );

      const dealCreated = Boolean(
        award?.deal_id
          && award.award_status === 'DEAL_CREATED'
          && award.deal_exists
          && award.deal_tenant_id === lot.tenant_id
          && award.deal_source_lot_id === lot.id,
      );
      const observedAt = clock.observed_at;
      const blockers = workspaceBlockers(lot, award, dealCreated, observedAt);
      const liveStatus = lot.status === 'OPEN' || lot.status === 'BIDDING';
      const readyForLive = liveStatus
        && lot.auction_ends_at.getTime() > observedAt.getTime()
        && blockers.length === 0;
      const minutesToEnd = Math.max(
        0,
        Math.floor((lot.auction_ends_at.getTime() - observedAt.getTime()) / 60_000),
      );
      const nextRequiredMilestones = requiredMilestones(lot, bidCount, award, dealCreated);
      const versions = [
        lot.version,
        summary.max_version,
        award?.award_version,
        award?.deal_version,
      ].filter((value): value is bigint => typeof value === 'bigint');

      return {
        authority: authorityProof(context, clock, versions),
        workspace: {
          lotId: lot.id,
          title: lot.title,
          lotStatus: lot.status,
          originMode: {
            id: lot.source_type,
            title: lot.source_type,
            description: lot.source_verified_at
              ? 'Source verified and persisted by the server'
              : 'Source verification is required',
            nextStep: originNextStep(lot),
          },
          readiness: {
            score: Math.max(0, 100 - blockers.length * 20),
            band: blockers.length === 0
              ? (readyForLive ? 'READY' : 'COMPLETE')
              : blockers.length <= 2
                ? 'REVIEW'
                : 'BLOCKED',
            blockers,
            readyForLive,
            bestBid: bestBid ? finiteNumber(bestBid.amount_rub_per_ton, 'best bid') : null,
            nextAction: nextAction(lot, bidCount, award, dealCreated),
          },
          timer: {
            auctionEndsAt: lot.auction_ends_at.toISOString(),
            minutesToEnd,
            shouldAutoExtend: Boolean(
              readyForLive
                && lot.auto_extend_enabled
                && minutesToEnd <= lot.auto_extend_window_minutes,
            ),
            autoExtendMinutes: lot.auto_extend_minutes,
          },
          bestBid: bestBid
            ? presentBid(bestBid, award, user, context)
            : null,
          bidCount,
          executionBridge: {
            dealCreated,
            dealId: dealCreated ? award?.deal_id ?? null : null,
            nextRequiredMilestones,
          },
        },
      };
    });
  }
}

function normalizeLotId(value: string): string {
  const normalized = value?.trim();
  if (!normalized || !LOT_ID_PATTERN.test(normalized)) {
    throw new BadRequestException({ code: 'INVALID_AUCTION_LOT_ID' });
  }
  return normalized;
}

function lotVisibilityScope(user: RequestUser, context: TrustedRlsContext): Prisma.Sql {
  switch (user.role) {
    case Role.FARMER:
      return Prisma.sql`l.seller_org_id = ${context.orgId}`;
    case Role.BUYER:
      return Prisma.sql`l.status IN ('OPEN', 'BIDDING', 'MATCHED', 'IN_DEAL')`;
    case Role.SUPPORT_MANAGER:
    case Role.ADMIN:
    case Role.COMPLIANCE_OFFICER:
    case Role.EXECUTIVE:
      return Prisma.sql`TRUE`;
    default:
      return Prisma.sql`FALSE`;
  }
}

async function readDatabaseClock(
  tx: Prisma.TransactionClient,
): Promise<DatabaseClockRow> {
  const rows = await tx.$queryRaw<DatabaseClockRow[]>(Prisma.sql`
    SELECT
      transaction_timestamp() AS observed_at,
      txid_current() AS tx_id,
      current_database() AS database_name
  `);
  const row = rows[0];
  if (!row?.observed_at || typeof row.database_name !== 'string') {
    throw new InternalServerErrorException({ code: 'AUCTION_POSTGRESQL_CLOCK_UNAVAILABLE' });
  }
  return row;
}

function authorityProof(
  context: TrustedRlsContext,
  clock: DatabaseClockRow,
  versions: readonly bigint[],
): AuctionAuthorityProof {
  const version = versions.length > 0
    ? Math.max(...versions.map((value) => safeVersion(value)))
    : 1;
  return Object.freeze({
    source: 'POSTGRESQL',
    scope: 'AUCTION',
    tenantId: context.tenantId,
    actorId: context.userId,
    observedAt: clock.observed_at.toISOString(),
    version,
    transactionId: clock.tx_id.toString(),
    database: clock.database_name,
  });
}

function toAccessibleLot(row: AuctionLotRow) {
  return {
    id: row.id,
    title: row.title,
    culture: row.culture,
    grade: row.grade,
    volumeTons: finiteNumber(row.volume_tons, 'lot volume'),
    startPrice: finiteNumber(row.start_price_rub_per_ton, 'lot start price'),
    stepPrice: finiteNumber(row.step_price_rub_per_ton, 'lot price step'),
    region: row.region,
    address: row.address,
    status: row.status,
    auctionEndsAt: row.auction_ends_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

function workspaceBlockers(
  lot: AuctionLotRow,
  award: AuctionAwardRow | null,
  dealCreated: boolean,
  observedAt: Date,
): string[] {
  const blockers: string[] = [];
  if (!lot.source_external_id?.trim()) blockers.push('source_external_id_required');
  if (!lot.source_verified_at) blockers.push('source_verification_required');
  if (lot.admission_status !== 'ADMITTED') {
    blockers.push(`admission_${lot.admission_status.toLowerCase()}`);
  }
  if (lot.status === 'DRAFT' || lot.status === 'CANCELLED') {
    blockers.push(`lot_status_${lot.status.toLowerCase()}`);
  }
  if (
    (lot.status === 'OPEN' || lot.status === 'BIDDING')
    && lot.auction_ends_at.getTime() <= observedAt.getTime()
  ) {
    blockers.push('auction_window_closed');
  }
  if (lot.status === 'MATCHED' || lot.status === 'IN_DEAL' || lot.status === 'CLOSED') {
    if (!award) blockers.push('server_award_required');
    else if (!dealCreated) blockers.push('server_deal_creation_pending');
  }
  return blockers;
}

function requiredMilestones(
  lot: AuctionLotRow,
  bidCount: number,
  award: AuctionAwardRow | null,
  dealCreated: boolean,
): string[] {
  const milestones: string[] = [];
  if (!lot.source_external_id?.trim() || !lot.source_verified_at) milestones.push('verify_lot_source');
  if (lot.admission_status !== 'ADMITTED') milestones.push('complete_admission');
  if (bidCount === 0) milestones.push('receive_server_bid');
  if (bidCount > 0 && !award) milestones.push('issue_server_award');
  if (award && !dealCreated) milestones.push('create_canonical_deal');
  return milestones;
}

const AUCTION_OVERSIGHT_ROLES: ReadonlySet<Role> = new Set([
  Role.SUPPORT_MANAGER,
  Role.ADMIN,
  Role.COMPLIANCE_OFFICER,
  Role.EXECUTIVE,
]);

type PresentedBid = Readonly<{
  id: string;
  amount: number;
  buyerName: string | null;
  buyerOrgId: string | null;
  status: string;
  isOwn: boolean;
  anonymized: boolean;
}>;

/**
 * Обезличивание ставок между конкурентами (решение владельца, 16.07.2026).
 * До итога торгов участники видят только цену и статус: идентичность чужой
 * ставки скрыта, чтобы исключить сговор и сделку в обход платформы. Свою
 * ставку участник видит как свою. Надзорные роли видят всё; победитель
 * раскрывается после присуждения (award) — сделка всё равно раскрывает стороны.
 */
function presentBid(
  bid: AuctionBidRow,
  award: AuctionAwardRow | null,
  user: RequestUser,
  context: TrustedRlsContext,
): PresentedBid {
  const isOwn = bid.buyer_org_id === context.orgId;
  const oversight = AUCTION_OVERSIGHT_ROLES.has(user.role);
  const awarded = Boolean(award && award.winning_bid_id === bid.id);
  const disclosed = oversight || isOwn || awarded;
  return {
    id: bid.id,
    amount: finiteNumber(bid.amount_rub_per_ton, 'best bid'),
    buyerName: disclosed ? bid.buyer_name : null,
    buyerOrgId: disclosed ? bid.buyer_org_id : null,
    status: bid.status,
    isOwn,
    anonymized: !disclosed,
  };
}

function originNextStep(lot: AuctionLotRow): string | null {
  if (!lot.source_external_id?.trim() || !lot.source_verified_at) return 'VERIFY_SOURCE';
  if (lot.admission_status !== 'ADMITTED') return 'COMPLETE_ADMISSION';
  return null;
}

function nextAction(
  lot: AuctionLotRow,
  bidCount: number,
  award: AuctionAwardRow | null,
  dealCreated: boolean,
): string {
  if (!lot.source_external_id?.trim() || !lot.source_verified_at) return 'VERIFY_SOURCE';
  if (lot.admission_status !== 'ADMITTED') return 'COMPLETE_ADMISSION';
  if (dealCreated) return 'OPEN_CANONICAL_DEAL';
  if (award) return 'CREATE_CANONICAL_DEAL_SERVER_SIDE';
  if (bidCount > 0) return 'WAIT_FOR_SERVER_AWARD';
  if (lot.status === 'OPEN' || lot.status === 'BIDDING') return 'WAIT_FOR_SERVER_BIDS';
  return 'REVIEW_AUCTION_STATE';
}

function assertPersistedAuctionConsistency(
  lot: AuctionLotRow,
  bidCount: number,
  winnerCount: number,
  bestBid: AuctionBidRow | null,
  award: AuctionAwardRow | null,
  context: TrustedRlsContext,
  crossTenantParticipant = false,
): void {
  if (lot.tenant_id !== context.tenantId && !crossTenantParticipant) {
    throw new InternalServerErrorException({ code: 'AUCTION_TENANT_AUTHORITY_MISMATCH' });
  }
  if ((bidCount === 0) !== (bestBid === null)) {
    throw new InternalServerErrorException({ code: 'AUCTION_BID_AGGREGATE_MISMATCH' });
  }
  if (!award && winnerCount > 0) {
    throw new InternalServerErrorException({ code: 'AUCTION_WINNER_WITHOUT_AWARD' });
  }
  if (award) {
    if (
      !bestBid
      || bestBid.id !== award.winning_bid_id
      || !['WINNING', 'ACCEPTED'].includes(bestBid.status)
      || winnerCount !== 1
    ) {
      throw new InternalServerErrorException({ code: 'AUCTION_AWARD_BID_MISMATCH' });
    }
    if (!['MATCHED', 'IN_DEAL', 'CLOSED'].includes(lot.status)) {
      throw new InternalServerErrorException({ code: 'AUCTION_AWARD_LOT_STATE_MISMATCH' });
    }
    if (
      award.deal_id
      && (
        award.award_status !== 'DEAL_CREATED'
        || award.deal_tenant_id !== context.tenantId
        || award.deal_source_lot_id !== lot.id
        || !award.deal_exists
      )
    ) {
      throw new InternalServerErrorException({ code: 'AUCTION_DEAL_AUTHORITY_MISMATCH' });
    }
  }
}

function finiteNumber(value: string, field: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || Math.abs(parsed) > Number.MAX_SAFE_INTEGER) {
    throw new InternalServerErrorException({ code: 'AUCTION_NUMERIC_OUT_OF_RANGE', field });
  }
  return parsed;
}

function safeVersion(value: bigint): number {
  if (value < 1n || value > MAX_SAFE_BIGINT) {
    throw new InternalServerErrorException({ code: 'AUCTION_VERSION_OUT_OF_RANGE' });
  }
  return Number(value);
}

function safeInteger(value: bigint, field: string): number {
  if (value < 0n || value > MAX_SAFE_BIGINT) {
    throw new InternalServerErrorException({ code: 'AUCTION_INTEGER_OUT_OF_RANGE', field });
  }
  return Number(value);
}
