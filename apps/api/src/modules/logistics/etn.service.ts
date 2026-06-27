import { Injectable, Logger } from '@nestjs/common';
import { integrationRegistry } from '../../../../../packages/integration-sdk/src/registry';
import { MockGisEpdAdapter, EtnCreateRequest, EtnDocument } from '../../../../../packages/integration-sdk/src/adapters/gis-epd.adapter';
import { RequestUser } from '../../common/types/request-user';

@Injectable()
export class EtnService {
  private readonly logger = new Logger(EtnService.name);

  private get gisEpd(): MockGisEpdAdapter {
    return integrationRegistry.get<MockGisEpdAdapter>('GIS_EPD');
  }

  async createEtn(params: EtnCreateRequest, user: RequestUser): Promise<EtnDocument> {
    this.logger.log(`Creating ETN for deal ${params.dealId} by user ${user.id}`);
    const doc = await this.gisEpd.createEtn(params);
    return doc;
  }

  async signEtn(
    etnId: string,
    signerRole: 'SHIPPER' | 'CARRIER' | 'CONSIGNEE',
    certificateId: string,
    user: RequestUser,
  ): Promise<EtnDocument> {
    return this.gisEpd.signEtn({
      etnId,
      signerRole,
      signatureBase64: `mock-sig-${user.id}-${Date.now()}`,
      certificateId,
    });
  }

  async getEtnStatus(etnId: string): Promise<EtnDocument> {
    return this.gisEpd.getStatus(etnId);
  }

  async listByDeal(dealId: string): Promise<EtnDocument[]> {
    return this.gisEpd.listByDeal(dealId);
  }
}
