import { RequestMethod } from '@nestjs/common';
import { GUARDS_METADATA, METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { StaffAccessController } from './staff-access.controller';
import { StaffAccessGuard } from './staff-access.guard';
import { STAFF_ACCESS_MODES_KEY } from './staff-access-modes.decorator';
import { StaffAccessMode, StaffPermission } from './staff-access.types';
import { StaffCapabilitiesController } from './staff-capabilities.controller';
import {
  STAFF_ENDPOINT_POLICIES,
  StaffAuditClass,
  StaffAuthorizationClass,
  type StaffEndpointPolicy,
  staffEndpointPolicyKey,
} from './staff-endpoint-policy';
import { STAFF_PERMISSIONS_KEY } from './staff-permissions.decorator';
import { StaffWorkspaceController } from './staff-workspace.controller';

type ControllerType = {
  name: string;
  prototype: Record<string, unknown>;
};

type ActualRoute = {
  method: 'GET' | 'POST';
  path: string;
  handlerName: string;
  guards: unknown[];
  modes: StaffAccessMode[];
  permissions: StaffPermission[];
};

const controllers: ControllerType[] = [
  StaffAccessController as unknown as ControllerType,
  StaffCapabilitiesController as unknown as ControllerType,
  StaffWorkspaceController as unknown as ControllerType,
];

function joinPath(base: string, child: string): string {
  return `/${[base, child].filter(Boolean).join('/')}`.replace(/\/+/g, '/');
}

function requestMethodName(value: RequestMethod): 'GET' | 'POST' {
  if (value === RequestMethod.GET) return 'GET';
  if (value === RequestMethod.POST) return 'POST';
  throw new Error(`Unsupported staff request method in policy gate: ${String(value)}`);
}

function metadataArray<T>(key: string, target: object): T[] {
  const value = Reflect.getMetadata(key, target);
  return Array.isArray(value) ? value : [];
}

function actualRoutes(): ActualRoute[] {
  const routes: ActualRoute[] = [];
  for (const controller of controllers) {
    const basePath = String(Reflect.getMetadata(PATH_METADATA, controller) ?? '');
    const classGuards = metadataArray<unknown>(GUARDS_METADATA, controller);
    const prototype = controller.prototype;
    for (const handlerName of Object.getOwnPropertyNames(prototype)) {
      if (handlerName === 'constructor') continue;
      const handler = prototype[handlerName];
      if (typeof handler !== 'function') continue;
      const requestMethod = Reflect.getMetadata(METHOD_METADATA, handler) as RequestMethod | undefined;
      if (requestMethod === undefined) continue;
      const childPath = String(Reflect.getMetadata(PATH_METADATA, handler) ?? '');
      routes.push({
        method: requestMethodName(requestMethod),
        path: joinPath(basePath, childPath),
        handlerName: `${controller.name}.${handlerName}`,
        guards: [...classGuards, ...metadataArray<unknown>(GUARDS_METADATA, handler)],
        modes: metadataArray<StaffAccessMode>(STAFF_ACCESS_MODES_KEY, handler),
        permissions: metadataArray<StaffPermission>(STAFF_PERMISSIONS_KEY, handler),
      });
    }
  }
  return routes.sort((a, b) => staffEndpointPolicyKey(a.method, a.path).localeCompare(staffEndpointPolicyKey(b.method, b.path)));
}

function policyCoverageErrors(routes: ActualRoute[], policies: readonly StaffEndpointPolicy[]): string[] {
  const errors: string[] = [];
  const policyCounts = new Map<string, number>();
  for (const entry of policies) {
    const key = staffEndpointPolicyKey(entry.method, entry.path);
    policyCounts.set(key, (policyCounts.get(key) ?? 0) + 1);
  }
  const routeKeys = new Set(routes.map((route) => staffEndpointPolicyKey(route.method, route.path)));
  for (const route of routes) {
    const key = staffEndpointPolicyKey(route.method, route.path);
    const count = policyCounts.get(key) ?? 0;
    if (count !== 1) errors.push(`${key}: expected exactly one policy, found ${count}`);
  }
  for (const [key, count] of policyCounts) {
    if (count !== 1) errors.push(`${key}: duplicate policy count ${count}`);
    if (!routeKeys.has(key)) errors.push(`${key}: policy has no current controller route`);
  }
  return [...new Set(errors)];
}

function sorted<T extends string>(values: readonly T[]): T[] {
  return [...values].sort();
}

function policyMetadataErrors(route: ActualRoute, entry: StaffEndpointPolicy): string[] {
  const errors: string[] = [];
  const key = staffEndpointPolicyKey(route.method, route.path);
  if (entry.requiresAccessSession) {
    if (!route.guards.includes(StaffAccessGuard)) errors.push(`${key}: StaffAccessGuard missing`);
    if (JSON.stringify(sorted(route.modes)) !== JSON.stringify(sorted(entry.modes))) errors.push(`${key}: modes mismatch`);
    if (JSON.stringify(sorted(route.permissions)) !== JSON.stringify(sorted(entry.permissions))) errors.push(`${key}: permissions mismatch`);
    if (entry.modes.length === 0) errors.push(`${key}: privileged policy has no modes`);
    if (entry.permissions.length === 0) errors.push(`${key}: privileged policy has no permissions`);
  } else {
    if (route.guards.includes(StaffAccessGuard)) errors.push(`${key}: unexpected StaffAccessGuard`);
    if (route.modes.length > 0) errors.push(`${key}: unexpected privileged modes`);
    if (route.permissions.length > 0) errors.push(`${key}: unexpected privileged permissions`);
  }
  return errors;
}

describe('Company OS staff endpoint authorization and audit policy gate', () => {
  const routes = actualRoutes();

  it('classifies every current /staff route exactly once and has no stale policies', () => {
    expect(routes.length).toBeGreaterThanOrEqual(47);
    expect(policyCoverageErrors(routes, STAFF_ENDPOINT_POLICIES)).toEqual([]);
  });

  it('binds privileged policy to actual StaffAccessGuard, mode and permission metadata', () => {
    for (const route of routes) {
      const entry = STAFF_ENDPOINT_POLICIES.find((candidate) => (
        staffEndpointPolicyKey(candidate.method, candidate.path) === staffEndpointPolicyKey(route.method, route.path)
      ));
      expect(entry).toBeDefined();
      if (!entry) continue;
      expect(policyMetadataErrors(route, entry)).toEqual([]);
    }
  });

  it('keeps self-authority discovery actor-only and self-governance explicitly bounded', () => {
    const selfReads = STAFF_ENDPOINT_POLICIES.filter((entry) => (
      entry.authorizationClass === StaffAuthorizationClass.STAFF_SELF_AUTHORITY_READ
    ));
    expect(selfReads.length).toBeGreaterThanOrEqual(4);
    for (const entry of selfReads) {
      expect(entry.method).toBe('GET');
      expect(entry.path).not.toContain(':');
      expect(entry.requiresAccessSession).toBe(false);
      expect(entry.scopeContract).toBe('ACTOR_ONLY');
      expect([StaffAuditClass.STANDARD_READ, StaffAuditClass.SENSITIVE_READ]).toContain(entry.auditClass);
    }

    const selfMutations = STAFF_ENDPOINT_POLICIES.filter((entry) => (
      entry.authorizationClass === StaffAuthorizationClass.STAFF_SELF_GOVERNANCE_MUTATION
    ));
    expect(selfMutations.map((entry) => staffEndpointPolicyKey(entry.method, entry.path)).sort()).toEqual([
      'POST /staff/access/grants/:id/activate',
      'POST /staff/access/requests',
      'POST /staff/access/sessions/:id/end',
    ]);
    expect(selfMutations.every((entry) => entry.auditClass === StaffAuditClass.MUTATION)).toBe(true);
    expect(selfMutations.every((entry) => entry.scopeContract === 'ACTOR_OWNED_RESOURCE' || entry.scopeContract === 'SERVER_VALIDATED_SCOPE')).toBe(true);
  });

  it('cannot downgrade emergency or critical operations to ordinary mutation classes', () => {
    for (const entry of STAFF_ENDPOINT_POLICIES) {
      if (
        entry.authorizationClass === StaffAuthorizationClass.STAFF_EMERGENCY_MUTATION
        || entry.authorizationClass === StaffAuthorizationClass.STAFF_CRITICAL_MUTATION
      ) {
        expect(entry.method).toBe('POST');
        expect(entry.auditClass).toBe(StaffAuditClass.CRITICAL_MUTATION);
      }
      if (entry.authorizationClass === StaffAuthorizationClass.STAFF_EMERGENCY_MUTATION) {
        expect(entry.scopeContract).toBe('EMERGENCY_SCOPE');
      }
    }
  });

  it('keeps read and mutation audit classes consistent with the HTTP method', () => {
    for (const entry of STAFF_ENDPOINT_POLICIES) {
      if (entry.method === 'GET') {
        expect([StaffAuditClass.STANDARD_READ, StaffAuditClass.SENSITIVE_READ]).toContain(entry.auditClass);
      } else {
        expect([StaffAuditClass.MUTATION, StaffAuditClass.CRITICAL_MUTATION]).toContain(entry.auditClass);
      }
    }
  });

  it('proves the registration review list and decision use active CONTROL_PLANE authority', () => {
    const list = STAFF_ENDPOINT_POLICIES.find((entry) => entry.path === '/staff/registration/applications');
    const decision = STAFF_ENDPOINT_POLICIES.find((entry) => entry.path === '/staff/registration/applications/:applicationId/decision');
    expect(list).toEqual(expect.objectContaining({
      authorizationClass: StaffAuthorizationClass.STAFF_PRIVILEGED_READ,
      requiresAccessSession: true,
      modes: [StaffAccessMode.CONTROL_PLANE],
      permissions: [StaffPermission.STAFF_REQUEST_READ],
    }));
    expect(decision).toEqual(expect.objectContaining({
      authorizationClass: StaffAuthorizationClass.STAFF_CRITICAL_MUTATION,
      requiresAccessSession: true,
      modes: [StaffAccessMode.CONTROL_PLANE],
      permissions: [StaffPermission.STAFF_REQUEST_APPROVE],
    }));
  });

  it('negative fixture: an unclassified endpoint fails coverage', () => {
    const forged = [...routes, {
      method: 'GET' as const,
      path: '/staff/forged-unclassified',
      handlerName: 'ForgedController.unclassified',
      guards: [],
      modes: [],
      permissions: [],
    }];
    expect(policyCoverageErrors(forged, STAFF_ENDPOINT_POLICIES)).toContain(
      'GET /staff/forged-unclassified: expected exactly one policy, found 0',
    );
  });

  it('negative fixture: contradictory privileged metadata fails the same policy checker', () => {
    const target = routes.find((route) => route.path === '/staff/registration/applications');
    expect(target).toBeDefined();
    if (!target) return;
    const entry = STAFF_ENDPOINT_POLICIES.find((candidate) => candidate.path === target.path);
    expect(entry).toBeDefined();
    if (!entry) return;
    const forged = { ...target, modes: [StaffAccessMode.VIEW_AS] };
    expect(policyMetadataErrors(forged, entry)).toContain('GET /staff/registration/applications: modes mismatch');
  });
});
