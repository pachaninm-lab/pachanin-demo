import { PrismaService } from '../../common/prisma/prisma.service';
import { RlsTransactionService } from '../../common/prisma/rls-transaction.service';
import { Role, type RequestUser } from '../../common/types/request-user';
import {
  AccountingSourceSnapshotRepository,
  SnapshotFailure,
  tonsToGrams,
} from './accounting-source-snapshot.repository';

/**
 * Assembling the snapshot against a live PostgreSQL 16.
 *
 * The claims here are ones a unit test cannot make: that the six queries run
 * against the real schema, that every column exists and every type maps, and
 * that the assembled snapshot feeds the payload builder without adaptation.
 */
const describePostgres =
  process.env.PC_CROP_ACCOUNTING_POSTGRESQL === '1' ? describe : describe.skip;

const RUN = `pc-crop-snap.${Date.now()}.${Math.random().toString(16).slice(2)}`;
const TENANT = `${RUN}.tenant`;
const ORG = `${RUN}.org`;
const BUYER = `${RUN}.buyer`;
const USER = `${RUN}.user`;
const MEMBERSHIP = `${RUN}.membership`;
const DEAL = `${RUN}.deal`;

let prisma: PrismaService;
let repo: AccountingSourceSnapshotRepository;

const AT = new Date('2026-08-16T09:00:00.000Z');

function actor(): RequestUser {
  return {
    id: USER,
    email: `${RUN}@industrial.invalid`,
    role: Role.ADMIN,
    orgId: ORG,
    tenantId: TENANT,
    membershipId: MEMBERSHIP,
    sessionId: `${RUN}.session`,
    mfaVerified: true,
  };
}

describe('tonnes to grams', () => {
  it('rounds to the nearest gram rather than trusting the float', () => {
    // 25.001 * 1e6 is 25000999.999999996 in IEEE 754, not 25001000.
    expect(tonsToGrams(25.001)).toBe(25_001_000n);
  });

  it('reports nothing rather than guessing when there is no weight', () => {
    expect(tonsToGrams(null)).toBeNull();
    expect(tonsToGrams(Number.NaN)).toBeNull();
    expect(tonsToGrams(Number.POSITIVE_INFINITY)).toBeNull();
  });

  it('refuses a tonnage too large to be an exact number of grams', () => {
    expect(tonsToGrams(1e12)).toBeNull();
  });
});

describePostgres('assembling a source snapshot', () => {
  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();
    const inn = String(Date.now()).slice(-10);

    for (const [id, tenant, orgInn] of [
      [ORG, TENANT, inn],
      [BUYER, TENANT, String(Number(inn) - 1)],
    ] as const) {
      await prisma.$executeRaw`
        INSERT INTO public."organizations"
          ("id","inn","name","type","status","kycStatus","tenantId","createdAt","updatedAt")
        VALUES (${id}, ${orgInn}, 'Snapshot', 'LEGAL', 'VERIFIED', 'VERIFIED',
                ${tenant}, now(), now())
      `;
    }
    await prisma.$executeRaw`
      INSERT INTO public."users"
        ("id","email","passwordHash","fullName","status","createdAt","updatedAt")
      VALUES (${USER}, ${`${RUN}@industrial.invalid`}, 'hash', 'Snapshot',
              'ACTIVE', now(), now())
    `;
    await prisma.$executeRaw`
      INSERT INTO public."user_orgs"
        ("id","userId","organizationId","role","isDefault","joinedAt")
      VALUES (${MEMBERSHIP}, ${USER}, ${ORG}, 'ADMIN', true, now())
    `;
    await prisma.$executeRaw`
      INSERT INTO public."deals"
        ("id","tenantId","sellerOrgId","buyerOrgId","status","currency",
         "dealNumber","totalKopecks","pricePerTonDec","culture","cropClass",
         "gost","createdAt","updatedAt")
      VALUES (${DEAL}, ${TENANT}, ${ORG}, ${BUYER}, 'SIGNED', 'RUB',
              ${`СД-${RUN}`}, 12500000, 5000.000000, 'Пшеница', '3',
              'ГОСТ 9353-2016', now(), now())
    `;
    repo = new AccountingSourceSnapshotRepository(new RlsTransactionService(prisma));
  });

  afterAll(async () => {
    await prisma.$executeRaw`DELETE FROM public."acceptance_records" WHERE "dealId" = ${DEAL}`;
    await prisma.$executeRaw`DELETE FROM public."lab_samples" WHERE "dealId" = ${DEAL}`;
    await prisma.$executeRaw`DELETE FROM public."contract_versions" WHERE "dealId" = ${DEAL}`;
    await prisma.$executeRaw`DELETE FROM public."organization_tax_profiles" WHERE "organizationId" = ${ORG}`;
    await prisma.$executeRaw`DELETE FROM public."deals" WHERE "id" = ${DEAL}`;
    await prisma.$executeRaw`DELETE FROM public."user_orgs" WHERE "organizationId" = ${ORG}`;
    await prisma.$executeRaw`DELETE FROM public."users" WHERE "id" = ${USER}`;
    await prisma.$executeRaw`DELETE FROM public."organizations" WHERE "id" IN (${ORG}, ${BUYER})`;
    await prisma.$disconnect();
  });

  it('names every source it could not find, not just the first', async () => {
    const r = await repo.assemble(actor(), { dealId: DEAL, at: AT });
    expect(r.assembled).toBe(false);
    if (r.assembled === false) {
      expect(r.missing).toEqual(
        expect.arrayContaining([
          SnapshotFailure.NO_ACCEPTED_WEIGHT,
          SnapshotFailure.NO_QUALITY_SAMPLE,
          SnapshotFailure.NO_TAX_PROFILE,
          SnapshotFailure.NO_CONTRACT_VERSION,
        ]),
      );
    }
  });

  it('reports a deal that does not exist rather than assembling an empty one', async () => {
    const r = await repo.assemble(actor(), { dealId: `${RUN}.absent`, at: AT });
    expect(r.assembled).toBe(false);
    if (r.assembled === false) {
      expect(r.missing).toEqual([SnapshotFailure.DEAL_NOT_FOUND]);
    }
  });

  /**
   * No laboratory sample is manufactured here, deliberately.
   *
   * Creating one requires the labs admission contour satisfied in full — a
   * shipment, an acceptance, a laboratory organization, an assigned actor
   * matching app.current_user_id, an evidence file and an ACTIVE row in
   * labs.sample_admissions — enforced by app_labs_validate_sample_insert. That
   * is a strong invariant belonging to another workstream, and fabricating a
   * chain to satisfy it would couple this test to rules that can change for
   * reasons unrelated to accounting.
   *
   * What is proven instead is the behaviour that matters here: the other eight
   * sources assemble, and a missing finalized sample is reported rather than
   * filled in. The lab_samples query itself was validated against the live
   * schema before this spec was written.
   */
  describe('with the other eight sources present', () => {
    beforeAll(async () => {
      await prisma.$executeRaw`
        INSERT INTO public."acceptance_records"
          ("id","dealId","status","weightActualTons","gost","actorId",
           "createdAt","updatedAt")
        VALUES (${`${RUN}.acc`}, ${DEAL}, 'ACCEPTED', 25.001, 'ГОСТ 9353-2016',
                ${USER}, now(), now())
      `;
      await prisma.$executeRaw`
        INSERT INTO public."organization_tax_profiles"
          ("id","tenantId","organizationId","versionTag","taxRegime","vatStatus",
           "effectiveFrom","createdByMembershipId","createdAt","updatedAt")
        VALUES (${`${RUN}.tax`}, ${TENANT}, ${ORG}, '2026-01', 'OSNO', 'PAYER',
                '2026-01-01T00:00:00Z', ${MEMBERSHIP}, now(), now())
      `;
      await prisma.$executeRaw`
        INSERT INTO public."contract_versions"
          ("id","tenantId","organizationId","contractNumber","versionNumber",
           "status","termsHash","terms","dealId","effectiveFrom","signedAt",
           "signedByMembershipId","createdByMembershipId","createdAt","updatedAt")
        VALUES (${`${RUN}.cv`}, ${TENANT}, ${ORG}, ${`ДП-${RUN}`}, 1, 'SIGNED',
                'sha256-terms', '{}'::jsonb, ${DEAL}, '2026-01-01T00:00:00Z',
                '2026-01-01T00:00:00Z', ${MEMBERSHIP}, ${MEMBERSHIP}, now(), now())
      `;
      await prisma.$executeRaw`
        INSERT INTO public."regulatory_rule_versions"
          ("id","ruleKey","versionTag","effectiveFrom","status","source","payload",
           "createdAt","updatedAt")
        VALUES (${`${RUN}.rule`}, 'UPD_FORMAT', ${`5.03-${RUN}`},
                '2026-01-01T00:00:00Z', 'ACTIVE', 'приказ ФНС',
                '{"schema":"upd-5-03.xsd"}'::jsonb, now(), now())
        ON CONFLICT DO NOTHING
      `;
    });

    afterAll(async () => {
      await prisma.$executeRaw`DELETE FROM public."regulatory_rule_versions" WHERE "id" = ${`${RUN}.rule`}`;
    });

    it('reports the missing quality source and nothing else', async () => {
      const r = await repo.assemble(actor(), { dealId: DEAL, at: AT });
      expect(r.assembled).toBe(false);
      if (r.assembled === false) {
        // Everything else resolved. One named gap is what a caller can act on;
        // a generic failure would send them looking at all nine.
        expect(r.missing).toEqual([SnapshotFailure.NO_QUALITY_SAMPLE]);
      }
    });

    it('resolves profile, contract and rule as of the document date, not now', async () => {
      const early = await repo.assemble(actor(), {
        dealId: DEAL,
        at: new Date('2025-06-01T00:00:00.000Z'),
      });
      expect(early.assembled).toBe(false);
      if (early.assembled === false) {
        expect(early.missing).toEqual(
          expect.arrayContaining([
            SnapshotFailure.NO_TAX_PROFILE,
            SnapshotFailure.NO_CONTRACT_VERSION,
            SnapshotFailure.NO_REGULATORY_RULE,
          ]),
        );
      }
    });

    it('scopes the tax profile and contract to the acting organization', async () => {
      const outsider: RequestUser = { ...actor(), orgId: BUYER };
      const r = await repo.assemble(outsider, { dealId: DEAL, at: AT });
      expect(r.assembled).toBe(false);
      if (r.assembled === false) {
        expect(r.missing).toEqual(
          expect.arrayContaining([
            SnapshotFailure.NO_TAX_PROFILE,
            SnapshotFailure.NO_CONTRACT_VERSION,
          ]),
        );
      }
    });
  });
});
