import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { createHash } from 'crypto';
import { Prisma } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../common/prisma/prisma.service';
import { PersistentAuthRepository } from '../auth/persistent-auth.repository';
import { Role } from '../../common/types/request-user';
import { CANONICAL_TEST_DEAL_ID } from './deal-command.policy';

const CANONICAL_TENANT_ID = 'tenant-canonical-test';
const TEST_PASSWORD = 'demo1234';
const TEST_FACT_AT = '2026-07-12T09:00:00.000Z';
const TEST_SHIPMENT_ID = `shipment:${CANONICAL_TEST_DEAL_ID}`;
const TEST_ACCEPTANCE_ID = `acceptance:${CANONICAL_TEST_DEAL_ID}`;
const TEST_SAMPLE_ID = `sample:${CANONICAL_TEST_DEAL_ID}`;
const TEST_CONTRACT_ID = `contract:${CANONICAL_TEST_DEAL_ID}`;
const TEST_INSPECTION_ID = `inspection:${CANONICAL_TEST_DEAL_ID}`;
const TEST_VEHICLE_ID = `vehicle:${CANONICAL_TEST_DEAL_ID}`;
const TEST_ROUTE_FROM_ID = 'facility:org-canonical-seller:dispatch';
const TEST_ROUTE_TO_ID = 'facility:org-canonical-buyer:acceptance';
const TEST_LAB_EVIDENCE_ID = `evidence:${CANONICAL_TEST_DEAL_ID}:lab`;
const TEST_LAB_METHOD_MOISTURE_ID = `lab-method:${CANONICAL_TEST_DEAL_ID}:moisture`;
const TEST_LAB_METHOD_PROTEIN_ID = `lab-method:${CANONICAL_TEST_DEAL_ID}:protein`;
const TEST_LAB_EQUIPMENT_ID = `lab-equipment:${CANONICAL_TEST_DEAL_ID}`;
const enabled = (name: string) => String(process.env[name] ?? '').toLowerCase() === 'true';

const identities = [
  { userId: 'farmer-e2e', email: 'farmer@demo.ru', fullName: 'Тестовый продавец', role: Role.FARMER, orgId: 'org-canonical-seller', requireMfa: false },
  { userId: 'buyer-e2e', email: 'buyer@demo.ru', fullName: 'Тестовый покупатель', role: Role.BUYER, orgId: 'org-canonical-buyer', requireMfa: true },
  { userId: 'logistician-e2e', email: 'logistician@demo.ru', fullName: 'Тестовый логист', role: Role.LOGISTICIAN, orgId: 'org-canonical-logistics', requireMfa: false },
  { userId: 'driver-e2e', email: 'driver@demo.ru', fullName: 'Тестовый водитель', role: Role.DRIVER, orgId: 'org-canonical-logistics', requireMfa: false },
  { userId: 'surveyor-e2e', email: 'surveyor@demo.ru', fullName: 'Тестовый сюрвейер', role: Role.SURVEYOR, orgId: 'org-canonical-surveyor', requireMfa: false },
  { userId: 'elevator-e2e', email: 'elevator@demo.ru', fullName: 'Тестовый сотрудник элеватора', role: Role.ELEVATOR, orgId: 'org-canonical-elevator', requireMfa: false },
  { userId: 'lab-e2e', email: 'lab@demo.ru', fullName: 'Тестовый лаборант', role: Role.LAB, orgId: 'org-canonical-lab', requireMfa: false },
  { userId: 'accounting-e2e', email: 'accounting@demo.ru', fullName: 'Тестовый банковский сотрудник', role: Role.ACCOUNTING, orgId: 'org-canonical-bank', requireMfa: true },
  { userId: 'compliance-e2e', email: 'compliance@demo.ru', fullName: 'Тестовый комплаенс', role: Role.COMPLIANCE_OFFICER, orgId: 'org-canonical-platform', requireMfa: false },
  { userId: 'arbitrator-e2e', email: 'arbitrator@demo.ru', fullName: 'Тестовый арбитр', role: Role.ARBITRATOR, orgId: 'org-canonical-arbitrator', requireMfa: false },
  { userId: 'operator-e2e', email: 'operator@demo.ru', fullName: 'Тестовый оператор', role: Role.SUPPORT_MANAGER, orgId: 'org-canonical-platform', requireMfa: false },
  { userId: 'executive-e2e', email: 'executive@demo.ru', fullName: 'Тестовый руководитель', role: Role.EXECUTIVE, orgId: 'org-canonical-platform', requireMfa: false },
] as const;

function participantAccess(role: Role): 'READ' | 'WORK' | 'APPROVE' {
  if (role === Role.EXECUTIVE) return 'READ';
  if (
    role === Role.COMPLIANCE_OFFICER
    || role === Role.ARBITRATOR
    || role === Role.SUPPORT_MANAGER
  ) return 'APPROVE';
  return 'WORK';
}

function fixtureHash(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

@Injectable()
export class CanonicalTestDealSeedService implements OnModuleInit {
  private readonly logger = new Logger(CanonicalTestDealSeedService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly authRepository: PersistentAuthRepository,
  ) {}

  async onModuleInit(): Promise<void> {
    if (!enabled('SEED_CANONICAL_TEST_DEAL')) return;

    const production = String(process.env.NODE_ENV ?? '').toLowerCase() === 'production';
    if (production && !enabled('ALLOW_CANONICAL_TEST_DEAL_IN_PRODUCTION')) {
      throw new Error(
        'SEED_CANONICAL_TEST_DEAL is forbidden in production unless ALLOW_CANONICAL_TEST_DEAL_IN_PRODUCTION=true is explicitly set.',
      );
    }

    await this.seed();
    this.logger.log(`Canonical test deal is ready: ${CANONICAL_TEST_DEAL_ID}`);
  }

  private async seed(): Promise<void> {
    const organizations = [
      { id: 'org-canonical-platform', inn: '990000000001', name: 'АО «Прозрачная Цена — тестовый контур»', type: 'LEGAL' },
      { id: 'org-canonical-buyer', inn: '990000000002', name: 'ООО «АгроТрейд Тест»', type: 'LEGAL' },
      { id: 'org-canonical-seller', inn: '990000000003', name: 'ООО «Золотое Поле Тест»', type: 'LEGAL' },
      { id: 'org-canonical-logistics', inn: '990000000004', name: 'ООО «ТрансАгро Тест»', type: 'LEGAL' },
      { id: 'org-canonical-surveyor', inn: '990000000005', name: 'ООО «АгроКонтроль Тест»', type: 'LEGAL' },
      { id: 'org-canonical-elevator', inn: '990000000006', name: 'АО «Центральный Элеватор Тест»', type: 'LEGAL' },
      { id: 'org-canonical-lab', inn: '990000000007', name: 'ООО «ЗерноЛаб Тест»', type: 'LEGAL' },
      { id: 'org-canonical-bank', inn: '990000000008', name: 'АО «Банк-партнёр Тест»', type: 'LEGAL' },
      { id: 'org-canonical-arbitrator', inn: '990000000009', name: 'АНО «АгроАрбитраж Тест»', type: 'LEGAL' },
    ] as const;

    const logisticsBasis = {
      carriers: [{ id: 'org-canonical-logistics', status: 'VERIFIED', tenantId: CANONICAL_TENANT_ID }],
      drivers: [{ id: 'driver-e2e', carrierOrgId: 'org-canonical-logistics', status: 'ACTIVE', vehicleIds: [TEST_VEHICLE_ID] }],
      vehicles: [{ id: TEST_VEHICLE_ID, carrierOrgId: 'org-canonical-logistics', status: 'ACTIVE' }],
      facilities: [
        { id: TEST_ROUTE_FROM_ID, organizationId: 'org-canonical-seller', status: 'ACTIVE' },
        { id: TEST_ROUTE_TO_ID, organizationId: 'org-canonical-buyer', status: 'ACTIVE' },
      ],
    };

    await this.prisma.$transaction(async (tx) => {
      for (const organization of organizations) {
        await tx.organization.upsert({
          where: { id: organization.id },
          update: {
            name: organization.name,
            tenantId: CANONICAL_TENANT_ID,
            status: 'VERIFIED',
            kycStatus: 'APPROVED',
            amlStatus: 'CLEAR',
          },
          create: {
            ...organization,
            tenantId: CANONICAL_TENANT_ID,
            status: 'VERIFIED',
            kycStatus: 'APPROVED',
            amlStatus: 'CLEAR',
            verifiedAt: new Date(),
          },
        });
      }

      await tx.deal.upsert({
        where: { id: CANONICAL_TEST_DEAL_ID },
        update: {
          tenantId: CANONICAL_TENANT_ID,
          sellerOrgId: 'org-canonical-seller',
          buyerOrgId: 'org-canonical-buyer',
          sagaState: { logisticsBasis },
        },
        create: {
          id: CANONICAL_TEST_DEAL_ID,
          dealNumber: 'ТП-000001',
          status: 'DRAFT',
          tenantId: CANONICAL_TENANT_ID,
          sellerOrgId: 'org-canonical-seller',
          buyerOrgId: 'org-canonical-buyer',
          volumeTons: 150,
          pricePerTon: 16_000,
          totalRub: 2_400_000,
          totalKopecks: 240_000_000,
          currency: 'RUB',
          culture: 'Пшеница',
          cropClass: '3',
          gost: 'ГОСТ 9353-2016',
          region: 'Тамбовская область',
          incoterms: 'FCA',
          fundingChoice: 'SAFE_DEAL',
          owner: 'operator',
          nextAction: 'Подтвердить допуск участников',
          sagaState: { logisticsBasis },
          meta: JSON.stringify({
            canonicalTestDeal: true,
            purpose: 'persistent-auth-backed-industrial-flow',
            isolatedE2EFixture: true,
          }),
        },
      });

      await tx.payment.upsert({
        where: { id: `payment:${CANONICAL_TEST_DEAL_ID}` },
        update: { amountKopecks: 240_000_000 },
        create: {
          id: `payment:${CANONICAL_TEST_DEAL_ID}`,
          dealId: CANONICAL_TEST_DEAL_ID,
          status: 'PENDING',
          amountKopecks: 240_000_000,
          callbackState: 'NONE',
        },
      });
    });

    await this.seedPersistentIdentitiesMembershipsAndParticipants();
    await this.seedControlledExecutionFacts();
  }

  private async seedControlledExecutionFacts(): Promise<void> {
    const evidenceKinds = [
      'seller-signature',
      'buyer-signature',
      'loading',
      'departure',
      'arrival',
      'weighing',
      'inspection',
      'lab',
      'acceptance',
    ] as const;

    await this.prisma.$transaction(async (tx) => {
      // Isolated CI fixture only. Production rows must pass all authority triggers.
      await tx.$executeRawUnsafe('SET LOCAL session_replication_role = replica');

      for (const kind of evidenceKinds) {
        const id = `evidence:${CANONICAL_TEST_DEAL_ID}:${kind}`;
        await tx.evidenceFile.upsert({
          where: { id },
          update: {
            dealId: CANONICAL_TEST_DEAL_ID,
            shipmentId: null,
            hash: fixtureHash(id),
            s3Key: `controlled-test/${CANONICAL_TEST_DEAL_ID}/${kind}.json`,
          },
          create: {
            id,
            dealId: CANONICAL_TEST_DEAL_ID,
            type: kind.toUpperCase(),
            filename: `${kind}.json`,
            mimeType: 'application/json',
            sizeBytes: 256,
            hash: fixtureHash(id),
            s3Key: `controlled-test/${CANONICAL_TEST_DEAL_ID}/${kind}.json`,
            uploadedBy: 'operator-e2e',
          },
        });
      }

      await tx.dealDocument.upsert({
        where: { id: TEST_LAB_EVIDENCE_ID },
        update: {
          tenantId: CANONICAL_TENANT_ID,
          type: 'EVIDENCE_FILE',
          status: 'VERIFIED',
          hash: fixtureHash(TEST_LAB_EVIDENCE_ID),
          isImmutable: true,
        },
        create: {
          id: TEST_LAB_EVIDENCE_ID,
          dealId: CANONICAL_TEST_DEAL_ID,
          tenantId: CANONICAL_TENANT_ID,
          type: 'EVIDENCE_FILE',
          status: 'VERIFIED',
          name: 'authoritative-laboratory-basis.json',
          mimeType: 'application/json',
          s3Key: `controlled-test/${CANONICAL_TEST_DEAL_ID}/authoritative-laboratory-basis.json`,
          sizeBytes: 1024,
          hash: fixtureHash(TEST_LAB_EVIDENCE_ID),
          uploadedByUserId: 'operator-e2e',
          version: 2,
          isImmutable: true,
        },
      });

      await tx.dealDocument.upsert({
        where: { id: TEST_CONTRACT_ID },
        update: {
          status: 'UPLOADED',
          signedAt: null,
          signatories: null,
          isImmutable: false,
          bankAcceptance: 'ACCEPTED',
        },
        create: {
          id: TEST_CONTRACT_ID,
          dealId: CANONICAL_TEST_DEAL_ID,
          type: 'CONTRACT',
          status: 'UPLOADED',
          name: 'Договор поставки — контролируемый тестовый контур',
          s3Key: `controlled-test/${CANONICAL_TEST_DEAL_ID}/contract.pdf`,
          hash: fixtureHash(TEST_CONTRACT_ID),
          uploadedByUserId: 'farmer-e2e',
          bankRequired: true,
          releaseRequired: true,
          bankAcceptance: 'ACCEPTED',
        },
      });

      await tx.dealDocument.upsert({
        where: { id: TEST_INSPECTION_ID },
        update: { status: 'VALIDATED', signedAt: null, isImmutable: false },
        create: {
          id: TEST_INSPECTION_ID,
          dealId: CANONICAL_TEST_DEAL_ID,
          type: 'INSPECTION_REPORT',
          status: 'VALIDATED',
          name: 'Заключение осмотра — контролируемый тестовый контур',
          s3Key: `controlled-test/${CANONICAL_TEST_DEAL_ID}/inspection.pdf`,
          hash: fixtureHash(TEST_INSPECTION_ID),
          uploadedByUserId: 'surveyor-e2e',
          releaseRequired: true,
        },
      });

      for (const document of [
        { id: `ttn:${CANONICAL_TEST_DEAL_ID}`, type: 'TTN', name: 'Транспортная накладная' },
        { id: `weighing:${CANONICAL_TEST_DEAL_ID}`, type: 'WEIGHING_ACT', name: 'Акт взвешивания' },
        { id: `lab-protocol:${CANONICAL_TEST_DEAL_ID}`, type: 'LAB_PROTOCOL', name: 'Лабораторный протокол' },
        { id: `acceptance-act:${CANONICAL_TEST_DEAL_ID}`, type: 'ACCEPTANCE_ACT', name: 'Акт приёмки' },
      ]) {
        await tx.dealDocument.upsert({
          where: { id: document.id },
          update: {},
          create: {
            ...document,
            dealId: CANONICAL_TEST_DEAL_ID,
            status: 'SIGNED',
            s3Key: `controlled-test/${CANONICAL_TEST_DEAL_ID}/${document.type}.pdf`,
            hash: fixtureHash(document.id),
            signedAt: new Date(TEST_FACT_AT),
            signatories: JSON.stringify([{ userId: 'operator-e2e', signedAt: TEST_FACT_AT, evidenceRef: `evidence:${CANONICAL_TEST_DEAL_ID}:acceptance` }]),
            uploadedByUserId: 'operator-e2e',
            isImmutable: true,
            bankRequired: true,
            releaseRequired: true,
            bankAcceptance: 'ACCEPTED',
          },
        });
      }

      await tx.$executeRaw(Prisma.sql`
        INSERT INTO labs.laboratories (
          id, tenant_id, organization_id, status, accreditation_status,
          accreditation_ref, evidence_file_id
        ) VALUES (
          ${`laboratory:${CANONICAL_TEST_DEAL_ID}`}, ${CANONICAL_TENANT_ID},
          'org-canonical-lab', 'ACTIVE', 'VERIFIED',
          'ACCREDITATION-org-canonical-lab', ${TEST_LAB_EVIDENCE_ID}
        )
        ON CONFLICT (tenant_id, organization_id) DO UPDATE SET
          status = 'ACTIVE', accreditation_status = 'VERIFIED',
          accreditation_ref = EXCLUDED.accreditation_ref,
          evidence_file_id = EXCLUDED.evidence_file_id,
          valid_until = NULL, updated_at = now()
      `);
      await tx.$executeRaw(Prisma.sql`
        INSERT INTO labs.authorized_actors (
          id, tenant_id, laboratory_org_id, user_id, actor_type, status, evidence_file_id
        ) VALUES (
          ${`lab-actor:${CANONICAL_TEST_DEAL_ID}`}, ${CANONICAL_TENANT_ID},
          'org-canonical-lab', 'lab-e2e', 'SIGNATORY', 'ACTIVE', ${TEST_LAB_EVIDENCE_ID}
        )
        ON CONFLICT (tenant_id, laboratory_org_id, user_id) DO UPDATE SET
          actor_type = 'SIGNATORY', status = 'ACTIVE',
          evidence_file_id = EXCLUDED.evidence_file_id,
          valid_until = NULL, updated_at = now()
      `);
      for (const method of [
        { id: TEST_LAB_METHOD_MOISTURE_ID, code: 'MOISTURE', parameter: 'moisture', unit: '%', min: null, max: '14.000000' },
        { id: TEST_LAB_METHOD_PROTEIN_ID, code: 'PROTEIN', parameter: 'protein', unit: '%', min: '12.500000', max: null },
      ]) {
        await tx.$executeRaw(Prisma.sql`
          INSERT INTO labs.methods (
            id, tenant_id, laboratory_org_id, code, parameter, unit,
            standard_ref, norm_min, norm_max, status, evidence_file_id
          ) VALUES (
            ${method.id}, ${CANONICAL_TENANT_ID}, 'org-canonical-lab', ${method.code},
            ${method.parameter}, ${method.unit}, 'CONTROLLED-STANDARD-E2E',
            ${method.min}::NUMERIC, ${method.max}::NUMERIC, 'ACTIVE', ${TEST_LAB_EVIDENCE_ID}
          )
          ON CONFLICT (tenant_id, laboratory_org_id, code) DO UPDATE SET
            parameter = EXCLUDED.parameter, unit = EXCLUDED.unit,
            standard_ref = EXCLUDED.standard_ref, norm_min = EXCLUDED.norm_min,
            norm_max = EXCLUDED.norm_max, status = 'ACTIVE',
            evidence_file_id = EXCLUDED.evidence_file_id,
            valid_until = NULL, updated_at = now()
        `);
      }
      await tx.$executeRaw(Prisma.sql`
        INSERT INTO labs.equipment (
          id, tenant_id, laboratory_org_id, code, name, serial_number,
          status, calibration_valid_until, evidence_file_id
        ) VALUES (
          ${TEST_LAB_EQUIPMENT_ID}, ${CANONICAL_TENANT_ID}, 'org-canonical-lab',
          'CONTROLLED-ANALYZER', 'Controlled laboratory analyzer', 'LAB-E2E-001',
          'ACTIVE', '2035-01-01T00:00:00.000Z'::TIMESTAMPTZ, ${TEST_LAB_EVIDENCE_ID}
        )
        ON CONFLICT (tenant_id, laboratory_org_id, code) DO UPDATE SET
          status = 'ACTIVE', calibration_valid_until = EXCLUDED.calibration_valid_until,
          evidence_file_id = EXCLUDED.evidence_file_id, updated_at = now()
      `);

      await tx.labSample.upsert({
        where: { id: TEST_SAMPLE_ID },
        update: {
          tenantId: CANONICAL_TENANT_ID,
          shipmentId: TEST_SHIPMENT_ID,
          acceptanceId: TEST_ACCEPTANCE_ID,
          status: 'PENDING',
          custodyStatus: 'ANALYSIS_IN_PROGRESS',
          sampleCode: `SAMPLE-${CANONICAL_TEST_DEAL_ID}`,
          protocol: null,
          protocolResult: null,
          finalizedAt: null,
          labId: 'org-canonical-lab',
          labName: 'ООО «ЗерноЛаб Тест»',
          assignedActorUserId: 'lab-e2e',
          latestEvidenceFileId: TEST_LAB_EVIDENCE_ID,
          version: 0,
        },
        create: {
          id: TEST_SAMPLE_ID,
          dealId: CANONICAL_TEST_DEAL_ID,
          shipmentId: TEST_SHIPMENT_ID,
          acceptanceId: TEST_ACCEPTANCE_ID,
          tenantId: CANONICAL_TENANT_ID,
          status: 'PENDING',
          custodyStatus: 'ANALYSIS_IN_PROGRESS',
          sampleCode: `SAMPLE-${CANONICAL_TEST_DEAL_ID}`,
          culture: 'Пшеница',
          labId: 'org-canonical-lab',
          labName: 'ООО «ЗерноЛаб Тест»',
          assignedActorUserId: 'lab-e2e',
          latestEvidenceFileId: TEST_LAB_EVIDENCE_ID,
          collectedAt: new Date(TEST_FACT_AT),
          version: 0,
        },
      });

      await tx.labTest.deleteMany({ where: { sampleId: TEST_SAMPLE_ID } });
      await tx.labTest.createMany({
        data: [
          {
            id: `lab-test:${CANONICAL_TEST_DEAL_ID}:moisture`,
            sampleId: TEST_SAMPLE_ID,
            tenantId: CANONICAL_TENANT_ID,
            parameter: 'moisture',
            value: 12.4,
            valueDec: '12.400000',
            unit: '%',
            normMax: 14,
            normMaxDec: '14.000000',
            passed: true,
            result: 'PASSED',
            methodId: TEST_LAB_METHOD_MOISTURE_ID,
            equipmentId: TEST_LAB_EQUIPMENT_ID,
            evidenceFileId: TEST_LAB_EVIDENCE_ID,
            actorUserId: 'lab-e2e',
            commandId: `fixture:${CANONICAL_TEST_DEAL_ID}:moisture`,
            idempotencyKey: `fixture:${CANONICAL_TEST_DEAL_ID}:moisture`,
            correlationId: `fixture:${CANONICAL_TEST_DEAL_ID}:labs`,
            recordedAt: new Date(TEST_FACT_AT),
          },
          {
            id: `lab-test:${CANONICAL_TEST_DEAL_ID}:protein`,
            sampleId: TEST_SAMPLE_ID,
            tenantId: CANONICAL_TENANT_ID,
            parameter: 'protein',
            value: 13.2,
            valueDec: '13.200000',
            unit: '%',
            normMin: 12.5,
            normMinDec: '12.500000',
            passed: true,
            result: 'PASSED',
            methodId: TEST_LAB_METHOD_PROTEIN_ID,
            equipmentId: TEST_LAB_EQUIPMENT_ID,
            evidenceFileId: TEST_LAB_EVIDENCE_ID,
            actorUserId: 'lab-e2e',
            commandId: `fixture:${CANONICAL_TEST_DEAL_ID}:protein`,
            idempotencyKey: `fixture:${CANONICAL_TEST_DEAL_ID}:protein`,
            correlationId: `fixture:${CANONICAL_TEST_DEAL_ID}:labs`,
            recordedAt: new Date(TEST_FACT_AT),
          },
        ],
      });
      await tx.$executeRaw(Prisma.sql`
        INSERT INTO labs.sample_custody_events (
          id, sample_id, tenant_id, event_type, from_status, to_status,
          actor_user_id, laboratory_org_id, evidence_file_id, command_id,
          idempotency_key, correlation_id, occurred_at, note, hash
        ) VALUES (
          ${`lab-custody:${CANONICAL_TEST_DEAL_ID}:received`}, ${TEST_SAMPLE_ID},
          ${CANONICAL_TENANT_ID}, 'RECEIVED', 'IN_TRANSIT', 'RECEIVED',
          'lab-e2e', 'org-canonical-lab', ${TEST_LAB_EVIDENCE_ID},
          ${`fixture:${CANONICAL_TEST_DEAL_ID}:custody`},
          ${`fixture:${CANONICAL_TEST_DEAL_ID}:custody`},
          ${`fixture:${CANONICAL_TEST_DEAL_ID}:labs`}, ${new Date(TEST_FACT_AT)},
          'Controlled fixture custody receipt', ${fixtureHash(`custody:${CANONICAL_TEST_DEAL_ID}`)}
        )
        ON CONFLICT (id) DO NOTHING
      `);
    });
  }

  private async seedPersistentIdentitiesMembershipsAndParticipants(): Promise<void> {
    const passwordHash = bcrypt.hashSync(TEST_PASSWORD, 10);

    for (const identity of identities) {
      await this.prisma.$transaction(async (tx) => {
        const user = await tx.user.upsert({
          where: { id: identity.userId },
          update: {
            email: identity.email,
            passwordHash,
            fullName: identity.fullName,
            status: 'ACTIVE',
            mfaEnabled: identity.requireMfa,
            deletedAt: null,
          },
          create: {
            id: identity.userId,
            email: identity.email,
            passwordHash,
            fullName: identity.fullName,
            status: 'ACTIVE',
            mfaEnabled: identity.requireMfa,
          },
        });

        await this.authRepository.ensureCredentialState(tx, user.id, '1.2', new Date());
        await tx.$executeRaw(Prisma.sql`
          UPDATE auth.credential_states
          SET credential_version = 1,
              failed_login_count = 0,
              locked_until = NULL,
              password_changed_at = NULL,
              last_login_at = NULL,
              mfa_enabled = ${identity.requireMfa},
              mfa_secret_ciphertext = NULL,
              mfa_key_version = NULL,
              mfa_backup_hashes = NULL,
              consent_version = '1.2',
              consent_at = NOW(),
              updated_at = NOW()
          WHERE user_id = ${user.id}
        `);

        await tx.userOrg.updateMany({
          where: {
            userId: user.id,
            NOT: { organizationId: identity.orgId },
          },
          data: { isDefault: false },
        });

        const membership = await tx.userOrg.upsert({
          where: {
            userId_organizationId: {
              userId: user.id,
              organizationId: identity.orgId,
            },
          },
          update: {
            role: identity.role,
            isDefault: true,
          },
          create: {
            userId: user.id,
            organizationId: identity.orgId,
            role: identity.role,
            isDefault: true,
          },
        });

        await tx.dealParticipant.upsert({
          where: {
            dealId_userId_role: {
              dealId: CANONICAL_TEST_DEAL_ID,
              userId: user.id,
              role: identity.role,
            },
          },
          update: {
            tenantId: CANONICAL_TENANT_ID,
            organizationId: identity.orgId,
            accessLevel: participantAccess(identity.role),
            status: 'ACTIVE',
            revokedAt: null,
          },
          create: {
            id: `participant:${CANONICAL_TEST_DEAL_ID}:${identity.role.toLowerCase()}`,
            dealId: CANONICAL_TEST_DEAL_ID,
            tenantId: CANONICAL_TENANT_ID,
            organizationId: identity.orgId,
            userId: user.id,
            role: identity.role,
            accessLevel: participantAccess(identity.role),
            status: 'ACTIVE',
          },
        });

        if (!membership.id) throw new Error(`Persistent membership was not created for ${identity.role}`);
      });
    }
  }
}
