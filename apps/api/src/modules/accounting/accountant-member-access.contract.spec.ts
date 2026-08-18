import 'reflect-metadata';
import { ROLES_KEY } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/types/request-user';
import {
  Capability,
  resolveMembershipCapabilities,
} from '../auth/membership-capability.resolver';
import { JobProfile } from '../auth/organization-job-profile';
import { AccountingController } from './accounting.controller';

function rolesFor(method: keyof AccountingController): readonly string[] {
  const handler = AccountingController.prototype[method] as unknown as object;
  return (Reflect.getMetadata(ROLES_KEY, handler) as readonly string[] | undefined) ?? [];
}

function capabilities(jobProfile: JobProfile | null) {
  return resolveMembershipCapabilities({
    role: Role.GUEST,
    jobProfile,
    membershipStatus: 'ACTIVE',
    userStatus: 'ACTIVE',
    delegations: [],
    now: new Date('2026-08-18T18:00:00Z'),
  });
}

describe('accountant organization-member HTTP and capability boundary', () => {
  it.each([
    'listTasks',
    'transition',
    'createTask',
    'projection',
    'listConnections',
    'listConnectionAttestations',
    'registerConnectionSubject',
    'attestConnection',
  ] as const)('admits GUEST only on reviewed capability-gated handler %s', (method) => {
    expect(rolesFor(method)).toContain(Role.GUEST);
  });

  it.each([
    'snapshot',
    'createVersion',
    'derive',
    'listPeriods',
    'openPeriod',
    'advancePeriod',
    'recordAdvance',
    'applyAdvanceOffset',
    'recordService',
    'decideService',
    'reverseService',
    'recordPayment',
    'allocatePayment',
    'prepareReconciliation',
    'answerReconciliation',
  ] as const)('does not widen GUEST onto non-migrated accounting handler %s', (method) => {
    expect(rolesFor(method)).not.toContain(Role.GUEST);
  });

  it('lets GUEST + ACCOUNTANT read/manage daily accounting without provider configuration authority', () => {
    const granted = capabilities(JobProfile.ACCOUNTANT);
    expect(granted.has(Capability.ACCOUNTING_DASHBOARD_READ)).toBe(true);
    expect(granted.has(Capability.ACCOUNTING_TASK_MANAGE)).toBe(true);
    expect(granted.has(Capability.INTEGRATIONS_READ)).toBe(true);
    expect(granted.has(Capability.ONE_C_SYNC)).toBe(true);
    expect(granted.has(Capability.ONE_C_MAPPING_MANAGE)).toBe(true);

    expect(granted.has(Capability.ONE_C_CONFIGURE)).toBe(false);
    expect(granted.has(Capability.EDO_CONFIGURE)).toBe(false);
    expect(granted.has(Capability.INTEGRATIONS_CONFIGURE)).toBe(false);
    expect(granted.has(Capability.ACCOUNTING_PACKAGE_CLOSE)).toBe(false);
    expect(granted.has(Capability.DOCUMENTS_SIGN)).toBe(false);
  });

  it('keeps GUEST + EXTERNAL_ACCOUNTANT out of configuration, close and reconciliation authority', () => {
    const granted = capabilities(JobProfile.EXTERNAL_ACCOUNTANT);
    expect(granted.has(Capability.ACCOUNTING_DASHBOARD_READ)).toBe(true);
    expect(granted.has(Capability.ACCOUNTING_TASK_MANAGE)).toBe(true);
    expect(granted.has(Capability.INTEGRATIONS_READ)).toBe(true);

    expect(granted.has(Capability.ONE_C_CONFIGURE)).toBe(false);
    expect(granted.has(Capability.EDO_CONFIGURE)).toBe(false);
    expect(granted.has(Capability.INTEGRATIONS_CONFIGURE)).toBe(false);
    expect(granted.has(Capability.ACCOUNTING_PACKAGE_CLOSE)).toBe(false);
    expect(granted.has(Capability.PAYMENTS_RECONCILE)).toBe(false);
    expect(granted.has(Capability.DOCUMENTS_SIGN)).toBe(false);
  });

  it('gives an unprofiled GUEST baseline identity capabilities only, not accounting or integrations', () => {
    const granted = capabilities(null);
    expect(granted.has(Capability.ORGANIZATION_READ)).toBe(true);
    expect(granted.has(Capability.ACCOUNTING_DASHBOARD_READ)).toBe(false);
    expect(granted.has(Capability.ACCOUNTING_TASK_MANAGE)).toBe(false);
    expect(granted.has(Capability.INTEGRATIONS_READ)).toBe(false);
    expect(granted.has(Capability.ONE_C_READ)).toBe(false);
  });
});
