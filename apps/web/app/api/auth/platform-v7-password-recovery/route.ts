import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function noStore(status: number, body: Record<string, unknown>) {
  return NextResponse.json(body, {
    status,
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      Pragma: 'no-cache',
    },
  });
}

function clean(input: unknown) {
  return typeof input === 'string' ? input.trim().slice(0, 500) : '';
}

export async function POST(request: NextRequest) {
  let payload: Record<string, unknown>;
  try {
    payload = await request.json();
  } catch {
    return noStore(400, { ok: false, reason: 'invalid_request' });
  }

  const recovery = {
    role: clean(payload.role) || 'не выбрана',
    login: clean(payload.login) || 'не указан',
    company: clean(payload.company) || 'не указано',
    contact: clean(payload.contact) || 'не указан',
    comment: clean(payload.comment) || 'без комментария',
    requestedAt: new Date().toISOString(),
  };

  console.info('platform-v7 password recovery request', recovery);

  return noStore(202, {
    ok: true,
    message: 'Запрос восстановления принят.',
  });
}
