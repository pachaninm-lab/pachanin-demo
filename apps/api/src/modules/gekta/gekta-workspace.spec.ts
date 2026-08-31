import { GektaWorkspaceService } from './gekta-workspace.service';
import type { PrismaService } from '../../common/prisma/prisma.service';

const NOW = new Date('2026-08-12T12:00:00.000Z');

/** Минимальный двойник Prisma: только то, что сервис действительно вызывает. */
function prismaWith(overrides: Record<string, unknown>): PrismaService {
  return {
    $transaction: async (fn: (tx: unknown) => unknown) => fn(overrides),
    ...overrides,
  } as unknown as PrismaService;
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
        update: async () => {
          calls.push('project.soft_delete');
          return { id: 'p-1' };
        },
      },
      gektaConversation: {
        updateMany: async (args: { data: { projectId: string | null } }) => {
          calls.push(`conversations.detach:${args.data.projectId}`);
          return { count: 3 };
        },
      },
    }));

    await service.deleteProject('acc-1', 'p-1', NOW);
    // Диалоги сначала отвязываются, и только потом проект помечается удалённым.
    expect(calls).toEqual(['conversations.detach:null', 'project.soft_delete']);
  });
});

describe('Gekta anonymous history import', () => {
  it('does not duplicate a conversation that was already imported', async () => {
    const created: string[] = [];
    const service = new GektaWorkspaceService(prismaWith({
      gektaConversation: {
        findFirst: async ({ where }: { where: { title: string } }) =>
          (where.title === 'Урожайность пшеницы' ? { id: 'existing' } : null),
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
        findFirst: async () => null,
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
        findFirst: async () => null,
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
