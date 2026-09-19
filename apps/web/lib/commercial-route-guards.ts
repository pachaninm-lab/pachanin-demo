import { NextResponse } from 'next/server';
import type { SurfaceRoleKey } from '../../../shared/role-contract';
import { assertCsrf } from './server-request-security';
import { describeActor, getServerRequestActor, type ServerRequestActor } from './server-request-actor';
import { getCorrelationId, logAuditEvent } from './observability';

export type CommercialResourceKey =
  | 'alerts'
  | 'companies'
  | 'dispatch'
  | 'field_kits'
  | 'finance_applications'
  | 'insurance'
  | 'knowledge'
  | 'market'
  | 'queue'
  | 'survey';

const ACCESS: Record<CommercialResourceKey, { read: SurfaceRoleKey[]; write: SurfaceRoleKey[] }> = {
  alerts: {
    read: ['FARMER', 'BUYER', 'EXECUTIVE', 'SUPPORT_MANAGER', 'ADMIN'],
    write: ['EXECUTIVE', 'SUPPORT_MANAGER', 'ADMIN'],
  },
  companies: {
    read: ['FARMER', 'BUYER', 'EXECUTIVE', 'SUPPORT_MANAGER', 'ADMIN'],
    write: ['BUYER', 'EXECUTIVE', 'SUPPORT_MANAGER', 'ADMIN'],
  },
  dispatch: {
    read: ['FARMER', 'BUYER', 'LOGISTICIAN', 'DRIVER', 'ELEVATOR', 'ACCOUNTING', 'EXECUTIVE', 'SUPPORT_MANAGER', 'ADMIN'],
    write: ['LOGISTICIAN', 'SUPPORT_MANAGER', 'ADMIN'],
  },
  field_kits: {
    read: ['FARMER', 'DRIVER', 'LAB', 'ELEVATOR', 'LOGISTICIAN', 'SUPPORT_MANAGER', 'ADMIN'],
    write: ['SUPPORT_MANAGER', 'ADMIN'],
  },
  finance_applications: {
    read: ['ACCOUNTING', 'EXECUTIVE', 'SUPPORT_MANAGER', 'ADMIN'],
    write: ['ACCOUNTING', 'EXECUTIVE', 'SUPPORT_MANAGER', 'ADMIN'],
  },
  insurance: {
    read: ['FARMER', 'BUYER', 'LOGISTICIAN', 'ACCOUNTING', 'EXECUTIVE', 'SUPPORT_MANAGER', 'ADMIN'],
    write: ['LOGISTICIAN', 'ACCOUNTING', 'EXECUTIVE', 'SUPPORT_MANAGER', 'ADMIN'],
  },
  knowledge: {
    read: ['FARMER', 'BUYER', 'LOGISTICIAN', 'DRIVER', 'LAB', 'ELEVATOR', 'ACCOUNTING', 'EXECUTIVE', 'SUPPORT_MANAGER', 'ADMIN'],
    write: ['SUPPORT_MANAGER', 'ADMIN'],
  },
  market: {
    read: ['FARMER', 'BUYER', 'EXECUTIVE', 'SUPPORT_MANAGER', 'ADMIN'],
    write: ['EXECUTIVE', 'SUPPORT_MANAGER', 'ADMIN'],
  },
  queue: {
    read: ['LOGISTICIAN', 'ELEVATOR', 'SUPPORT_MANAGER', 'ADMIN'],
    write: ['LOGISTICIAN', 'ELEVATOR', 'SUPPORT_MANAGER', 'ADMIN'],
  },
  survey: {
    read: ['FARMER', 'BUYER', 'LAB', 'ELEVATOR', 'EXECUTIVE', 'SUPPORT_MANAGER', 'ADMIN'],
    write: ['LAB', 'ELEVATOR', 'EXECUTIVE', 'SUPPORT_MANAGER', 'ADMIN'],
  },
};

export type CommercialGuardSuccess = {
  ok: true;
  actor: ServerRequestActor;
  correlationId: string;
  response?: undefined;
};

export type CommercialGuardFailure = {
  ok: false;
  response: NextResponse;
  actor?: undefined;
  correlationId?: undefined;
};

export type CommercialGuardResult = CommercialGuardSuccess | CommercialGuardFailure;

function hasRole(actor: ServerRequestActor, roles: SurfaceRoleKey[]) {
  return roles.includes(actor.surfaceRole as SurfaceRoleKey);
}

export async function assertCommercialRequest(
  request: Request,
  resource: CommercialResourceKey,
  intent: 'read' | 'write',
): Promise<CommercialGuardResult> {
  const correlationId = getCorrelationId(request);
  const actor = await getServerRequestActor(request);
  if (!actor.isAuthenticated) {
    await logAuditEvent({
      severity: 'WARN',
      scope: 'commercial_api',
      action: `${resource}.${intent}.deny`,
      message: 'Требуется авторизация.',
      actor: describeActor(actor),
      correlationId,
      details: { reason: 'auth_required' },
    });
    const response = NextResponse.json({ message: 'auth_required' }, { status: 401 });
    response.headers.set('x-correlation-id', correlationId);
    return { ok: false, response };
  }

  if (intent === 'write') {
    const trusted = assertCsrf(request);
    if (!trusted.ok) {
      const failReason = (trusted as any).reason as string;
      await logAuditEvent({
        severity: 'WARN',
        scope: 'commercial_api',
        action: `${resource}.${intent}.deny`,
        message: 'CSRF проверка не пройдена.',
        actor: describeActor(actor),
        correlationId,
        details: { reason: failReason },
      });
      const response = NextResponse.json({ message: failReason }, { status: 403 });
      response.headers.set('x-correlation-id', correlationId);
      return { ok: false, response };
    }
  }

  const roles = ACCESS[resource][intent];
  if (!hasRole(actor, roles)) {
    await logAuditEvent({
      severity: 'WARN',
      scope: 'commercial_api',
      action: `${resource}.${intent}.deny`,
      message: 'Недостаточно прав.',
      actor: describeActor(actor),
      correlationId,
      details: { requiredRoles: roles, role: actor.surfaceRole },
    });
    const response = NextResponse.json({ message: 'forbidden' }, { status: 403 });
    response.headers.set('x-correlation-id', correlationId);
    return { ok: false, response };
  }

  return { ok: true, actor, correlationId };
}

export function jsonWithCorrelation(payload: unknown, init: ResponseInit | undefined, correlationId: string) {
  const response = NextResponse.json(payload, init);
  response.headers.set('x-correlation-id', correlationId);
  return response;
}

export function parseEnum<T extends string>(value: unknown, allowed: readonly T[]): T | null {
  const normalized = String(value || '').trim();
  return (allowed as readonly string[]).includes(normalized) ? (normalized as T) : null;
}

export function parseString(value: unknown) {
  const normalized = String(value || '').trim();
  return normalized || '';
}

export function parseNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}
