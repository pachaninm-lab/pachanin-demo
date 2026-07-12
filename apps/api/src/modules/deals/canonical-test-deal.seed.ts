import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../common/prisma/prisma.service';
import { PersistentAuthRepository } from '../auth/persistent-auth.repository';
import { Role } from '../../common/types/request-user';
import { CANONICAL_TEST_DEAL_ID } from './deal-command.policy';

const CANONICAL_TENANT_ID = 'tenant-canonical-test';
const TEST_PASSWORD = 'demo1234';
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
