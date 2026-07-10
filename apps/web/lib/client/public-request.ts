'use client';

export type PublicRequestResult<T> = {
  response: Response;
  payload: T;
};

export async function postPublicJson<T extends Record<string, unknown>>(
  url: string,
  body: Record<string, unknown>,
  timeoutMs: number,
): Promise<PublicRequestResult<T>> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort('timeout'), timeoutMs);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      cache: 'no-store',
      signal: controller.signal,
      credentials: 'same-origin',
    });
    const payload = await response.json().catch(() => ({} as T)) as T;
    return { response, payload };
  } catch {
    if (controller.signal.aborted) throw new Error('REQUEST_TIMEOUT');
    if (typeof navigator !== 'undefined' && navigator.onLine === false) throw new Error('NETWORK_OFFLINE');
    throw new Error('NETWORK_ERROR');
  } finally {
    window.clearTimeout(timeout);
  }
}
