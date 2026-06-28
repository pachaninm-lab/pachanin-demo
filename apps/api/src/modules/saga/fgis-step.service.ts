import { Injectable, Logger } from '@nestjs/common';
import { DealSagaService } from './deal-saga.service';
import { integrationRegistry } from '../../../../packages/integration-sdk/src/registry';
import type { MockFgisZernoAdapter } from '../../../../packages/integration-sdk/src/adapters/fgis-zerno.adapter';

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

@Injectable()
export class FgisStepService {
  private readonly logger = new Logger(FgisStepService.name);

  constructor(private readonly saga: DealSagaService) {}

  async executeFgisRegister(params: FgisRegisterParams): Promise<FgisRegisterResult> {
    const { dealId, culture, cropClass, volumeTons, producerInn, regionCode, gost } = params;

    this.saga.advance(dealId, 'fgis_register', { culture, volumeTons, producerInn });

    try {
      const adapter = integrationRegistry.get<MockFgisZernoAdapter>('FGIS_ZERNO');

      const { fgisLotId } = await adapter.registerLot({
        id: dealId,
        culture,
        cropClass,
        volumeTons,
        producerInn,
        regionCode,
        gost,
      });

      this.logger.log(`FGIS lot registered: deal=${dealId} fgisLotId=${fgisLotId}`);

      const status = await adapter.getLotStatus(fgisLotId);
      const certificate = await adapter.getCertificate(fgisLotId);

      const result: FgisRegisterResult = {
        dealId,
        fgisLotId,
        fgisStatus: status.status,
        registeredAt: new Date().toISOString(),
        certificate: {
          certificateNumber: certificate.certificateNumber,
          issuedAt: certificate.issuedAt,
          validUntil: certificate.validUntil,
        },
      };

      this.saga.complete(dealId, 'fgis_register', {
        fgisLotId,
        fgisStatus: status.status,
        certificateNumber: certificate.certificateNumber,
      });

      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`FGIS registration failed: deal=${dealId} error=${message}`);
      this.saga.fail(dealId, 'fgis_register', message);
      throw err;
    }
  }

  async confirmShipment(params: {
    dealId: string;
    fgisLotId: string;
    vehicleNumber: string;
    driverName: string;
    routeFrom: string;
    routeTo: string;
    loadedTons: number;
  }): Promise<{ confirmed: boolean; fgisLotId: string }> {
    const adapter = integrationRegistry.get<MockFgisZernoAdapter>('FGIS_ZERNO');
    await adapter.confirmShipment({
      ...params,
      departedAt: new Date().toISOString(),
    });
    return { confirmed: true, fgisLotId: params.fgisLotId };
  }

  async confirmAcceptance(params: {
    dealId: string;
    fgisLotId: string;
    receiverInn: string;
    acceptedTons: number;
    quality: Record<string, number>;
  }): Promise<{ confirmed: boolean; fgisLotId: string }> {
    const adapter = integrationRegistry.get<MockFgisZernoAdapter>('FGIS_ZERNO');
    await adapter.confirmAcceptance({
      fgisLotId: params.fgisLotId,
      receiverInn: params.receiverInn,
      acceptedTons: params.acceptedTons,
      quality: params.quality,
      acceptedAt: new Date().toISOString(),
    });
    return { confirmed: true, fgisLotId: params.fgisLotId };
  }

  async getCrops() {
    const adapter = integrationRegistry.get<MockFgisZernoAdapter>('FGIS_ZERNO');
    return adapter.getCrops();
  }
}
