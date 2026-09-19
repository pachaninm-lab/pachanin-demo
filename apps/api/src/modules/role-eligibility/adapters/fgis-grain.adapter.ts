import { Injectable } from '@nestjs/common';
import type { RegistryAdapterFetchResult } from '../role-eligibility.types';
import { EligibilitySourceError } from '../role-eligibility.types';

/**
 * The Ministry of Agriculture exposes the elevator registry as FGISS Grain
 * open data. The public dataset endpoint is not treated as authoritative by
 * this runtime until its transport and parser contract can be fetched and
 * validated end-to-end. No mirror, search cache or unofficial API is used.
 */
@Injectable()
export class FgisGrainAdapter {
  readonly source = 'FGIS_GRAIN' as const;
  readonly sourceName = 'ФГИС «Зерно» — реестр элеваторов';
  readonly officialDataset = 'https://opendata.mcx.ru/opendata/7708075454-zerno';

  async fetchGeneration(): Promise<RegistryAdapterFetchResult> {
    throw new EligibilitySourceError(
      'FGIS_GRAIN',
      'FGIS_GRAIN_OFFICIAL_DATASET_TRANSPORT_NOT_PROVEN',
      'UNAVAILABLE',
    );
  }
}
