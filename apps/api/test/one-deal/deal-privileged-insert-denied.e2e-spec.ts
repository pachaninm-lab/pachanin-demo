import { PrismaService } from '../../src/common/prisma/prisma.service';
import { RlsTransactionService } from '../../src/common/prisma/rls-transaction.service';
import { Role, type RequestUser } from '../../src/common/types/request-user';

const operator: RequestUser = {
  id: 'operator-e2e',
  email: 'operator@demo.ru',
  fullName: 'Тестовый оператор',
  role: Role.SUPPORT_MANAGER,
  orgId: 'org-canonical-platform',
  tenantId: 'tenant-canonical-test',
  sessionId: 'restricted-authority-operator-session',
  mfaVerified: true,
};

function databaseErrorText(error: unknown): string {
  const candidate = error as { code?: unknown; message?: unknown; meta?: unknown };
  return JSON.stringify({ code: candidate?.code, message: candidate?.message, meta: candidate?.meta });
}

describe('Deal insert privilege boundary', () => {
  let prisma: PrismaService;
  let rls: RlsTransactionService;

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();
    rls = new RlsTransactionService(prisma);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('denies arbitrary Deal creation to SUPPORT_MANAGER despite privileged read access', async () => {
    let errorText = '';
    try {
      await rls.withTrustedContext(operator, (tx) => tx.deal.create({
        data: {
          id: 'deal-forged-by-support-manager',
          lotId: 'LOT-FORGED-BY-SUPPORT',
          sourceLotId: 'BID-FORGED-BY-SUPPORT',
          dealNumber: 'ТП-FORGED-BY-SUPPORT',
          status: 'DRAFT',
          tenantId: operator.tenantId,
          sellerOrgId: 'org-canonical-seller',
          buyerOrgId: 'org-canonical-buyer',
          totalKopecks: 100n,
          currency: 'RUB',
        },
      }));
    } catch (error) {
      errorText = databaseErrorText(error);
    }

    expect(errorText).toMatch(/row-level security|42501|policy/i);
    await expect(prisma.deal.findUnique({
      where: { id: 'deal-forged-by-support-manager' },
    })).resolves.toBeNull();
  });
});
