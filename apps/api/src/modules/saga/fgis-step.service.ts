import { Injectable } from '@nestjs/common';
import {
  FGIS_LEGACY_ERROR_CODES,
  denyLegacyFgisActionOnBehalfOfClient,
} from '../regulatory-integration/fgis-grain/fgis-grain-legacy-quarantine';
import { FgisLegacyQuarantineAuditService } from '../regulatory-integration/fgis-grain/fgis-grain-legacy-quarantine.audit';
import type { RequestUser } from '../../common/types/request-user';

/**
 * P0.2-1A — the ФГИС «Зерно» saga steps are retired.
 *
 * These steps were reachable by `ADMIN` and `SUPPORT_MANAGER` and called the
 * mock ФГИС adapter, so platform staff could produce a "registered lot",
 * "confirmed shipment" or "issued certificate" for someone else's deal. Two
 * things were wrong with that at once:
 *
 *   - the adapter was a mock, so the result was synthetic and no external
 *     register ever saw the request;
 *   - registering a lot and confirming shipment or acceptance are legally
 *     significant acts of the participating organization. Even against a real
 *     provider, platform staff are not the party entitled to perform them, and
 *     the platform's transport signature does not grant that right.
 *
 * Every step now fails closed and the attempt is committed to the durable audit
 * trail against the staff member who made it. The saga step id stays in the
 * lifecycle so existing deals keep a readable history; only the write path is
 * withdrawn. The `integrationRegistry` import is gone on purpose — the mock
 * ФГИС adapter must not be reachable from the production module graph at all.
 */

export interface FgisRegisterParams {
  dealId: string;
  culture: string;
  cropClass: string;
  volumeTons: number;
  producerInn: string;
  regionCode: string;
  gost: string;
}

export interface FgisRegisterResult {
  dealId: string;
  fgisLotId: string;
  fgisStatus: string;
  registeredAt: string;
  certificate?: {
    certificateNumber: string;
    issuedAt: string;
    validUntil: string;
  };
}

const REGISTRATION_NEXT_STEP =
  'Продавец подключает организацию к ФГИС «Зерно» и создаёт лот из подтверждённой партии в своём кабинете.';

@Injectable()
export class FgisStepService {
  constructor(private readonly quarantineAudit: FgisLegacyQuarantineAuditService) {}

  /**
   * Denied before the saga is touched: a refused command must not advance,
   * complete or fail a step, because each of those writes deal history.
   *
   * `actor` is required rather than optional. These routes are staff-only, and
   * recording a staff attempt as `anonymous` would defeat the reason for
   * auditing it at all.
   */
  async executeFgisRegister(
    params: FgisRegisterParams,
    actor: RequestUser,
  ): Promise<FgisRegisterResult> {
    return denyLegacyFgisActionOnBehalfOfClient({
      code: FGIS_LEGACY_ERROR_CODES.SAGA_RETIRED,
      message:
        'Регистрация партии во ФГИС «Зерно» сотрудником платформы отключена. ' +
        'Это юридически значимое действие организации-участника.',
      nextStep: REGISTRATION_NEXT_STEP,
      route: `POST /saga/deals/${params.dealId}/execute/fgis_register`,
      actor,
      audit: this.quarantineAudit,
    });
  }

  async confirmShipment(
    params: {
      dealId: string;
      fgisLotId: string;
      vehicleNumber: string;
      driverName: string;
      routeFrom: string;
      routeTo: string;
      loadedTons: number;
    },
    actor: RequestUser,
  ): Promise<{ confirmed: boolean; fgisLotId: string }> {
    return denyLegacyFgisActionOnBehalfOfClient({
      code: FGIS_LEGACY_ERROR_CODES.SAGA_RETIRED,
      message:
        'Подтверждение отгрузки во ФГИС «Зерно» сотрудником платформы отключено. ' +
        'СДИЗ подписывает участник сделки, а не платформа.',
      nextStep: REGISTRATION_NEXT_STEP,
      route: `POST /saga/deals/${params.dealId}/fgis/confirm-shipment`,
      actor,
      audit: this.quarantineAudit,
    });
  }

  async confirmAcceptance(
    params: {
      dealId: string;
      fgisLotId: string;
      receiverInn: string;
      acceptedTons: number;
      quality: Record<string, number>;
    },
    actor: RequestUser,
  ): Promise<{ confirmed: boolean; fgisLotId: string }> {
    return denyLegacyFgisActionOnBehalfOfClient({
      code: FGIS_LEGACY_ERROR_CODES.SAGA_RETIRED,
      message:
        'Подтверждение приёмки во ФГИС «Зерно» сотрудником платформы отключено. ' +
        'Это юридически значимое действие организации-получателя.',
      nextStep: REGISTRATION_NEXT_STEP,
      route: `POST /saga/deals/${params.dealId}/fgis/confirm-acceptance`,
      actor,
      audit: this.quarantineAudit,
    });
  }

  /**
   * Also denied: the crop dictionary came from the same mock and returned
   * invented codes. Presenting them as ФГИС reference data would put synthetic
   * values into a seller's lot.
   */
  async getCrops(actor: RequestUser | null): Promise<never> {
    return denyLegacyFgisActionOnBehalfOfClient({
      code: FGIS_LEGACY_ERROR_CODES.SAGA_RETIRED,
      message:
        'Справочник культур ФГИС «Зерно» по этому маршруту недоступен: ' +
        'прежние значения были синтетическими.',
      nextStep:
        'Справочники читаются каноническими операциями официального контракта после подключения организации.',
      route: 'GET /saga/fgis/crops',
      actor,
      audit: this.quarantineAudit,
    });
  }
}
