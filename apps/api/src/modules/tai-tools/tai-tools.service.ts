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

/**
 * The workspace omits a collection when the deal has none, so an absent key is
 * an empty projection rather than a malformed one.
 */
function collection(value: unknown, name: string): readonly JsonRecord[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) {
    throw new BadRequestException({ code: 'TAI_TOOL_WORKSPACE_INVALID', field: name });
  }
  return value.filter(
    (item): item is JsonRecord =>
      Boolean(item) && typeof item === 'object' && !Array.isArray(item),
  );
}

function stringList(value: unknown): readonly string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string');
}

/** Narrow a collection to one entry when the caller named it, keeping the shape stable. */
function selected(
  entries: readonly JsonRecord[],
  id: string | undefined,
): readonly JsonRecord[] {
  if (id === undefined) return entries;
  return entries.filter((entry) => String(entry.id) === id);
}

/**
 * Timelines grow without bound, and the TAI adapter refuses a response over its byte
 * budget. Returning the most recent slice with an explicit count keeps a long-running
 * deal answerable instead of unreadable.
 */
const MAX_TIMELINE_EVENTS = 100;

function recentTimeline(entries: readonly JsonRecord[]): {
  events: readonly JsonRecord[];
  totalCount: number;
  truncated: boolean;
} {
  const truncated = entries.length > MAX_TIMELINE_EVENTS;
  return {
    events: truncated ? entries.slice(-MAX_TIMELINE_EVENTS) : entries,
    totalCount: entries.length,
    truncated,
  };
}

const CLOSED_DISPUTE_STATUSES = ['RESOLVED', 'CLOSED', 'CANCELLED'];

function isOpenDispute(dispute: JsonRecord): boolean {
  return !CLOSED_DISPUTE_STATUSES.includes(String(dispute.status));
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
      case 'getDealRisks':
        return this.getDealRisks(args, user);
      case 'getDocumentStatus':
        return this.getDocumentStatus(args, user);
      case 'getLogisticsStatus':
        return this.getLogisticsStatus(args, user);
      case 'getLaboratoryStatus':
        return this.getLaboratoryStatus(args, user);
      case 'getMoneyReadiness':
        return this.getMoneyReadiness(args, user);
      case 'getDisputeStatus':
        return this.getDisputeStatus(args, user);
      case 'getEvidenceTimeline':
        return this.getEvidenceTimeline(args, user);
      case 'prepareCommandDraft':
        return this.prepareCommandDraft(args, user, identity);
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

  private async getDealRisks(args: JsonRecord, user: RequestUser): Promise<JsonRecord> {
    exactKeys(args, ['dealId']);
    const dealId = requiredPortable(args, 'dealId');
    const workspace = workspaceRecord(await this.deals.workspace(dealId, user));
    const disputes = collection(workspace.disputes, 'disputes');
    const money = workspace.money === null ? null : record(workspace.money, 'money');
    return {
      schemaVersion: 'platform.deal-risks.v1',
      dealId,
      status: record(workspace.deal, 'deal').status ?? null,
      attention: workspace.attention ?? null,
      blockers: stringList(workspace.blockers),
      openDisputeCount: disputes.filter(isOpenDispute).length,
      paymentStatus: money?.status ?? null,
      roleProjection: workspace.roleProjection ?? null,
    };
  }

  private async getDocumentStatus(args: JsonRecord, user: RequestUser): Promise<JsonRecord> {
    exactKeys(args, ['dealId', 'documentId']);
    const dealId = requiredPortable(args, 'dealId');
    const documentId = optionalPortable(args, 'documentId');
    const workspace = workspaceRecord(await this.deals.workspace(dealId, user));
    const documents = selected(collection(workspace.documents, 'documents'), documentId);
    return {
      schemaVersion: 'platform.document-status.v1',
      dealId,
      documentId: documentId ?? null,
      documents,
      documentCount: documents.length,
    };
  }

  private async getLogisticsStatus(args: JsonRecord, user: RequestUser): Promise<JsonRecord> {
    exactKeys(args, ['dealId', 'shipmentId']);
    const dealId = requiredPortable(args, 'dealId');
    const shipmentId = optionalPortable(args, 'shipmentId');
    const workspace = workspaceRecord(await this.deals.workspace(dealId, user));
    const shipments = selected(collection(workspace.shipments, 'shipments'), shipmentId);
    return {
      schemaVersion: 'platform.logistics-status.v1',
      dealId,
      shipmentId: shipmentId ?? null,
      shipments,
      shipmentCount: shipments.length,
    };
  }

  private async getLaboratoryStatus(args: JsonRecord, user: RequestUser): Promise<JsonRecord> {
    exactKeys(args, ['dealId', 'sampleId']);
    const dealId = requiredPortable(args, 'dealId');
    const sampleId = optionalPortable(args, 'sampleId');
    const workspace = workspaceRecord(await this.deals.workspace(dealId, user));
    const samples = selected(collection(workspace.laboratory, 'laboratory'), sampleId);
    return {
      schemaVersion: 'platform.laboratory-status.v1',
      dealId,
      sampleId: sampleId ?? null,
      samples,
      sampleCount: samples.length,
      acceptance: collection(workspace.acceptance, 'acceptance'),
    };
  }

  private async getMoneyReadiness(args: JsonRecord, user: RequestUser): Promise<JsonRecord> {
    exactKeys(args, ['dealId']);
    const dealId = requiredPortable(args, 'dealId');
    const workspace = workspaceRecord(await this.deals.workspace(dealId, user));
    const deal = record(workspace.deal, 'deal');
    return {
      schemaVersion: 'platform.money-readiness.v1',
      dealId,
      status: deal.status ?? null,
      totalKopecks: deal.totalKopecks ?? null,
      currency: deal.currency ?? null,
      money: workspace.money ?? null,
      bankOperations: collection(workspace.bankOperations, 'bankOperations'),
      blockers: stringList(workspace.blockers),
    };
  }

  private async getDisputeStatus(args: JsonRecord, user: RequestUser): Promise<JsonRecord> {
    exactKeys(args, ['dealId', 'disputeId']);
    const dealId = requiredPortable(args, 'dealId');
    const disputeId = optionalPortable(args, 'disputeId');
    const workspace = workspaceRecord(await this.deals.workspace(dealId, user));
    const all = collection(workspace.disputes, 'disputes');
    const disputes = selected(all, disputeId);
    return {
      schemaVersion: 'platform.dispute-status.v1',
      dealId,
      disputeId: disputeId ?? null,
      disputes,
      disputeCount: disputes.length,
      openDisputeCount: all.filter(isOpenDispute).length,
    };
  }

  private async getEvidenceTimeline(args: JsonRecord, user: RequestUser): Promise<JsonRecord> {
    exactKeys(args, ['dealId']);
    const dealId = requiredPortable(args, 'dealId');
    const workspace = workspaceRecord(await this.deals.workspace(dealId, user));
    const timeline = recentTimeline(collection(workspace.timeline, 'timeline'));
    return {
      schemaVersion: 'platform.evidence-timeline.v1',
      dealId,
      events: timeline.events,
      eventCount: timeline.totalCount,
      truncated: timeline.truncated,
      returnedCount: timeline.events.length,
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
}
