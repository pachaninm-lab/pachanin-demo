import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { ACCESS_COOKIE } from '../../../../lib/auth-cookies';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

/**
 * Единственный API-мост кабинетов (CANONICAL_SCENARIO.md §0.1, §0.3).
 *
 * Каждый путь — строго real-backend-only: если сервер недоступен или сессия
 * не подтверждена, интерфейс получает явный отказ REAL_BACKEND_REQUIRED и
 * показывает состояние деградации сам. Прежние встроенные демонстрационные
 * массивы удалены: тихая подмена ответа на продуктовом пути фабриковала
 * состояние сделок и денег.
 */
function realBackendUnavailable(reason: string, status = 503) {
  return NextResponse.json(
    {
      ok: false,
      code: 'REAL_BACKEND_REQUIRED',
      message: 'Сервер не подтвердил состояние. Ответ без сервера запрещён.',
      reason,
    },
    { status },
  );
}

async function proxy(request: Request, params: { path: string[] }) {
  const path = params.path.join('/');
  const jar = await cookies();
  const token = jar.get(ACCESS_COOKIE)?.value || '';

  if (!API_URL) return realBackendUnavailable('api_url_missing');
  if (!token || token.startsWith('demo.')) return realBackendUnavailable('verified_session_missing', 401);

  try {
    // Строка запроса обязана доходить до API: фильтры и пагинация —
    // часть контракта (?status=, ?limit=, ?cursor=).
    const search = new URL(request.url).search;
    const target = `${API_URL}/${path}${search}`;
    const headers = new Headers(request.headers);
    headers.set('Authorization', `Bearer ${token}`);
    headers.delete('host');
    const body = request.method === 'GET' || request.method === 'HEAD' ? undefined : await request.text();
    const response = await fetch(target, {
      method: request.method,
      headers,
      body,
      cache: 'no-store',
      signal: AbortSignal.timeout(8000),
    });
    const text = await response.text();
    return new NextResponse(text, {
      status: response.status,
      headers: { 'content-type': response.headers.get('content-type') || 'application/json' },
    });
  } catch {
    return realBackendUnavailable('backend_unreachable');
  }
}

export async function GET(request: Request, props: { params: Promise<{ path: string[] }> }) {
  const params = await props.params;
  return proxy(request, params);
}
export async function POST(request: Request, props: { params: Promise<{ path: string[] }> }) {
  const params = await props.params;
  return proxy(request, params);
}
export async function PATCH(request: Request, props: { params: Promise<{ path: string[] }> }) {
  const params = await props.params;
  return proxy(request, params);
}
export async function PUT(request: Request, props: { params: Promise<{ path: string[] }> }) {
  const params = await props.params;
  return proxy(request, params);
}
export async function DELETE(request: Request, props: { params: Promise<{ path: string[] }> }) {
  const params = await props.params;
  return proxy(request, params);
}
