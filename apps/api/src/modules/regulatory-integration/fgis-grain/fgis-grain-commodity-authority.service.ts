import { ForbiddenException, Injectable } from '@nestjs/common';
import type { RequestUser } from '../../../common/types/request-user';
import { Role } from '../../../common/types/request-user';
import {
  assertAcceptFgisCommodityPartySnapshotInput,
  assertBindFgisCommodityConnectionInput,
  assertCreateFgisLotPassportInput,
  assertOpenFgisCommodityReconciliationCaseInput,
  assertReserveFgisCommodityVolumeInput,
  assertSealFgisLotPassportInput,
  assertStartFgisCommoditySyncRunInput,
  assertTransitionFgisCommodityReservationInput,
  type FgisCommodityCommandReceipt,
} from './fgis-grain-commodity-authority.contract';
import { FgisGrainCommodityAuthorityRepository } from './fgis-grain-commodity-authority.repository';

/**
 * Reservation receipts are PostgreSQL-owned JSON objects whose accepted and
 * denied variants expose different command-specific fields. The repository
 * still validates the common durable boundary (`ok`, `auditId`, `duplicate`)
 * before returning. Widening only this service return avoids pretending every
 * reservation outcome contains the same optional domain properties.
 */
type ReservationCommandReceipt = Readonly<Record<string, unknown>>;

function requireAdminMfa(user: RequestUser): void {
  if (user.role !== Role.ADMIN) {
    throw new ForbiddenException('FGIS commodity connection management requires organization admin');
  }
  if (user.mfaVerified !== true) {
    throw new ForbiddenException('MFA is required for FGIS commodity connection management');
  }
}

function requireSeller(user: RequestUser): void {
  if (user.role !== Role.FARMER) {
    throw new ForbiddenException('FGIS commodity reservation is available only to an admitted seller');
  }
}

function requireInternalSnapshotAuthority(user: RequestUser): void {
  // A human administrator can initiate synchronization, but cannot manufacture
  // provider evidence or persist an FGIS-backed party. Only the canonical
  // server-side normalizer may call this command after the verified provider
  // response has been durably accepted. The role is server-derived and must
  // never be assigned through a user membership or client-controlled claim.
  if (user.role !== Role.FGIS_GRAIN_PROVIDER) {
    throw new ForbiddenException(
      'FGIS party snapshot ingestion requires the server-side verified provider principal',
    );
  }
  if (user.sessionId || user.membershipId) {
    throw new ForbiddenException(
      'FGIS provider principal cannot use a human session or organization membership',
    );
  }
}

@Injectable()
export class FgisGrainCommodityAuthorityService {
  constructor(private readonly repository: FgisGrainCommodityAuthorityRepository) {}

  async bindConnection(user: RequestUser, raw: unknown): Promise<FgisCommodityCommandReceipt> {
    requireAdminMfa(user);
    return this.repository.bindConnection(
      user,
      assertBindFgisCommodityConnectionInput(raw),
    );
  }

  async startSyncRun(user: RequestUser, raw: unknown): Promise<FgisCommodityCommandReceipt> {
    if (user.role === Role.ADMIN) {
      if (user.mfaVerified !== true) {
        throw new ForbiddenException('MFA is required for admin-initiated FGIS synchronization');
      }
    } else {
      requireSeller(user);
    }
    return this.repository.startSyncRun(user, assertStartFgisCommoditySyncRunInput(raw));
  }

  async acceptPartySnapshot(
    user: RequestUser,
    raw: unknown,
  ): Promise<FgisCommodityCommandReceipt> {
    requireInternalSnapshotAuthority(user);
    return this.repository.acceptPartySnapshot(
      user,
      assertAcceptFgisCommodityPartySnapshotInput(raw),
    );
  }

  async reserveVolume(user: RequestUser, raw: unknown): Promise<ReservationCommandReceipt> {
    requireSeller(user);
    return this.repository.reserveVolume(user, assertReserveFgisCommodityVolumeInput(raw));
  }

  async transitionReservation(
    user: RequestUser,
    raw: unknown,
  ): Promise<FgisCommodityCommandReceipt> {
    if (user.role !== Role.FARMER && user.role !== Role.ADMIN) {
      throw new ForbiddenException('Reservation transition is not permitted');
    }
    if (user.role === Role.ADMIN && user.mfaVerified !== true) {
      throw new ForbiddenException('MFA is required for administrative reservation transition');
    }
    return this.repository.transitionReservation(
      user,
      assertTransitionFgisCommodityReservationInput(raw),
    );
  }

  async createLotPassport(
    user: RequestUser,
    raw: unknown,
  ): Promise<FgisCommodityCommandReceipt> {
    requireSeller(user);
    return this.repository.createLotPassport(user, assertCreateFgisLotPassportInput(raw));
  }

  async sealLotPassport(
    user: RequestUser,
    raw: unknown,
  ): Promise<FgisCommodityCommandReceipt> {
    requireSeller(user);
    return this.repository.sealLotPassport(user, assertSealFgisLotPassportInput(raw));
  }

  async openReconciliationCase(
    user: RequestUser,
    raw: unknown,
  ): Promise<FgisCommodityCommandReceipt> {
    if (user.role !== Role.ADMIN && user.role !== Role.COMPLIANCE_OFFICER) {
      throw new ForbiddenException('FGIS reconciliation authority is not permitted');
    }
    if (user.mfaVerified !== true) {
      throw new ForbiddenException('MFA is required for FGIS reconciliation authority');
    }
    return this.repository.openReconciliationCase(
      user,
      assertOpenFgisCommodityReconciliationCaseInput(raw),
    );
  }
}
