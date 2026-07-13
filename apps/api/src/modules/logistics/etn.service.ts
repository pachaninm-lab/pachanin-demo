import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import type {
  EtnCreateRequest,
  EtnDocument,
} from '../../../../../packages/integration-sdk/src/adapters/gis-epd.adapter';
import type { RequestUser } from '../../common/types/request-user';

/**
 * GIS EPD is not an active production integration. The API remains explicit and
 * fail-closed so callers cannot mistake a simulator result for a legally valid
 * electronic transport document or signature.
 */
@Injectable()
export class EtnService {
  createEtn(_params: EtnCreateRequest, _user: RequestUser): Promise<EtnDocument> {
    return integrationNotActivated('GIS_EPD_CREATE');
  }

  signEtn(
    _etnId: string,
    _signerRole: 'SHIPPER' | 'CARRIER' | 'CONSIGNEE',
    _certificateId: string,
    _user: RequestUser,
  ): Promise<EtnDocument> {
    return integrationNotActivated('GIS_EPD_SIGNATURE');
  }

  getEtnStatus(_etnId: string): Promise<EtnDocument> {
    return integrationNotActivated('GIS_EPD_STATUS');
  }

  listByDeal(_dealId: string): Promise<EtnDocument[]> {
    return integrationNotActivated('GIS_EPD_LIST');
  }
}

function integrationNotActivated(capability: string): never {
  throw new ServiceUnavailableException({
    code: 'INTEGRATION_NOT_ACTIVATED',
    capability,
    message: 'GIS EPD has not completed contract, credential and conformance activation.',
  });
}
