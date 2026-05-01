import { NextResponse } from 'next/server';
import { assertCsrf } from '@/lib/server-request-security';
import { applyLogisticsRuntimeCommand, type LogisticsRuntimeAction } from '@/lib/platform-v7/logistics-runtime-store';
import type { PlatformRole } from '@/lib/platform-v7/execution-contour';

const actions = new Set<LogisticsRuntimeAction>(['send_request', 'view_request', 'submit_quote', 'accept_quote', 'reject_quote']);
const roles = new Set<PlatformRole>(['seller', 'buyer', 'operator', 'bank', 'logistics', 'driver', 'elevator', 'lab', 'surveyor', 'arbitrator', 'investor']);

export async function POST(request: Request) {
  const csrf = assertCsrf(request);
  if (csrf.ok === false) return NextResponse.json({ ok: false, error: csrf.reason }, { status: 403 });

  const body = await request.json().catch(() => ({}));
  const action = body?.action as LogisticsRuntimeAction;
  if (!actions.has(action)) return NextResponse.json({ ok: false, error: 'Неизвестное действие логистики.' }, { status: 400 });

  const actorRole = roles.has(body?.actorRole as PlatformRole) ? body.actorRole as PlatformRole : 'operator';
  const result = applyLogisticsRuntimeCommand({
    scopeId: typeof body?.scopeId === 'string' ? body.scopeId : 'default',
    idempotencyKey: typeof body?.idempotencyKey === 'string' ? body.idempotencyKey : undefined,
    action,
    actorRole,
    requestId: typeof body?.requestId === 'string' ? body.requestId : 'LR-2041',
    quoteId: typeof body?.quoteId === 'string' ? body.quoteId : undefined,
  });

  return NextResponse.json(result, { status: result.ok === false ? 400 : 200 });
}
