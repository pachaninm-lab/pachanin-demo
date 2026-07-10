import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 5;

const ALLOWED_KINDS = new Set(['web_vital', 'client_error', 'blank_screen']);
const ALLOWED_METRICS = new Set(['CLS', 'FCP', 'INP', 'LCP', 'TTFB']);
const ALLOWED_ROUTES = new Set([
  '/platform-v7',
  '/platform-v7/login',
  '/platform-v7/forgot-password',
  '/platform-v7/reset-password',
  '/platform-v7/other',
]);
const ALLOWED_CATEGORIES = new Set(['chunk_load', 'runtime', 'unhandled_rejection', 'main_not_rendered']);

function response(status: number, correlationId: string) {
  return NextResponse.json(
    { accepted: status === 202, correlationId },
    {
      status,
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        Pragma: 'no-cache',
        'X-Content-Type-Options': 'nosniff',
      },
    },
  );
}

export async function POST(request: Request) {
  const correlationId = request.headers.get('x-correlation-id') || randomUUID();
  const contentLength = Number(request.headers.get('content-length') || 0);
  if (contentLength > 2_048) return response(413, correlationId);

  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin) return response(403, correlationId);

  const payload = await request.json().catch(() => null) as null | Record<string, unknown>;
  if (!payload) return response(400, correlationId);

  const kind = String(payload.kind || '');
  const route = String(payload.route || '');
  const release = String(payload.release || 'unknown').slice(0, 80);
  const name = String(payload.name || '');
  const category = String(payload.category || '');
  const rating = String(payload.rating || '');
  const value = Number(payload.value);

  if (!ALLOWED_KINDS.has(kind) || !ALLOWED_ROUTES.has(route)) return response(400, correlationId);
  if (kind === 'web_vital' && (!ALLOWED_METRICS.has(name) || !Number.isFinite(value) || value < 0 || value > 120_000)) {
    return response(400, correlationId);
  }
  if (kind !== 'web_vital' && !ALLOWED_CATEGORIES.has(category)) return response(400, correlationId);

  console.info('public_entry_telemetry', JSON.stringify({
    correlationId,
    kind,
    route,
    release,
    ...(kind === 'web_vital' ? { name, value, rating: rating.slice(0, 16) } : { category }),
  }));

  return response(202, correlationId);
}
