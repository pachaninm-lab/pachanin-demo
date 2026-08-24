import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { RlsTransactionService } from '../../common/prisma/rls-transaction.service';
import { Role, type RequestUser } from '../../common/types/request-user';
import {
  ONE_C_COMMANDS,
  ONE_C_PROTOCOL_VERSION,
  type OneCSelfDiscovery,
} from './one-c-connector.protocol';
import {
  OneCPairingChallengeOutcome,
  OneCRuntimeRepository,
} from './one-c-runtime.repository';
import { WorkTaskRepository } from './work-task.repository';

const describeDiagnostic =
  process.env.EVIDENCE_DIR === 'artifacts/pc-crop-accounting' ? describe : describe.skip;
const RUN = `pc-one-c-consume-diagnostic.${Date.now()}.${Math.random().toString(16).slice(2)}`;
const TENANT_ID = `${RUN}.tenant`;
const ORGANIZATION_ID = `${RUN}.organization`;
const USER_ID = `${RUN}.user`;
const MEMBERSHIP_ID = `${RUN}.membership`;
const INN = `7${String(Date.now()).slice(-9)}`;
const KPP = '770701001';
const DATABASE_INSTANCE_ID = `${RUN}.database-instance`;
const ONE_C_ORGANIZATION_GUID = '11111111-2222-3333-4444-555555555555';

let prisma: PrismaService;
let repository: OneCRuntimeRepository;

const user: RequestUser = {
  id: USER_ID,
  email: `${USER_ID}@industrial.invalid`,
  role: Role.GUEST,
  orgId: ORGANIZATION_ID,
  tenantId: TENANT_ID,
  membershipId: MEMBERSHIP_ID,
  sessionId: `${RUN}.session`,
  mfaVerified: true,
  mfaVerifiedAt: new Date().toISOString(),
};

const discovery: OneCSelfDiscovery = {
  platformVersion: '8.3.27.1234',
  configurationName: 'Бухгалтерия предприятия',
  configurationVersion: '3.0.170.31',
  databaseInstanceId: DATABASE_INSTANCE_ID,
  organizations: [
    {
      guid: ONE_C_ORGANIZATION_GUID,
      inn: INN,
      kpp: KPP,
      name: 'One C Diagnostic',
    },
  ],
  capabilities: ONE_C_COMMANDS,
  connectorVersion: '1.0.0',
  protocolVersion: ONE_C_PROTOCOL_VERSION,
};

function safeDiagnostic(error: unknown, pairingCode: string, correlationId: string): string {
  const meta =
    error instanceof Prisma.PrismaClientKnownRequestError && error.meta
      ? error.meta
      : undefined;
  let message =
    typeof meta?.message === 'string'
      ? meta.message
      : error instanceof Error
        ? error.message
        : String(error);
  for (const value of [
    pairingCode,
    correlationId,
    RUN,
    DATABASE_INSTANCE_ID,
    ONE_C_ORGANIZATION_GUID,
    INN,
    KPP,
  ]) {
    message = message.replaceAll(value, '<redacted>');
  }
  message = message.replace(/[\r\n\t]+/g, ' ').slice(0, 800);

  return JSON.stringify({
    errorType: error instanceof Error ? error.constructor.name : typeof error,
    prismaCode:
      error instanceof Prisma.PrismaClientKnownRequestError ? error.code : null,
    databaseCode: typeof meta?.code === 'string' ? meta.code : null,
    constraint: typeof meta?.constraint === 'string' ? meta.constraint : null,
    table: typeof meta?.table === 'string' ? meta.table : null,
    column: typeof meta?.column === 'string' ? meta.column : null,
    message,
  });
}

describeDiagnostic('1C consume pairing safe PostgreSQL diagnostic', () => {
  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();
    await prisma.$executeRaw(Prisma.sql`
      INSERT INTO public."organizations"
        ("id","inn","kpp","name","type","status","kycStatus","tenantId","createdAt","updatedAt")
      VALUES
        (${ORGANIZATION_ID}, ${INN}, ${KPP}, 'One C Diagnostic', 'LEGAL',
         'VERIFIED', 'VERIFIED', ${TENANT_ID}, now(), now())
    `);
    await prisma.$executeRaw(Prisma.sql`
      INSERT INTO public."users"
        ("id","email","passwordHash","fullName","status","createdAt","updatedAt")
      VALUES
        (${USER_ID}, ${user.email}, 'hash', 'CHIEF_ACCOUNTANT', 'ACTIVE', now(), now())
    `);
    await prisma.$executeRaw(Prisma.sql`
      INSERT INTO public."user_orgs"
        ("id","userId","organizationId","role","status","isDefault","joinedAt","job_profile")
      VALUES
        (${MEMBERSHIP_ID}, ${USER_ID}, ${ORGANIZATION_ID}, 'GUEST', 'ACTIVE', true,
         now(), 'CHIEF_ACCOUNTANT')
    `);

    const transactions = new RlsTransactionService(prisma);
    repository = new OneCRuntimeRepository(
      prisma,
      transactions,
      new WorkTaskRepository(transactions),
    );
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('surfaces only redacted SQLSTATE and bounded PostgreSQL metadata', async () => {
    const challenge = await repository.createPairingChallenge(user, {
      correlationId: `${RUN}.challenge`,
      ttlSeconds: 600,
    });
    expect(challenge.outcome).toBe(OneCPairingChallengeOutcome.ISSUED);
    const pairingCode = challenge.pairingCode as string;
    const correlationId = `${RUN}.consume`;
    const rollback = new Error('ONE_C_DIAGNOSTIC_ROLLBACK');

    try {
      await prisma.$transaction(
        async (tx) => {
          await tx.$queryRaw(Prisma.sql`
            SELECT installation_id
              FROM connector.consume_one_c_pairing(
                ${pairingCode},
                ${discovery.databaseInstanceId},
                ${discovery.platformVersion},
                ${discovery.configurationName},
                ${discovery.configurationVersion},
                ${discovery.connectorVersion},
                ${discovery.protocolVersion},
                ARRAY[${Prisma.join([...discovery.capabilities])}]::text[],
                ${JSON.stringify(discovery.organizations)}::jsonb,
                ${correlationId}
              )
          `);
          throw rollback;
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      if (error === rollback) return;
      throw new Error(`ONE_C_SAFE_DB_DIAGNOSTIC ${safeDiagnostic(error, pairingCode, correlationId)}`);
    }
  });
});
