import http from 'node:http';
import https from 'node:https';
import fs from 'node:fs';

const port = Number(process.env.STAFF_MOCK_PORT || 4010);
const grants = new Map();

function send(response, status, payload, correlationId = 'staff-evidence-correlation') {
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Correlation-Id': correlationId,
  });
  response.end(JSON.stringify(payload));
}

async function jsonBody(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  if (chunks.length === 0) return {};
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

function authorized(request) {
  return request.headers.authorization?.startsWith('Bearer ') === true;
}

function staffSession(request) {
  return String(request.headers['x-staff-access-session'] || '');
}

const organization = {
  id: 'org-evidence-buyer',
  tenant_id: 'tenant-evidence',
  name: 'ООО «Проверка контура»',
  inn: '7700000001',
  status: 'ACTIVE',
  kyc_status: 'VERIFIED',
  aml_status: 'CLEAR',
  updated_at: new Date().toISOString(),
};

const handler = async (request, response) => {
  try {
    const url = new URL(request.url || '/', `https://127.0.0.1:${port}`);
    if (!authorized(request)) return send(response, 401, { code: 'AUTH_REQUIRED' });

    if (request.method === 'GET' && url.pathname === '/staff/assignments/me') {
      return send(response, 200, [{
        id: 'sta-owner-evidence',
        user_id: 'owner-evidence',
        role: 'PLATFORM_OWNER',
        status: 'ACTIVE',
        valid_from: new Date(Date.now() - 60_000).toISOString(),
        valid_until: null,
      }]);
    }

    if (request.method === 'POST' && url.pathname === '/staff/access/requests') {
      const body = await jsonBody(request);
      const id = `grant-${String(body.accessMode || 'CONTROL_PLANE').toLowerCase()}`;
      grants.set(id, String(body.accessMode || 'CONTROL_PLANE'));
      return send(response, 201, { requestId: `request-${id}`, status: 'GRANTED', grantId: id });
    }

    const activation = url.pathname.match(/^\/staff\/access\/grants\/([^/]+)\/activate$/);
    if (request.method === 'POST' && activation) {
      const grantId = decodeURIComponent(activation[1]);
      const accessMode = grants.get(grantId) || 'CONTROL_PLANE';
      return send(response, 200, {
        accessSessionId: `session-${accessMode.toLowerCase()}`,
        accessMode,
        accessToken: accessMode === 'VIEW_AS' ? 'delegated-evidence-token' : 'control-evidence-token',
        expiresAt: new Date(Date.now() + 15 * 60_000).toISOString(),
      });
    }

    if (url.pathname.startsWith('/staff/organizations') && url.pathname.includes('/cabinet/')) {
      if (staffSession(request) !== 'delegated-evidence-token') return send(response, 401, { code: 'DELEGATED_SESSION_REQUIRED' });
      const match = url.pathname.match(/^\/staff\/organizations\/([^/]+)\/cabinet\/([^/]+)$/);
      if (!match) return send(response, 404, { code: 'NOT_FOUND' });
      return send(response, 200, {
        mode: 'READ_ONLY_VIEW_AS',
        actorUserId: 'owner-evidence',
        actorStaffRole: 'PLATFORM_OWNER',
        accessSessionId: 'session-view_as',
        effectiveTenantId: organization.tenant_id,
        effectiveOrganizationId: decodeURIComponent(match[1]),
        effectiveRole: decodeURIComponent(match[2]),
        expiresAt: new Date(Date.now() + 15 * 60_000).toISOString(),
        deals: [{
          id: 'DEAL-EVIDENCE-001',
          deal_number: 'TP-2026-001',
          status: 'IN_EXECUTION',
          next_action: 'Проверить комплект документов',
          sla_at: new Date(Date.now() + 60 * 60_000).toISOString(),
          updated_at: new Date().toISOString(),
        }],
      });
    }

    const controlRequired = [
      '/staff/organizations',
      '/staff/access/requests/review',
      '/staff/access/sessions/review',
      '/staff/audit/events',
      '/staff/break-glass/active',
      '/staff/assignments',
    ];
    if (controlRequired.some((item) => url.pathname === item) && staffSession(request) !== 'control-evidence-token') {
      return send(response, 401, { code: 'CONTROL_SESSION_REQUIRED' });
    }

    if (request.method === 'GET' && url.pathname === '/staff/organizations') return send(response, 200, [organization]);

    const users = url.pathname.match(/^\/staff\/organizations\/([^/]+)\/users$/);
    if (request.method === 'GET' && users) {
      if (staffSession(request) !== 'control-evidence-token') return send(response, 401, { code: 'CONTROL_SESSION_REQUIRED' });
      return send(response, 200, [{
        membership_id: 'membership-evidence',
        user_id: 'buyer-evidence',
        email: 'buyer@example.test',
        full_name: 'Ответственный покупателя',
        user_status: 'ACTIVE',
        mfa_enabled: true,
        role: 'BUYER',
        is_default: true,
        joined_at: new Date().toISOString(),
      }]);
    }

    if (request.method === 'GET' && url.pathname === '/staff/access/requests/review') return send(response, 200, []);
    if (request.method === 'GET' && url.pathname === '/staff/access/sessions/review') return send(response, 200, [{
      id: 'session-control_plane',
      actor_user_id: 'owner-evidence',
      staff_role: 'PLATFORM_OWNER',
      access_mode: 'CONTROL_PLANE',
      effective_tenant_id: null,
      effective_organization_id: null,
      effective_user_id: null,
      effective_role: null,
      reason: 'Evidence control session',
      ticket_id: 'OWN-EVIDENCE',
      started_at: new Date(Date.now() - 60_000).toISOString(),
      expires_at: new Date(Date.now() + 14 * 60_000).toISOString(),
    }]);
    if (request.method === 'GET' && url.pathname === '/staff/audit/events') return send(response, 200, { items: [{
      id: 'sae-evidence',
      actor_user_id: 'owner-evidence',
      staff_role: 'PLATFORM_OWNER',
      action: 'staff.session.activate',
      outcome: 'SUCCESS',
      reason: 'Evidence control session',
      ticket_id: 'OWN-EVIDENCE',
      correlation_id: 'staff-evidence-correlation',
      created_at: new Date().toISOString(),
    }], nextCursor: null });
    if (request.method === 'GET' && url.pathname === '/staff/break-glass/active') return send(response, 200, []);
    if (request.method === 'GET' && url.pathname === '/staff/assignments') return send(response, 200, [{
      id: 'sta-owner-evidence',
      user_id: 'owner-evidence',
      email: 'owner@example.test',
      full_name: 'Владелец платформы',
      role: 'PLATFORM_OWNER',
      status: 'ACTIVE',
      valid_until: null,
    }]);

    if (request.method === 'POST' && url.pathname === '/staff/assignments') return send(response, 201, { assignmentId: 'sta-created-evidence', status: 'ELIGIBLE' });
    if (request.method === 'POST' && /\/staff\/access\/requests\/[^/]+\/decision$/.test(url.pathname)) return send(response, 200, { status: 'GRANTED', grantId: 'grant-approved-evidence' });
    if (request.method === 'POST' && /\/staff\/access\/sessions\/[^/]+\/(end|revoke)$/.test(url.pathname)) return send(response, 200, { success: true });
    if (request.method === 'POST' && url.pathname === '/staff/break-glass/activate') return send(response, 201, { activationId: 'bga-evidence', expiresAt: new Date(Date.now() + 15 * 60_000).toISOString() });
    if (request.method === 'POST' && /\/staff\/break-glass\/[^/]+\/end$/.test(url.pathname)) return send(response, 200, { success: true });
    if (request.method === 'GET' && /\/staff\/audit\/actors\/[^/]+\/verify$/.test(url.pathname)) return send(response, 200, { valid: true, checked: 1 });

    return send(response, 404, { code: 'NOT_FOUND', path: url.pathname });
  } catch (error) {
    return send(response, 500, { code: 'MOCK_FAILURE', message: String(error) });
  }
};

const tlsKey = process.env.STAFF_MOCK_TLS_KEY;
const tlsCert = process.env.STAFF_MOCK_TLS_CERT;
const server = tlsKey && tlsCert
  ? https.createServer({ key: fs.readFileSync(tlsKey), cert: fs.readFileSync(tlsCert) }, handler)
  : http.createServer(handler);

server.listen(port, '127.0.0.1', () => {
  console.log(`staff mock listening on ${tlsKey && tlsCert ? 'https' : 'http'}://127.0.0.1:${port}`);
});

for (const signal of ['SIGTERM', 'SIGINT']) {
  process.on(signal, () => server.close(() => process.exit(0)));
}
