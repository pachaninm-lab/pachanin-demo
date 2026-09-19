import fs from 'node:fs';
import path from 'node:path';

const routePath = path.join(process.cwd(), 'apps/web/app/api/platform-v7/cabinet-session/route.ts');
const routeSource = fs.readFileSync(routePath, 'utf8');

describe('platform-v7 cabinet session route hardening', () => {
  it('does not trust body.role as an unconditional cabinet session source', () => {
    expect(routeSource).toContain('readVerifiedCabinetRole');
    expect(routeSource).toContain('isDirectBodyRoleCabinetSessionAllowed');
    expect(routeSource).toContain("verifiedRole ?? (directBodyRoleAllowed ? bodyRole : '')");
    expect(routeSource).toContain('verified backend role required');
    expect(routeSource).toContain('status: bodyRole ? 403 : 400');
    expect(routeSource).not.toContain("const role = typeof body?.role === 'string' ? body.role : '';");
  });

  it('keeps direct body-role issuance behind explicit controlled-pilot/demo boundaries', () => {
    expect(routeSource).toContain('PLATFORM_V7_ALLOW_BODY_ROLE_CABINET_SESSION');
    expect(routeSource).toContain('PLATFORM_V7_CONTROLLED_PILOT_BODY_ROLE_SESSION');
    expect(routeSource).toContain('PLATFORM_V7_PRODUCTION_LIKE');
    expect(routeSource).toContain('PLATFORM_V7_CABINET_SESSION_MODE');
    expect(routeSource).toContain("envValue(env, 'NODE_ENV') === 'production'");
    expect(routeSource).toContain("envValue(env, CABINET_SESSION_MODE) === 'production-like'");
  });

  it('keeps bank/arbitrator/compliance in the valid role set without allowing self-issuance by default', () => {
    expect(routeSource).toContain("'bank'");
    expect(routeSource).toContain("'arbitrator'");
    expect(routeSource).toContain("'compliance'");
    expect(routeSource).toContain('return false;');
    expect(routeSource).toContain("source: verifiedRole ? 'verified-backend-role' : 'controlled-pilot-body-role'");
  });
});
