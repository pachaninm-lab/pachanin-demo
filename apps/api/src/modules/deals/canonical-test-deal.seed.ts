import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuthService } from '../auth/auth.service';
import { Role } from '../../common/types/request-user';
import { CANONICAL_TEST_DEAL_ID } from './deal-command.policy';

const CANONICAL_TENANT_ID = 'tenant-canonical-test';
const TEST_PASSWORD = 'demo1234';
const enabled = (name: string) => String(process.env[name] ?? '').toLowerCase() === 'true';

const identities = [
  { email: 'farmer@demo.ru', fullName: 'Тестовый продавец', role: Role.FARMER, orgId: 'org-canonical-seller' },
  { email: 'buyer@demo.ru', fullName: 'Тестовый покупатель', role: Role.BUYER, orgId: 'org-canonical-buyer' },
  { email: 'logistician@demo.ru', fullName: 'Тестовый логист', role: Role.LOGISTICIAN, orgId: 'org-canonical-logistics' },
  { email: 'driver@demo.ru', fullName: 'Тестовый водитель', role: Role.DRIVER, orgId: 'org-canonical-logistics' },
  { email: 'surveyor@demo.ru', fullName: 'Тестовый сюрвейер', role: Role.SURVEYOR, orgId: 'org-canonical-surveyor' },
  { email: 'elevator@demo.ru', fullName: 'Тестовый элеватор', role: Role.ELEVATOR, orgId: 'org-canonical-elevator' },
  { email: 'lab@demo.ru', fullName: 'Тестовая лаборатория', role: Role.LAB, orgId: 'org-canonical-lab' },
  { email: 'accounting@demo.ru', fullName: 'Тестовый банковский сотрудник', role: Role.ACCOUNTING, orgId: 'org-canonical-bank' },
  { email: 'compliance@demo.ru', fullName: 'Тестовый комплаенс', role: Role.COMPLIANCE_OFFICER, orgId: 'org-canonical-platform' },
  { email: 'arbitrator@demo.ru', fullName: 'Тестовый арбитр', role: Role.ARBITRATOR, orgId: 'org-canonical-platform' },
  { email: 'operator@demo.ru', fullName: 'Тестовый оператор', role: Role.SUPPORT_MANAGER, orgId: 'org-canonical-platform' },
  { email: 'executive@demo.ru', fullName: 'Тестовый руководитель', role: Role.EXECUTIVE, orgId: 'org-canonical-platform' },
] as const;

@Injectable()
export class CanonicalTestDealSeedService implements OnModuleInit {
  private readonly logger = new Logger(CanonicalTestDealSeedService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auth: AuthService,
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
      { id: 'org-canonical-seller', inn: '990000000001', name: 'Тестовый продавец', type: 'LEGAL' },
      { id: 'org-canonical-buyer', inn: '990000000002', name: 'Тестовый покупатель', type: 'LEGAL' },
      { id: 'org-canonical-logistics', inn: '990000000003', name: 'Тестовый перевозчик', type: 'LEGAL' },
      { id: 'org-canonical-lab', inn: '990000000004', name: 'Тестовая лаборатория', type: 'LEGAL' },
      { id: 'org-canonical-elevator', inn: '990000000005', name: 'Тестовый элеватор', type: 'LEGAL' },
      { id: 'org-canonical-platform', inn: '990000000006', name: 'Оператор тестового контура', type: 'LEGAL' },
      { id: 'org-canonical-bank', inn: '990000000007', name: 'Тестовый банковский контур', type: 'LEGAL' },
      { id: 'org-canonical-surveyor', inn: '990000000008', name: 'Тестовый сюрвейер', type: 'LEGAL' },
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
            purpose: 'single-role-consistent-industrial-flow',
            synthetic: true,
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

    await this.seedIdentitiesAndMemberships();
  }

  private async seedIdentitiesAndMemberships(): Promise<void> {
    const passwordHash = bcrypt.hashSync(TEST_PASSWORD, 10);

    for (const identity of identities) {
      let user = this.auth.listUsers().find((item) => item.email.toLowerCase() === identity.email);
      if (!user) {
        const registered = await this.auth.register({
          email: identity.email,
          password: TEST_PASSWORD,
          role: Role.DRIVER,
          orgId: identity.orgId,
          fullName: identity.fullName,
          consentVersion: '1.2',
        });
        user = registered.user;
      }

      this.auth.updateUserRole(user.id, identity.role);
      this.auth.updateUserOrg(user.id, identity.orgId);

      await this.prisma.user.upsert({
        where: { id: user.id },
        update: {
          email: identity.email,
          passwordHash,
          fullName: identity.fullName,
          status: 'ACTIVE',
        },
        create: {
          id: user.id,
          email: identity.email,
          passwordHash,
          fullName: identity.fullName,
          status: 'ACTIVE',
        },
      });

      await this.prisma.userOrg.upsert({
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
    }
  }
}
