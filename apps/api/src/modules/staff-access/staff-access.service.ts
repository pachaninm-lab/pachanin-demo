import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  HttpException,
  ServiceUnavailableException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomBytes, randomUUID } from 'crypto';
import { isRetryableTransactionConflict } from '../../common/prisma/rls-transaction.service';
import { Role, RequestUser } from '../../common/types/request-user';
import { digestOpaqueAuthToken, issueStaffAccessCredential } from '../auth/opaque-token-authority';
import {
  hashAuthMaterial,
  hashClientValue,
  sha256,
  stableJson,
} from '../auth/auth-crypto';
import {
  CriticalActionRow,
  StaffAccessRepository,
  StaffAccessRequestRow,
  StaffGrantRow,
  StaffSessionRow,
  StaffSessionActivationRetryExhaustedError,
  StaffCreateIdentityCollisionError,
  StaffCreateIntentRetryExhaustedError,
  StaffSqlClient,
} from './staff-access.repository';
import {
  ALLOWED_STAFF_CRITICAL_ACTIONS,
  FORBIDDEN_STAFF_ACTIONS,
  isStaffAccessMode,
  isStaffPermission,
  isStaffRole,
  MODE_MAX_DURATION_SECONDS,
  ROLE_PERMISSION_CEILING,
  StaffAccessContext,
  StaffAccessMode,
  StaffPermission,
  StaffRole,
} from './staff-access.types';

const STAFF_MFA_FRESHNESS_MS = 15 * 60 * 1000;
const REQUEST_TTL_MS = 30 * 60 * 1000;
const CRITICAL_ACTION_TTL_MS = 10 * 60 * 1000;
const READ_ONLY_SUFFIXES = [':read', ':list', ':view-as', ':export'];

const BREAK_GLASS_ROLES = new Set<StaffRole>([
  StaffRole.PLATFORM_OWNER,
  StaffRole.SRE_ONCALL,
  StaffRole.BREAK_GLASS_ADMIN,
]);

const ROLE_ALLOWED_MODES: Readonly<Record<StaffRole, readonly StaffAccessMode[]>> = {
  PLATFORM_OWNER: Object.values(StaffAccessMode),
  PLATFORM_ADMIN: [StaffAccessMode.CONTROL_PLANE, StaffAccessMode.VIEW_AS, StaffAccessMode.ASSISTED, StaffAccessMode.JIT_PRIVILEGED],
  SUPPORT_L1: [StaffAccessMode.CONTROL_PLANE],
  SUPPORT_L2: [StaffAccessMode.CONTROL_PLANE, StaffAccessMode.VIEW_AS, StaffAccessMode.ASSISTED],
  OPERATIONS_AGENT: [StaffAccessMode.CONTROL_PLANE, StaffAccessMode.VIEW_AS, StaffAccessMode.OPERATIONS],
  OPERATIONS_SUPERVISOR: [StaffAccessMode.CONTROL_PLANE, StaffAccessMode.VIEW_AS, StaffAccessMode.OPERATIONS, StaffAccessMode.JIT_PRIVILEGED],
  FINANCE_OPS: [StaffAccessMode.CONTROL_PLANE, StaffAccessMode.JIT_PRIVILEGED],
  COMPLIANCE_STAFF: [StaffAccessMode.CONTROL_PLANE, StaffAccessMode.VIEW_AS, StaffAccessMode.JIT_PRIVILEGED],
  DEVELOPER: [StaffAccessMode.CONTROL_PLANE, StaffAccessMode.JIT_PRIVILEGED],
  SRE_ONCALL: [StaffAccessMode.CONTROL_PLANE, StaffAccessMode.JIT_PRIVILEGED, StaffAccessMode.BREAK_GLASS],
  SECURITY_AUDITOR: [StaffAccessMode.CONTROL_PLANE, StaffAccessMode.VIEW_AS],
  BREAK_GLASS_ADMIN: [StaffAccessMode.CONTROL_PLANE, StaffAccessMode.BREAK_GLASS],
};

export const FOUNDER_ROLE_MODE_SCHEMA = 'pc-crop.founder-role-mode.v1' as const;
export const FOUNDER_ROLE_MODE_RETURN_PATH = '/platform-v7/staff' as const;
export const FOUNDER_ROLE_MODE_DEFAULT_DURATION_SECONDS = 15 * 60;
export const FOUNDER_ROLE_MODE_MAX_DURATION_SECONDS = 60 * 60;

export const FOUNDER_ROLE_MODE_RESTRICTIONS = [
  'READ_ONLY',
  'NO_PAYMENT_RELEASE',
  'NO_BANK_CALLBACK_CONFIRM',
  'NO_DOCUMENT_SIGN',
  'NO_LAB_FINALIZE',
  'NO_ACCEPTANCE_SIGN',
  'NO_ARBITRATION_DECIDE',
  'NO_EVIDENCE_DELETE',
] as const;

export const FOUNDER_ROLE_MODE_CABINETS = [
  { key: 'operator', canonicalPath: '/platform-v7/operator', effectiveRole: Role.SUPPORT_MANAGER },
  { key: 'buyer', canonicalPath: '/platform-v7/buyer', effectiveRole: Role.BUYER },
  { key: 'seller', canonicalPath: '/platform-v7/seller', effectiveRole: Role.FARMER },
  { key: 'logistics', canonicalPath: '/platform-v7/logistics', effectiveRole: Role.LOGISTICIAN },
  { key: 'driver', canonicalPath: '/platform-v7/driver/field', effectiveRole: Role.DRIVER },
  { key: 'surveyor', canonicalPath: '/platform-v7/surveyor', effectiveRole: Role.SURVEYOR },
  { key: 'elevator', canonicalPath: '/platform-v7/elevator', effectiveRole: Role.ELEVATOR },
  { key: 'lab', canonicalPath: '/platform-v7/lab', effectiveRole: Role.LAB },
  { key: 'bank', canonicalPath: '/platform-v7/bank', effectiveRole: Role.ACCOUNTING },
  { key: 'organization', canonicalPath: '/platform-v7/profile', effectiveRole: Role.GUEST },
  { key: 'arbitrator', canonicalPath: '/platform-v7/arbitrator', effectiveRole: Role.ARBITRATOR },
  { key: 'compliance', canonicalPath: '/platform-v7/compliance', effectiveRole: Role.COMPLIANCE_OFFICER },
  { key: 'executive', canonicalPath: '/platform-v7/executive', effectiveRole: Role.EXECUTIVE },
] as const;

export type FounderRoleModeCabinetKey = (typeof FOUNDER_ROLE_MODE_CABINETS)[number]['key'];
export type FounderRoleModeCabinet = (typeof FOUNDER_ROLE_MODE_CABINETS)[number];

export type RequestFounderRoleModeInput = Readonly<{
  createIntentId?: string;
  cabinetKey: string;
  organizationId: string;
  reason: string;
  ticketId: string;
  durationSeconds?: number;
}>;

const FOUNDER_VIEW_AS_PERMISSIONS = [
  StaffPermission.CABINET_VIEW_AS,
  StaffPermission.DEAL_READ,
  StaffPermission.DOCUMENT_METADATA_READ,
] as const;

const FOUNDER_CABINET_BY_KEY = new Map<string, FounderRoleModeCabinet>(
  FOUNDER_ROLE_MODE_CABINETS.map((cabinet) => [cabinet.key, cabinet]),
);
const FOUNDER_CABINET_BY_EFFECTIVE_ROLE = new Map<string, FounderRoleModeCabinet>(
  FOUNDER_ROLE_MODE_CABINETS.map((cabinet) => [cabinet.effectiveRole, cabinet]),
);
const CONTROLLED_TEST_TENANT_ID = 'tenant-canonical-test';
const CONTROLLED_TEST_ORGANIZATION_PREFIX = 'org-canonical-';

function founderRoleModeCabinetByKey(value: unknown): FounderRoleModeCabinet | null {
  return typeof value === 'string' ? FOUNDER_CABINET_BY_KEY.get(value) ?? null : null;
}
function founderRoleModeCabinetByEffectiveRole(value: unknown): FounderRoleModeCabinet | null {
  return typeof value === 'string' ? FOUNDER_CABINET_BY_EFFECTIVE_ROLE.get(value) ?? null : null;
}
function controlledTestFounderTarget(tenantId: string | null, organizationId: string | null): boolean {
  return tenantId === CONTROLLED_TEST_TENANT_ID
    || String(organizationId || '').startsWith(CONTROLLED_TEST_ORGANIZATION_PREFIX);
}

export type RequestStaffAccessInput = {
  createIntentId?: string;
  assignmentId: string;
  accessMode: StaffAccessMode;
  permissions: StaffPermission[];
  targetTenantId?: string;
  targetOrganizationId?: string;
  targetUserId?: string;
  targetRole?: string;
  targetDealId?: string;
  reason: string;
  ticketId: string;
  durationSeconds: number;
};

type StaffCreateIdentity = {
  createIntentId: string; requestId: string; eventId: string;
  actorContext: { userId: string; tenantId: string; organizationId: string; membershipId: string };
};
type StaffCreateIntent = StaffCreateIdentity & {
  kind: 'generic' | 'founder'; normalizedInput: Record<string, unknown>; fingerprint: string;
};
type FounderRoleModeReceipt = {
  cabinetKey: string; canonicalPath: string; effectiveRole: string;
  effectiveOrganizationId: string; effectiveTenantId: string;
  mode: typeof StaffAccessMode.VIEW_AS; readOnly: true; restrictions: string[]; returnPath: string;
};
export type StaffCreateReceipt = {
  createIntentId?: string; requestId: string; status: string; grantId: string | null; expiresAt: string;
  schemaVersion?: typeof FOUNDER_ROLE_MODE_SCHEMA; roleMode?: FounderRoleModeReceipt;
};

export type StaffRequestDecisionInput = {
  decision: 'APPROVE' | 'DENY';
  reason: string;
};

@Injectable()
export class StaffAccessService {
  constructor(private readonly repository: StaffAccessRepository) {}

  private createIntent(user: RequestUser, kind: 'generic' | 'founder', input: RequestStaffAccessInput | RequestFounderRoleModeInput): StaffCreateIntent | null {
    if (input.createIntentId === undefined) return null;
    this.assertRecentMfa(user);
    const actorContext = this.createActorContext(user);
    const createIntentId = input.createIntentId;
    if (typeof createIntentId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(createIntentId)) {
      throw new BadRequestException('createIntentId must be a UUIDv4');
    }
    const id = createIntentId.toLowerCase();
    const required = (value: unknown, name: string, minimum: number, maximum: number) => {
      if (typeof value !== 'string') throw new BadRequestException(`${name} must be a string`);
      const text = value.trim();
      if (text.length < minimum || text.length > maximum) throw new BadRequestException(`${name} is outside its bounds`);
      return text;
    };
    const optional = (value: unknown, name: string, maximum = 128) => {
      if (value === undefined || value === null || value === '') return null;
      return required(value, name, 1, maximum);
    };
    const durationSeconds = input.durationSeconds ?? (kind === 'founder' ? FOUNDER_ROLE_MODE_DEFAULT_DURATION_SECONDS : NaN);
    if (!Number.isInteger(durationSeconds) || durationSeconds < 60 || durationSeconds > 3600) throw new BadRequestException('Invalid create duration');
    let normalizedInput: Record<string, unknown>;
    if (kind === 'founder') {
      const founder = input as RequestFounderRoleModeInput;
      normalizedInput = { cabinetKey: required(founder.cabinetKey, 'cabinetKey', 2, 32),
        organizationId: required(founder.organizationId, 'organizationId', 3, 128),
        reason: required(input.reason, 'reason', 10, 2000), ticketId: required(input.ticketId, 'ticketId', 3, 128), durationSeconds };
    } else {
      const generic = input as RequestStaffAccessInput;
      if (!isStaffAccessMode(generic.accessMode)) throw new BadRequestException('Unknown staff access mode');
      normalizedInput = { assignmentId: required(generic.assignmentId, 'assignmentId', 3, 128),
        accessMode: generic.accessMode, permissions: this.normalizePermissions(generic.permissions).sort(),
        targetTenantId: optional(generic.targetTenantId, 'targetTenantId'), targetOrganizationId: optional(generic.targetOrganizationId, 'targetOrganizationId'),
        targetUserId: optional(generic.targetUserId, 'targetUserId'), targetRole: optional(generic.targetRole, 'targetRole', 64),
        targetDealId: optional(generic.targetDealId, 'targetDealId'),
        reason: required(input.reason, 'reason', generic.accessMode === StaffAccessMode.BREAK_GLASS ? 20 : 10, 2000),
        ticketId: required(input.ticketId, 'ticketId', 3, 128), durationSeconds };
    }
    const digest = sha256(stableJson({ schema: 'staff-access-create-intent.v1', actorUserId: user.id, createIntentId: id }));
    return { createIntentId: id, requestId: `sar_${digest}`, eventId: `sae_${digest}`, actorContext, kind, normalizedInput,
      fingerprint: sha256(stableJson({ schema: 'staff-access-create-payload.v1', actorContext, kind, normalizedInput })) };
  }

  private createActorContext(user: RequestUser) {
    const context = { userId: user.id, tenantId: user.tenantId, organizationId: user.orgId, membershipId: user.membershipId };
    if (Object.values(context).some(value => typeof value !== 'string' || !value || value !== value.trim() || value.length > 128)) {
      throw new ForbiddenException('Trusted actor context is incomplete');
    }
    return context as StaffCreateIntent['actorContext'];
  }

  // The deal wrapper calls this before its mutable function-only target lookup.
  async replayAccessRequest(user: RequestUser, input: RequestStaffAccessInput) {
    const intent = this.createIntent(user, 'generic', input);
    if (!intent) return null;
    return this.repository.transaction(async tx => (await this.readCreateReceipt(tx, user, intent))?.originalReceipt ?? null);
  }

  async recoverCreateIntent(user: RequestUser, createIntentId: string) {
    this.assertRecentMfa(user);
    // Derive identity without selecting a current assignment or resolving a target.
    const actorContext = this.createActorContext(user);
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(createIntentId)) throw new BadRequestException('createIntentId must be a UUIDv4');
    const id = createIntentId.toLowerCase();
    const digest = sha256(stableJson({ schema: 'staff-access-create-intent.v1', actorUserId: user.id, createIntentId: id }));
    return this.repository.transaction(async tx => {
      const result = await this.readCreateReceipt(tx, user, { createIntentId: id, requestId: `sar_${digest}`, eventId: `sae_${digest}`, actorContext });
      if (!result) throw new NotFoundException('Create intent not found');
      const grant = result.grant;
      const assignment = await this.repository.getAssignment(tx, result.request.assignment_id, user.id);
      const now = new Date();
      const assignmentActive = assignment && assignment.role === result.originalStaffRole && ['ACTIVE', 'ELIGIBLE'].includes(assignment.status)
        && assignment.valid_from <= now && (!assignment.valid_until || assignment.valid_until > now);
      return { createIntentId: id, originalReceipt: result.originalReceipt,
        currentProjection: { requestId: result.request.id, requestStatus: result.request.status,
          grantId: grant?.id ?? null, grantStatus: grant?.status ?? null, expiresAt: grant?.expires_at.toISOString() ?? result.request.expires_at.toISOString(),
          activationEligible: Boolean(assignmentActive && grant && grant.status === 'ACTIVE' && grant.revoked_at == null && grant.starts_at <= now && grant.expires_at > now),
          requiresLiveActivationChecks: true } };
    });
  }

  private async readCreateReceipt(tx: StaffSqlClient, user: RequestUser, expected: StaffCreateIdentity & Partial<StaffCreateIntent>) {
    const request = await this.repository.getAccessRequest(tx, expected.requestId);
    const event = await this.repository.getCreateEvent(tx, expected.eventId);
    if (!request && !event) return null;
    const invalid = (): never => { throw new ConflictException({ code: 'STAFF_CREATE_RECEIPT_INVALID', message: 'Original create receipt cannot be verified' }); };
    if (!request || !event) return invalid();
    const record = (value: unknown): Record<string, unknown> | null => value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
    const metadata = record(event.metadata);
    const stored = record(metadata?.createIntent);
    if (!metadata || !stored || stored.schema !== 'staff-access-create-receipt.v1') return invalid();
    if (request.requester_user_id !== user.id || event.actor_user_id !== user.id || stableJson(stored.actorContext) !== stableJson(expected.actorContext)) {
      throw new NotFoundException('Create intent not found');
    }
    if (stored.createIntentId !== expected.createIntentId || (stored.kind !== 'founder' && stored.kind !== 'generic')) return invalid();
    const normalizedInput = record(stored.normalizedInput);
    if (!normalizedInput) return invalid();
    let canonical: StaffCreateIntent | null;
    try {
      canonical = this.createIntent(user, stored.kind, { ...normalizedInput, createIntentId: expected.createIntentId } as RequestStaffAccessInput);
    } catch { return invalid(); }
    if (!canonical || stableJson(canonical.normalizedInput) !== stableJson(normalizedInput) || canonical.fingerprint !== stored.fingerprint) return invalid();
    const payload = { id: event.id, actorUserId: event.actor_user_id, staffRole: event.staff_role,
      accessSessionId: event.access_session_id, grantId: event.grant_id, action: event.action,
      resourceType: event.resource_type, resourceId: event.resource_id, outcome: event.outcome,
      reason: event.reason, ticketId: event.ticket_id, correlationId: event.correlation_id, metadata: event.metadata, prevHash: event.prev_hash };
    if (event.id !== expected.eventId || event.resource_type !== 'staff_access_request' || event.resource_id !== request.id
      || event.action !== 'staff.access.request' || event.outcome !== 'SUCCESS' || event.access_session_id !== null
      || !/^[a-f0-9]{64}$/.test(event.hash) || sha256(stableJson(payload)) !== event.hash) return invalid();
    const authority = record(stored.authoritySnapshot);
    const receipt = record(stored.originalReceipt);
    if (!authority || !receipt || !isStaffRole(event.staff_role)) return invalid();
    const storedPermissions = (value: unknown) => {
      try { return this.normalizePermissions(value).sort(); } catch { return invalid(); }
    };
    const snapshot = { assignmentId: request.assignment_id, staffRole: event.staff_role, accessMode: request.access_mode,
      targetTenantId: request.target_tenant_id, targetOrganizationId: request.target_organization_id,
      targetUserId: request.target_user_id, targetRole: request.target_role, targetDealId: request.target_deal_id,
      permissions: storedPermissions(request.requested_permissions), reason: request.reason,
      ticketId: request.ticket_id, durationSeconds: request.max_duration_seconds, requestExpiresAt: request.expires_at.toISOString() };
    if (stableJson(authority) !== stableJson(snapshot) || event.reason !== request.reason || event.ticket_id !== request.ticket_id
      || event.effective_tenant_id !== request.target_tenant_id || event.effective_organization_id !== request.target_organization_id
      || event.effective_user_id !== request.target_user_id || event.effective_role !== request.target_role || event.access_mode !== request.access_mode) return invalid();
    if (normalizedInput.reason !== request.reason || normalizedInput.ticketId !== request.ticket_id || normalizedInput.durationSeconds !== request.max_duration_seconds) return invalid();
    if (stored.kind === 'generic' && (normalizedInput.assignmentId !== request.assignment_id || normalizedInput.accessMode !== request.access_mode
      || stableJson(normalizedInput.permissions) !== stableJson(snapshot.permissions) || normalizedInput.targetRole !== request.target_role
      || normalizedInput.targetDealId !== request.target_deal_id
      || (normalizedInput.targetTenantId !== null && normalizedInput.targetTenantId !== request.target_tenant_id)
      || (normalizedInput.targetOrganizationId !== null && normalizedInput.targetOrganizationId !== request.target_organization_id)
      || (normalizedInput.targetUserId !== null && normalizedInput.targetUserId !== request.target_user_id))) return invalid();
    if (stored.kind === 'founder' && normalizedInput.organizationId !== request.target_organization_id) return invalid();
    const expectedKeys = ['createIntentId', 'requestId', 'status', 'grantId', 'expiresAt', ...(stored.kind === 'founder' ? ['schemaVersion', 'roleMode'] : [])].sort();
    if (stableJson(Object.keys(receipt).sort()) !== stableJson(expectedKeys) || receipt.createIntentId !== expected.createIntentId
      || receipt.requestId !== expected.requestId || !['PENDING', 'GRANTED'].includes(String(receipt.status))
      || typeof receipt.expiresAt !== 'string' || !Number.isFinite(Date.parse(receipt.expiresAt))) return invalid();
    if (stored.kind === 'founder') {
      const mode = record(receipt.roleMode);
      const roleModeKeys = ['cabinetKey', 'canonicalPath', 'effectiveRole', 'effectiveOrganizationId', 'effectiveTenantId', 'mode', 'readOnly', 'restrictions', 'returnPath'].sort();
      if (!mode || stableJson(Object.keys(mode).sort()) !== stableJson(roleModeKeys)
        || event.staff_role !== StaffRole.PLATFORM_OWNER || request.access_mode !== StaffAccessMode.VIEW_AS
        || stableJson(snapshot.permissions) !== stableJson([...FOUNDER_VIEW_AS_PERMISSIONS].sort()) || receipt.status !== 'GRANTED'
        || receipt.schemaVersion !== FOUNDER_ROLE_MODE_SCHEMA || mode.cabinetKey !== normalizedInput.cabinetKey
        || mode.effectiveOrganizationId !== request.target_organization_id || mode.effectiveTenantId !== request.target_tenant_id
        || mode.effectiveRole !== request.target_role || mode.mode !== StaffAccessMode.VIEW_AS || mode.readOnly !== true
        || typeof mode.canonicalPath !== 'string' || mode.canonicalPath.length > 256 || !/^\/platform-v7\/[a-z0-9/-]+$/.test(mode.canonicalPath)
        || mode.returnPath !== FOUNDER_ROLE_MODE_RETURN_PATH || !Array.isArray(mode.restrictions)
        || stableJson(mode.restrictions) !== stableJson([...FOUNDER_ROLE_MODE_RESTRICTIONS])) return invalid();
    }
    if (metadata.requestId !== request.id || metadata.accessMode !== request.access_mode
      || stableJson(storedPermissions(metadata.permissions)) !== stableJson(snapshot.permissions)
      || metadata.autoApproved !== (receipt.status === 'GRANTED')
      || metadata.targetTenantId !== request.target_tenant_id || metadata.targetOrganizationId !== request.target_organization_id
      || metadata.targetUserId !== request.target_user_id || metadata.targetRole !== request.target_role) return invalid();
    const grant = await this.repository.getGrantForRequest(tx, request.id);
    if (grant && (grant.request_id !== request.id || grant.grantee_user_id !== user.id || grant.assignment_id !== request.assignment_id
      || grant.access_mode !== request.access_mode || grant.target_tenant_id !== request.target_tenant_id
      || grant.target_organization_id !== request.target_organization_id || grant.target_user_id !== request.target_user_id
      || grant.target_role !== request.target_role || grant.target_deal_id !== request.target_deal_id
      || stableJson(storedPermissions(grant.permissions)) !== stableJson(snapshot.permissions))) return invalid();
    if (receipt.status === 'GRANTED') {
      if (!grant || receipt.grantId !== grant.id || event.grant_id !== grant.id || receipt.expiresAt !== grant.expires_at.toISOString()
        || grant.expires_at.getTime() - grant.starts_at.getTime() !== request.max_duration_seconds * 1000) return invalid();
    } else if (receipt.grantId !== null || event.grant_id !== null || receipt.expiresAt !== request.expires_at.toISOString()) return invalid();
    if (expected.fingerprint && (expected.kind !== stored.kind || expected.fingerprint !== stored.fingerprint)) {
      throw new ConflictException({ code: 'STAFF_CREATE_INTENT_PAYLOAD_CONFLICT', message: 'Create intent payload differs from the original operation' });
    }
    return { originalReceipt: receipt as unknown as StaffCreateReceipt, request, grant, originalStaffRole: event.staff_role };
  }

  async enrichActor(user: RequestUser): Promise<RequestUser> {
    const assignments = await this.repository.listActiveAssignments(this.repository.prisma, user.id);
    return {
      ...user,
      staffRoles: assignments.map((assignment) => assignment.role).filter(isStaffRole),
      staffAssignmentIds: assignments.map((assignment) => assignment.id),
    };
  }

  listMyAssignments(user: RequestUser) {
    return this.repository.listActiveAssignments(this.repository.prisma, user.id);
  }

  async requireActivePlatformOwner(user: RequestUser) {
    this.assertRecentMfa(user);
    const assignments = await this.repository.listActiveAssignments(this.repository.prisma, user.id);
    const assignment = assignments.find((item) => (
      item.role === StaffRole.PLATFORM_OWNER && item.status === 'ACTIVE'
    ));
    if (!assignment) {
      throw new ForbiddenException('Active PLATFORM_OWNER assignment is required');
    }
    return assignment;
  }

  async founderRoleModeRegistry(user: RequestUser) {
    await this.requireActivePlatformOwner(user);
    return {
      schemaVersion: FOUNDER_ROLE_MODE_SCHEMA,
      mode: StaffAccessMode.VIEW_AS,
      readOnly: true,
      returnPath: FOUNDER_ROLE_MODE_RETURN_PATH,
      restrictions: [...FOUNDER_ROLE_MODE_RESTRICTIONS],
      cabinets: FOUNDER_ROLE_MODE_CABINETS.map((cabinet) => ({ ...cabinet })),
    };
  }

  async requestFounderRoleMode(
    user: RequestUser,
    input: RequestFounderRoleModeInput,
    correlationId?: string,
  ) {
    const intent = this.createIntent(user, 'founder', input);
    if (intent) {
      const replay = await this.repository.transaction(async tx => this.readCreateReceipt(tx, user, intent));
      if (replay) return replay.originalReceipt;
    }
    const assignment = await this.requireActivePlatformOwner(user);
    const cabinet = founderRoleModeCabinetByKey(input.cabinetKey);
    if (!cabinet) throw new BadRequestException('Unknown founder role-mode cabinet');

    const organizationId = String(input.organizationId || '').trim();
    if (!organizationId || organizationId.length > 128) {
      throw new BadRequestException('A bounded organizationId is required');
    }

    const target = await this.repository.resolveTargetScope(this.repository.prisma, {
      actorUserId: user.id,
      assignmentId: assignment.id,
      targetOrganizationId: organizationId,
    });
    if (
      !target
      || !target.tenant_id
      || !target.organization_id
      || target.organization_id !== organizationId
    ) {
      throw new ForbiddenException('Founder role-mode target scope could not be verified');
    }
    if (controlledTestFounderTarget(target.tenant_id, target.organization_id)) {
      throw new ForbiddenException('Controlled test targets are not R1 production role-mode authority');
    }

    const durationSeconds = input.durationSeconds ?? FOUNDER_ROLE_MODE_DEFAULT_DURATION_SECONDS;
    if (
      !Number.isInteger(durationSeconds)
      || durationSeconds < 60
      || durationSeconds > FOUNDER_ROLE_MODE_MAX_DURATION_SECONDS
    ) {
      throw new BadRequestException('Founder role-mode duration must be between 60 and 3600 seconds');
    }

    const roleMode: FounderRoleModeReceipt = {
      cabinetKey: cabinet.key, canonicalPath: cabinet.canonicalPath, effectiveRole: cabinet.effectiveRole,
      effectiveOrganizationId: target.organization_id, effectiveTenantId: target.tenant_id,
      mode: StaffAccessMode.VIEW_AS, readOnly: true, restrictions: [...FOUNDER_ROLE_MODE_RESTRICTIONS], returnPath: FOUNDER_ROLE_MODE_RETURN_PATH,
    };
    const requestInput: RequestStaffAccessInput = {
      assignmentId: assignment.id,
      accessMode: StaffAccessMode.VIEW_AS,
      permissions: [...FOUNDER_VIEW_AS_PERMISSIONS],
      targetTenantId: target.tenant_id,
      targetOrganizationId: target.organization_id,
      targetRole: cabinet.effectiveRole,
      reason: input.reason,
      ticketId: input.ticketId,
      durationSeconds,
    };
    const created = intent
      ? await this.requestAccess(user, requestInput, correlationId, intent, roleMode)
      : await this.requestAccess(user, requestInput, correlationId);
    if (intent) return created;

    return {
      schemaVersion: FOUNDER_ROLE_MODE_SCHEMA,
      ...created,
      roleMode: {
        cabinetKey: cabinet.key,
        canonicalPath: cabinet.canonicalPath,
        effectiveRole: cabinet.effectiveRole,
        effectiveOrganizationId: target.organization_id,
        effectiveTenantId: target.tenant_id,
        mode: StaffAccessMode.VIEW_AS,
        readOnly: true,
        restrictions: [...FOUNDER_ROLE_MODE_RESTRICTIONS],
        returnPath: FOUNDER_ROLE_MODE_RETURN_PATH,
      },
    };
  }

  async founderRoleModeSession(user: RequestUser, context: StaffAccessContext) {
    await this.requireActivePlatformOwner(user);
    if (context.actorUserId !== user.id || context.staffRole !== StaffRole.PLATFORM_OWNER) {
      throw new ForbiddenException('Founder role-mode session must belong to the active platform owner');
    }
    if (context.accessMode !== StaffAccessMode.VIEW_AS) {
      throw new ForbiddenException('Founder role-mode requires VIEW_AS');
    }
    if (!context.permissions.includes(StaffPermission.CABINET_VIEW_AS)) {
      throw new ForbiddenException('Founder role-mode session lacks cabinet:view-as');
    }
    const allowed = new Set<string>(FOUNDER_VIEW_AS_PERMISSIONS);
    if (context.permissions.some((permission) => !allowed.has(permission))) {
      throw new ForbiddenException('Founder role-mode session contains non-canonical permissions');
    }

    const cabinet = founderRoleModeCabinetByEffectiveRole(context.effectiveRole);
    if (!cabinet || !context.effectiveOrganizationId || !context.effectiveTenantId) {
      throw new ForbiddenException('Founder role-mode session scope is incomplete');
    }
    if (controlledTestFounderTarget(context.effectiveTenantId, context.effectiveOrganizationId)) {
      throw new ForbiddenException('Controlled test targets are not R1 production role-mode authority');
    }

    const displayName = String(user.fullName || '').trim().slice(0, 160) || 'Platform owner';
    return {
      schemaVersion: FOUNDER_ROLE_MODE_SCHEMA,
      active: true,
      accessSessionId: context.accessSessionId,
      actor: { displayName },
      cabinetKey: cabinet.key,
      canonicalPath: cabinet.canonicalPath,
      effectiveRole: cabinet.effectiveRole,
      effectiveOrganizationId: context.effectiveOrganizationId,
      effectiveTenantId: context.effectiveTenantId,
      mode: StaffAccessMode.VIEW_AS,
      readOnly: true,
      restrictions: [...FOUNDER_ROLE_MODE_RESTRICTIONS],
      expiresAt: context.expiresAt.toISOString(),
      ticketId: context.ticketId,
      mfaRequired: true,
      returnPath: FOUNDER_ROLE_MODE_RETURN_PATH,
    };
  }

  async listRequests(user: RequestUser) {
    await this.requireAssignments(user);
    return this.repository.listAccessRequests(this.repository.prisma, user.id, false);
  }

  async listReviewRequests(user: RequestUser) {
    await this.requirePermission(user, StaffPermission.STAFF_REQUEST_READ);
    return this.repository.listAccessRequests(this.repository.prisma, user.id, true);
  }

  async requestAccess(
    user: RequestUser,
    input: RequestStaffAccessInput,
    correlationId: string = randomUUID(),
    internalIntent?: StaffCreateIntent,
    founderRoleMode?: FounderRoleModeReceipt,
    originalInput: RequestStaffAccessInput = input,
  ): Promise<StaffCreateReceipt> {
    this.assertRecentMfa(user);
    const intent = internalIntent ?? this.createIntent(user, 'generic', originalInput);
    if (intent) {
      const replay = await this.repository.transaction(async tx => this.readCreateReceipt(tx, user, intent));
      if (replay) return replay.originalReceipt;
    }
    if (!isStaffAccessMode(input.accessMode)) throw new BadRequestException('Unknown staff access mode');
    const assignment = await this.repository.getAssignment(this.repository.prisma, input.assignmentId, user.id);
    if (!assignment || !isStaffRole(assignment.role)) throw new ForbiddenException('Active staff assignment is required');
    this.assertAssignmentActive(assignment);
    const role: StaffRole = assignment.role;
    if (!ROLE_ALLOWED_MODES[role].includes(input.accessMode)) {
      throw new ForbiddenException(`${role} cannot request ${input.accessMode}`);
    }

    const permissions = this.normalizePermissions(input.permissions);
    this.assertPermissionCeiling(role, permissions);
    this.assertModePermissions(input.accessMode, permissions);
    const target = await this.validateTargetScope(user, assignment.id, input);
    const maxDuration = MODE_MAX_DURATION_SECONDS[input.accessMode];
    if (!Number.isInteger(input.durationSeconds) || input.durationSeconds < 60 || input.durationSeconds > maxDuration) {
      throw new BadRequestException(`Duration must be between 60 and ${maxDuration} seconds`);
    }
    const reason = this.requireText(input.reason, 'reason', input.accessMode === StaffAccessMode.BREAK_GLASS ? 20 : 10);
    const ticketId = this.requireText(input.ticketId, 'ticketId', 3);
    const targetRole = intent?.kind === 'generic'
      ? intent.normalizedInput.targetRole as string | null
      : input.targetRole || null;
    const targetDealId = intent?.kind === 'generic'
      ? intent.normalizedInput.targetDealId as string | null
      : input.targetDealId || null;
    const requestId = intent?.requestId ?? `sar_${randomUUID()}`;
    const now = new Date();
    const requestExpiry = new Date(now.getTime() + REQUEST_TTL_MS);
    const autoApprove = this.canAutoApprove(role, input.accessMode);

    const work = async (tx: Prisma.TransactionClient): Promise<StaffCreateReceipt> => {
      if (intent) {
        const replay = await this.readCreateReceipt(tx, user, intent);
        if (replay) return replay.originalReceipt;
        const lockedAssignment = await this.repository.getAssignment(tx, assignment.id, user.id, true);
        if (!lockedAssignment || lockedAssignment.role !== role) throw new ForbiddenException('Staff assignment changed before create');
        this.assertAssignmentActive(lockedAssignment);
        this.assertRecentMfa(user);
      }
      const reserved = await this.repository.createAccessRequest(tx, {
        id: requestId,
        requesterUserId: user.id,
        assignmentId: assignment.id,
        accessMode: input.accessMode,
        targetTenantId: target.tenantId,
        targetOrganizationId: target.organizationId,
        targetUserId: target.userId,
        targetRole,
        targetDealId,
        permissions,
        reason,
        ticketId,
        maxDurationSeconds: input.durationSeconds,
        expiresAt: requestExpiry,
        ...(intent ? { reserveIntent: true } : {}),
      });
      if (intent && !reserved) throw new StaffCreateIdentityCollisionError();

      let createdGrant: { id: string; expiresAt: Date } | null = null;
      if (autoApprove) {
        const request = await this.requireRequest(tx, requestId, true);
        const changed = await this.repository.markRequest(tx, {
          id: request.id,
          expectedVersion: request.version,
          status: 'APPROVED',
          actorUserId: user.id,
          reason: 'AUTO_APPROVED_OWNER_READ_ONLY',
        });
        if (!changed) throw new ConflictException('Access request changed concurrently');
        createdGrant = await this.createGrant(tx, { ...request, version: request.version + 1 }, now);
      }

      const receipt: StaffCreateReceipt = {
        requestId, status: autoApprove ? 'GRANTED' : 'PENDING', grantId: createdGrant?.id ?? null,
        expiresAt: createdGrant?.expiresAt.toISOString() ?? requestExpiry.toISOString(),
        ...(intent ? { createIntentId: intent.createIntentId } : {}),
        ...(founderRoleMode ? { schemaVersion: FOUNDER_ROLE_MODE_SCHEMA, roleMode: founderRoleMode } : {}),
      };
      const authoritySnapshot = { assignmentId: assignment.id, staffRole: role, accessMode: input.accessMode,
        targetTenantId: target.tenantId, targetOrganizationId: target.organizationId, targetUserId: target.userId,
        targetRole, targetDealId,
        permissions: [...permissions].sort(), reason, ticketId, durationSeconds: input.durationSeconds, requestExpiresAt: requestExpiry.toISOString() };
      await this.audit(tx, {
        actor: user,
        staffRole: role,
        ...(intent ? { eventId: intent.eventId, resourceType: 'staff_access_request', resourceId: requestId, grantId: createdGrant?.id ?? null } : {}),
        action: 'staff.access.request',
        outcome: 'SUCCESS',
        reason,
        ticketId,
        correlationId,
        metadata: {
          requestId,
          accessMode: input.accessMode,
          permissions,
          autoApproved: autoApprove,
          targetTenantId: target.tenantId,
          targetOrganizationId: target.organizationId,
          targetUserId: target.userId,
          targetRole,
          ...(intent ? { createIntent: { schema: 'staff-access-create-receipt.v1', createIntentId: intent.createIntentId,
            actorContext: intent.actorContext, kind: intent.kind, normalizedInput: intent.normalizedInput,
            fingerprint: intent.fingerprint, authoritySnapshot, originalReceipt: receipt } } : {}),
        },
      });
      return receipt;
    };
    try {
      return await (intent ? this.repository.createIntentTransaction(work) : this.repository.transaction(work));
    } catch (error) {
      if (error instanceof StaffCreateIntentRetryExhaustedError) throw new ConflictException({
        code: 'STAFF_CREATE_INTENT_RETRY_REQUIRED', createIntentId: intent?.createIntentId,
        message: 'Recover or retry the same create intent', retryable: true,
      });
      if (intent && !(error instanceof HttpException)) throw new ServiceUnavailableException({
        code: 'STAFF_CREATE_OUTCOME_UNKNOWN', createIntentId: intent.createIntentId,
        recoveryRequired: true, message: 'Recover the same create intent before another operation',
      }, { cause: error });
      throw error;
    }
  }

  async decideRequest(
    user: RequestUser,
    requestId: string,
    input: StaffRequestDecisionInput,
    correlationId: string = randomUUID(),
  ) {
    this.assertRecentMfa(user);
    const approverRole = await this.requirePermission(user, StaffPermission.STAFF_REQUEST_APPROVE);
    const reason = this.requireText(input.reason, 'reason', 5);
    if (input.decision !== 'APPROVE' && input.decision !== 'DENY') throw new BadRequestException('Unknown decision');

    return this.repository.transaction(async (tx) => {
      const request = await this.requireRequest(tx, requestId, true);
      this.assertPendingRequest(request);
      if (request.requester_user_id === user.id) throw new ForbiddenException('Requester cannot approve their own access');
      await this.repository.insertApproval(tx, {
        id: `saa_${randomUUID()}`,
        requestId,
        approverUserId: user.id,
        decision: input.decision,
        reason,
      });

      if (input.decision === 'DENY') {
        const changed = await this.repository.markRequest(tx, {
          id: request.id,
          expectedVersion: request.version,
          status: 'DENIED',
          actorUserId: user.id,
          reason,
        });
        if (!changed) throw new ConflictException('Access request changed concurrently');
        await this.audit(tx, {
          actor: user,
          staffRole: approverRole,
          action: 'staff.access.deny',
          outcome: 'SUCCESS',
          reason,
          ticketId: request.ticket_id,
          correlationId,
          metadata: { requestId },
        });
        return { requestId, status: 'DENIED' };
      }

      const approvalCount = await this.repository.countApprovals(tx, requestId);
      const requiredApprovals = request.access_mode === StaffAccessMode.JIT_PRIVILEGED ? 2 : 1;
      if (approvalCount < requiredApprovals) {
        await this.audit(tx, {
          actor: user,
          staffRole: approverRole,
          action: 'staff.access.approve.partial',
          outcome: 'SUCCESS',
          reason,
          ticketId: request.ticket_id,
          correlationId,
          metadata: { requestId, approvalCount, requiredApprovals },
        });
        return { requestId, status: 'PENDING', approvalCount, requiredApprovals };
      }

      const changed = await this.repository.markRequest(tx, {
        id: request.id,
        expectedVersion: request.version,
        status: 'APPROVED',
        actorUserId: user.id,
        reason,
      });
      if (!changed) throw new ConflictException('Access request changed concurrently');
      const grant = await this.createGrant(tx, { ...request, version: request.version + 1 }, new Date());
      await this.audit(tx, {
        actor: user,
        staffRole: approverRole,
        action: 'staff.access.approve',
        outcome: 'SUCCESS',
        reason,
        ticketId: request.ticket_id,
        correlationId,
        metadata: { requestId, grantId: grant.id, approvalCount },
      });
      return { requestId, status: 'GRANTED', grantId: grant.id, expiresAt: grant.expiresAt.toISOString() };
    });
  }

  async activateGrant(
    user: RequestUser,
    grantId: string,
    userAgent?: string,
    ip?: string,
    correlationId: string = randomUUID(),
  ) {
    this.assertRecentMfa(user);
    const token = this.makeAccessToken();
    return this.repository.activateSessionTransaction(async (tx) => {
      const grant = await this.repository.getGrant(tx, grantId, user.id, true);
      if (!grant || !isStaffRole(grant.staff_role)) throw new NotFoundException('Staff grant not found');
      this.assertGrantActive(grant);
      if (await this.repository.hasActiveSession(tx, user.id)) {
        throw new ConflictException({
          code: 'STAFF_ACTIVE_SESSION_CONFLICT',
          message: 'End the active staff session before activating another grant.',
        });
      }
      const sessionId = `sas_${randomUUID()}`;
      await this.repository.createAccessSession(tx, {
        id: sessionId,
        grant,
        tokenHash: token.hash,
        mfaLevel: 'TOTP',
        ipHash: hashClientValue(ip),
        userAgentHash: hashClientValue(userAgent),
      });
      await this.audit(tx, {
        actor: user,
        staffRole: grant.staff_role,
        accessSessionId: sessionId,
        grantId: grant.id,
        action: 'staff.session.activate',
        outcome: 'SUCCESS',
        reason: grant.reason,
        ticketId: grant.ticket_id,
        correlationId,
        metadata: {
          accessMode: grant.access_mode,
          targetTenantId: grant.target_tenant_id,
          targetOrganizationId: grant.target_organization_id,
          targetUserId: grant.target_user_id,
          targetRole: grant.target_role,
          expiresAt: grant.expires_at.toISOString(),
        },
      });
      return {
        accessSessionId: sessionId,
        accessToken: token.token,
        expiresAt: grant.expires_at.toISOString(),
        accessMode: grant.access_mode,
        permissions: this.permissions(grant.permissions),
      };
    }).catch((error: unknown) => {
      if (error instanceof StaffSessionActivationRetryExhaustedError) {
        throw new ConflictException({
          code: 'STAFF_SESSION_ACTIVATION_CONFLICT',
          message: 'Refresh active staff sessions before retrying activation.',
          retryable: true,
        });
      }
      throw error;
    });
  }

  async resolveAccessSession(user: RequestUser, token: string): Promise<StaffAccessContext> {
    const presented = String(token ?? '');
    if (!presented) throw new UnauthorizedException('Invalid staff access session');
    const tokenHash = digestOpaqueAuthToken({ purpose: 'staff-access', rawToken: presented });
    const session = await this.repository.getAccessSessionByHash(this.repository.prisma, tokenHash, user.id);
    if (!session || !isStaffRole(session.staff_role) || !isStaffAccessMode(session.access_mode)) {
      throw new UnauthorizedException('Invalid staff access session');
    }
    if (session.actor_user_id !== user.id || session.status !== 'ACTIVE'
      || !(session.expires_at instanceof Date) || !Number.isFinite(session.expires_at.getTime())
      || session.expires_at <= new Date()) {
      throw new UnauthorizedException('Staff access session is not active');
    }
    // The repository revalidates this exact session's grant and assignment;
    // an unrelated current assignment must not supply its role/permission ceiling.
    if (!ROLE_ALLOWED_MODES[session.staff_role].includes(session.access_mode)) {
      throw new UnauthorizedException('Staff access session mode exceeds its assignment');
    }
    try {
      const permissions = this.normalizePermissions(session.permissions);
      this.assertPermissionCeiling(session.staff_role, permissions);
      this.assertModePermissions(session.access_mode, permissions);
    } catch (error) {
      if (error instanceof BadRequestException || error instanceof ForbiddenException) {
        throw new UnauthorizedException('Staff access session permissions are not valid');
      }
      throw error;
    }
    await this.repository.touchAccessSession(this.repository.prisma, session.id);
    return this.toContext(session);
  }

  async endSession(
    user: RequestUser,
    sessionId: string,
    reason = 'STAFF_ENDED',
    correlationId: string = randomUUID(),
  ) {
    const roles = await this.requireAssignments(user);
    return this.sessionLifecycleTransaction(async (tx) => {
      const target = await this.repository.getActiveAccessSession(tx, sessionId, user.id);
      if (!target || !isStaffRole(target.staff_role)) throw new NotFoundException('Active staff session not found');
      const ended = await this.repository.endAccessSession(tx, sessionId, user.id, reason);
      if (!ended) throw new ConflictException('Staff session is no longer active');
      await this.audit(tx, {
        actor: user,
        staffRole: roles[0].role,
        accessSessionId: sessionId,
        grantId: target.grant_id,
        action: 'staff.session.end',
        outcome: 'SUCCESS',
        reason,
        ticketId: target.ticket_id,
        correlationId,
      });
      return { success: true, sessionId };
    });
  }

  async revokeSession(
    user: RequestUser,
    sessionId: string,
    reason = 'STAFF_REVOKED',
    correlationId: string = randomUUID(),
  ) {
    const staffRole = await this.requirePermission(user, StaffPermission.STAFF_SESSION_REVOKE);
    return this.sessionLifecycleTransaction(async (tx) => {
      const target = await this.repository.getActiveAccessSession(tx, sessionId);
      if (!target || !isStaffRole(target.staff_role)) throw new NotFoundException('Active staff session not found');
      const ended = await this.repository.endAccessSession(tx, sessionId, target.actor_user_id, reason);
      if (!ended) throw new ConflictException('Staff session is no longer active');
      await this.audit(tx, {
        actor: user,
        staffRole,
        accessSessionId: sessionId,
        grantId: target.grant_id,
        action: 'staff.session.revoke',
        outcome: 'SUCCESS',
        reason,
        ticketId: target.ticket_id,
        correlationId,
        metadata: { targetActorUserId: target.actor_user_id },
      });
      return { success: true, sessionId };
    });
  }

  async listActiveSessions(user: RequestUser) {
    await this.requireAssignments(user);
    return this.repository.listActiveSessions(this.repository.prisma, user.id);
  }

  async listAllActiveSessions(user: RequestUser) {
    await this.requirePermission(user, StaffPermission.STAFF_SESSION_READ);
    return this.repository.listActiveSessions(this.repository.prisma);
  }

  async activateBreakGlass(
    user: RequestUser,
    input: { assignmentId: string; reason: string; ticketId: string },
    correlationId: string = randomUUID(),
  ) {
    this.assertRecentMfa(user);
    const assignment = await this.repository.getAssignment(this.repository.prisma, input.assignmentId, user.id);
    if (!assignment || !isStaffRole(assignment.role)) throw new ForbiddenException('Break-glass assignment is required');
    const role: StaffRole = assignment.role;
    if (!BREAK_GLASS_ROLES.has(role)) throw new ForbiddenException('Role cannot activate break-glass access');
    const reason = this.requireText(input.reason, 'reason', 20);
    const ticketId = this.requireText(input.ticketId, 'ticketId', 3);
    const activationId = `bga_${randomUUID()}`;
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
    await this.repository.transaction(async (tx) => {
      await this.repository.createBreakGlass(tx, {
        id: activationId,
        actorUserId: user.id,
        assignmentId: assignment.id,
        reason,
        ticketId,
        expiresAt,
        correlationId,
      });
      await this.audit(tx, {
        actor: user,
        staffRole: role,
        action: 'staff.break-glass.activate',
        outcome: 'SUCCESS',
        reason,
        ticketId,
        correlationId,
        metadata: { activationId, expiresAt: expiresAt.toISOString(), notificationRequired: true },
      });
    });
    return { activationId, expiresAt: expiresAt.toISOString(), notificationRequired: true };
  }

  async requestCriticalAction(
    user: RequestUser,
    access: StaffAccessContext,
    input: { action: string; resourceType: string; resourceId: string; payload: unknown },
    correlationId: string = randomUUID(),
  ) {
    this.assertRecentMfa(user);
    if (!access.permissions.includes(StaffPermission.CRITICAL_ACTION_REQUEST)) {
      throw new ForbiddenException('Grant cannot request critical actions');
    }
    if (FORBIDDEN_STAFF_ACTIONS.has(input.action)) {
      throw new ForbiddenException('This action must be performed by the authoritative business actor or verified external callback');
    }
    const id = `scar_${randomUUID()}`;
    const payloadHash = sha256(stableJson(input.payload));
    const expiresAt = new Date(Date.now() + CRITICAL_ACTION_TTL_MS);
    await this.repository.transaction(async (tx) => {
      await this.repository.createCriticalAction(tx, {
        id,
        requesterUserId: user.id,
        accessSessionId: access.accessSessionId,
        action: input.action,
        resourceType: input.resourceType,
        resourceId: input.resourceId,
        targetTenantId: access.effectiveTenantId,
        targetOrganizationId: access.effectiveOrganizationId,
        payloadHash,
        requiredApprovals: 2,
        expiresAt,
      });
      await this.audit(tx, {
        actor: user,
        staffRole: access.staffRole,
        accessSessionId: access.accessSessionId,
        grantId: access.grantId,
        action: 'staff.critical.request',
        resourceType: input.resourceType,
        resourceId: input.resourceId,
        outcome: 'SUCCESS',
        reason: access.reason,
        ticketId: access.ticketId,
        correlationId,
        metadata: { criticalRequestId: id, requestedAction: input.action, payloadHash },
      });
    });
    return { criticalRequestId: id, payloadHash, requiredApprovals: 2, expiresAt: expiresAt.toISOString() };
  }

  async approveCriticalAction(
    user: RequestUser,
    requestId: string,
    input: { decision: 'APPROVE' | 'DENY'; reason: string },
    correlationId: string = randomUUID(),
  ) {
    this.assertRecentMfa(user);
    const role = await this.requirePermission(user, StaffPermission.CRITICAL_ACTION_APPROVE);
    const reason = this.requireText(input.reason, 'reason', 5);
    return this.repository.transaction(async (tx) => {
      const request = await this.requireCriticalRequest(tx, requestId, true);
      if (request.status !== 'PENDING' || request.expires_at <= new Date()) throw new ConflictException('Critical request is not pending');
      if (request.requester_user_id === user.id) throw new ForbiddenException('Requester cannot approve their own critical action');
      await this.repository.insertCriticalApproval(tx, {
        id: `scaa_${randomUUID()}`,
        requestId,
        approverUserId: user.id,
        decision: input.decision,
        reason,
      });
      if (input.decision === 'DENY') {
        await this.repository.markCriticalAction(tx, requestId, 'DENIED');
        await this.auditCritical(tx, user, role, request, 'staff.critical.deny', reason, correlationId);
        return { requestId, status: 'DENIED' };
      }
      const approvals = await this.repository.countCriticalApprovals(tx, requestId);
      if (approvals >= request.required_approvals) await this.repository.markCriticalAction(tx, requestId, 'APPROVED');
      await this.auditCritical(tx, user, role, request, 'staff.critical.approve', reason, correlationId, { approvals });
      return {
        requestId,
        status: approvals >= request.required_approvals ? 'APPROVED' : 'PENDING',
        approvals,
        requiredApprovals: request.required_approvals,
      };
    });
  }

  async consumeCriticalAction(
    user: RequestUser,
    access: StaffAccessContext,
    requestId: string,
    payload: unknown,
    correlationId: string = randomUUID(),
  ) {
    return this.repository.transaction(async (tx) => {
      const request = await this.requireCriticalRequest(tx, requestId, true);
      if (request.requester_user_id !== user.id || request.access_session_id !== access.accessSessionId) {
        throw new NotFoundException('Critical action approval not found');
      }
      if (request.status !== 'APPROVED' || request.expires_at <= new Date()) {
        throw new ConflictException('Critical action approval is not active');
      }
      const payloadHash = sha256(stableJson(payload));
      if (payloadHash !== request.payload_hash) throw new ForbiddenException('Critical action payload changed after approval');
      const consumed = await this.repository.markCriticalAction(tx, request.id, 'CONSUMED', true);
      if (!consumed) throw new ConflictException('Critical action approval was already consumed');
      await this.auditCritical(tx, user, access.staffRole, request, 'staff.critical.consume', access.reason, correlationId);
      return { success: true, requestId, action: request.action, payloadHash };
    });
  }

  async requirePermission(user: RequestUser, permission: StaffPermission): Promise<StaffRole> {
    const assignments = await this.requireAssignments(user);
    const assignment = assignments.find(({ role }) => ROLE_PERMISSION_CEILING[role].includes(permission));
    if (!assignment) throw new ForbiddenException(`Missing staff permission ${permission}`);
    return assignment.role;
  }

  private async requireAssignments(user: RequestUser) {
    const rows = await this.repository.listActiveAssignments(this.repository.prisma, user.id);
    const assignments = rows
      .filter((row) => isStaffRole(row.role))
      .map((row) => ({ ...row, role: row.role as StaffRole }));
    if (assignments.length === 0) throw new ForbiddenException('Active staff assignment is required');
    return assignments;
  }

  private async sessionLifecycleTransaction<T>(work: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    try {
      return await this.repository.transaction(work);
    } catch (error) {
      if (isRetryableTransactionConflict(error)) {
        throw new ConflictException({
          code: 'STAFF_SESSION_LIFECYCLE_CONFLICT',
          message: 'Refresh the staff session before retrying completion.',
          retryable: true,
        });
      }
      throw error;
    }
  }

  private assertRecentMfa(user: RequestUser) {
    if (!user.mfaVerified || !user.mfaVerifiedAt) throw new ForbiddenException('Staff access requires MFA');
    const age = Date.now() - new Date(user.mfaVerifiedAt).getTime();
    if (!Number.isFinite(age) || age < 0 || age > STAFF_MFA_FRESHNESS_MS) {
      throw new ForbiddenException('Staff access requires recent MFA verification');
    }
  }

  private assertAssignmentActive(assignment: { status: string; valid_from: Date; valid_until: Date | null }) {
    const now = new Date();
    if (!['ELIGIBLE', 'ACTIVE'].includes(assignment.status) || assignment.valid_from > now || (assignment.valid_until && assignment.valid_until <= now)) {
      throw new ForbiddenException('Staff assignment is not active');
    }
  }

  private normalizePermissions(values: unknown): StaffPermission[] {
    if (!Array.isArray(values) || values.length === 0) throw new BadRequestException('At least one permission is required');
    const permissions = [...new Set(values)].filter(isStaffPermission);
    if (permissions.length !== values.length) throw new BadRequestException('Unknown or duplicate staff permission');
    return permissions;
  }

  private assertPermissionCeiling(role: StaffRole, permissions: StaffPermission[]) {
    const ceiling = new Set(ROLE_PERMISSION_CEILING[role]);
    const denied = permissions.filter((permission) => !ceiling.has(permission));
    if (denied.length > 0) throw new ForbiddenException(`Permissions exceed ${role} ceiling: ${denied.join(', ')}`);
  }

  private assertModePermissions(mode: StaffAccessMode, permissions: StaffPermission[]) {
    if (mode === StaffAccessMode.VIEW_AS) {
      const writes = permissions.filter((permission) =>
        !READ_ONLY_SUFFIXES.some((suffix) => permission.endsWith(suffix))
        && permission !== StaffPermission.DOCUMENT_METADATA_READ,
      );
      if (writes.length > 0) throw new ForbiddenException(`VIEW_AS is read-only: ${writes.join(', ')}`);
      if (!permissions.includes(StaffPermission.CABINET_VIEW_AS)) throw new BadRequestException('VIEW_AS requires cabinet:view-as');
    }
    if (mode === StaffAccessMode.BREAK_GLASS && permissions.some((permission) => permission.startsWith('payment:'))) {
      throw new ForbiddenException('Break-glass cannot grant payment authority');
    }
  }

  private async validateTargetScope(
    user: RequestUser,
    assignmentId: string,
    input: RequestStaffAccessInput,
  ) {
    const customerMode = input.accessMode !== StaffAccessMode.CONTROL_PLANE;
    if (customerMode && !input.targetOrganizationId && !input.targetTenantId && !input.targetDealId) {
      throw new BadRequestException('Customer-context access must be scoped to a tenant, organization or deal');
    }
    if (input.targetUserId && !input.targetOrganizationId) {
      throw new BadRequestException('Target user requires target organization');
    }

    const target = await this.repository.resolveTargetScope(this.repository.prisma, {
      actorUserId: user.id,
      assignmentId,
      targetTenantId: input.targetTenantId ?? null,
      targetOrganizationId: input.targetOrganizationId ?? null,
      targetUserId: input.targetUserId ?? null,
    });
    if (!target) {
      throw new ForbiddenException('Target staff access scope could not be verified');
    }

    return {
      tenantId: target.tenant_id,
      organizationId: target.organization_id,
      userId: target.user_id,
    };
  }

  private canAutoApprove(role: StaffRole, mode: StaffAccessMode) {
    return role === StaffRole.PLATFORM_OWNER
      && (mode === StaffAccessMode.CONTROL_PLANE || mode === StaffAccessMode.VIEW_AS);
  }

  private async createGrant(tx: Prisma.TransactionClient, request: StaffAccessRequestRow, now: Date) {
    const grantId = `sag_${randomUUID()}`;
    const expiresAt = new Date(now.getTime() + request.max_duration_seconds * 1000);
    await this.repository.createGrant(tx, { id: grantId, request, startsAt: now, expiresAt });
    const marked = await this.repository.markRequest(tx, {
      id: request.id,
      expectedVersion: request.version,
      status: 'GRANTED',
      reason: 'GRANT_CREATED',
    });
    if (!marked) throw new ConflictException('Access request changed while grant was created');
    return { id: grantId, expiresAt };
  }

  // A staff access token is a bearer credential, so its stored form comes
  // from the opaque token authority under its own purpose. It cannot be
  // presented as an invitation, a password reset or any other token.
  private makeAccessToken() {
    const issued = issueStaffAccessCredential();
    return { token: issued.rawToken, hash: issued.storedDigest };
  }

  private assertGrantActive(grant: StaffGrantRow) {
    const now = new Date();
    if (grant.status !== 'ACTIVE' || grant.starts_at > now || grant.expires_at <= now) {
      throw new ConflictException('Staff grant is not active');
    }
  }

  private toContext(session: StaffSessionRow): StaffAccessContext {
    return {
      accessSessionId: session.id,
      grantId: session.grant_id,
      actorUserId: session.actor_user_id,
      staffRole: session.staff_role as StaffRole,
      accessMode: session.access_mode as StaffAccessMode,
      permissions: this.permissions(session.permissions),
      effectiveTenantId: session.effective_tenant_id,
      effectiveOrganizationId: session.effective_organization_id,
      effectiveUserId: session.effective_user_id,
      effectiveRole: session.effective_role,
      targetDealId: session.target_deal_id,
      reason: session.reason,
      ticketId: session.ticket_id,
      expiresAt: session.expires_at,
    };
  }

  private permissions(value: unknown): StaffPermission[] {
    return Array.isArray(value) ? value.filter(isStaffPermission) : [];
  }

  private async requireRequest(client: StaffSqlClient, id: string, forUpdate: boolean) {
    const request = await this.repository.getAccessRequest(client, id, forUpdate);
    if (!request) throw new NotFoundException('Staff access request not found');
    return request;
  }

  private assertPendingRequest(request: StaffAccessRequestRow) {
    if (request.status !== 'PENDING' || request.expires_at <= new Date()) {
      throw new ConflictException('Staff access request is not pending');
    }
  }

  private async requireCriticalRequest(client: StaffSqlClient, id: string, forUpdate: boolean) {
    const request = await this.repository.getCriticalAction(client, id, forUpdate);
    if (!request) throw new NotFoundException('Critical action request not found');
    return request;
  }

  private requireText(value: unknown, field: string, minLength: number) {
    const normalized = String(value ?? '').trim();
    if (normalized.length < minLength) throw new BadRequestException(`${field} must be at least ${minLength} characters`);
    return normalized.slice(0, 2000);
  }

  private auditCritical(
    tx: Prisma.TransactionClient,
    actor: RequestUser,
    role: StaffRole,
    request: CriticalActionRow,
    action: string,
    reason: string,
    correlationId: string,
    metadata: Record<string, unknown> = {},
  ) {
    return this.audit(tx, {
      actor,
      staffRole: role,
      accessSessionId: request.access_session_id,
      action,
      resourceType: request.resource_type,
      resourceId: request.resource_id,
      outcome: 'SUCCESS',
      reason,
      correlationId,
      metadata: { criticalRequestId: request.id, requestedAction: request.action, ...metadata },
    });
  }

  private async audit(tx: Prisma.TransactionClient, input: {
    actor: RequestUser;
    eventId?: string;
    staffRole: StaffRole;
    accessSessionId?: string | null;
    grantId?: string | null;
    action: string;
    resourceType?: string | null;
    resourceId?: string | null;
    outcome: 'SUCCESS' | 'FAILURE' | 'DENIED';
    reason?: string | null;
    ticketId?: string | null;
    correlationId: string;
    metadata?: Record<string, unknown>;
  }) {
    const prevHash = await this.repository.latestEventHash(tx, input.actor.id);
    const eventId = input.eventId ?? `sae_${randomUUID()}`;
    const payload = {
      id: eventId,
      actorUserId: input.actor.id,
      staffRole: input.staffRole,
      accessSessionId: input.accessSessionId ?? null,
      grantId: input.grantId ?? null,
      action: input.action,
      resourceType: input.resourceType ?? null,
      resourceId: input.resourceId ?? null,
      outcome: input.outcome,
      reason: input.reason ?? null,
      ticketId: input.ticketId ?? null,
      correlationId: input.correlationId,
      metadata: input.metadata ?? {},
      prevHash,
    };
    const hash = sha256(stableJson(payload));
    await this.repository.insertEvent(tx, {
      ...payload,
      effectiveTenantId: input.metadata?.targetTenantId as string | undefined,
      effectiveOrganizationId: input.metadata?.targetOrganizationId as string | undefined,
      effectiveUserId: input.metadata?.targetUserId as string | undefined,
      effectiveRole: input.metadata?.targetRole as string | undefined,
      accessMode: input.metadata?.accessMode as string | undefined,
      hash,
    });
  }
}
