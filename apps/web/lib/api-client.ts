export class ApiError extends Error {
  status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

const API_URL = (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_API_URL) || 'http://localhost:4000/api';

// Global 401 handler — set by auth provider at runtime
let on401Handler: (() => void) | null = null;
export function setOn401Handler(fn: () => void) { on401Handler = fn; }

async function request<T>(path: string, init?: RequestInit, retries = 1): Promise<T> {
  let lastError: Error = new ApiError('unknown');

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetch(`${API_URL}${path}`, {
        ...init,
        headers: {
          'Content-Type': 'application/json',
          ...(init?.headers || {}),
        },
        cache: 'no-store',
      });

      // 401 — session expired
      if (response.status === 401) {
        on401Handler?.();
        throw new ApiError('401 Unauthorized — сессия истекла', 401);
      }

      if (!response.ok) {
        let message = `Request failed: ${response.status}`;
        try {
          const payload = await response.json();
          message = payload?.message || payload?.error || message;
        } catch {
          try { const text = await response.text(); if (text) message = text; } catch {}
        }
        throw new ApiError(message, response.status);
      }

      if (response.status === 204) return undefined as T;
      return response.json() as Promise<T>;
    } catch (err) {
      lastError = err instanceof Error ? err : new ApiError(String(err));

      // Don't retry on 4xx (client errors) — only on network/5xx
      if (err instanceof ApiError && err.status && err.status < 500) throw err;
      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, 300 * Math.pow(2, attempt)));
        continue;
      }
    }
  }

  throw lastError;
}

export const api = {
  get<T>(path: string) {
    return request<T>(path, { method: 'GET' });
  },
  post<T>(path: string, body?: unknown) {
    return request<T>(path, { method: 'POST', body: body === undefined ? undefined : JSON.stringify(body) });
  },
  patch<T>(path: string, body?: unknown) {
    return request<T>(path, { method: 'PATCH', body: body === undefined ? undefined : JSON.stringify(body) });
  },
  put<T>(path: string, body?: unknown) {
    return request<T>(path, { method: 'PUT', body: body === undefined ? undefined : JSON.stringify(body) });
  },
  delete<T>(path: string) {
    return request<T>(path, { method: 'DELETE' });
  },
};

// Typed API error guard
export function isApiError(err: unknown): err is ApiError {
  return err instanceof ApiError;
}

export function isNetworkError(err: unknown): boolean {
  return err instanceof TypeError && err.message.includes('fetch');
}
