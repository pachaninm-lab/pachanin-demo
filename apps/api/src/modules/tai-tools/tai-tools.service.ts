import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { RequestUser, Role } from '../../common/types/request-user';
import { IndustrialDealCommandGateway } from '../deals/industrial-deal-command.gateway';
import { TaiDelegatedIdentity, TaiPlatformToolName } from './tai-tool-assertion';

type JsonRecord = Record<string, unknown>;

type ToolBody = {
  readonly arguments?: unknown;
};

function record(value: unknown, name: string): JsonRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new BadRequestException({ code: 'TAI_TOOL_ARGUMENTS_INVALID', field: name });
  }
  return value as JsonRecord;
}

function boundedRecord(value: unknown, name: string): JsonRecord {
  const result = record(value, name);
  const serialized = JSON.stringify(result);
  if (Buffer.byteLength(serialized, 'utf8') > 32_768) {
    throw new BadRequestException({ code: 'TAI_TOOL_ARGUMENTS_TOO_LARGE', field: name });
  }
  return result;
}

function exactKeys(value: JsonRecord, allowed: readonly string[]): void {
  const keys = Object.keys(value);
  if (keys.some((key) => !allowed.includes(key))) {
    throw new BadRequestException({ code: 'TAI_TOOL_ARGUMENTS_UNEXPECTED' });
  }
}

function requiredPortable(value: JsonRecord, name: string): string {
  const raw = value[name];
  if (typeof raw !== 'string' || !/^[A-Za-z0-9._:-]{1,160}$/.test(raw)) {
    throw new BadRequestException({ code: 'TAI_TOOL_ARGUMENT_INVALID', field: name });
  }
  return raw;
}

function optionalPortable(value: JsonRecord, name: string): string | undefined {
  if (value[name] === undefined) return undefined;
  return requiredPortable(value, name);
}

function requiredIso(value: JsonRecord, name: string): string {
  const raw = value[name];
  if (
    typeof raw !== 'string' ||
    raw.length > 64 ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/.test(raw) ||
    !Number.isFinite(new Date(raw).getTime())
  ) {
    throw new BadRequestException({ code: 'TAI_TOOL_ARGUMENT_INVALID', field: name });
  }
  return raw;
}

function requiredVersion(value: JsonRecord, name: string): string {
  const raw = value[name];
  if (typeof raw !== 'string' || !/^(?:0|[1-9][0-9]{0,19})$/.test(raw)) {
    throw new BadRequestException({ code: 'TAI_TOOL_ARGUMENT_INVALID', field: name });
  }
  return raw;
}

function delegatedUser(identity: TaiDelegatedIdentity): RequestUser {
  if (!identity.tenantId) {
    throw new ForbiddenException({ code: 'TENANT_CONTEXT_REQUIRED' });
  }
  return {
    id: identity.userId,
    email: 'tai-delegated@system.invalid',
    orgId: 'tai-delegated',
    role: Role.GUEST,
    tenantId: identity.tenantId,
    sessionId: identity.sessionId,
    mfaVerified: false,
  };
}

function workspaceRecord(value: unknown): JsonRecord {
  return record(value, 'workspace');
}

function unreachable(value: never): never {
  throw new BadRequestException({
    code: 'TAI_TOOL_NOT_REGISTERED',
    toolName: String(value),
  });
}

@Injectable()
export class TaiToolsService {
  constructor(private readonly deals: IndustrialDealCommandGateway) {}

  async execute(
    toolName: TaiPlatformToolName,
    body: ToolBody,
    identity: TaiDelegatedIdentity,
  ): Promise<JsonRecord> {
    const args = boundedRecord(body.arguments ?? {}, 'arguments');
    const user = delegatedUser(identity);
    switch (toolName) {
      case 'getDealSummary':
        return this.getDealSummary(args, user);
      case 'getRoleNextActions':
        return this.getRoleNextActions(args, user);
      case 'prepareCommandDraft':
        return this.prepareCommandDraft(args, user, identity);
      case 'assignLogistics':
        return this.assignLogistics(args, user, identity);
      default:
        return unreachable(toolName);
    }
  }

  private async getDealSummary(args: JsonRecord, user: RequestUser): Promise<JsonRecord> {
    exactKeys(args, ['dealId']);
    const dealId = requiredPortable(args, 'dealId');
    const workspace = workspaceRecord(await this.deals.workspace(dealId, user));
    return {
      schemaVersion: 'platform.deal-summary.v1',
      deal: workspace.deal ?? null,
      roleProjection: workspace.roleProjection ?? null,
      attention: workspace.attention ?? null,
      blockers: workspace.blockers ?? [],
      money: workspace.money ?? null,
      spine: workspace.spine ?? [],
    };
  }

  private async getRoleNextActions(
    args: JsonRecord,
    user: RequestUser,
  ): Promise<JsonRecord> {
    exactKeys(args, ['dealId']);
    const dealId = requiredPortable(args, 'dealId');
    const workspace = workspaceRecord(await this.deals.workspace(dealId, user));
    return {
      schemaVersion: 'platform.role-next-actions.v1',
      dealId,
      deal: workspace.deal ?? null,
      roleProjection: workspace.roleProjection ?? null,
      attention: workspace.attention ?? null,
      blockers: workspace.blockers ?? [],
    };
  }

  private async prepareCommandDraft(
    args: JsonRecord,
    user: RequestUser,
    identity: TaiDelegatedIdentity,
  ): Promise<JsonRecord> {
    exactKeys(args, ['dealId', 'actionId', 'payload']);
    const dealId = requiredPortable(args, 'dealId');
    const requestedAction = optionalPortable(args, 'actionId');
    const payload =
      args.payload === undefined ? {} : boundedRecord(args.payload, 'payload');
    const workspace = workspaceRecord(await this.deals.workspace(dealId, user));
    const roleProjection = record(workspace.roleProjection, 'roleProjection');
    const primaryAction = record(roleProjection.primaryAction, 'primaryAction');
    const actionId = requiredPortable(primaryAction, 'id');
    if (requestedAction && requestedAction !== actionId) {
      throw new BadRequestException({ code: 'TAI_TOOL_ACTION_NOT_CURRENT' });
    }
    if (primaryAction.enabled !== true || primaryAction.source !== 'USER') {
      throw new ForbiddenException({ code: 'TAI_TOOL_ACTION_NOT_EXECUTABLE' });
    }
    const deal = record(workspace.deal, 'deal');
    const updatedAt = deal.updatedAt;
    const version = deal.version;
    if (typeof updatedAt !== 'string' || !updatedAt.trim()) {
      throw new BadRequestException({ code: 'TAI_TOOL_DEAL_VERSION_MISSING' });
    }
    if (typeof version !== 'string' && typeof version !== 'number') {
      throw new BadRequestException({ code: 'TAI_TOOL_DEAL_VERSION_MISSING' });
    }
    return {
      schemaVersion: 'platform.deal-command-draft.v1',
      dealId,
      actionId,
      method: 'POST',
      endpoint: `/deals/${dealId}/commands/${actionId}`,
      commandId: `tai:${identity.traceId}:${identity.callId}`,
      idempotencyKey: identity.idempotencyKey,
      expectedUpdatedAt: updatedAt,
      expectedVersion: String(version),
      payload,
      requiresExplicitUserConfirmation: true,
      generatedFromStatus: deal.status ?? null,
      role: roleProjection.role ?? null,
    };
  }

  private async assignLogistics(
    args: JsonRecord,
    user: RequestUser,
    identity: TaiDelegatedIdentity,
  ): Promise<JsonRecord> {
    if (identity.mode !== 'CONFIRMED_WRITE' || identity.toolName !== 'assignLogistics') {
      throw new ForbiddenException({ code: 'TAI_CONFIRMED_WRITE_AUTHORITY_REQUIRED' });
    }
    exactKeys(args, [
      'dealId',
      'carrierOrgId',
      'driverUserId',
      'vehicleId',
      'routeFromFacilityId',
      'routeToFacilityId',
      'expectedUpdatedAt',
      'expectedVersion',
    ]);
    const dealId = requiredPortable(args, 'dealId');
    const carrierOrgId = requiredPortable(args, 'carrierOrgId');
    const driverUserId = requiredPortable(args, 'driverUserId');
    const vehicleId = requiredPortable(args, 'vehicleId');
    const routeFromFacilityId = requiredPortable(args, 'routeFromFacilityId');
    const routeToFacilityId = requiredPortable(args, 'routeToFacilityId');
    const expectedUpdatedAt = requiredIso(args, 'expectedUpdatedAt');
    const expectedVersion = requiredVersion(args, 'expectedVersion');
    const result = await this.deals.executeUser(
      dealId,
      'assign_logistics',
      {
        commandId: `tai:${identity.traceId}:${identity.callId}`,
        idempotencyKey: identity.idempotencyKey,
        expectedUpdatedAt,
        expectedVersion,
        payload: {
          carrierOrgId,
          driverUserId,
          vehicleId,
          routeFromFacilityId,
          routeToFacilityId,
        },
      },
      user,
    );
    return {
      schemaVersion: 'platform.assign-logistics-result.v1',
      authority: 'TAI_CONFIRMED_WRITE',
      ...record(result, 'result'),
    };
  }
}
