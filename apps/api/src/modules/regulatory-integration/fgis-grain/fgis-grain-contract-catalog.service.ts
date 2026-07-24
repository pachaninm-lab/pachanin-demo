import { Injectable } from '@nestjs/common';
import {
  FGIS_GRAIN_ADAPTER_IDENTITY,
  FGIS_GRAIN_BUSINESS_OPERATIONS,
  FGIS_GRAIN_CATALOG_STATUS,
  FGIS_GRAIN_OPERATIONAL_STATUS,
  getFgisGrainBusinessOperation,
  validateFgisGrainContractEnvelope,
  validateFgisGrainRuntimeEndpoint,
  type FgisGrainContractEnvelopeMetadata,
} from './fgis-grain-1.0.23.contract';
import {
  FGIS_GRAIN_1_0_23_CATALOG_SHA256,
  FGIS_GRAIN_1_0_23_PACKAGE_SHA256,
  type FgisGrainBusinessOperationCode,
} from './fgis-grain-1.0.23.generated';

@Injectable()
export class FgisGrainContractCatalogService {
  readonly identity = FGIS_GRAIN_ADAPTER_IDENTITY;
  readonly catalogStatus = FGIS_GRAIN_CATALOG_STATUS;
  readonly operationalStatus = FGIS_GRAIN_OPERATIONAL_STATUS;
  readonly packageSha256 = FGIS_GRAIN_1_0_23_PACKAGE_SHA256;
  readonly catalogSha256 = FGIS_GRAIN_1_0_23_CATALOG_SHA256;
  readonly operationCount = FGIS_GRAIN_BUSINESS_OPERATIONS.length;

  getOperation(code: FgisGrainBusinessOperationCode) {
    return getFgisGrainBusinessOperation(code);
  }

  validateEnvelope(envelope: FgisGrainContractEnvelopeMetadata) {
    return validateFgisGrainContractEnvelope(envelope);
  }

  validateRuntimeEndpoint(endpoint: string) {
    return validateFgisGrainRuntimeEndpoint(endpoint);
  }
}
