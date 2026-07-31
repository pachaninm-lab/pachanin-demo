from pathlib import Path
import json

controller_path = Path('apps/api/src/modules/admin/admin.controller.ts')
controller = controller_path.read_text()
assert controller.count('  Patch,\n') == 1
assert controller.count("import { AuthService } from '../auth/auth.service';\n") == 1
controller = controller.replace('  Patch,\n', '', 1)
controller = controller.replace("import { AuthService } from '../auth/auth.service';\n", '', 1)
old_constructor = '''  constructor(
    private readonly auth: AuthService,
    private readonly outbox: OutboxService,
  ) {}
'''
new_constructor = '''  constructor(private readonly outbox: OutboxService) {}
'''
assert controller.count(old_constructor) == 1, 'admin constructor anchor mismatch'
controller = controller.replace(old_constructor, new_constructor, 1)

users_start = controller.index("  @Get('users')\n")
system_start = controller.index("  @Get('system')\n", users_start)
controller = controller[:users_start] + controller[system_start:]

block_start = controller.index("  @Patch('users/:id/block')\n")
health_start = controller.index("  @Get('health')\n", block_start)
controller = controller[:block_start] + controller[health_start:]

for forbidden in [
    "@Get('users')",
    "@Patch('users/:id/role')",
    "@Patch('users/:id/org')",
    "@Patch('users/:id/block')",
    "@Post('users/:id/force-logout')",
    "@Get('users/:id/mfa-status')",
    'this.auth.',
    'AuthService',
]:
    assert forbidden not in controller, f'unsafe admin user boundary remains: {forbidden}'
controller_path.write_text(controller)

spec_path = Path('apps/api/src/modules/admin/admin.controller.spec.ts')
spec = spec_path.read_text()
assert spec.count("import { AuthService } from '../auth/auth.service';\n") == 1
spec = spec.replace("import { AuthService } from '../auth/auth.service';\n", '', 1)
make_auth_start = spec.index('function makeAuthService():')
make_outbox_start = spec.index('function makeOutboxService():', make_auth_start)
spec = spec[:make_auth_start] + spec[make_outbox_start:]
spec = spec.replace('  let auth: jest.Mocked<AuthService>;\n', '', 1)
old_before = '''  beforeEach(() => {
    auth = makeAuthService();
    outbox = makeOutboxService();
    ctrl = new AdminController(auth, outbox);
  });

'''
new_before = '''  beforeEach(() => {
    outbox = makeOutboxService();
    ctrl = new AdminController(outbox);
  });

'''
assert spec.count(old_before) == 1, 'admin test setup anchor mismatch'
spec = spec.replace(old_before, new_before, 1)
user_tests_start = spec.index("  it('returns users without password hashes'")
outbox_test_start = spec.index("  it('returns durable PostgreSQL queue statistics", user_tests_start)
replacement_test = '''  it('does not expose synthetic user list or direct role and organization mutation', () => {
    expect((ctrl as any).listUsers).toBeUndefined();
    expect((ctrl as any).updateRole).toBeUndefined();
    expect((ctrl as any).updateOrg).toBeUndefined();
    expect((ctrl as any).blockUser).toBeUndefined();
    expect((ctrl as any).forceLogout).toBeUndefined();
    expect((ctrl as any).mfaStatus).toBeUndefined();
  });

'''
spec = spec[:user_tests_start] + replacement_test + spec[outbox_test_start:]
for forbidden in ['makeAuthService', 'updateUserRole', 'updateUserOrg', 'Demo Admin', 'Demo Farmer']:
    assert forbidden not in spec, f'synthetic admin test remains: {forbidden}'
spec_path.write_text(spec)

scope_path = Path('docs/platform-v7/autopilot/scopes/p0-first-customer-access-3563.json')
scope = json.loads(scope_path.read_text())
for path in [
    'apps/api/src/modules/admin/admin.controller.ts',
    'apps/api/src/modules/admin/admin.controller.spec.ts',
]:
    if path not in scope['allowedPaths']:
        scope['allowedPaths'].append(path)
scope['allowedPaths'] = sorted(scope['allowedPaths'])
scope['acceptance']['changedPathCount'] = len(scope['allowedPaths'])
assert scope['acceptance']['changedPathCount'] == 42
repair = scope.setdefault('repairEvidence', {})
repair['adminSyntheticBoundarySourceHead'] = '98c0b3826b4929587a5ea9ffc23b7fa730427e95'
repair['adminSyntheticBoundaryHead'] = 'PENDING_EXACT_HEAD'
defect = 'admin user endpoints depended on synthetic cache and bypassed controlled admission authority'
if defect not in repair.setdefault('confirmedDefects', []):
    repair['confirmedDefects'].append(defect)
fix = 'remove synthetic and no-op admin user endpoints until governed operational admission is implemented'
if fix not in repair.setdefault('repair', []):
    repair['repair'].append(fix)
scope_path.write_text(json.dumps(scope, ensure_ascii=False, indent=2) + '\n')
