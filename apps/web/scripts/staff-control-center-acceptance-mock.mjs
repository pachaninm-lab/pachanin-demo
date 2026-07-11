import http from 'node:http';

const port = Number(process.env.STAFF_MOCK_PORT || 4010);
const iso = (offset = 0) => new Date(Date.now() + offset).toISOString();
let activeMode = null;
let activeExpiresAt = null;
let accessToken = null;
let requests = [];
const permissions = [
  'organization:list','user:list','staff-assignment:read','staff-assignment:write',
  'staff-request:read','staff-request:approve','staff-session:read','staff-session:revoke',
  'audit:read','support-case:read','support-case:update','user:session:revoke',
  'user:access-recovery:initiate','deal:list','deal:read','deal:blocker:read',
  'payment:metadata:read','payment:reconciliation:read','diagnostic:read','deployment:read',
  'feature-flag:read','critical-action:approve','break-glass:activate',
];
const organization = { id: 'org-buyer', tenantId: 'tenant-evidence', tenant_id: 'tenant-evidence', name: 'ООО «Контур Приёмки»', inn: '7700000001', status: 'ACTIVE', kycStatus: 'VERIFIED', kyc_status: 'VERIFIED', amlStatus: 'CLEAR', aml_status: 'CLEAR', userCount: 1, dealCount: 1 };
const assignment = { id: 'sta-owner', user_id: 'owner-evidence', email: 'owner@example.test', full_name: 'Platform Owner', role: 'PLATFORM_OWNER', status: 'ACTIVE', valid_from: iso(-60_000), valid_until: null, reason: 'Acceptance owner' };
const supportCase = { id: 'sup-1', tenant_id: 'tenant-evidence', organization_id: organization.id, organization_name: organization.name, organization_inn: organization.inn, user_id: 'buyer-1', user_email: 'buyer@example.test', user_full_name: 'Покупатель', deal_id: 'deal-evidence', deal_number: 'TP-2026-001', subject: 'Отсутствует ЭПД', description: 'Необходимо получить электронный перевозочный документ.', priority: 'HIGH', status: 'OPEN', source: 'STAFF', created_by_user_id: 'owner-evidence', assigned_staff_user_id: null, idempotency_key: 'SUP-EVIDENCE-1', version: 1, created_at: iso(-120_000), updated_at: iso(-60_000), resolved_at: null, closed_at: null };

function send(res, status, payload) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-correlation-id': 'staff-final-correlation' });
  res.end(JSON.stringify(payload));
}
async function readBody(req) { const chunks=[]; for await (const chunk of req) chunks.push(chunk); return chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {}; }
function authorized(req) { return String(req.headers.authorization || '').startsWith('Bearer '); }
function staffHeader(req) { return String(req.headers['x-staff-access-session'] || ''); }
function staffSession() {
  if (!activeMode || !accessToken || !activeExpiresAt) return null;
  return { id: `sas-${activeMode.toLowerCase()}`, status: 'ACTIVE', staff_role: 'PLATFORM_OWNER', access_mode: activeMode, permissions: activeMode === 'VIEW_AS' ? ['cabinet:view-as','deal:read','document:metadata:read'] : permissions, effective_tenant_id: activeMode === 'VIEW_AS' ? organization.tenantId : null, effective_organization_id: activeMode === 'VIEW_AS' ? organization.id : null, effective_user_id: null, effective_role: activeMode === 'VIEW_AS' ? 'BUYER' : null, target_deal_id: null, reason: 'Acceptance protected session', ticket_id: 'OWN-2353', expires_at: activeExpiresAt, created_at: iso(-30_000) };
}
function clearSession() { activeMode = null; activeExpiresAt = null; accessToken = null; }

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url || '/', `http://127.0.0.1:${port}`);
    if (!authorized(req)) return send(res, 401, { code: 'AUTH_REQUIRED' });
    if (req.method === 'GET' && url.pathname === '/auth/me') return send(res, 200, { id: 'owner-evidence', email: 'owner@example.test', fullName: 'Platform Owner', role: 'ADMIN', organizationId: 'platform-org', tenantId: 'platform-tenant' });
    if (req.method === 'GET' && url.pathname === '/staff/assignments/me') return send(res, 200, [assignment]);
    if (req.method === 'GET' && url.pathname === '/staff/access/requests') return send(res, 200, requests);
    if (req.method === 'POST' && url.pathname === '/staff/access/requests') {
      clearSession();
      const input = await readBody(req); const id = `sar-${requests.length + 1}`; const grantId = `sag-${requests.length + 1}`;
      const expiresAt = iso(3_600_000);
      const row = { id, requester_user_id: 'owner-evidence', assignment_id: input.assignmentId, access_mode: input.accessMode, permissions: input.permissions, requested_permissions: input.permissions, reason: input.reason, ticket_id: input.ticketId, status: 'GRANTED', grant_id: grantId, grant_status: 'ACTIVE', target_organization_id: input.targetOrganizationId || null, target_role: input.targetRole || null, requested_at: iso(), expires_at: expiresAt, grant_expires_at: expiresAt };
      requests = [row, ...requests]; return send(res, 201, { status: 'GRANTED', grantId, requestId: id });
    }
    if (req.method === 'POST' && /^\/staff\/access\/grants\/[^/]+\/activate$/.test(url.pathname)) {
      const grantId = decodeURIComponent(url.pathname.split('/')[4]); const request = requests.find((item) => item.grant_id === grantId);
      activeMode = request?.access_mode || 'CONTROL_PLANE';
      activeExpiresAt = request?.grant_expires_at || iso(3_600_000);
      accessToken = activeMode === 'VIEW_AS' ? 'opaque-view-token' : 'opaque-control-token';
      return send(res, 200, { accessSessionId: `sas-${activeMode.toLowerCase()}`, accessMode: activeMode, accessToken, expiresAt: activeExpiresAt, staffRole: 'PLATFORM_OWNER', permissions: activeMode === 'VIEW_AS' ? ['cabinet:view-as','deal:read','document:metadata:read'] : permissions, effectiveTenantId: activeMode === 'VIEW_AS' ? organization.tenantId : null, effectiveOrganizationId: activeMode === 'VIEW_AS' ? organization.id : null, effectiveRole: activeMode === 'VIEW_AS' ? 'BUYER' : null, ticketId: request?.ticket_id || 'OWN-2353', reason: request?.reason || 'Acceptance session' });
    }
    if (req.method === 'GET' && url.pathname === '/staff/access/sessions') return send(res, 200, staffSession() ? [staffSession()] : []);
    if (req.method === 'POST' && /^\/staff\/access\/sessions\/[^/]+\/(?:end|revoke)$/.test(url.pathname)) { clearSession(); return send(res, 200, { success: true }); }
    if (!accessToken || staffHeader(req) !== accessToken) return send(res, 401, { code: 'STAFF_SESSION_REQUIRED' });

    if (req.method === 'GET' && url.pathname === '/staff/organizations') return send(res, 200, [organization]);
    if (req.method === 'GET' && url.pathname === '/staff/access/requests/review') return send(res, 200, requests);
    if (req.method === 'GET' && url.pathname === '/staff/access/sessions/review') return send(res, 200, staffSession() ? [staffSession()] : []);
    if (req.method === 'GET' && url.pathname === '/staff/audit/events') return send(res, 200, { items: [{ id: 'sae-1', actor_user_id: 'owner-evidence', staff_role: 'PLATFORM_OWNER', action: 'staff.session.activate', outcome: 'SUCCESS', correlation_id: 'staff-final-correlation', created_at: iso(-10_000) }] });
    if (req.method === 'GET' && /^\/staff\/organizations\/[^/]+\/cabinet\/[^/]+$/.test(url.pathname)) return send(res, 200, { mode: 'READ_ONLY_VIEW_AS', actorUserId: 'owner-evidence', actorStaffRole: 'PLATFORM_OWNER', accessSessionId: 'sas-view_as', effectiveTenantId: organization.tenantId, effectiveOrganizationId: organization.id, effectiveRole: 'BUYER', expiresAt: activeExpiresAt, deals: [{ id: 'deal-evidence', dealNumber: 'TP-2026-001', deal_number: 'TP-2026-001', status: 'IN_EXECUTION', nextAction: 'CHECK_DOCUMENTS', next_action: 'CHECK_DOCUMENTS', updatedAt: iso(-5_000), updated_at: iso(-5_000) }] });
    if (req.method === 'GET' && /^\/staff\/organizations\/[^/]+\/users$/.test(url.pathname)) return send(res, 200, [{ membership_id: 'm-1', user_id: 'buyer-1', email: 'buyer@example.test', full_name: 'Покупатель', user_status: 'ACTIVE', mfa_enabled: true, role: 'BUYER', is_default: true, joined_at: iso(-86_400_000) }]);

    if (req.method === 'GET' && url.pathname === '/staff/workspaces/support') return send(res, 200, { generatedAt: iso(), deals: [{ id: 'deal-evidence', dealNumber: 'TP-2026-001', status: 'IN_EXECUTION', seller: { id: 'org-seller', name: 'ООО «Продавец»' }, buyer: organization, nextAction: 'Проверить ЭПД', slaAt: iso(-30_000), overdue: true, blockers: [{ shipmentId: 'sh-1', blocker: 'Отсутствует ЭПД', nextAction: 'Запросить документ' }] }], kycTasks: [{ id: 'kyc-1', organizationId: organization.id, type: 'AML_REVIEW', status: 'PENDING', updatedAt: iso(-60_000), organization }] });
    if (req.method === 'GET' && url.pathname === '/staff/workspaces/support/cases') return send(res, 200, [supportCase]);
    if (req.method === 'POST' && url.pathname === '/staff/workspaces/support/cases') return send(res, 201, { case: supportCase, replayed: false });
    if (req.method === 'POST' && /^\/staff\/workspaces\/support\/cases\/[^/]+\/transition$/.test(url.pathname)) { const input = await readBody(req); supportCase.status = input.status; supportCase.version += 1; supportCase.updated_at = iso(); return send(res, 200, supportCase); }
    if (req.method === 'POST' && /^\/staff\/workspaces\/support\/users\/[^/]+\/revoke-sessions$/.test(url.pathname)) return send(res, 200, { success: true, revokedSessions: 1, revokedRefreshTokens: 1 });
    if (req.method === 'POST' && /^\/staff\/workspaces\/support\/users\/[^/]+\/recovery$/.test(url.pathname)) return send(res, 201, { requestId: 'srr-1', status: 'PENDING_DELIVERY', expiresAt: iso(3_600_000) });
    if (req.method === 'GET' && url.pathname === '/staff/workspaces/operations') return send(res, 200, { generatedAt: iso(), items: [{ id: 'deal-evidence', dealNumber: 'TP-2026-001', status: 'IN_EXECUTION', seller: { name: 'ООО «Продавец»' }, buyer: organization, nextAction: 'Проверить ЭПД', slaAt: iso(600_000), overdue: false, shipmentSummary: { total: 2, active: 1, blocked: 1 }, documentSummary: { total: 5, pending: 1, releaseBlocking: 1 }, payment: { status: 'RESERVED' }, openDisputes: 0 }] });
    if (req.method === 'GET' && url.pathname === '/staff/workspaces/finance') return send(res, 200, { generatedAt: iso(), payments: [{ id: 'pay-1', dealId: 'deal-evidence', status: 'RESERVED', amountKopecks: 12500000, callbackState: 'CONFIRMED', updatedAt: iso(), deal: { dealNumber: 'TP-2026-001' } }], bankOperations: [{ id: 'bank-1', dealId: 'deal-evidence', type: 'RESERVE', status: 'CONFIRMED', amountKopecks: '12500000', updatedAt: iso(), deal: { dealNumber: 'TP-2026-001' } }] });
    if (req.method === 'GET' && url.pathname === '/staff/workspaces/diagnostics') return send(res, 200, { generatedAt: iso(), integrations: [{ id: 'ie-1', adapterName: 'bank-sandbox', eventType: 'CALLBACK', status: 'CONFIRMED', createdAt: iso() }], outbox: [{ id: 'ob-1', type: 'deal.updated', dealId: 'deal-evidence', status: 'CONFIRMED', retryCount: 0, maxRetries: 5, correlationId: 'corr-1', createdAt: iso() }], runtimeAttempts: [{ id: 'rt-1', transactionId: 'tx-1', stage: 'COMMIT', outcome: 'SUCCESS', correlationId: 'corr-1', startedAt: iso() }] });
    if (req.method === 'GET' && url.pathname === '/staff/workspaces/assignments') return send(res, 200, [assignment]);
    if (req.method === 'GET' && url.pathname === '/staff/workspaces/critical-actions') return send(res, 200, [{ id: 'scar-1', requester_user_id: 'ops-1', action: 'deal:operation:retry', resource_type: 'deal', resource_id: 'deal-evidence', required_approvals: 2, approvals: 1, status: 'PENDING', expires_at: iso(600_000), created_at: iso(-10_000) }]);
    if (req.method === 'GET' && url.pathname === '/staff/workspaces/break-glass') return send(res, 200, []);
    if (req.method === 'GET' && /^\/staff\/workspaces\/audit\/actors\/[^/]+\/verify$/.test(url.pathname)) return send(res, 200, { valid: true, checked: 12 });
    return send(res, 404, { code: 'NOT_FOUND', path: url.pathname });
  } catch {
    return send(res, 500, { code: 'MOCK_FAILURE', message: 'Deterministic acceptance mock failed' });
  }
});
server.listen(port, '127.0.0.1', () => console.log(`staff final acceptance mock on ${port}`));
for (const signal of ['SIGTERM','SIGINT']) process.on(signal, () => server.close(() => process.exit(0)));
