import type { EligibilitySource, RegistryAdapterFetchResult } from '../role-eligibility.types';

export interface RoleEligibilityRegistryAdapter {
  readonly source: EligibilitySource;
  fetchGeneration(): Promise<RegistryAdapterFetchResult>;
}
