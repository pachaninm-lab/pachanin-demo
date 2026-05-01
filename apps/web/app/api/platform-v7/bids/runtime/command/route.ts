import { NextResponse } from 'next/server';
import { applyBidRuntimeCommand, type BidRuntimeAction } from '@/lib/platform-v7/bid-runtime-store';
import type { PlatformRole, RejectionReason } from '@/lib/platform-v7/execution-contour';
import { assertCsrf } from '@/lib/server-request-security';

const actions: BidRuntimeAction[] = ['accept_bid', 'reject_bid', 'clarify_bid', 'improve_bid', 'withdraw_bid', 'submit_bid'];
const roles: PlatformRole[] = ['seller', 'buyer', 'operator', 'bank', 'logistics', 'driver', 'elevator', 'lab', 'surveyor', 'arbitrator', 'investor'];
const reasons: RejectionReason[] = ['Цена ниже ожидания', 'Не подходит объём', 'Не подходит срок вывоза', 'Не подходят условия оплаты', 'Не готовы документы', 'Другое'];

function actionOf(value: unknown): BidRuntimeAction | null {
  return actions.includes(value as BidRuntimeAction) ? value as BidRuntimeAction : null;
}

function roleOf(value: unknown): PlatformRole {
  return roles.includes(value as PlatformRole) ? value as PlatformRole : 'operator';
}

function reasonOf(value: unknown): RejectionReason | undefined {
  return reasons.includes(value as RejectionReason) ? value as RejectionReason : undefined;
}

export async function POST(request: Request) {
  const trusted = assertCsrf(request);
  if (trusted.ok === false) {
    return NextResponse.json({ ok: false, error: trusted.reason }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const action = actionOf(body?.action);
  if (!action) {
    return NextResponse.json({ ok: false, error: 'Неизвестное действие ставки.' }, { status: 400 });
  }

  const result = applyBidRuntimeCommand({
    scopeId: typeof body?.scopeId === 'string' ? body.scopeId : 'default',
    idempotencyKey: typeof body?.idempotencyKey === 'string' ? body.idempotencyKey : undefined,
    action,
    actorRole: roleOf(body?.actorRole),
    lotId: typeof body?.lotId === 'string' ? body.lotId : 'LOT-2403',
    bidId: typeof body?.bidId === 'string' ? body.bidId : undefined,
    viewerCounterpartyId: typeof body?.viewerCounterpartyId === 'string' ? body.viewerCounterpartyId : undefined,
    reason: reasonOf(body?.reason),
    priceDelta: typeof body?.priceDelta === 'number' ? body.priceDelta : undefined,
  });

  return NextResponse.json(result, { status: result.ok === false ? 400 : 200 });
}
