import { Injectable } from '@nestjs/common';
import type { RegistryAdapterFetchResult } from '../role-eligibility.types';
import { EligibilitySourceError } from '../role-eligibility.types';

/**
 * FNS publishes a documented machine-to-machine EGRUL/EGRIP integration
 * contract, but ordinary legal/physical persons receive that bulk access under
 * paid subscriber terms. The free single-entity UI is not a documented API and
 * must not be reverse engineered. Until a zero-cost official machine contract
 * or an already-authorized official file feed is provisioned, this adapter is
 * deliberately fail-closed.
 */
@Injectable()
export class FnsEvidenceAdapter {
  readonly source = 'FNS' as const;
  readonly sourceName = 'ФНС России — ЕГРЮЛ/ЕГРИП';
  readonly officialDocumentation = 'https://www.nalog.gov.ru/rn77/service/egrip2/egrip_vzayim/';

  async fetchGeneration(): Promise<RegistryAdapterFetchResult> {
    throw new EligibilitySourceError(
      'FNS',
      'FNS_ZERO_COST_MACHINE_CONTRACT_NOT_PROVEN',
      'UNAVAILABLE',
    );
  }
}
