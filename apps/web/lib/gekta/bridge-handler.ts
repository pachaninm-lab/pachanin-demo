import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { ACCESS_COOKIE } from '@/lib/auth-cookies';
import { assertCsrf } from '@/lib/server-request-security';
import {
  GEKTA_BRIDGE_TIMEOUT_MS,
  resolveBridgePath,
  safeSearch,
  upstreamUrl,
  type BridgeSurface,
} from '@/lib/gekta/account-bridge';

const NO_STORE = { 'Cache-Control': 'no-store' } as const;

function fail(error: string, status: number) {
  return NextResponse.json({ error }, { status, headers: NO_STORE });
}

/**
 * Общая пересылка для пользовательского и операторского мостов.
 *
 * Права здесь не вычисляются: и владение аккаунтом, и роли оператора
 * проверяет API. Мост отвечает только за то, чтобы наружу не открылся
 * маршрут, которого нет в списке, и чтобы токен не ушёл на чужой хост.
 */
export async function forwardToGekta(
  request: Request,
  surface: BridgeSurface,
  segments: readonly string[],
): Promise<NextResponse> {
  if (assertCsrf(request).ok === false) return fail('csrf_rejected', 403);

  const path = resolveBridgePath(surface, segments);
  if (!path) return fail('unsupported_path', 404);

  const token = (await cookies()).get(ACCESS_COOKIE)?.value;
  // Кабинет существует только для вошедшего пользователя: анонимный доступ
  // живёт в отдельном контуре с квотой в подписанной cookie.
  if (!token) return fail('authentication_required', 401);

  const url = upstreamUrl(surface, path, safeSearch(surface, new URL(request.url).searchParams));
  if (!url) return fail('service_unavailable', 503);

  const body = request.method === 'GET' || request.method === 'DELETE' ? undefined : await request.text();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), GEKTA_BRIDGE_TIMEOUT_MS);
  try {
    const upstream = await fetch(url, {
      method: request.method,
      headers: {
        authorization: `Bearer ${token}`,
        ...(body ? { 'content-type': 'application/json' } : {}),
      },
      ...(body ? { body } : {}),
      signal: controller.signal,
      cache: 'no-store',
    });
    const text = await upstream.text();
    return new NextResponse(text, {
      status: upstream.status,
      headers: { ...NO_STORE, 'content-type': upstream.headers.get('content-type') ?? 'application/json' },
    });
  } catch {
    return fail('upstream_unavailable', 502);
  } finally {
    clearTimeout(timer);
  }
}
