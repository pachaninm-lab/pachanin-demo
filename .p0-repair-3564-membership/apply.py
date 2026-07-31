from pathlib import Path
import json

repository_path = Path('apps/api/src/modules/auth/persistent-auth.repository.ts')
repository = repository_path.read_text()
identity_anchor = '''  membership_id: string;
  role: string;
  organization_id: string;
'''
identity_replacement = '''  membership_id: string;
  role: string;
  membership_status: string;
  organization_id: string;
'''
assert repository.count(identity_anchor) == 1, 'IdentityRow membership anchor mismatch'
repository = repository.replace(identity_anchor, identity_replacement, 1)
select_anchor = '''        uo.id AS membership_id,
        uo.role,
        o.id AS organization_id,
'''
select_replacement = '''        uo.id AS membership_id,
        uo.role,
        uo.status AS membership_status,
        o.id AS organization_id,
'''
assert repository.count(select_anchor) == 5, f'unexpected identity projection count: {repository.count(select_anchor)}'
repository = repository.replace(select_anchor, select_replacement)
repository_path.write_text(repository)

auth_path = Path('apps/api/src/modules/auth/auth.service.ts')
auth = auth_path.read_text()
identity_guard = '''    if (identity.user_status !== 'ACTIVE') reason = 'USER_NOT_ACTIVE';
    else if (identity.organization_status !== 'VERIFIED') reason = 'ORGANIZATION_NOT_VERIFIED';
    else if (!KNOWN_ROLES.has(identity.role) || identity.role === Role.BANK_CALLBACK) reason = 'MEMBERSHIP_ROLE_INVALID';
'''
identity_guard_replacement = '''    if (identity.user_status !== 'ACTIVE') reason = 'USER_NOT_ACTIVE';
    else if (identity.membership_status !== 'ACTIVE') reason = 'MEMBERSHIP_NOT_ACTIVE';
    else if (identity.organization_status !== 'VERIFIED') reason = 'ORGANIZATION_NOT_VERIFIED';
    else if (!KNOWN_ROLES.has(identity.role) || identity.role === Role.BANK_CALLBACK) reason = 'MEMBERSHIP_ROLE_INVALID';
'''
assert auth.count(identity_guard) == 1, 'login identity guard anchor mismatch'
auth = auth.replace(identity_guard, identity_guard_replacement, 1)
session_guard = '''    if (context.user_status !== 'ACTIVE') return 'USER_NOT_ACTIVE';
    if (context.organization_status !== 'VERIFIED') return 'ORGANIZATION_NOT_VERIFIED';
    if (context.session_credential_version !== context.current_credential_version) return 'CREDENTIAL_VERSION_CHANGED';
'''
session_guard_replacement = '''    if (context.user_status !== 'ACTIVE') return 'USER_NOT_ACTIVE';
    if (context.membership_status !== 'ACTIVE') return 'MEMBERSHIP_NOT_ACTIVE';
    if (context.organization_status !== 'VERIFIED') return 'ORGANIZATION_NOT_VERIFIED';
    if (context.session_credential_version !== context.current_credential_version) return 'CREDENTIAL_VERSION_CHANGED';
'''
assert auth.count(session_guard) == 1, 'session guard anchor mismatch'
auth = auth.replace(session_guard, session_guard_replacement, 1)
auth_path.write_text(auth)

test_path = Path('apps/api/test/auth/persistent-auth.e2e-spec.ts')
test = test_path.read_text()
seed_anchor = '''      update: { role, isDefault: true },
      create: { userId, organizationId, role, isDefault: true },
'''
seed_replacement = '''      update: { role, status: 'ACTIVE', isDefault: true },
      create: { userId, organizationId, role, status: 'ACTIVE', isDefault: true },
'''
assert test.count(seed_anchor) == 1, 'membership seed anchor mismatch'
test = test.replace(seed_anchor, seed_replacement, 1)
insert_anchor = '''  it('ignores client orgId during self-registration and creates a pending organization', async () => {
'''
new_test = '''  it('denies non-active membership at login, refresh and access resolution', async () => {
    const pendingIdentity = await seedIdentity('pending-membership', Role.BUYER);
    await first.prisma.userOrg.update({
      where: { id: pendingIdentity.membership.id },
      data: { status: 'PENDING' },
    });
    await expect(
      first.auth.login({ email: pendingIdentity.email, password: PASSWORD }),
    ).rejects.toThrow(/MEMBERSHIP_NOT_ACTIVE/);
    const [pendingSessionCount] = await first.prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*)::bigint AS count
      FROM auth.sessions
      WHERE user_id = ${pendingIdentity.userId}
    `;
    expect(Number(pendingSessionCount.count)).toBe(0);

    const refreshIdentity = await seedIdentity('suspended-membership-refresh', Role.FARMER);
    const refreshLogin = await first.auth.login({
      email: refreshIdentity.email,
      password: PASSWORD,
    }) as any;
    await first.prisma.userOrg.update({
      where: { id: refreshIdentity.membership.id },
      data: { status: 'SUSPENDED' },
    });
    await expect(
      second.auth.refresh({ refreshToken: refreshLogin.refreshToken }),
    ).rejects.toThrow(/invalid|expired/i);
    const refreshSessions = await first.prisma.$queryRaw<Array<{
      status: string;
      revocation_reason: string | null;
    }>>`
      SELECT status, revocation_reason
      FROM auth.sessions
      WHERE user_id = ${refreshIdentity.userId}
    `;
    expect(refreshSessions).toEqual([
      expect.objectContaining({ status: 'REVOKED', revocation_reason: 'MEMBERSHIP_NOT_ACTIVE' }),
    ]);

    const accessIdentity = await seedIdentity('revoked-membership-access', Role.LOGISTICIAN);
    const accessLogin = await first.auth.login({
      email: accessIdentity.email,
      password: PASSWORD,
    }) as any;
    await first.prisma.userOrg.update({
      where: { id: accessIdentity.membership.id },
      data: { status: 'REVOKED', revokedAt: new Date() },
    });
    await expect(second.auth.verifyAccessToken(accessLogin.accessToken)).rejects.toThrow(/not active/i);
    const accessSessions = await first.prisma.$queryRaw<Array<{
      status: string;
      revocation_reason: string | null;
    }>>`
      SELECT status, revocation_reason
      FROM auth.sessions
      WHERE user_id = ${accessIdentity.userId}
    `;
    expect(accessSessions).toEqual([
      expect.objectContaining({ status: 'REVOKED', revocation_reason: 'MEMBERSHIP_NOT_ACTIVE' }),
    ]);
  });

'''
assert test.count(insert_anchor) == 1, 'membership E2E insertion anchor mismatch'
test = test.replace(insert_anchor, new_test + insert_anchor, 1)
test_path.write_text(test)

scope_path = Path('docs/platform-v7/autopilot/scopes/p0-first-customer-access-3563.json')
scope = json.loads(scope_path.read_text())
new_paths = [
    'apps/api/src/modules/auth/auth.service.ts',
    'apps/api/src/modules/auth/persistent-auth.repository.ts',
    'apps/api/test/auth/persistent-auth.e2e-spec.ts',
]
for path in new_paths:
    if path not in scope['allowedPaths']:
        scope['allowedPaths'].append(path)
scope['allowedPaths'] = sorted(scope['allowedPaths'])
scope['acceptance']['changedPathCount'] = len(scope['allowedPaths'])
assert scope['acceptance']['changedPathCount'] == 38
repair_evidence = scope.setdefault('repairEvidence', {})
repair_evidence['membershipGuardSourceHead'] = '34046f8e87568ff76a9c6b09366838c898b98e95'
repair_evidence['membershipGuardHead'] = 'PENDING_EXACT_HEAD'
confirmed = repair_evidence.setdefault('confirmedDefects', [])
membership_defect = 'non-active membership remained usable during login, refresh and access-token session resolution'
if membership_defect not in confirmed:
    confirmed.append(membership_defect)
repairs = repair_evidence.setdefault('repair', [])
membership_repair = 'require ACTIVE membership in every identity and session authority projection'
if membership_repair not in repairs:
    repairs.append(membership_repair)
scope_path.write_text(json.dumps(scope, ensure_ascii=False, indent=2) + '\n')
