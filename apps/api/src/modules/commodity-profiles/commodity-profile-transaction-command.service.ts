import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
} from '@nestjs/common';
import type { RequestUser } from '../../common/types/request-user';
import {
  assertIdempotentReplay,
  commodityProfileCommandFingerprint,
  type CommodityProfileCommand,
  type CommodityProfileCommandReceipt,
  validateCommodityProfileCommand,
} from './commodity-profile-command.contract';
import {
  CommodityProfileAction,
  decideCommodityProfileAction,
  type CommodityProfileClassification,
  type CommodityProfileLifecycle,
} from './commodity-profile.policy';

export const COMMODITY_PROFILE_TRANSACTION_PORT = Symbol(
  'COMMODITY_PROFILE_TRANSACTION_PORT',
);

export type CommodityProfileCommandSnapshot = {
  profileId: string;
  profileVersionId?: string;
  lifecycle?: CommodityProfileLifecycle;
  classification: CommodityProfileClassification;
  version: string;
};

export type CommodityProfileAtomicWrite = {
  command: CommodityProfileCommand;
  actor: RequestUser;
  requestFingerprint: string;
  fromLifecycle?: CommodityProfileLifecycle;
  toLifecycle?: CommodityProfileLifecycle;
};

export interface CommodityProfileTransactionPort {
  findReplay(
    actor: RequestUser,
    command: CommodityProfileCommand,
  ): Promise<CommodityProfileCommandReceipt | null>;
  loadSnapshot(
    actor: RequestUser,
    command: CommodityProfileCommand,
  ): Promise<CommodityProfileCommandSnapshot>;
  commitAtomic(write: CommodityProfileAtomicWrite): Promise<CommodityProfileCommandReceipt>;
}

const TARGET_LIFECYCLE: Partial<Record<CommodityProfileCommand['action'], CommodityProfileLifecycle>> = {
  [CommodityProfileAction.CREATE_DRAFT]: 'DRAFT',
  [CommodityProfileAction.UPDATE_DRAFT]: 'DRAFT',
  [CommodityProfileAction.SUBMIT_REVIEW]: 'REVIEW',
  [CommodityProfileAction.APPROVE]: 'APPROVED',
  [CommodityProfileAction.ACTIVATE]: 'EFFECTIVE',
  [CommodityProfileAction.DEPRECATE]: 'DEPRECATED',
  [CommodityProfileAction.REVOKE]: 'REVOKED',
};

@Injectable()
export class CommodityProfileTransactionCommandService {
  constructor(
    @Inject(COMMODITY_PROFILE_TRANSACTION_PORT)
    private readonly port: CommodityProfileTransactionPort,
  ) {}

  async execute(
    user: RequestUser,
    command: CommodityProfileCommand,
    options: { hasJitAuthority?: boolean } = {},
  ): Promise<CommodityProfileCommandReceipt> {
    validateCommodityProfileCommand(command);
    const requestFingerprint = commodityProfileCommandFingerprint(command);

    const replay = await this.port.findReplay(user, command);
    if (replay) {
      assertIdempotentReplay(replay.requestFingerprint, command);
      return { ...replay, replayed: true };
    }

    const snapshot = await this.port.loadSnapshot(user, command);
    if (snapshot.profileId !== command.profileId) {
      throw new ConflictException({ code: 'COMMODITY_PROFILE_IDENTITY_CONFLICT' });
    }
    if (snapshot.version !== command.expectedVersion) {
      throw new ConflictException({
        code: 'COMMODITY_PROFILE_STALE_VERSION',
        currentVersion: snapshot.version,
        refreshRequired: true,
      });
    }

    const decision = decideCommodityProfileAction({
      user,
      action: command.action,
      lifecycle: snapshot.lifecycle,
      classification: snapshot.classification,
      hasJitAuthority: Boolean(options.hasJitAuthority),
      hasHumanReason: command.reason.trim().length >= 10,
    });
    if (!decision.allowed) {
      throw new ForbiddenException({ code: decision.reasonCode });
    }

    return this.port.commitAtomic({
      command,
      actor: user,
      requestFingerprint,
      fromLifecycle: snapshot.lifecycle,
      toLifecycle: TARGET_LIFECYCLE[command.action],
    });
  }
}
