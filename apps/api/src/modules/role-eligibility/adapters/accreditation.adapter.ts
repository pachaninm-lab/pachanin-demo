import { Injectable } from '@nestjs/common';
import type { RegistryAdapterFetchResult } from '../role-eligibility.types';
import { EligibilitySourceError } from '../role-eligibility.types';

/**
 * Rosaccreditation's public RAL is an official reviewer source, but no stable
 * public production machine interface was proven for this contour. Automated
 * HTML scraping, CAPTCHA bypass and undocumented private APIs are forbidden.
 */
@Injectable()
export class AccreditationAdapter {
  readonly source = 'ROSACCREDITATION' as const;
  readonly sourceName = 'Росаккредитация — реестр аккредитованных лиц';
  readonly officialRegistry = 'https://pub.fsa.gov.ru/ral';

  async fetchGeneration(): Promise<RegistryAdapterFetchResult> {
    throw new EligibilitySourceError(
      'ROSACCREDITATION',
      'ROSACCREDITATION_MACHINE_CONTRACT_NOT_PROVEN',
      'UNAVAILABLE',
    );
  }
}
