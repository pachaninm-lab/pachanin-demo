import { Prisma, PrismaClient } from '@prisma/client';

const ADMIN_URL = process.env.TEST_ADMIN_DATABASE_URL;
const describeRace = ADMIN_URL ? describe : describe.skip;

const TENANT = 'tenant-auction-idempotency-race';
const ACTOR = 'user-auction-idempotency-race';
const ORG = 'org-auction-idempotency-race';
const COMMAND = 'PLACE_BID';
const IDEMPOTENCY_KEY = 'auction-race:same-key';
const REQUEST_HASH = 'sha256:same-payload';

function client(url: string): PrismaClient {
  return new PrismaClient({ datasources: { db: { url } } });
}

function isRetryable(error: unknown): boolean {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2034') return true;
    const meta = error.meta as Record<string, unknown> | undefined;
    return ['code', 'database_error_code', 'dbErrorCode', 'sqlState']
      .some((key) => meta?.[key] === '40001');
  }
  return (error as { code?: unknown })?.code === '40001';
}

async function executeIdempotentCommand(db: PrismaClient, marker: string): Promise<Record<string, unknown>> {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      return await db.$transaction(async (tx) => {
        await tx.$executeRawUnsafe(`SELECT set_config('app.current_tenant_id', $1, true)`, TENANT);
        await tx.$executeRawUnsafe(`SELECT set_config('app.current_user_id', $1, true)`, ACTOR);
        await tx.$executeRawUnsafe(`SELECT set_config('app.current_org_id', $1, true)`, ORG);
        await tx.$executeRawUnsafe(`SELECT set_config('app.current_role', 'BUYER', true)`);

        const replayRows = await tx.$queryRaw<Array<{ result: Prisma.JsonValue | null }>>`
          SELECT auction.replay_command(${COMMAND}, ${IDEMPOTENCY_KEY}, ${REQUEST_HASH}) AS result
        `;
        const replay = replayRows[0]?.result;
        if (replay && typeof replay === 'object' && !Array.isArray(replay)) {
          return replay as Record<string, unknown>;
        }

        await tx.$executeRaw`SELECT pg_sleep(0.2)`;
        const result = { marker, accepted: true };
        await tx.$executeRaw`
          SELECT auction.save_command(
            ${COMMAND},
            ${`command:${marker}`},
            ${IDEMPOTENCY_KEY},
            ${REQUEST_HASH},
            ${JSON.stringify(result)}::jsonb
          )
        `;
        return result;
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 10_000 });
    } catch (error) {
      if (!isRetryable(error) || attempt === 4) throw error;
    }
  }
  throw new Error('Unreachable idempotency retry state');
}

describeRace('IR-AUCTION concurrent idempotency receipt', () => {
  let admin: PrismaClient;
  let first: PrismaClient;
  let second: PrismaClient;

  beforeAll(async () => {
    admin = client(ADMIN_URL!);
    first = client(ADMIN_URL!);
    second = client(ADMIN_URL!);
    await Promise.all([admin.$connect(), first.$connect(), second.$connect()]);
    await admin.$executeRawUnsafe(
      `DELETE FROM auction.command_receipts WHERE tenant_id = $1 AND actor_id = $2 AND idempotency_key = $3`,
      TENANT,
      ACTOR,
      IDEMPOTENCY_KEY,
    );
  });

  afterAll(async () => {
    await admin?.$executeRawUnsafe(
      `DELETE FROM auction.command_receipts WHERE tenant_id = $1 AND actor_id = $2 AND idempotency_key = $3`,
      TENANT,
      ACTOR,
      IDEMPOTENCY_KEY,
    );
    await Promise.all([admin?.$disconnect(), first?.$disconnect(), second?.$disconnect()]);
  });

  it('returns one accepted result and one durable replay instead of a unique violation', async () => {
    const outcomes = await Promise.all([
      executeIdempotentCommand(first, 'first'),
      executeIdempotentCommand(second, 'second'),
    ]);

    expect(outcomes.filter((item) => item.duplicate === true)).toHaveLength(1);
    expect(outcomes.filter((item) => item.accepted === true)).toHaveLength(2);
    expect(new Set(outcomes.map((item) => item.marker))).toHaveLength(1);

    const receipts = await admin.$queryRawUnsafe<Array<{ count: bigint }>>(
      `SELECT count(*)::bigint AS count FROM auction.command_receipts WHERE tenant_id = $1 AND actor_id = $2 AND idempotency_key = $3`,
      TENANT,
      ACTOR,
      IDEMPOTENCY_KEY,
    );
    expect(Number(receipts[0]?.count ?? 0n)).toBe(1);
  });
});
