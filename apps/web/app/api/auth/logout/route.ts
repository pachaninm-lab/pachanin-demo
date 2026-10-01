import { randomUUID } from 'node:crypto';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { REFRESH_COOKIE } from '../../../../lib/auth-cookies';
import { isControlHostRequest } from '../../../../lib/platform-v7/control-host';
import { assertCsrf } from '../../../../lib/server-request-security';
import { clearAuthenticatedSession } from '../../../../lib/server/auth-session-response';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const API_URL = String(process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || '').replace(/\/$/, '');

function response(
  body: Record<string, unknown>,
  status: number,
  controlPlane: boolean,
) {
  const result = NextResponse.json(body, {
    status,
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      // V14.3.1: выход обрывал сессию, но не убирал за ней. Куки снимаются
      // ниже точечно; всё, что сессия оставила в localStorage, sessionStorage
      // и IndexedDB, переживало выход - история ассистента, списки документов
      // и чек-листы по сделкам, профиль поддержки.
      //
      // "cookies" сознательно НЕ запрашивается: браузер снял бы куки по всему
      // registrable domain, а у платформы есть отдельный control-host, и его
      // сессию этот выход трогать не должен. Куки остаются за
      // clearAuthenticatedSession, который снимает ровно свои.
      //
      // "cache" запрошен намеренно: часть маршрутов ещё не ставит no-store
      // (это открытый V14.3.2), поэтому аутентифицированные ответы могут
      // лежать в дисковом кэше браузера и после выхода.
      //
      // Заголовок действует только в защищённом контексте - по http браузер
      // его игнорирует. Поэтому он не единственный механизм: clearClientSessionState
      // делает то же самое на клиенте, включая случай недоступного сервера.
      'Clear-Site-Data': '"cache", "storage"',
    },
  });
  clearAuthenticatedSession(result, { controlPlane });
  return result;
}

export async function POST(request: Request) {
  const correlationId = request.headers.get('x-correlation-id') || randomUUID();
  const controlPlane = isControlHostRequest(request);
  const csrf = assertCsrf(request);
  if (!csrf.ok) {
    if (controlPlane) console.warn('control_plane_logout_denied', JSON.stringify({ correlationId, reason: 'csrf' }));
    return NextResponse.json(
      { ok: false, code: 'CSRF_REJECTED', correlationId },
      { status: 403, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  const refreshToken = (await cookies()).get(REFRESH_COOKIE)?.value || '';
  if (!refreshToken) {
    if (controlPlane) console.info('control_plane_logout_success', JSON.stringify({ correlationId, localOnly: true }));
    return response({ ok: true, correlationId }, 200, controlPlane);
  }
  if (!API_URL) {
    return response({ ok: false, code: 'AUTH_SERVICE_UNAVAILABLE', localSessionCleared: true, correlationId }, 503, controlPlane);
  }

  try {
    const upstream = await fetch(`${API_URL}/auth/logout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-correlation-id': correlationId,
        ...(request.headers.get('user-agent') ? { 'user-agent': request.headers.get('user-agent') as string } : {}),
      },
      body: JSON.stringify({ refreshToken }),
      cache: 'no-store',
      signal: AbortSignal.timeout(5_000),
    });
    if (!upstream.ok) {
      if (controlPlane) console.warn('control_plane_logout_failed', JSON.stringify({ correlationId, reason: 'upstream' }));
      return response({ ok: false, code: 'SESSION_REVOKE_FAILED', localSessionCleared: true, correlationId }, 503, controlPlane);
    }
    if (controlPlane) console.info('control_plane_logout_success', JSON.stringify({ correlationId, localOnly: false }));
    return response({ ok: true, correlationId }, 200, controlPlane);
  } catch (error) {
    console.error('auth_logout_transport_failure', JSON.stringify({
      correlationId,
      controlPlane,
      reason: error instanceof Error ? error.name : 'unknown',
    }));
    return response({ ok: false, code: 'AUTH_SERVICE_UNAVAILABLE', localSessionCleared: true, correlationId }, 503, controlPlane);
  }
}
