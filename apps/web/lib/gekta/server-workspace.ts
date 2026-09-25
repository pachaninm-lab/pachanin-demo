import type { GektaConversation, GektaMessage } from '@/components/gekta/GektaChatTypes';
import type { GektaProject } from '@/lib/gekta/projects';

/**
 * Серверная история Гекты.
 *
 * Пока пользователь не вошёл, история живёт только в браузере. После входа
 * авторитетом становится сервер: локальные диалоги один раз переносятся в
 * аккаунт, и дальше и чтение, и запись идут через API. Дублирующего хранилища
 * не остаётся — иначе два списка неизбежно разойдутся.
 */

export const GEKTA_HISTORY_IMPORT_FLAG = 'gekta-history-imported-v1';

export type WorkspaceMode = 'local' | 'server';

export type ServerConversationRow = {
  id: string;
  title: string;
  locale: string;
  projectId: string | null;
  createdAt: string;
  updatedAt: string;
  messages?: readonly { id: string; role: string; body: string; createdAt: string }[];
};

export type ServerProjectRow = {
  id: string;
  name: string;
  description: string | null;
  locale: string;
  createdAt: string;
  updatedAt: string;
};

function locale(value: unknown): 'ru' | 'en' | 'zh' {
  return value === 'en' || value === 'zh' ? value : 'ru';
}

function moment(value: unknown, fallback: string): string {
  return typeof value === 'string' && Number.isFinite(Date.parse(value)) ? value : fallback;
}

/** Ответ сервера — такой же недоверенный вход, как и localStorage. */
export function toConversation(row: ServerConversationRow, now: string): GektaConversation | null {
  if (!row || typeof row.id !== 'string' || !row.id) return null;
  const title = typeof row.title === 'string' ? row.title.trim() : '';
  if (!title) return null;
  const messages: GektaMessage[] = (row.messages ?? []).flatMap((message) => {
    if (!message || typeof message.id !== 'string' || typeof message.body !== 'string') return [];
    return [{
      id: message.id,
      role: message.role === 'assistant' ? 'assistant' : 'user',
      text: message.body,
      createdAt: moment(message.createdAt, now),
    }];
  });
  return {
    id: row.id,
    locale: locale(row.locale),
    title,
    createdAt: moment(row.createdAt, now),
    updatedAt: moment(row.updatedAt, now),
    projectId: typeof row.projectId === 'string' ? row.projectId : null,
    messages,
  };
}

export function toProject(row: ServerProjectRow, now: string): GektaProject | null {
  if (!row || typeof row.id !== 'string' || !row.id) return null;
  const name = typeof row.name === 'string' ? row.name.trim() : '';
  if (!name) return null;
  return {
    id: row.id,
    locale: locale(row.locale),
    name,
    description: typeof row.description === 'string' ? row.description : '',
    createdAt: moment(row.createdAt, now),
    updatedAt: moment(row.updatedAt, now),
  };
}

export type ImportableConversation = {
  title: string;
  locale: string;
  createdAt: string;
  messages: { role: string; body: string }[];
};

/**
 * Что именно переносить в аккаунт. Пустые диалоги не переносятся: они не несут
 * содержания, а в истории выглядели бы как потерянная переписка.
 */
export function importablePayload(conversations: readonly GektaConversation[]): {
  conversations: ImportableConversation[];
} {
  return {
    conversations: conversations
      .filter((conversation) => conversation.title.trim() && conversation.messages.length > 0)
      .slice(0, 100)
      .map((conversation) => ({
        title: conversation.title,
        locale: conversation.locale,
        createdAt: conversation.createdAt,
        messages: conversation.messages.map((message) => ({ role: message.role, body: message.text })),
      })),
  };
}

/** Порог, ниже стандартного лимита тела запроса NestJS в 100 КБ. */
export const IMPORT_CHUNK_BYTES = 64 * 1024;

/**
 * Сколько диалогов сервер принимает за один запрос переноса. Значение
 * повторяет GEKTA_IMPORT_MAX_CONVERSATIONS в API.
 *
 * Размера части в байтах было недостаточно: сто коротких диалогов весят около
 * 13 КБ и уходили одной частью, а сервер брал первые шестьдесят и возвращал
 * ok. Клиент видел успех, помечал перенос выполненным — и сорок диалогов
 * истории пропадали молча, без единой ошибки.
 */
export const IMPORT_CHUNK_CONVERSATIONS = 60;

/**
 * Перенос идёт частями: целая история легко перерастает лимит тела запроса, а
 * молчаливо обрезать её нельзя — локальная копия после переноса удаляется.
 * Диалог, который сам по себе больше порога, всё равно уходит отдельной
 * частью: пусть лучше сервер откажет явно, чем клиент потеряет переписку молча.
 */
export function chunkImport(
  conversations: readonly ImportableConversation[],
  limitBytes: number = IMPORT_CHUNK_BYTES,
  limitCount: number = IMPORT_CHUNK_CONVERSATIONS,
): ImportableConversation[][] {
  const chunks: ImportableConversation[][] = [];
  let current: ImportableConversation[] = [];
  let size = 0;
  for (const conversation of conversations) {
    const weight = JSON.stringify(conversation).length;
    if (current.length > 0 && (size + weight > limitBytes || current.length >= limitCount)) {
      chunks.push(current);
      current = [];
      size = 0;
    }
    current.push(conversation);
    size += weight;
  }
  if (current.length > 0) chunks.push(current);
  return chunks;
}

export function csrfToken(): string {
  if (typeof document === 'undefined') return '';
  const row = document.cookie.split('; ').find((entry) => entry.startsWith('pc_csrf_token='));
  return row ? decodeURIComponent(row.slice(row.indexOf('=') + 1)) : '';
}

/**
 * Плоский результат вместо размеченного объединения: в этой конфигурации
 * TypeScript не сужает объединение по булеву дискриминанту, и `status` внутри
 * ветки ошибки становится недоступен.
 */
export type AccountResponse<T> = { ok: boolean; status: number; data: T | null };

let refreshInFlight: Promise<boolean> | null = null;

async function refreshAccountSession(): Promise<boolean> {
  if (refreshInFlight) return refreshInFlight;
  refreshInFlight = (async () => {
    try {
      const response = await fetch('/api/gekta/auth/refresh', {
        method: 'POST',
        credentials: 'same-origin',
        cache: 'no-store',
        headers: { 'x-csrf-token': csrfToken() },
      });
      return response.ok;
    } catch {
      return false;
    } finally {
      refreshInFlight = null;
    }
  })();
  return refreshInFlight;
}

async function recoverAccountSession(
  retry: () => Promise<Response>,
  initial: Response,
): Promise<Response> {
  const locks = typeof navigator === 'undefined' ? undefined : navigator.locks;
  if (!locks) return await refreshAccountSession() ? retry() : initial;

  return locks.request('gekta-product-session-refresh', async () => {
    // Another tab may have rotated the shared HttpOnly cookies while this tab
    // waited. Recheck first so we do not rotate the new refresh token again.
    const afterWait = await retry();
    if (afterWait.status !== 401) return afterWait;
    return await refreshAccountSession() ? retry() : afterWait;
  });
}

async function accountRequest(
  path: string,
  init: { method: 'GET' | 'POST' | 'PATCH' | 'DELETE'; body?: unknown; signal?: AbortSignal },
): Promise<Response> {
  const method = init.method;
  return fetch(`/api/gekta/account/${path}`, {
    method,
    credentials: 'same-origin',
    cache: 'no-store',
    headers: {
      Accept: 'application/json',
      ...(method === 'GET' ? {} : { 'x-csrf-token': csrfToken() }),
      ...(init.body === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
    ...(init.body === undefined ? {} : { body: JSON.stringify(init.body) }),
    ...(init.signal ? { signal: init.signal } : {}),
  });
}

export async function accountApi<T>(
  path: string,
  init?: { method?: 'GET' | 'POST' | 'PATCH' | 'DELETE'; body?: unknown; signal?: AbortSignal },
): Promise<AccountResponse<T>> {
  const method = init?.method ?? 'GET';
  try {
    const request = { method, body: init?.body, signal: init?.signal };
    let response = await accountRequest(path, request);
    // Product refresh tokens rotate. Web Locks coordinate every tab; the
    // module promise remains the safe fallback within one browser context.
    if (response.status === 401) {
      response = await recoverAccountSession(() => accountRequest(path, request), response);
    }
    if (!response.ok) return { ok: false, status: response.status, data: null };
    const text = await response.text();
    return { ok: true, status: response.status, data: (text ? JSON.parse(text) : null) as T };
  } catch {
    return { ok: false, status: 0, data: null };
  }
}

export async function logoutGektaAccount(): Promise<boolean> {
  try {
    const response = await fetch('/api/gekta/auth/logout', {
      method: 'POST',
      credentials: 'same-origin',
      cache: 'no-store',
      headers: { 'x-csrf-token': csrfToken() },
    });
    try { window.localStorage.removeItem(GEKTA_HISTORY_IMPORT_FLAG); } catch {}
    return response.ok;
  } catch {
    try { window.localStorage.removeItem(GEKTA_HISTORY_IMPORT_FLAG); } catch {}
    return false;
  }
}

/**
 * Перенос выполняется один раз на браузер: сервер дополнительно защищён от
 * повторов по названию диалога, но повторно слать сотню диалогов незачем.
 */
export function importAlreadyDone(): boolean {
  try {
    return window.localStorage.getItem(GEKTA_HISTORY_IMPORT_FLAG) === 'done';
  } catch {
    return false;
  }
}

export function markImportDone(): void {
  try {
    window.localStorage.setItem(GEKTA_HISTORY_IMPORT_FLAG, 'done');
  } catch {
    /* приватный режим браузера — перенос просто повторится в следующий раз */
  }
}
