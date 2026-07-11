import { NextRequest, NextResponse } from 'next/server';
import { verifyHs256Jwt } from '@/lib/platform-v7/verified-session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const CONTROL_PERMISSIONS = [
  'organization:list','user:list','staff-assignment:read','staff-assignment:write',
  'staff-request:read','staff-request:approve','staff-session:read','staff-session:revoke',
  'audit:read','support-case:read','support-case:update','user:session:revoke',
  'user:access-recovery:initiate','deal:list','deal:read','deal:blocker:read',
  'payment:metadata:read','payment:reconciliation:read','diagnostic:read','deployment:read',
  'feature-flag:read','critical-action:approve','break-glass:activate',
] as const;

const VIEW_AS_PERMISSIONS = ['cabinet:view-as','deal:read','document:metadata:read'] as const;
const ORGANIZATION = {
  id: 'org-canonical-buyer',
  tenantId: 'tenant-canonical-test',
  tenant_id: 'tenant-canonical-test',
  name: 'ООО «Тестовый покупатель»',
  inn: '990000000002',
  status: 'ACTIVE',
  kycStatus: 'VERIFIED',
  kyc_status: 'VERIFIED',
  amlStatus: 'CLEAR',
  aml_status: 'CLEAR',
};

function readEnv(name: string): string {
  return String(process.env[name] || '').trim();
}

function enabled(): boolean {
  if (readEnv('PC_STAFF_TEST_FIXTURE').toLowerCase() !== 'true') return false;
  if (readEnv('PC_CABINET_TEST_ACCESS').toLowerCase() !== 'true') return false;
  const expiresAt = readEnv('PC_CABINET_TEST_ACCESS_EXPIRES_AT');
  if (!expiresAt) return true;
  const expiry = Date.parse(expiresAt);
  return Number.isFinite(expiry) && expiry > Date.now();
}

function secret(): string {
  return readEnv('JWT_SECRET') || readEnv('PC_CABINET_SESSION_SECRET');
}

function iso(offsetMs = 0) {
  return new Date(Date.now() + offsetMs).toISOString();
}

function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate, private',
      Pragma: 'no-cache',
      'X-Content-Type-Options': 'nosniff',
      'X-Test-Environment': 'controlled-access',
    },
  });
}

async function authorized(request: NextRequest): Promise<boolean> {
  const authorization = request.headers.get('authorization') || '';
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : '';
  const signingSecret = secret();
  if (!token || !signingSecret) return false;
  const claims = await verifyHs256Jwt(token, signingSecret);
  const exp = typeof claims?.exp === 'number' ? claims.exp : 0;
  return Boolean(claims && typeof claims.cab === 'string' && exp > Math.floor(Date.now() / 1000));
}

function normalizedPath(parts: string[] | undefined) {
  return (parts || []).map((part) => decodeURIComponent(part)).join('/');
}

function session(mode: 'CONTROL_PLANE' | 'VIEW_AS') {
  const viewAs = mode === 'VIEW_AS';
  return {
    id: viewAs ? 'sas-view_as' : 'sas-control_plane',
    status: 'ACTIVE',
    staff_role: 'PLATFORM_OWNER',
    access_mode: mode,
    permissions: viewAs ? [...VIEW_AS_PERMISSIONS] : [...CONTROL_PERMISSIONS],
    effective_tenant_id: viewAs ? ORGANIZATION.tenantId : null,
    effective_organization_id: viewAs ? ORGANIZATION.id : null,
    effective_user_id: null,
    effective_role: viewAs ? 'BUYER' : null,
    target_deal_id: null,
    reason: 'Controlled owner testing',
    ticket_id: 'OWNER-TEST-ACCESS',
    expires_at: iso(60 * 60 * 1000),
    created_at: iso(-60_000),
  };
}

async function handle(request: NextRequest, context: { params: { path?: string[] } }) {
  if (!enabled()) return json({ code: 'NOT_FOUND' }, 404);
  if (!(await authorized(request))) return json({ code: 'AUTH_REQUIRED' }, 401);

  const path = normalizedPath(context.params.path);
  const method = request.method.toUpperCase();
  const body = method === 'POST' ? await request.json().catch(() => ({})) as Record<string, unknown> : {};

  if (method === 'GET' && path === 'assignments/me') {
    return json([{ id: 'sta-owner-controlled-test', role: 'PLATFORM_OWNER', status: 'ACTIVE', valid_from: iso(-86_400_000), valid_until: null }]);
  }
  if (method === 'GET' && path === 'access/requests') return json([]);
  if (method === 'GET' && path === 'access/requests/review') return json([]);
  if (method === 'GET' && path === 'access/sessions') return json([session('CONTROL_PLANE'), session('VIEW_AS')]);
  if (method === 'GET' && path === 'access/sessions/review') return json([session('CONTROL_PLANE'), session('VIEW_AS')]);
  if (method === 'POST' && path === 'access/requests') {
    const mode = body.accessMode === 'VIEW_AS' ? 'VIEW_AS' : 'CONTROL_PLANE';
    return json({ status: 'GRANTED', requestId: `sar-${mode.toLowerCase()}`, grantId: `sag-${mode.toLowerCase()}` }, 201);
  }
  const activate = path.match(/^access\/grants\/(sag-(control_plane|view_as))\/activate$/);
  if (method === 'POST' && activate) {
    const mode = activate[2] === 'view_as' ? 'VIEW_AS' : 'CONTROL_PLANE';
    const active = session(mode);
    return json({
      accessSessionId: active.id,
      accessMode: active.access_mode,
      accessToken: mode === 'VIEW_AS' ? 'controlled-view-as-token' : 'controlled-control-plane-token',
      expiresAt: active.expires_at,
      staffRole: active.staff_role,
      permissions: active.permissions,
      effectiveTenantId: active.effective_tenant_id,
      effectiveOrganizationId: active.effective_organization_id,
      effectiveRole: active.effective_role,
      ticketId: active.ticket_id,
      reason: active.reason,
    });
  }
  if (method === 'POST' && /^access\/sessions\/[^/]+\/(end|revoke)$/.test(path)) return json({ success: true });

  if (method === 'GET' && path === 'organizations') return json([ORGANIZATION]);
  if (method === 'GET' && /^organizations\/[^/]+\/users$/.test(path)) {
    return json([{ membership_id: 'm-buyer-test', user_id: 'buyer-e2e', email: 'buyer@demo.ru', full_name: 'Тестовый покупатель', user_status: 'ACTIVE', mfa_enabled: true, role: 'BUYER', is_default: true, joined_at: iso(-86_400_000) }]);
  }
  if (method === 'GET' && /^organizations\/[^/]+\/cabinet\/[^/]+$/.test(path)) {
    const role = path.split('/').at(-1) || 'BUYER';
    return json({
      mode: 'READ_ONLY_VIEW_AS',
      effectiveOrganization: ORGANIZATION,
      effectiveRole: role,
      roleMembers: 1,
      deals: [{ id: 'deal-canonical-test', dealNumber: 'ТП-000001', deal_number: 'ТП-000001', status: 'IN_EXECUTION', nextAction: 'Проверить документы', next_action: 'Проверить документы', updatedAt: iso(-5_000), updated_at: iso(-5_000) }],
    });
  }
  if (method === 'GET' && path === 'audit/events') {
    return json({ items: [{ id: 'sae-controlled-1', actor_user_id: 'owner-controlled-test', staff_role: 'PLATFORM_OWNER', action: 'staff.session.test-access', outcome: 'SUCCESS', correlation_id: 'owner-controlled-test', created_at: iso(-10_000) }] });
  }
  if (method === 'GET' && path === 'break-glass/active') return json([]);
  if (method === 'POST' && path === 'break-glass/activate') return json({ success: true, mode: 'BREAK_GLASS', expiresAt: iso(15 * 60 * 1000) });
  if (method === 'POST' && /^break-glass\/[^/]+\/end$/.test(path)) return json({ success: true });

  if (method === 'GET' && path === 'workspaces/support') {
    return json({ generatedAt: iso(), deals: [{ id: 'deal-canonical-test', dealNumber: 'ТП-000001', status: 'IN_EXECUTION', seller: { id: 'org-canonical-seller', name: 'Тестовый продавец' }, buyer: ORGANIZATION, nextAction: 'Проверить ЭПД', slaAt: iso(-30_000), overdue: true, blockers: [{ shipmentId: 'shipment-test', blocker: 'Отсутствует ЭПД', nextAction: 'Запросить документ' }] }], kycTasks: [] });
  }
  if (method === 'GET' && path === 'workspaces/support/cases') return json([]);
  if (method === 'POST' && path === 'workspaces/support/cases') return json({ case: { id: 'sup-controlled-test', status: 'OPEN', version: 1 }, replayed: false }, 201);
  if (method === 'GET' && path === 'workspaces/operations') {
    return json({ generatedAt: iso(), items: [{ id: 'deal-canonical-test', dealNumber: 'ТП-000001', status: 'IN_EXECUTION', seller: { name: 'Тестовый продавец' }, buyer: ORGANIZATION, nextAction: 'Проверить ЭПД', slaAt: iso(600_000), overdue: false, shipmentSummary: { total: 2, active: 1, blocked: 1 }, documentSummary: { total: 5, pending: 1, releaseBlocking: 1 }, payment: { status: 'RESERVED' }, openDisputes: 0 }] });
  }
  if (method === 'GET' && path === 'workspaces/finance') {
    return json({ generatedAt: iso(), payments: [{ id: 'pay-test', dealId: 'deal-canonical-test', status: 'RESERVED', amountKopecks: 240000000, callbackState: 'NONE', updatedAt: iso(), deal: { dealNumber: 'ТП-000001' } }], bankOperations: [] });
  }
  if (method === 'GET' && path === 'workspaces/diagnostics') {
    return json({ generatedAt: iso(), integrations: [{ id: 'integration-test', adapterName: 'bank-sandbox', eventType: 'CALLBACK', status: 'PENDING', createdAt: iso() }], outbox: [{ id: 'outbox-test', type: 'deal.updated', dealId: 'deal-canonical-test', status: 'CONFIRMED', retryCount: 0, maxRetries: 5, correlationId: 'controlled-test', createdAt: iso() }], runtimeAttempts: [] });
  }
  if (method === 'GET' && path === 'workspaces/assignments') return json([{ id: 'sta-owner-controlled-test', email: 'maxim.owner@test.local', full_name: 'Максим — владелец платформы', role: 'PLATFORM_OWNER', status: 'ACTIVE', valid_from: iso(-86_400_000), valid_until: null, reason: 'Controlled test access' }]);
  if (method === 'GET' && path === 'workspaces/critical-actions') return json([]);
  if (method === 'GET' && path === 'workspaces/critical-actions/mine') return json([]);
  if (method === 'GET' && path === 'workspaces/break-glass') return json([]);
  if (method === 'GET' && /^workspaces\/audit\/actors\/[^/]+\/verify$/.test(path)) return json({ valid: true, checked: 1 });

  if (method === 'POST' && path.startsWith('workspaces/')) return json({ success: true });
  return json({ code: 'NOT_FOUND', path }, 404);
}

export function GET(request: NextRequest, context: { params: { path?: string[] } }) {
  return handle(request, context);
}

export function POST(request: NextRequest, context: { params: { path?: string[] } }) {
  return handle(request, context);
}
