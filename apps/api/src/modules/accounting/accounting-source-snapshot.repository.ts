import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { RlsTransactionService } from '../../common/prisma/rls-transaction.service';
import type { RequestUser } from '../../common/types/request-user';
import type { SourceSnapshot } from '../auth/accounting-document-payload.builder';

/**
 * Reading the nine sources a УПД draws on, as one snapshot.
 *
 * The payload builder refuses to accept the sources separately for a reason:
 * the recorded revisions must describe the same read the content came from.
 * This is the other half of that guarantee, and it needs one property the
 * builder cannot provide for itself — that the nine reads see one state of the
 * database rather than nine.
 *
 * Hence REPEATABLE READ. Under the default READ COMMITTED every statement
 * takes a fresh snapshot, so three consecutive SELECTs in one transaction can
 * observe three different states; a shipment re-weighed between the deal read
 * and the weight read would produce a document describing a mixture of
 * instants that never existed together. REPEATABLE READ fixes one snapshot for
 * the whole transaction, which is exactly the atomicity a legal document needs.
 *
 * The rows are read directly rather than through the deal, shipment and
 * laboratory repositories. Those expose `getById(id, user)` and each manages
 * its own transaction, so calling three of them cannot be atomic without
 * changing all three — and changing other workstreams' modules to obtain
 * atomicity here would be both out of scope and the wrong repair. Row level
 * security still applies: this runs inside `withTrustedContext`, so the same
 * policies that constrain those modules constrain these reads.
 *
 * Revisions are the rows' own `version` counters, not invented identifiers —
 * `deals`, `lab_samples` and `organizations` all carry optimistic-locking
 * versions that advance when the row changes, which is precisely what a
 * revision must mean.
 *
 * With one exception, recorded rather than smoothed over: `acceptance_records`
 * has no version column. Its revision is derived from `id` and `updatedAt`,
 * which is weaker — two changes inside one millisecond would produce the same
 * revision and a re-weighing would go unnoticed. The gap belongs to the
 * existing model, not to this reader, and inventing a counter here would only
 * hide it. Adding one is a migration on another workstream's table.
 */

export const SnapshotFailure = {
  DEAL_NOT_FOUND: 'DEAL_NOT_FOUND',
  NO_ACCEPTED_WEIGHT: 'NO_ACCEPTED_WEIGHT',
  NO_QUALITY_SAMPLE: 'NO_QUALITY_SAMPLE',
  NO_TAX_PROFILE: 'NO_TAX_PROFILE',
  NO_CONTRACT_VERSION: 'NO_CONTRACT_VERSION',
  NO_REGULATORY_RULE: 'NO_REGULATORY_RULE',
} as const;

export type SnapshotFailure =
  typeof SnapshotFailure[keyof typeof SnapshotFailure];

export type SnapshotResult =
  | { assembled: true; snapshot: SourceSnapshot }
  | { assembled: false; missing: readonly SnapshotFailure[] };

/**
 * Tonnes to grams.
 *
 * The platform stores weight as a float — `acceptance_records.weightActualTons`
 * and `shipments.loadedTons` are both `Float` — so grams cannot be derived
 * exactly: 25.001 tonnes multiplies to 25001000.000000004. The rounding is
 * declared here rather than hidden, and the precision limit belongs to the
 * stored measurement, not to this conversion.
 *
 * This is the same class of defect the repository already forbids for money.
 * It does not corrupt money on this path only because the payload builder
 * restates the deal's recorded total instead of recomputing it from weight.
 */
export function tonsToGrams(tons: number | null): bigint | null {
  if (tons === null || !Number.isFinite(tons)) {
    return null;
  }
  const grams = Math.round(tons * 1_000_000);
  return Number.isSafeInteger(grams) ? BigInt(grams) : null;
}

type DealRow = {
  id: string;
  dealNumber: string | null;
  sellerOrgId: string;
  buyerOrgId: string;
  currency: string;
  totalKopecks: bigint | null;
  pricePerTonKopecks: bigint | null;
  culture: string | null;
  cropClass: string | null;
  gost: string | null;
  version: bigint;
  sellerInn: string | null;
  buyerInn: string | null;
  requisitesVersion: bigint;
};

@Injectable()
export class AccountingSourceSnapshotRepository {
  constructor(private readonly transactions: RlsTransactionService) {}

  /**
   * Assemble within a transaction the caller already holds.
   *
   * Exposed so that creating a document version can read the sources and write
   * the row under one transaction. Opening a second transaction here would
   * leave a window in which a source moves between the read and the write, and
   * the stored revisions would then describe a read the payload did not come
   * from — which is exactly the failure the snapshot exists to prevent.
   */
  async assembleWithin(
    tx: Prisma.TransactionClient,
    context: { orgId: string },
    input: { dealId: string; at: Date },
  ): Promise<SnapshotResult> {
  const deals = await tx.$queryRaw<DealRow[]>`
        SELECT d."id",
               d."dealNumber",
               d."sellerOrgId",
               d."buyerOrgId",
               d."currency",
               d."totalKopecks",
               CASE WHEN d."pricePerTonDec" IS NULL THEN NULL
                    ELSE (round(d."pricePerTonDec" * 100))::bigint END
                 AS "pricePerTonKopecks",
               d."culture", d."cropClass", d."gost", d."version",
               s."inn" AS "sellerInn",
               b."inn" AS "buyerInn",
               (coalesce(s."version", 0) + coalesce(b."version", 0))::bigint
                 AS "requisitesVersion"
          FROM public."deals" d
          LEFT JOIN public."organizations" s ON s."id" = d."sellerOrgId"
          LEFT JOIN public."organizations" b ON b."id" = d."buyerOrgId"
         WHERE d."id" = ${input.dealId}
      `;
      const deal = deals[0];
      if (deal === undefined) {
        return {
          assembled: false,
          missing: [SnapshotFailure.DEAL_NOT_FOUND],
        };
      }

      // No version column on this table — see the note above. The revision
      // is built from id and updatedAt, which is the strongest identifier
      // the row actually offers.
      const weights = await tx.$queryRaw<
        { id: string; weightActualTons: number | null; updatedAt: Date }[]
      >`
        SELECT "id", "weightActualTons", "updatedAt"
          FROM public."acceptance_records"
         WHERE "dealId" = ${input.dealId}
           AND "status" = 'ACCEPTED'
         ORDER BY "updatedAt" DESC
         LIMIT 1
      `;
      const samples = await tx.$queryRaw<
        { id: string; gost: string | null; version: bigint }[]
      >`
        SELECT "id", "gost", "version"
          FROM public."lab_samples"
         WHERE "dealId" = ${input.dealId}
           AND "finalizedAt" IS NOT NULL
         ORDER BY "finalizedAt" DESC
         LIMIT 1
      `;
      const profiles = await tx.$queryRaw<
        { versionTag: string; vatStatus: string; vatExemptionGround: string | null }[]
      >`
        SELECT "versionTag", "vatStatus", "vatExemptionGround"
          FROM public."organization_tax_profiles"
         WHERE "organizationId" = ${context.orgId}
           AND "effectiveFrom" <= ${input.at}
           AND ("effectiveTo" IS NULL OR "effectiveTo" > ${input.at})
      `;
      const contracts = await tx.$queryRaw<
        { contractNumber: string; versionNumber: number }[]
      >`
        SELECT "contractNumber", "versionNumber"
          FROM public."contract_versions"
         WHERE "organizationId" = ${context.orgId}
           AND "dealId" = ${input.dealId}
           AND "status" = 'SIGNED'
           AND "effectiveFrom" <= ${input.at}
           AND ("effectiveTo" IS NULL OR "effectiveTo" > ${input.at})
      `;
      const rules = await tx.$queryRaw<
        { ruleKey: string; versionTag: string }[]
      >`
        SELECT "ruleKey", "versionTag"
          FROM public."regulatory_rule_versions"
         WHERE "ruleKey" = 'UPD_FORMAT'
           AND "status" = 'ACTIVE'
           AND "effectiveFrom" <= ${input.at}
           AND ("effectiveTo" IS NULL OR "effectiveTo" > ${input.at})
      `;

      const missing: SnapshotFailure[] = [];
      const netWeightGrams = tonsToGrams(
        weights[0]?.weightActualTons ?? null,
      );
      if (netWeightGrams === null) {
        missing.push(SnapshotFailure.NO_ACCEPTED_WEIGHT);
      }
      if (samples.length === 0) {
        missing.push(SnapshotFailure.NO_QUALITY_SAMPLE);
      }
      // Exactly one of each is required. Two rows in force is the ambiguity
      // the registries refuse at write time; finding it here would mean a
      // constraint had been lost, so it is reported rather than resolved.
      if (profiles.length !== 1) {
        missing.push(SnapshotFailure.NO_TAX_PROFILE);
      }
      if (contracts.length !== 1) {
        missing.push(SnapshotFailure.NO_CONTRACT_VERSION);
      }
      if (rules.length !== 1) {
        missing.push(SnapshotFailure.NO_REGULATORY_RULE);
      }
      if (missing.length > 0) {
        return { assembled: false, missing };
      }

      const profile = profiles[0];
      const contract = contracts[0];
      const rule = rules[0];
      const sample = samples[0];

      const snapshot: SourceSnapshot = {
        deal: {
          revision: `deal@${deal.version}`,
          value: {
            dealId: deal.id,
            dealNumber: deal.dealNumber,
            sellerOrgId: deal.sellerOrgId,
            buyerOrgId: deal.buyerOrgId,
            currency: deal.currency,
            totalKopecks: deal.totalKopecks,
          },
        },
        execution: {
          revision: `deal@${deal.version}`,
          value: {
            culture: deal.culture,
            cropClass: deal.cropClass,
            gost: deal.gost ?? sample.gost,
          },
        },
        weight: {
          revision: `acceptance@${weights[0].id}@${weights[0].updatedAt.toISOString()}`,
          value: { netWeightGrams },
        },
        quality: {
          revision: `sample@${sample.version}`,
          value: { qualityPassportId: sample.id },
        },
        price: {
          revision: `deal@${deal.version}`,
          value: { pricePerTonKopecks: deal.pricePerTonKopecks },
        },
        contractVersion: {
          revision: `${contract.contractNumber}#${contract.versionNumber}`,
          value: { contractNumber: contract.contractNumber },
        },
        counterpartyRequisites: {
          revision: `req@${deal.requisitesVersion}`,
          value: { sellerInn: deal.sellerInn, buyerInn: deal.buyerInn },
        },
        taxProfile: {
          revision: `${context.orgId}@${profile.versionTag}`,
          // The VAT line itself is decided by organization-tax-profile.policy
          // against the rule in force; this carries only what was recorded.
          value: {
            vatLine:
              profile.vatStatus === 'EXEMPT'
                ? `Без НДС (${profile.vatExemptionGround})`
                : profile.vatStatus === 'NOT_PAYER'
                  ? 'Без НДС'
                  : 'НДС',
            vatAmountKopecks: null,
          },
        },
        regulatoryRule: {
          revision: `${rule.ruleKey}@${rule.versionTag}`,
          value: { formatRevision: `${rule.ruleKey}@${rule.versionTag}` },
        },
      };

      return { assembled: true, snapshot };
  }

  async assemble(
    user: RequestUser | undefined,
    input: { dealId: string; at: Date },
  ): Promise<SnapshotResult> {
    return this.transactions.withTrustedContext(
      user,
      async (tx, context) => this.assembleWithin(tx, context, input),
      {
        // One snapshot of the database for all nine reads. Under READ
        // COMMITTED each statement would take its own, and the document would
        // describe a mixture of instants that never existed together.
        isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
      },
    );
  }
}
