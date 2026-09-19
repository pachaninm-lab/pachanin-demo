/**
 * Офлайн-очередь доменных команд для полевых ролей (водитель, элеватор,
 * лаборатория, сюрвейер).
 *
 * Принцип честности: устройство никогда не «подтверждает» действие само.
 * При обрыве связи команда сохраняется локально с теми же commandId и
 * idempotencyKey и отправляется повторно, когда сеть вернулась. Сервер
 * идемпотентен: повторная доставка возвращает сохранённый результат, а не
 * исполняет действие второй раз; конфликт версий (409) очищает запись —
 * состояние уже изменил другой участник, экран нужно обновить.
 */

export interface PendingCommand {
  dealId: string;
  actionId: string;
  commandId: string;
  idempotencyKey: string;
  expectedUpdatedAt: string;
  expectedVersion?: string;
  payload: Record<string, unknown>;
  savedAt: string;
}

const STORAGE_KEY = 'pc-pending-deal-commands-v1';
const MAX_QUEUE = 20;

function storage(): Storage | null {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    return null;
  }
}

export function readQueue(): PendingCommand[] {
  const store = storage();
  if (!store) return [];
  try {
    const parsed = JSON.parse(store.getItem(STORAGE_KEY) ?? '[]');
    return Array.isArray(parsed) ? (parsed as PendingCommand[]) : [];
  } catch {
    return [];
  }
}

function writeQueue(queue: PendingCommand[]): boolean {
  const store = storage();
  if (!store) return false;
  try {
    store.setItem(STORAGE_KEY, JSON.stringify(queue.slice(-MAX_QUEUE)));
    return true;
  } catch {
    // Хранилище недоступно (приватный режим/квота): сохранить нечем.
    return false;
  }
}

/**
 * Одна отложенная команда на сделку: повторное нажатие не создаёт дубликат.
 * Возвращает null, если локальное хранилище недоступно — UI обязан честно
 * сказать «не сохранено», а не обещать доставку, которой не будет.
 */
export function enqueueCommand(command: Omit<PendingCommand, 'savedAt'>): PendingCommand | null {
  const entry: PendingCommand = { ...command, savedAt: new Date().toISOString() };
  const queue = readQueue().filter((item) => item.dealId !== command.dealId);
  queue.push(entry);
  if (!writeQueue(queue)) return null;
  // Проверяем, что запись реально легла в хранилище, прежде чем обещать доставку.
  return pendingForDeal(command.dealId)?.commandId === command.commandId ? entry : null;
}

export function pendingForDeal(dealId: string): PendingCommand | undefined {
  return readQueue().find((item) => item.dealId === dealId);
}

export function removeCommand(dealId: string, commandId: string): void {
  writeQueue(readQueue().filter((item) => !(item.dealId === dealId && item.commandId === commandId)));
}

export type FlushOutcome = 'delivered' | 'conflict' | 'still-offline' | 'retry-later' | 'rejected';

const TRANSIENT_STATUSES = new Set([429, 500, 502, 503, 504]);

/**
 * Пытается доставить отложенную команду сделки.
 * - 2xx (включая duplicate-реплей сервера) → delivered, запись удаляется;
 * - 409 → conflict, запись удаляется (сделку изменил другой участник);
 * - сетевая ошибка → still-offline, запись остаётся;
 * - 429/5xx → retry-later, запись ОСТАЁТСЯ: сервер команду не принял, и
 *   обещанное «сохранено на устройстве» не может пропасть из-за временного
 *   сбоя сервера;
 * - другой ответ сервера (окончательный 4xx) → rejected, запись удаляется,
 *   причина показывается пользователю — молчаливых бесконечных ретраев нет.
 */
export async function flushPendingCommand(
  dealId: string,
  doFetch: typeof fetch = fetch,
): Promise<{ outcome: FlushOutcome; message?: string }> {
  const pending = pendingForDeal(dealId);
  if (!pending) return { outcome: 'delivered' };

  let response: Response;
  try {
    response = await doFetch(`/api/proxy/deals/${pending.dealId}/commands/${pending.actionId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      cache: 'no-store',
      body: JSON.stringify({
        commandId: pending.commandId,
        idempotencyKey: pending.idempotencyKey,
        expectedUpdatedAt: pending.expectedUpdatedAt,
        ...(pending.expectedVersion ? { expectedVersion: pending.expectedVersion } : {}),
        payload: pending.payload,
      }),
    });
  } catch {
    return { outcome: 'still-offline' };
  }

  if (response.ok) {
    removeCommand(pending.dealId, pending.commandId);
    return { outcome: 'delivered' };
  }
  if (response.status === 409) {
    removeCommand(pending.dealId, pending.commandId);
    return { outcome: 'conflict' };
  }
  if (TRANSIENT_STATUSES.has(response.status)) {
    return { outcome: 'retry-later' };
  }
  const payload = await response.json().catch(() => ({}));
  removeCommand(pending.dealId, pending.commandId);
  const message = typeof (payload as { message?: unknown })?.message === 'string'
    ? (payload as { message: string }).message
    : `Ошибка ${response.status}`;
  return { outcome: 'rejected', message };
}

/** Сетевая ошибка fetch (обрыв связи), в отличие от ответа сервера. */
export function isNetworkFailure(reason: unknown): boolean {
  return reason instanceof TypeError;
}
