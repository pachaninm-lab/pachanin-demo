import { Injectable } from '@nestjs/common';
import type { RegistryAdapterFetchResult } from '../role-eligibility.types';
import { EligibilitySourceError } from '../role-eligibility.types';

/**
 * FNS publishes an official EGRUL/EGRIP machine-integration contract: full and
 * daily replacement XML files are delivered through the FNS subscriber FTP
 * service. As of 2026-09-05 the current EGRUL format is 4.08, with 4.07 kept as
 * an explicitly bounded transitional format. Ordinary legal/physical persons
 * require subscriber access for that bulk machine feed.
 *
 * The free single-entity FNS services are official human-facing services, but
 * their private browser endpoints are not a documented machine API and must not
 * be reverse engineered. A downloaded official single-entity extract can only
 * become authoritative after its FNS cryptographic provenance is verified.
 *
 * The national feed is intentionally not materialized by this adapter. Once
 * authorized feed credentials/files are provisioned, bounded ZIP/XML parsing
 * and chunked PostgreSQL ingestion are handled by the dedicated EGRUL ingest
 * contour. Until an ACTIVE FNS generation exists, source sync fails closed.
 *
 * Keep the established fail-closed reason code stable: the official bulk feed
 * exists, but a zero-cost machine contract is still not proven/provisioned for
 * this platform. This avoids changing operational semantics before an actual
 * authoritative source is available.
 */
@Injectable()
export class FnsEvidenceAdapter {
  readonly source = 'FNS' as const;
  readonly sourceName = 'ФНС России — ЕГРЮЛ/ЕГРИП';
  readonly officialDocumentation = 'https://www.nalog.gov.ru/rn77/service/egrip2/egrip_vzayim/';
  readonly officialAccessOrder = 'https://www.nalog.gov.ru/rn77/service/egrip2/access_order/';
  readonly supportedEgrulFormats = ['4.08', '4.07'] as const;
  readonly authorizedMachineFeedProvisioned = false;

  async fetchGeneration(): Promise<RegistryAdapterFetchResult> {
    throw new EligibilitySourceError(
      'FNS',
      'FNS_ZERO_COST_MACHINE_CONTRACT_NOT_PROVEN',
      'UNAVAILABLE',
    );
  }
}
