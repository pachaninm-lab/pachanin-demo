import { Prisma, PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../src/common/prisma/prisma.service';
import { GektaWorkspaceService } from '../../src/modules/gekta/gekta-workspace.service';

const adminUrl = process.env.TEST_ADMIN_DATABASE_URL || process.env.DATABASE_URL;
if (!adminUrl) throw new Error('A real PostgreSQL URL is required for Gekta history acceptance');
const admin = new PrismaClient({ datasources: { db: { url: adminUrl } } });
const role = 'gekta_history_e2e';
const restrictedUrl = new URL(adminUrl);
restrictedUrl.username = role;
restrictedUrl.password = 'ephemeral_gekta_history_e2e_only';
const left = new PrismaClient({ datasources: { db: { url: restrictedUrl.toString() } } });
const right = new PrismaClient({ datasources: { db: { url: restrictedUrl.toString() } } });
const service = (client: PrismaClient) => new GektaWorkspaceService(client as unknown as PrismaService);
let account: string;
let otherAccount: string;
let users: string[];

function incoming(sourceId = 'local-1', body = 'own synthetic question') {
  return { sourceId, title: 'Same title', locale: 'ru', createdAt: '2026-10-08T00:00:00.000Z',
    messages: [{ role: 'user' as const, body }] };
}

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>(r => { resolve = r; });
  return { promise, resolve };
}

async function waitForBlockedHistoryTransaction() {
  const deadline = Date.now() + 3_000;
  while (Date.now() < deadline) {
    const rows = await admin.$queryRaw<{ count: bigint }[]>(Prisma.sql`
      SELECT count(*) AS count FROM pg_catalog.pg_stat_activity
      WHERE usename = ${role} AND wait_event_type = 'Lock'
    `);
    if (rows[0].count > 0n) return;
    await new Promise(r => setTimeout(r, 10));
  }
  throw new Error('The second real PostgreSQL transaction did not wait for the history lock');
}

describe('Gekta history: real restricted PostgreSQL import, purge and concurrency', () => {
  beforeAll(async () => {
    await admin.$connect();
    await admin.$executeRawUnsafe(`DO $role$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'gekta_history_e2e') THEN
        CREATE ROLE gekta_history_e2e LOGIN;
      END IF;
      ALTER ROLE gekta_history_e2e LOGIN PASSWORD 'ephemeral_gekta_history_e2e_only';
    END $role$;`);
    await admin.$executeRawUnsafe(`DO $grant$ BEGIN
      EXECUTE format('GRANT CONNECT ON DATABASE %I TO gekta_history_e2e', current_database());
    END $grant$;`);
    // Same narrow table capabilities as the existing production principal;
    // role creation and these fixture grants occur only in the disposable CI DB.
    await admin.$executeRawUnsafe('GRANT USAGE ON SCHEMA public TO gekta_history_e2e');
    await admin.$executeRawUnsafe('GRANT SELECT, INSERT, UPDATE ON public.gekta_accounts, public.gekta_conversations, public.gekta_messages, public.gekta_projects TO gekta_history_e2e');
    await admin.$executeRawUnsafe('GRANT SELECT, INSERT ON public.gekta_history_imports TO gekta_history_e2e');
    await admin.$executeRawUnsafe('GRANT EXECUTE ON FUNCTION public.purge_gekta_history(TEXT, TEXT) TO gekta_history_e2e');
    await Promise.all([left.$connect(), right.$connect()]);
  });

  beforeEach(async () => {
    users = [randomUUID(), randomUUID()].map(id => `gekta-history-user-${id}`);
    for (const id of users) await admin.user.create({ data: {
      id, email: `${id}@example.test`, passwordHash: 'not-a-login-credential', fullName: 'Own synthetic fixture',
    } });
    account = (await admin.gektaAccount.create({ data: { userId: users[0] } })).id;
    otherAccount = (await admin.gektaAccount.create({ data: { userId: users[1] } })).id;
  });

  afterEach(async () => {
    await admin.user.deleteMany({ where: { id: { in: users } } });
  });
  afterAll(async () => {
    await Promise.all([left.$disconnect(), right.$disconnect(), admin.$disconnect()]);
  });

  it('commits exactly once across eight simultaneous calls and independent database connections', async () => {
    const results = await Promise.all(Array.from({ length: 8 }, (_, i) => service(i % 2 ? left : right)
      .importAnonymousHistory(account, [incoming()])));
    expect(results.map(r => r.importedCount).reduce((a, b) => a + b, 0)).toBe(1);
    expect(await admin.gektaConversation.count({ where: { accountId: account } })).toBe(1);
    expect(await admin.gektaHistoryImportReceipt.count({ where: { accountId: account } })).toBe(1);
    expect(await admin.gektaMessage.count({ where: { conversation: { accountId: account } } })).toBe(1);
    const fresh = new PrismaClient({ datasources: { db: { url: restrictedUrl.toString() } } });
    try { expect((await service(fresh).importAnonymousHistory(account, [incoming()])).importedCount).toBe(0); }
    finally { await fresh.$disconnect(); }
  });

  it('preserves different and identical content under different stable IDs with the same title', async () => {
    const results = await Promise.all([
      service(left).importAnonymousHistory(account, [incoming('local-a', 'first body')]),
      service(right).importAnonymousHistory(account, [incoming('local-b', 'second body')]),
    ]);
    expect(results.map(r => r.importedCount)).toEqual([1, 1]);
    expect((await service(left).importAnonymousHistory(account, [incoming('local-c', 'first body')])).importedCount).toBe(1);
    expect(await admin.gektaConversation.count({ where: { accountId: account } })).toBe(3);
  });

  it('physically removes owned conversation/message rows and prevents repeated or changed restoration', async () => {
    const first = await service(left).importAnonymousHistory(account, [incoming()]);
    await service(right).importAnonymousHistory(otherAccount, [incoming()]);
    await service(left).deleteConversation(account, first.conversationIds[0]);
    expect(await admin.gektaConversation.count({ where: { accountId: account } })).toBe(0);
    expect(await admin.gektaMessage.count({ where: { conversationId: first.conversationIds[0] } })).toBe(0);
    expect((await service(right).importAnonymousHistory(account, [incoming()])).importedCount).toBe(0);
    await expect(service(right).importAnonymousHistory(account, [incoming('local-1', 'changed body')]))
      .rejects.toThrow('import_identity_conflict');
    await expect(service(right).deleteConversation(account, first.conversationIds[0])).resolves.toEqual({ deleted: true });
    expect(await admin.gektaConversation.count({ where: { accountId: otherAccount } })).toBe(1);
    const receipts = await admin.gektaHistoryImportReceipt.findMany({ where: { accountId: account } });
    expect(receipts).toHaveLength(1);
    expect(Object.keys(receipts[0]).sort()).toEqual(['accountId', 'conversationId', 'importKey', 'importedAt', 'payloadHash']);
    expect(JSON.stringify(receipts)).not.toContain('own synthetic question');
    expect(JSON.stringify(receipts)).not.toContain('Same title');
  });

  it('clears active and legacy soft-deleted rows with cascaded content, while keeping other accounts untouched', async () => {
    await service(left).importAnonymousHistory(account, [incoming()]);
    const legacy = await admin.gektaConversation.create({ data: {
      accountId: account, title: 'legacy', locale: 'ru', importedAt: new Date(), deletedAt: new Date(),
      messages: { create: { role: 'user', body: 'legacy body', citations: { own: true }, attachments: { own: true } } },
    } });
    await service(right).importAnonymousHistory(otherAccount, [incoming()]);
    await expect(service(left).clearHistory(account)).resolves.toEqual({ count: 2 });
    expect(await admin.gektaConversation.count({ where: { accountId: account } })).toBe(0);
    expect(await admin.gektaMessage.count({ where: { conversationId: legacy.id } })).toBe(0);
    expect((await service(right).importAnonymousHistory(account, [{ title: 'legacy', locale: 'ru', messages: [{ role: 'user', body: 'legacy body' }] }])).importedCount).toBe(0);
    expect(await admin.gektaConversation.count({ where: { accountId: otherAccount } })).toBe(1);
  });

  it('rolls back the whole import and receipts when a nested message fails, then accepts a valid retry', async () => {
    const bad = incoming('local-b');
    bad.messages[0].role = 'invalid-role-over-sixteen' as 'user';
    await expect(service(left).importAnonymousHistory(account, [incoming('local-a'), bad])).rejects.toThrow();
    expect(await admin.gektaConversation.count({ where: { accountId: account } })).toBe(0);
    expect(await admin.gektaHistoryImportReceipt.count({ where: { accountId: account } })).toBe(0);
    expect((await service(right).importAnonymousHistory(account, [incoming('local-a'), incoming('local-b')])).importedCount).toBe(2);
  });

  it('rejects a stale append snapshot after a different connection commits physical deletion', async () => {
    const conversation = await service(left).createConversation(account, 'Own', 'ru');
    const captured = deferred();
    const resume = deferred();
    const paused = new GektaWorkspaceService({
      gektaConversation: left.gektaConversation,
      $transaction: async (fn: (tx: Prisma.TransactionClient) => Promise<unknown>) => {
        captured.resolve(); await resume.promise;
        return left.$transaction(fn);
      },
    } as unknown as PrismaService);
    const append = paused.appendMessage(account, conversation.id, { role: 'user', body: 'stale write' });
    const rejected = expect(append).rejects.toThrow('not_found');
    await captured.promise;
    try { await service(right).deleteConversation(account, conversation.id); } finally { resume.resolve(); }
    await rejected;
    expect(await admin.gektaMessage.count({ where: { conversationId: conversation.id } })).toBe(0);
  });

  it('serializes import against clearHistory on the real account row lock and never restores the purged result', async () => {
    const locked = deferred();
    const resume = deferred();
    const paused = new GektaWorkspaceService({
      $transaction: (fn: (tx: Prisma.TransactionClient) => Promise<unknown>) => left.$transaction(async tx => {
        const receipt = { ...tx.gektaHistoryImportReceipt,
          findUnique: async (args: Prisma.GektaHistoryImportReceiptFindUniqueArgs) => {
            locked.resolve(); await resume.promise; return tx.gektaHistoryImportReceipt.findUnique(args);
          },
        };
        // Prisma's raw-query methods are not enumerable. Forward the actual
        // transaction through a proxy so the real FOR UPDATE still executes.
        return fn(new Proxy(tx, { get(target, property) {
          if (property === 'gektaHistoryImportReceipt') return receipt;
          const value = Reflect.get(target, property);
          return typeof value === 'function' ? value.bind(target) : value;
        } }));
      }, { timeout: 10_000 }),
    } as unknown as PrismaService);
    const importResult = paused.importAnonymousHistory(account, [incoming()]);
    await Promise.race([locked.promise, importResult.then(() => {
      throw new Error('Import completed before its receipt barrier');
    })]);
    const clearResult = service(right).clearHistory(account);
    try { await waitForBlockedHistoryTransaction(); } finally { resume.resolve(); }
    expect((await importResult).importedCount).toBe(1);
    expect((await clearResult).count).toBe(1);
    expect(await admin.gektaConversation.count({ where: { accountId: account } })).toBe(0);
    expect((await service(left).importAnonymousHistory(account, [incoming()])).importedCount).toBe(0);
  });

  it('preserves the account boundary and denies direct runtime DELETE while allowing only the purge function', async () => {
    const foreign = await service(right).createConversation(otherAccount, 'Other own fixture', 'ru');
    await expect(service(left).deleteConversation(account, foreign.id)).rejects.toThrow('not_owner');
    await expect(service(left).getConversation(account, foreign.id)).rejects.toThrow('not_owner');
    await expect(left.$executeRaw(Prisma.sql`DELETE FROM public.gekta_conversations WHERE id = ${foreign.id}`)).rejects.toThrow();
    await expect(left.$executeRaw(Prisma.sql`DELETE FROM public.gekta_messages WHERE "conversationId" = ${foreign.id}`)).rejects.toThrow();
    const capabilities = await admin.$queryRaw<{ direct_delete: boolean; receipt_delete: boolean; can_purge: boolean }[]>(Prisma.sql`
      SELECT has_table_privilege(${role}, 'public.gekta_conversations', 'DELETE') AS direct_delete,
        has_table_privilege(${role}, 'public.gekta_history_imports', 'DELETE') AS receipt_delete,
        has_function_privilege(${role}, 'public.purge_gekta_history(text,text)', 'EXECUTE') AS can_purge
    `);
    expect(capabilities[0]).toEqual({ direct_delete: false, receipt_delete: false, can_purge: true });
    await service(left).clearHistory(account);
    expect(await admin.gektaConversation.findUnique({ where: { id: foreign.id } })).not.toBeNull();
  });

  it.each(['stable', 'legacy'] as const)('retains %s receipts through auth pepper rotation and does not restore purged rows', async kind => {
    const previousPepper = process.env.AUTH_TOKEN_PEPPER;
    const record = kind === 'stable' ? incoming() : { ...incoming(), sourceId: undefined };
    try {
      process.env.AUTH_TOKEN_PEPPER = 'own-synthetic-pepper-before-rotation';
      const created = await service(left).importAnonymousHistory(account, [record]);
      expect(created.importedCount).toBe(1);
      await service(left).deleteConversation(account, created.conversationIds[0]);
      const before = await admin.gektaHistoryImportReceipt.findMany({ where: { accountId: account } });
      process.env.AUTH_TOKEN_PEPPER = 'own-synthetic-pepper-after-rotation';
      expect((await service(right).importAnonymousHistory(account, [record])).importedCount).toBe(0);
      expect(await admin.gektaConversation.count({ where: { accountId: account } })).toBe(0);
      expect(await admin.gektaMessage.count({ where: { conversation: { accountId: account } } })).toBe(0);
      expect(await admin.gektaHistoryImportReceipt.findMany({ where: { accountId: account } })).toEqual(before);
      if (kind === 'stable') await expect(service(right).importAnonymousHistory(account, [incoming('local-1', 'changed')])).rejects.toThrow('import_identity_conflict');
    } finally {
      if (previousPepper === undefined) delete process.env.AUTH_TOKEN_PEPPER;
      else process.env.AUTH_TOKEN_PEPPER = previousPepper;
    }
  });
});
