import { GektaWorkspaceService } from './gekta-workspace.service';
import type { PrismaService } from '../../common/prisma/prisma.service';

const NOW = new Date('2026-08-12T12:00:00.000Z');

/** Минимальный двойник Prisma: только то, что сервис действительно вызывает. */
function prismaWith(overrides: Record<string, unknown>): PrismaService {
  const receipts: Record<string, unknown>[] = [];
  const matches = (row: Record<string, unknown>, where: Record<string, unknown>) => Object.entries(where).every(([k, v]) =>
    typeof v === 'object' && v !== null && 'startsWith' in v ? String(row[k]).startsWith(String(v.startsWith)) : row[k] === v);
  const db = {
    $queryRaw: async (sql: { values: unknown[] }) => [{ id: sql.values[0] }],
    gektaHistoryImportReceipt: {
      findUnique: async ({ where }: { where: { accountId_importKey: Record<string, unknown> } }) => receipts.find(r => matches(r, where.accountId_importKey)) ?? null,
      findFirst: async ({ where }: { where: Record<string, unknown> }) => receipts.find(r => matches(r, where)) ?? null,
      create: async ({ data }: { data: Record<string, unknown> }) => { receipts.push(data); return data; },
      createMany: async ({ data }: { data: Record<string, unknown>[] }) => {
        const fresh = data.filter(r => !receipts.some(existing => existing.accountId === r.accountId && existing.importKey === r.importKey));
        receipts.push(...fresh); return { count: fresh.length };
      },
    },
    ...overrides,
  };
  return { ...db, $transaction: async (fn: (tx: unknown) => unknown) => fn(db) } as unknown as PrismaService;
}

describe('Gekta workspace ownership', () => {
  it('refuses to open a conversation that belongs to another account', async () => {
    const service = new GektaWorkspaceService(prismaWith({
      gektaConversation: { findUnique: async () => ({ id: 'c-1', accountId: 'acc-2', messages: [] }) },
    }));
    await expect(service.getConversation('acc-1', 'c-1')).rejects.toThrow('not_owner');
  });

  it('refuses to rename a project that belongs to another account', async () => {
    const service = new GektaWorkspaceService(prismaWith({
      gektaProject: { findUnique: async () => ({ id: 'p-1', accountId: 'acc-2' }) },
    }));
    await expect(service.renameProject('acc-1', 'p-1', 'Новое имя')).rejects.toThrow('not_owner');
  });

  it('refuses to move a conversation into a project owned by someone else', async () => {
    const service = new GektaWorkspaceService(prismaWith({
      gektaConversation: { findUnique: async () => ({ id: 'c-1', accountId: 'acc-1' }) },
      gektaProject: { findUnique: async () => ({ id: 'p-9', accountId: 'acc-2' }) },
    }));
    await expect(service.moveConversation('acc-1', 'c-1', 'p-9')).rejects.toThrow('not_owner');
  });

  it('reports a missing row as not found rather than leaking its existence', async () => {
    const service = new GektaWorkspaceService(prismaWith({
      gektaConversation: { findUnique: async () => null },
    }));
    await expect(service.getConversation('acc-1', 'c-404')).rejects.toThrow('not_found');
  });

  it('rejects an empty project name instead of creating an unnamed folder', async () => {
    const service = new GektaWorkspaceService(prismaWith({
      gektaProject: { create: async () => ({ id: 'p-1' }) },
    }));
    await expect(service.createProject('acc-1', '   ', '', 'ru')).rejects.toThrow('project_name_required');
  });

  it('returns conversations to the history instead of deleting them with the project', async () => {
    const calls: string[] = [];
    const service = new GektaWorkspaceService(prismaWith({
      gektaProject: {
        findUnique: async () => ({ id: 'p-1', accountId: 'acc-1' }),
        updateMany: async () => {
          calls.push('project.soft_delete');
          return { count: 1 };
        },
        findUniqueOrThrow: async () => ({ id: 'p-1', accountId: 'acc-1', deletedAt: NOW }),
      },
      gektaConversation: {
        updateMany: async (args: { data: { projectId: string | null } }) => {
          calls.push(`conversations.detach:${args.data.projectId}`);
          return { count: 3 };
        },
      },
    }));

    await service.deleteProject('acc-1', 'p-1', NOW);
    // Both effects commit together; lock the project first, as assignment does.
    expect(calls).toEqual(['project.soft_delete', 'conversations.detach:null']);
  });
});

describe('Gekta anonymous history import', () => {
  it('does not duplicate a stable import when an old client omits sourceId', async () => {
    const create = jest.fn().mockResolvedValue({ id: 'c-imported' });
    const service = new GektaWorkspaceService(prismaWith({ gektaConversation: { findMany: async () => [], create } }));
    const record = { sourceId: 'stable-1', title: 'Own fixture', locale: 'ru', messages: [{ role: 'user' as const, body: 'own body' }] };
    expect((await service.importAnonymousHistory('acc-1', [record])).importedCount).toBe(1);
    const { sourceId: _sourceId, ...legacy } = record;
    expect((await service.importAnonymousHistory('acc-1', [legacy])).importedCount).toBe(0);
    expect(create).toHaveBeenCalledTimes(1);
    expect((await service.importAnonymousHistory('acc-1', [{ ...record, sourceId: 'stable-2' }])).importedCount).toBe(1);
    expect(create).toHaveBeenCalledTimes(2);
  });

  it('adopts a legacy receipt once and binds changed stable payloads to a conflict', async () => {
    const create = jest.fn().mockResolvedValue({ id: 'c-imported' });
    const service = new GektaWorkspaceService(prismaWith({ gektaConversation: { findMany: async () => [], create } }));
    const record = { title: 'Own fixture', locale: 'ru', messages: [{ role: 'user' as const, body: 'own body' }] };
    expect((await service.importAnonymousHistory('acc-1', [record])).importedCount).toBe(1);
    expect((await service.importAnonymousHistory('acc-1', [{ ...record, sourceId: 'stable-1' }])).importedCount).toBe(0);
    await expect(service.importAnonymousHistory('acc-1', [{ ...record, sourceId: 'stable-1', messages: [{ role: 'user', body: 'changed' }] }])).rejects.toThrow('import_identity_conflict');
    expect(create).toHaveBeenCalledTimes(1);
  });

  it.each(['stable', 'legacy'] as const)('does not recreate %s imports after authentication pepper rotation', async kind => {
    const previousPepper = process.env.AUTH_TOKEN_PEPPER;
    const create = jest.fn().mockResolvedValue({ id: 'c-imported' });
    const service = new GektaWorkspaceService(prismaWith({
      gektaConversation: { findMany: async () => [], create },
    }));
    const record = { ...(kind === 'stable' ? { sourceId: 'local-stable-1' } : {}), title: 'Own fixture', locale: 'ru', messages: [{ role: 'user' as const, body: 'own body' }] };
    try {
      process.env.AUTH_TOKEN_PEPPER = 'own-synthetic-pepper-before-rotation';
      expect((await service.importAnonymousHistory('acc-1', [record])).importedCount).toBe(1);
      process.env.AUTH_TOKEN_PEPPER = 'own-synthetic-pepper-after-rotation';
      expect((await service.importAnonymousHistory('acc-1', [record])).importedCount).toBe(0);
      expect(create).toHaveBeenCalledTimes(1);
      if (kind === 'stable') await expect(service.importAnonymousHistory('acc-1', [{ ...record, messages: [{ role: 'user', body: 'changed' }] }])).rejects.toThrow('import_identity_conflict');
      expect(create).toHaveBeenCalledTimes(1);
    } finally {
      if (previousPepper === undefined) delete process.env.AUTH_TOKEN_PEPPER;
      else process.env.AUTH_TOKEN_PEPPER = previousPepper;
    }
  });

  it('does not duplicate a conversation that was already imported', async () => {
    const created: string[] = [];
    const service = new GektaWorkspaceService(prismaWith({
      gektaConversation: {
        findMany: async ({ where }: { where: { title: string } }) =>
          (where.title === 'Урожайность пшеницы' ? [{ id: 'existing', title: where.title, locale: 'ru', messages: [] }] : []),
        create: async ({ data }: { data: { title: string } }) => {
          created.push(data.title);
          return { id: `c-${created.length}` };
        },
      },
    }));

    const result = await service.importAnonymousHistory('acc-1', [
      { title: 'Урожайность пшеницы', locale: 'ru', messages: [] },
      { title: 'Расход топлива', locale: 'ru', messages: [{ role: 'user', body: 'вопрос' }] },
    ], NOW);

    expect(created).toEqual(['Расход топлива']);
    expect(result.importedCount).toBe(1);
  });

  it('skips a conversation without a usable title instead of failing the whole import', async () => {
    const created: string[] = [];
    const service = new GektaWorkspaceService(prismaWith({
      gektaConversation: {
        findMany: async () => [],
        create: async ({ data }: { data: { title: string } }) => {
          created.push(data.title);
          return { id: 'c-1' };
        },
      },
    }));

    const result = await service.importAnonymousHistory('acc-1', [
      { title: '   ', locale: 'ru', messages: [] },
      { title: 'Севооборот', locale: 'ru', messages: [] },
    ], NOW);

    expect(created).toEqual(['Севооборот']);
    expect(result.importedCount).toBe(1);
  });

  it('marks imported conversations so a second import can recognise them', async () => {
    let captured: Record<string, unknown> | null = null;
    const service = new GektaWorkspaceService(prismaWith({
      gektaConversation: {
        findMany: async () => [],
        create: async ({ data }: { data: Record<string, unknown> }) => {
          captured = data;
          return { id: 'c-1' };
        },
      },
    }));

    await service.importAnonymousHistory('acc-1', [
      { title: 'Хранение картофеля', locale: 'ru', createdAt: '2026-08-01T10:00:00.000Z', messages: [{ role: 'assistant', body: 'ответ' }] },
    ], NOW);

    expect(captured).not.toBeNull();
    expect(captured!.importedAt).toEqual(NOW);
    // Исходная дата диалога сохраняется, иначе история схлопнулась бы в одну дату.
    expect(captured!.createdAt).toEqual(new Date('2026-08-01T10:00:00.000Z'));
  });
});


/** Mutable rows exercise lifecycle effects, not only query text. */
function lifecycleFixture() {
  type Row = { id: string; accountId: string; deletedAt: Date | null; projectId?: string | null; title?: string; name?: string; updatedAt?: Date };
  const conversations: Row[] = [{ id: 'c-1', accountId: 'acc-1', deletedAt: null, projectId: null, title: 'Original' }];
  const projects: Row[] = [{ id: 'p-1', accountId: 'acc-1', deletedAt: null, name: 'Original' }];
  const messages: { conversationId: string; body: string }[] = [];
  let beforeWrite: (() => void) | undefined;
  let failMessage = false;
  const writes: string[] = [];
  function delegate(rows: Row[], label: string) {
    return {
      findUnique: async ({ where }: { where: { id: string } }) => {
        const row = rows.find(r => r.id === where.id);
        return row ? { ...row, messages: messages.filter(m => m.conversationId === row.id) } : null;
      },
      findUniqueOrThrow: async ({ where }: { where: { id: string } }) => {
        const row = rows.find(r => r.id === where.id);
        if (!row) throw new Error('unexpected fixture row absence');
        return { ...row };
      },
      findMany: async () => [],
      update: async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        const hook = beforeWrite; beforeWrite = undefined; hook?.();
        const row = rows.find(r => r.id === where.id);
        if (!row) throw new Error('unexpected fixture row absence');
        Object.assign(row, data); writes.push(label); return { ...row };
      },
      updateMany: async ({ where, data }: { where: Record<string, unknown>; data: Record<string, unknown> }) => {
        const hook = beforeWrite; beforeWrite = undefined; hook?.();
        let count = 0;
        for (const row of rows) {
          if (!Object.entries(where).every(([key, value]) => (row as unknown as Record<string, unknown>)[key] === value)) continue;
          Object.assign(row, data); count++; writes.push(label);
        }
        return { count };
      },
      create: async ({ data }: { data: Row }) => {
        writes.push(label + '.create'); rows.push({ ...data, id: 'created', deletedAt: null }); return rows.at(-1);
      },
    };
  }
  const db = {
    $queryRaw: async (sql: { sql: string; values: unknown[] }) => {
      if (!sql.sql.includes('purge_gekta_history')) return [{ id: sql.values[0] }];
      const [accountId, conversationId] = sql.values;
      const removed = conversations.filter(r => r.accountId === accountId && (conversationId === undefined || r.id === conversationId));
      for (const row of removed) {
        conversations.splice(conversations.indexOf(row), 1);
        for (let i = messages.length - 1; i >= 0; i--) if (messages[i].conversationId === row.id) messages.splice(i, 1);
        writes.push('conversation.purge');
      }
      return [{ count: BigInt(removed.length) }];
    },
    gektaHistoryImportReceipt: { findFirst: async () => null },
    gektaConversation: delegate(conversations, 'conversation'),
    gektaProject: delegate(projects, 'project'),
    gektaMessage: { create: async ({ data }: { data: { conversationId: string; body: string } }) => {
      if (failMessage) throw new Error('message_failure');
      messages.push({ ...data }); writes.push('message'); return { id: 'm-1', ...data };
    } },
    $transaction: async (fn: (tx: unknown) => Promise<unknown>) => {
      const snapshot = structuredClone({ conversations, projects, messages, writes });
      try { return await fn(db); } catch (error) {
        conversations.splice(0, conversations.length, ...snapshot.conversations);
        projects.splice(0, projects.length, ...snapshot.projects);
        messages.splice(0, messages.length, ...snapshot.messages);
        writes.splice(0, writes.length, ...snapshot.writes);
        throw error;
      }
    },
  };
  return {
    service: new GektaWorkspaceService(db as unknown as PrismaService), conversations, projects, messages, writes,
    beforeWrite: (hook: () => void) => { beforeWrite = hook; },
    failMessage: () => { failMessage = true; },
  };
}

describe('Gekta deleted lifecycle boundary', () => {
  const operations: [string, (s: GektaWorkspaceService) => Promise<unknown>][] = [
    ['read', s => s.getConversation('acc-1', 'c-1')],
    ['append', s => s.appendMessage('acc-1', 'c-1', { role: 'user', body: 'new message' })],
    ['rename', s => s.renameConversation('acc-1', 'c-1', 'Renamed')],
    ['move', s => s.moveConversation('acc-1', 'c-1', 'p-1')],
    ['detach', s => s.moveConversation('acc-1', 'c-1', null)],
  ];
  for (const [name, operation] of operations) {
    it(`refuses ${name} after deletion without additional writes`, async () => {
      const f = lifecycleFixture();
      await f.service.deleteConversation('acc-1', 'c-1', NOW);
      const writes = [...f.writes];
      await expect(operation(f.service)).rejects.toThrow('not_found');
      expect(f.writes).toEqual(writes);
      expect(f.messages).toEqual([]);
    });
    it(`refuses ${name} after clearing history`, async () => {
      const f = lifecycleFixture();
      await f.service.clearHistory('acc-1', NOW);
      const writes = [...f.writes];
      await expect(operation(f.service)).rejects.toThrow('not_found');
      expect(f.writes).toEqual(writes);
    });
    it(`preserves ${name} on an active owned conversation`, async () => {
      const f = lifecycleFixture();
      await expect(operation(f.service)).resolves.toBeDefined();
      expect(f.conversations[0].deletedAt).toBeNull();
    });
    it(`does not allow ${name} on another account's conversation`, async () => {
      const f = lifecycleFixture(); f.conversations[0].accountId = 'acc-2';
      await expect(operation(f.service)).rejects.toThrow('not_owner');
      expect(f.writes).toEqual([]);
    });
  }
  for (const [name, operation] of operations.filter(([name]) => name !== 'read')) {
    it(`refuses ${name} if deletion wins the conditional transaction boundary`, async () => {
      const f = lifecycleFixture();
      // A row snapshot was active; the durable row changes before UPDATE.
      f.beforeWrite(() => { f.conversations[0].deletedAt = NOW; });
      await expect(operation(f.service)).rejects.toThrow('not_found');
      expect(f.messages).toEqual([]);
      expect(f.writes).toEqual([]);
    });
  }
  it('keeps repeated physical DELETE idempotent without recreating content', async () => {
    const f = lifecycleFixture();
    await f.service.deleteConversation('acc-1', 'c-1', NOW);
    const writes = [...f.writes];
    const again = await f.service.deleteConversation('acc-1', 'c-1', new Date('2026-10-07T00:00:00Z'));
    expect(again).toEqual({ deleted: true });
    expect(f.conversations).toEqual([]);
    expect(f.writes).toEqual(writes);
  });
  it('removes stored message content and the conversation together', async () => {
    const f = lifecycleFixture();
    await f.service.appendMessage('acc-1', 'c-1', { role: 'user', body: 'own synthetic private content' });
    expect(f.messages).toHaveLength(1);
    await f.service.deleteConversation('acc-1', 'c-1');
    expect(f.conversations).toEqual([]);
    expect(f.messages).toEqual([]);
  });
  it('rolls back the conversation touch if message creation fails', async () => {
    const f = lifecycleFixture(); f.failMessage();
    await expect(f.service.appendMessage('acc-1', 'c-1', { role: 'user', body: 'new' })).rejects.toThrow('message_failure');
    expect(f.messages).toEqual([]);
    expect(f.writes).toEqual([]);
    expect(f.conversations[0].updatedAt).toBeUndefined();
  });
  it('preserves append ordering: active row is locked before the message exists', async () => {
    const f = lifecycleFixture();
    await f.service.appendMessage('acc-1', 'c-1', { role: 'user', body: 'new' });
    expect(f.writes).toEqual(['conversation', 'message']);
    expect(f.messages).toHaveLength(1);
  });
  for (const [name, operation] of [
    ['create', (s: GektaWorkspaceService) => s.createConversation('acc-1', 'new', 'ru', 'p-1')],
    ['move', (s: GektaWorkspaceService) => s.moveConversation('acc-1', 'c-1', 'p-1')],
    ['rename project', (s: GektaWorkspaceService) => s.renameProject('acc-1', 'p-1', 'new')],
  ] as const) {
    it(`rejects ${name} using a deleted project`, async () => {
      const f = lifecycleFixture(); f.projects[0].deletedAt = NOW;
      await expect(operation(f.service)).rejects.toThrow('not_found');
      expect(f.writes).toEqual([]);
    });
    it(`rejects ${name} when project deletion wins before UPDATE`, async () => {
      const f = lifecycleFixture();
      f.beforeWrite(() => { f.projects[0].deletedAt = NOW; });
      await expect(operation(f.service)).rejects.toThrow('not_found');
      expect(f.writes).toEqual([]);
    });
  }
  it('uses the same project-first locking order for move and delete', async () => {
    const f = lifecycleFixture();
    await f.service.moveConversation('acc-1', 'c-1', 'p-1');
    expect(f.writes).toEqual(['project', 'conversation']);
    f.writes.length = 0;
    await f.service.deleteProject('acc-1', 'p-1', NOW);
    expect(f.writes).toEqual(['project', 'conversation']);
    expect(f.conversations[0].projectId).toBeNull();
    expect(f.conversations[0].deletedAt).toBeNull();
  });
  it('does not recreate an imported deleted conversation on a repeated import', async () => {
    const create = jest.fn();
    const service = new GektaWorkspaceService(prismaWith({
      gektaConversation: { findMany: async () => [{ id: 'c-1', accountId: 'acc-1', deletedAt: NOW, title: 'original', locale: 'ru', messages: [] }], create },
    }));
    await expect(service.importAnonymousHistory('acc-1', [{ title: 'original', locale: 'ru', messages: [] }])).resolves.toEqual({ importedCount: 0, conversationIds: [] });
    expect(create).not.toHaveBeenCalled();
  });
});
