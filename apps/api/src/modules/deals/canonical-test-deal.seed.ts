import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CANONICAL_TEST_DEAL_ID } from './deal-command.policy';

const enabled = (name: string) => String(process.env[name] ?? '').toLowerCase() === 'true';

@Injectable()
export class CanonicalTestDealSeedService implements OnModuleInit {
  private readonly logger = new Logger(CanonicalTestDealSeedService.name);

  constructor(private readonly prisma: PrismaService) {}

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
    ] as const;

    await this.prisma.$transaction(async (tx) => {
      for (const organization of organizations) {
        await tx.organization.upsert({
          where: { id: organization.id },
          update: {
            name: organization.name,
            status: 'VERIFIED',
            kycStatus: 'APPROVED',
            amlStatus: 'CLEAR',
          },
          create: {
            ...organization,
            tenantId: 'tenant-canonical-test',
            status: 'VERIFIED',
            kycStatus: 'APPROVED',
            amlStatus: 'CLEAR',
            verifiedAt: new Date(),
          },
        });
      }

      await tx.deal.upsert({
        where: { id: CANONICAL_TEST_DEAL_ID },
        update: {},
        create: {
          id: CANONICAL_TEST_DEAL_ID,
          dealNumber: 'ТП-000001',
          status: 'DRAFT',
          tenantId: 'tenant-canonical-test',
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
        update: {},
        create: {
          id: `payment:${CANONICAL_TEST_DEAL_ID}`,
          dealId: CANONICAL_TEST_DEAL_ID,
          status: 'PENDING',
          amountKopecks: 240_000_000,
          callbackState: 'NONE',
        },
      });
    });
  }
}
