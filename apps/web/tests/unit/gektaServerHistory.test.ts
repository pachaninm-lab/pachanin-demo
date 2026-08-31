import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { chunkImport, importablePayload, toConversation, toProject } from '@/lib/gekta/server-workspace';
import type { GektaConversation } from '@/components/gekta/GektaChatTypes';

const root = resolve(__dirname, '../..');
const workspace = readFileSync(resolve(root, 'components/gekta/GektaChatWorkspace.tsx'), 'utf8');
const serverWorkspace = readFileSync(resolve(root, 'lib/gekta/server-workspace.ts'), 'utf8');

const NOW = '2026-08-12T12:00:00.000Z';

function conversation(overrides: Partial<GektaConversation> = {}): GektaConversation {
  return {
    id: 'c-1',
    locale: 'ru',
    title: 'Севооборот',
    createdAt: '2026-08-01T10:00:00.000Z',
    updatedAt: '2026-08-01T10:05:00.000Z',
    projectId: null,
    messages: [
      { id: 'm-1', role: 'user', text: 'Какой севооборот выбрать?', createdAt: '2026-08-01T10:00:00.000Z' },
      { id: 'm-2', role: 'assistant', text: 'Зависит от предшественника.', createdAt: '2026-08-01T10:01:00.000Z' },
    ],
    ...overrides,
  };
}

describe('Gekta reads the server history as untrusted input', () => {
  it('keeps a well-formed conversation with its own timestamps', () => {
    const parsed = toConversation({
      id: 's-1',
      title: 'Урожайность пшеницы',
      locale: 'en',
      projectId: 'p-1',
      createdAt: '2026-07-01T08:00:00.000Z',
      updatedAt: '2026-07-02T08:00:00.000Z',
      messages: [{ id: 'm-1', role: 'assistant', body: 'ответ', createdAt: '2026-07-01T08:01:00.000Z' }],
    }, NOW);

    expect(parsed?.id).toBe('s-1');
    expect(parsed?.locale).toBe('en');
    expect(parsed?.projectId).toBe('p-1');
    expect(parsed?.createdAt).toBe('2026-07-01T08:00:00.000Z');
    expect(parsed?.messages[0]?.role).toBe('assistant');
  });

  it('drops a row that has no usable identity or title', () => {
    expect(toConversation({ id: '', title: 'x', locale: 'ru', projectId: null, createdAt: NOW, updatedAt: NOW }, NOW)).toBeNull();
    expect(toConversation({ id: 's-1', title: '   ', locale: 'ru', projectId: null, createdAt: NOW, updatedAt: NOW }, NOW)).toBeNull();
    expect(toProject({ id: 's-1', name: '', description: null, locale: 'ru', createdAt: NOW, updatedAt: NOW }, NOW)).toBeNull();
  });

  it('falls back to the current time rather than rendering a broken date', () => {
    const parsed = toConversation({
      id: 's-1', title: 'Хранение', locale: 'ru', projectId: null,
      createdAt: 'не дата', updatedAt: 'не дата',
    }, NOW);
    expect(parsed?.createdAt).toBe(NOW);
  });

  it('treats an unknown locale as Russian instead of failing the whole load', () => {
    expect(toConversation({ id: 's-1', title: 'Тест', locale: 'de', projectId: null, createdAt: NOW, updatedAt: NOW }, NOW)?.locale).toBe('ru');
  });
});

describe('Gekta imports anonymous history without inventing content', () => {
  it('carries over the original date so the history does not collapse into today', () => {
    const payload = importablePayload([conversation()]);
    expect(payload.conversations).toHaveLength(1);
    expect(payload.conversations[0]?.createdAt).toBe('2026-08-01T10:00:00.000Z');
    expect(payload.conversations[0]?.messages).toHaveLength(2);
  });

  it('splits the import so a long history does not exceed the request body limit', () => {
    const many = Array.from({ length: 12 }, (_, index) => ({
      title: `Диалог ${index}`,
      locale: 'ru',
      createdAt: NOW,
      messages: [{ role: 'user', body: 'x'.repeat(3_000) }],
    }));
    const chunks = chunkImport(many, 10_000);
    expect(chunks.length).toBeGreaterThan(1);
    // Ни один диалог не теряется и ни один не дублируется.
    expect(chunks.flat()).toHaveLength(12);
    expect(new Set(chunks.flat().map((item) => item.title)).size).toBe(12);
  });

  it('still sends a conversation that alone exceeds the limit, rather than dropping it', () => {
    const huge = [{ title: 'Огромный', locale: 'ru', createdAt: NOW, messages: [{ role: 'user', body: 'x'.repeat(50_000) }] }];
    expect(chunkImport(huge, 1_000).flat()).toHaveLength(1);
    expect(chunkImport([], 1_000)).toEqual([]);
  });

  it('skips an empty conversation instead of importing a blank chat', () => {
    const payload = importablePayload([
      conversation({ id: 'c-2', messages: [] }),
      conversation({ id: 'c-3', title: '   ' }),
      conversation(),
    ]);
    expect(payload.conversations.map((item) => item.title)).toEqual(['Севооборот']);
  });
});

describe('Gekta keeps one authority for the history', () => {
  it('drops the local copy once the account becomes the source of truth', () => {
    expect(workspace).toContain("if (workspaceMode === 'server')");
    expect(workspace).toContain('window.localStorage.removeItem(HISTORY_STORAGE)');
    expect(workspace).toContain('window.localStorage.removeItem(GEKTA_PROJECTS_STORAGE)');
  });

  it('stays local when the bridge refuses, instead of showing an empty history', () => {
    // Ответ 401 или 503 не должен подменять уже существующую историю пустой.
    expect(workspace).toContain('if (cancelled || !probe.ok) return;');
  });

  it('imports the browser history only once', () => {
    expect(workspace).toContain('if (!importAlreadyDone() && local.length > 0)');
    expect(workspace).toContain('markImportDone()');
  });

  it('keeps the local copy authoritative until the whole import lands', () => {
    // Иначе непереехавшие диалоги были бы стёрты вместе с локальной копией.
    expect(workspace).toContain('if (!complete) return;');
    expect(workspace).toContain('for (const chunk of chunkImport(');
  });

  it('loads the replies when a restored conversation is opened', () => {
    // Список приходит без реплик, поэтому без дочитывания диалог из истории
    // открывался бы пустым.
    expect(workspace).toContain("accountApi<ServerConversationRow>(`conversations/${encodeURIComponent(serverId)}`)");
    expect(workspace).toContain('for (const message of restored.messages) sentMessageIds.current.add(message.id);');
    // Пользователь мог переключиться, пока читались реплики. Проверка идёт по
    // ref, а обновление состояния остаётся чистым.
    expect(workspace).toContain('if (activeIdRef.current === conversation.id) setMessages([...restored.messages]);');
    expect(workspace).toContain('activeIdRef.current = activeId;');
  });

  it('searches the account on the server, not only the loaded page', () => {
    // Сервер отдаёт последние 200 диалогов: фильтрация по загруженному списку
    // не нашла бы ничего за его пределами.
    expect(workspace).toContain("`conversations?search=${encodeURIComponent(query)}`");
    expect(workspace).toContain('const source = serverSearch.results ?? conversations;');
  });

  it('debounces the search and cancels a superseded request', () => {
    expect(workspace).toContain('GEKTA_SEARCH_DEBOUNCE_MS');
    expect(workspace).toContain('const controller = new AbortController();');
    expect(workspace).toContain('controller.abort();');
    expect(workspace).toContain('if (controller.signal.aborted) return;');
  });

  it('bounds the query and does not search on a single character', () => {
    expect(workspace).toContain('const GEKTA_SEARCH_MIN_LENGTH = 2;');
    expect(workspace).toContain('const GEKTA_SEARCH_MAX_LENGTH = 120;');
    expect(workspace).toContain('search.trim().slice(0, GEKTA_SEARCH_MAX_LENGTH)');
  });

  it('returns to the normal recent history when the query is cleared', () => {
    expect(workspace).toContain("setServerSearch({ state: 'idle', query: '', results: null });");
  });

  it('never searches the server in anonymous mode', () => {
    // У анонимного режима нет аккаунта: серверный поиск ему нечего искать.
    expect(workspace).toContain("if (workspaceMode !== 'server' || query.length < GEKTA_SEARCH_MIN_LENGTH)");
  });

  it('switches to server mode only after the server list is actually read', () => {
    // Сбой чтения не должен приводить к удалению локальной копии.
    expect(workspace).toContain('if (!serverConversations.ok) return;');
  });

  it('does not create a second server conversation for one that was loaded', () => {
    expect(workspace).toContain('serverConversationIds.current.set(conversation.id, conversation.id)');
    expect(workspace).toContain('sentMessageIds.current.add(message.id)');
  });

  it('lets the account decide access instead of the anonymous quota', () => {
    // Пробный период не должен упираться в десять бесплатных ответов.
    expect(workspace).toContain("if (workspaceMode === 'server') {\n      const decision = await accountApi");
    expect(workspace).toContain('return ACCOUNT_TICKET;');
    expect(workspace).toContain('if (ticket === ACCOUNT_TICKET) return;');
  });

  it('coordinates rotating refresh tokens across browser tabs', () => {
    expect(serverWorkspace).toContain("locks.request('gekta-product-session-refresh'");
    expect(serverWorkspace).toContain('const afterWait = await retry();');
    expect(serverWorkspace).toContain('if (afterWait.status !== 401) return afterWait;');
  });

  it('does not show a free-answer counter to an account that has none', () => {
    expect(workspace).toContain('remaining: null, limit: null');
  });

  it('sends deletions to the server so they survive a reload', () => {
    expect(workspace).toContain("accountApi(`conversations/${encodeURIComponent(serverId)}`, { method: 'DELETE' })");
    expect(workspace).toContain("accountApi(`projects/${encodeURIComponent(projectId)}`, { method: 'DELETE' })");
  });

  it('clears only the language the user was looking at', () => {
    // Общий DELETE /conversations стёр бы и другие языки, которых нет на экране.
    expect(workspace).not.toContain("accountApi('conversations', { method: 'DELETE' })");
    expect(workspace).toContain("conversations.filter((conversation) => conversation.locale === locale)");
  });

  it('moves a conversation onto the server project id instead of orphaning it', () => {
    expect(workspace).toContain('conversation.projectId === project.id ? { ...conversation, projectId: serverId }');
  });
});
