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

function recoveryApiHeaders() {
  const token = process.env.PC_RECOVERY_WEBHOOK_TOKEN;
  return {
    'Content-Type': 'application/json',
    ...(token ? { 'X-Recovery-Token': token } : {}),
  };
}

export async function POST(request: NextRequest) {
  const recoveryApiUrl = process.env.PC_RECOVERY_WEBHOOK_URL;
  if (!recoveryApiUrl) {
    return noStore(503, { ok: false, reason: 'recovery_api_not_configured' });
  }

  let payload: Record<string, unknown>;
  try {
    payload = await request.json();
  } catch {
    return noStore(400, { ok: false, reason: 'invalid_request' });
  }

  const recovery = {
    source: 'platform-v7',
    type: 'password_recovery_request',
    role: clean(payload.role) || 'не выбрана',
    login: clean(payload.login) || 'не указан',
    company: clean(payload.company) || 'не указано',
    contact: clean(payload.contact) || 'не указан',
    comment: clean(payload.comment) || 'без комментария',
    requestedAt: new Date().toISOString(),
  };

  const forwarded = await fetch(recoveryApiUrl, {
    method: 'POST',
    headers: recoveryApiHeaders(),
    body: JSON.stringify(recovery),
  });

  if (!forwarded.ok) {
    console.error('platform-v7 recovery api failed', { status: forwarded.status });
    return noStore(502, { ok: false, reason: 'recovery_api_failed' });
  }

  return noStore(202, {
    ok: true,
    message: 'Запрос восстановления отправлен.',
  });
}
