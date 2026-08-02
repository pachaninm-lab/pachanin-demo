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
  // P0.2-2A does not expose a provider endpoint. Until the official normalizer
  // lands in 3A, only an MFA-backed organization administrator may exercise the
  // persistence command in controlled tests or operations. The future worker
  // receives its own server principal instead of borrowing a human session.
  requireAdminMfa(user);
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

  async reserveVolume(user: RequestUser, raw: unknown): Promise<FgisCommodityCommandReceipt> {
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
