/**
 * Real HTTP client shared by every *live* integration adapter.
 *
 * This is the vendor-agnostic plumbing that all live adapters need: timeouts,
 * retry with exponential backoff + jitter, idempotency keys, pluggable auth
 * headers, JSON (de)serialisation, normalised errors and PII-masked structured
 * logging. A live adapter only supplies the endpoint paths and the domain
 * <-> vendor payload mapping; everything transport-related lives here.
 *
 * `fetch` and `sleep` are injectable so the client is fully unit-testable
 * without real network access.
 */

import type { HealthStatus } from '../adapter.interface';

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

/** Returns extra headers to attach to every request (e.g. Authorization). */
export type AuthProvider = () => Promise<Record<string, string>>;

export interface Logger {
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
}

export type FetchLike = (
  url: string,
  init: {
    method: string;
    headers: Record<string, string>;
    body?: string;
    signal?: AbortSignal;
  },
) => Promise<{
  ok: boolean;
  status: number;
  statusText?: string;
  text(): Promise<string>;
  headers?: { get(name: string): string | null };
}>;

export interface HttpIntegrationClientOptions {
  /** Adapter name, used only for logs/health. */
  readonly name: string;
  /** Base URL of the external system (no trailing slash required). */
  readonly baseUrl: string;
  /** Optional auth header provider (bearer / api-key / oauth2). */
  readonly auth?: AuthProvider;
  /** Per-request timeout. Default 15s. */
  readonly timeoutMs?: number;
  /** Max retry attempts on retryable failures (network / 5xx / 429). Default 3. */
  readonly maxRetries?: number;
  /** Base backoff delay in ms (grows exponentially with jitter). Default 300. */
  readonly retryBaseDelayMs?: number;
  /** Static headers added to every request. */
  readonly defaultHeaders?: Record<string, string>;
  /** Injectable fetch (defaults to global fetch). */
  readonly fetchImpl?: FetchLike;
  /** Injectable sleep (defaults to setTimeout) — tests pass a no-op. */
  readonly sleep?: (ms: number) => Promise<void>;
  /** Injectable logger. Defaults to a PII-masking console logger. */
  readonly logger?: Logger;
}

export interface RequestOptions<TBody = unknown> {
  readonly method: HttpMethod;
  readonly path: string;
  readonly body?: TBody;
  readonly query?: Record<string, string | number | boolean | undefined>;
  readonly headers?: Record<string, string>;
  /** Idempotency key for non-GET mutations (added as Idempotency-Key header). */
  readonly idempotencyKey?: string;
  readonly timeoutMs?: number;
}

export class IntegrationHttpError extends Error {
  constructor(
    message: string,
    readonly options: {
      readonly adapter: string;
      readonly status?: number;
      readonly code: 'timeout' | 'network' | 'http' | 'parse';
      readonly retryable: boolean;
      readonly body?: string;
    },
  ) {
    super(message);
    this.name = 'IntegrationHttpError';
  }
}

const PII_KEYS = /(pass(word)?|secret|token|authorization|inn|snils|passport|account|card|cvv|pin|phone|email|birth)/i;

function maskValue(value: unknown): unknown {
  if (typeof value === 'string') {
    if (value.length <= 4) return '***';
    return `${value.slice(0, 2)}***${value.slice(-2)}`;
  }
  return '***';
}

/** Deep-clone with PII fields masked — safe for logging request/response bodies. */
export function maskPii(input: unknown, depth = 0): unknown {
  if (depth > 6 || input == null) return input;
  if (Array.isArray(input)) return input.map((v) => maskPii(v, depth + 1));
  if (typeof input === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
      out[k] = PII_KEYS.test(k) ? maskValue(v) : maskPii(v, depth + 1);
    }
    return out;
  }
  return input;
}

const defaultLogger: Logger = {
  // eslint-disable-next-line no-console
  info: (m, meta) => console.info(`[integration] ${m}`, meta ? maskPii(meta) : ''),
  // eslint-disable-next-line no-console
  warn: (m, meta) => console.warn(`[integration] ${m}`, meta ? maskPii(meta) : ''),
  // eslint-disable-next-line no-console
  error: (m, meta) => console.error(`[integration] ${m}`, meta ? maskPii(meta) : ''),
};

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export class HttpIntegrationClient {
  private readonly name: string;
  private readonly baseUrl: string;
  private readonly auth?: AuthProvider;
  private readonly timeoutMs: number;
  private readonly maxRetries: number;
  private readonly retryBaseDelayMs: number;
  private readonly defaultHeaders: Record<string, string>;
  private readonly fetchImpl: FetchLike;
  private readonly sleep: (ms: number) => Promise<void>;
  private readonly logger: Logger;

  constructor(opts: HttpIntegrationClientOptions) {
    if (!opts.baseUrl) throw new Error(`[${opts.name}] baseUrl is required for the live HTTP client`);
    this.name = opts.name;
    this.baseUrl = opts.baseUrl.replace(/\/+$/, '');
    this.auth = opts.auth;
    this.timeoutMs = opts.timeoutMs ?? 15_000;
    this.maxRetries = opts.maxRetries ?? 3;
    this.retryBaseDelayMs = opts.retryBaseDelayMs ?? 300;
    this.defaultHeaders = opts.defaultHeaders ?? {};
    const injectedFetch = opts.fetchImpl ?? (globalThis.fetch as unknown as FetchLike | undefined);
    if (!injectedFetch) throw new Error(`[${opts.name}] no fetch implementation available`);
    this.fetchImpl = injectedFetch;
    this.sleep = opts.sleep ?? defaultSleep;
    this.logger = opts.logger ?? defaultLogger;
  }

  private buildUrl(path: string, query?: RequestOptions['query']): string {
    const base = `${this.baseUrl}/${path.replace(/^\/+/, '')}`;
    if (!query) return base;
    const params = Object.entries(query)
      .filter(([, v]) => v !== undefined)
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`);
    return params.length ? `${base}?${params.join('&')}` : base;
  }

  private backoffDelay(attempt: number): number {
    const exp = this.retryBaseDelayMs * 2 ** (attempt - 1);
    const jitter = Math.random() * this.retryBaseDelayMs;
    return Math.round(exp + jitter);
  }

  async request<TResponse = unknown, TBody = unknown>(options: RequestOptions<TBody>): Promise<TResponse> {
    const url = this.buildUrl(options.path, options.query);
    const authHeaders = this.auth ? await this.auth() : {};
    const headers: Record<string, string> = {
      accept: 'application/json',
      ...this.defaultHeaders,
      ...authHeaders,
      ...options.headers,
    };
    const hasBody = options.body !== undefined && options.method !== 'GET';
    if (hasBody) headers['content-type'] = headers['content-type'] ?? 'application/json';
    if (options.idempotencyKey && options.method !== 'GET') headers['idempotency-key'] = options.idempotencyKey;
    const body = hasBody ? JSON.stringify(options.body) : undefined;

    let lastError: IntegrationHttpError | undefined;
    for (let attempt = 1; attempt <= this.maxRetries + 1; attempt++) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? this.timeoutMs);
      try {
        this.logger.info(`${this.name} ${options.method} ${options.path}`, {
          attempt,
          query: options.query,
          body: options.body,
        });
        const res = await this.fetchImpl(url, { method: options.method, headers, body, signal: controller.signal });
        const text = await res.text();
        if (res.ok) return this.parse<TResponse>(text);

        const retryable = res.status === 429 || res.status >= 500;
        lastError = new IntegrationHttpError(`${this.name} ${options.method} ${options.path} -> ${res.status}`, {
          adapter: this.name,
          status: res.status,
          code: 'http',
          retryable,
          body: text.slice(0, 2000),
        });
        if (!retryable) throw lastError;
      } catch (err) {
        if (err instanceof IntegrationHttpError && !err.options.retryable) throw err;
        lastError =
          err instanceof IntegrationHttpError
            ? err
            : new IntegrationHttpError(`${this.name} ${options.method} ${options.path} failed: ${String(
                err instanceof Error ? err.message : err,
              )}`, {
                adapter: this.name,
                code: (err as { name?: string })?.name === 'AbortError' ? 'timeout' : 'network',
                retryable: true,
              });
      } finally {
        clearTimeout(timer);
      }

      if (attempt <= this.maxRetries) {
        const delay = this.backoffDelay(attempt);
        this.logger.warn(`${this.name} retry ${attempt}/${this.maxRetries} in ${delay}ms`, {
          reason: lastError?.options.code,
          status: lastError?.options.status,
        });
        await this.sleep(delay);
      }
    }
    throw lastError ?? new IntegrationHttpError(`${this.name} request failed`, { adapter: this.name, code: 'network', retryable: false });
  }

  private parse<T>(text: string): T {
    if (!text) return undefined as unknown as T;
    try {
      return JSON.parse(text) as T;
    } catch {
      throw new IntegrationHttpError(`${this.name} returned a non-JSON body`, {
        adapter: this.name,
        code: 'parse',
        retryable: false,
        body: text.slice(0, 2000),
      });
    }
  }

  /** Standard health check: GET a lightweight path and time it. */
  async healthCheck(path = '/health'): Promise<HealthStatus> {
    const startedAt = Date.now();
    try {
      await this.request({ method: 'GET', path, timeoutMs: Math.min(this.timeoutMs, 5000) });
      return { status: 'ok', latencyMs: Date.now() - startedAt, lastCheckedAt: new Date().toISOString() };
    } catch (err) {
      const detail = err instanceof Error ? err.message : 'health check failed';
      const status = err instanceof IntegrationHttpError && err.options.code === 'timeout' ? 'degraded' : 'down';
      return { status, latencyMs: Date.now() - startedAt, lastCheckedAt: new Date().toISOString(), detail };
    }
  }
}
