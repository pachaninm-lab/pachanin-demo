import { Injectable } from '@nestjs/common';
import { RoleEligibilityRepository } from './role-eligibility.repository';
import { sha256, stableJson } from './role-eligibility-security';
import type {
  EligibilityCheck,
  EligibilityEvidence,
  EligibilitySource,
  NormalizedOrganizationFacts,
  RoleEligibilityCandidate,
  SourceHealthStatus,
  SourceManifestEntry,
} from './role-eligibility.types';

const SOURCE_NAMES: Record<EligibilitySource, string> = {
  FNS: 'ФНС России',
  CBR: 'Банк России',
  FGIS_GRAIN: 'ФГИС «Зерно»',
  ROSACCREDITATION: 'Росаккредитация',
};

const SOURCES: EligibilitySource[] = ['FNS', 'FGIS_GRAIN', 'CBR', 'ROSACCREDITATION'];

function bool(value: unknown): boolean { return value === true; }
function text(value: unknown): string | null { return typeof value === 'string' && value.trim() ? value.trim() : null; }
function strings(value: unknown): string[] { return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string').map((v) => v.trim()).filter(Boolean) : []; }

@Injectable()
export class RoleEligibilityEvidenceService {
  constructor(private readonly repository: RoleEligibilityRepository) {}

  async collect(check: EligibilityCheck, candidate: RoleEligibilityCandidate, sourceStates: Partial<Record<EligibilitySource, SourceHealthStatus>>): Promise<{
    evidence: EligibilityEvidence[];
    manifest: SourceManifestEntry[];
    facts: NormalizedOrganizationFacts;
    evidenceSources: EligibilitySource[];
  }> {
    const now = new Date();
    const evidence: EligibilityEvidence[] = [];

    for (const source of SOURCES) {
      if (['UNAVAILABLE', 'SCHEMA_CHANGED'].includes(String(sourceStates[source] || ''))) continue;
      const records = await this.repository.activeRecords(source, candidate.inn, candidate.ogrn);
      for (const record of records) {
        if (record.freshUntil.getTime() <= now.getTime()) continue;
        const minimized = this.minimize(source, record.normalizedPayload);
        const payloadSha256 = sha256(stableJson(minimized));
        evidence.push(await this.repository.createEvidence({
          checkId: check.id,
          sourceType: source,
          sourceName: SOURCE_NAMES[source],
          sourceRecordId: record.sourceRecordId,
          registryGeneration: record.generation,
          subjectInn: record.subjectInn,
          subjectOgrn: record.subjectOgrn,
          evidenceType: this.evidenceType(source),
          normalizedPayload: minimized,
          sourcePublishedAt: record.sourcePublishedAt,
          sourceCheckedAt: now,
          validFrom: record.validFrom,
          validUntil: record.validUntil,
          freshUntil: record.freshUntil,
          parserVersion: record.parserVersion,
          payloadSha256,
          confidenceClass: source === 'FNS' || source === 'CBR' || source === 'FGIS_GRAIN' || source === 'ROSACCREDITATION' ? 'HIGH' : 'MEDIUM',
        }));
      }
    }

    const manifest = evidence.map((entry): SourceManifestEntry => ({
      source: entry.sourceType,
      generation: entry.registryGeneration,
      evidenceId: entry.id,
      evidenceHash: entry.payloadSha256,
      sourcePublishedAt: entry.sourcePublishedAt.toISOString(),
      parserVersion: entry.parserVersion,
    }));

    return {
      evidence,
      manifest,
      facts: this.buildFacts(candidate, evidence),
      evidenceSources: [...new Set(evidence.map((entry) => entry.sourceType))],
    };
  }

  private evidenceType(source: EligibilitySource): string {
    if (source === 'FNS') return 'LEGAL_ENTITY_IDENTITY_AND_ACTIVITY';
    if (source === 'CBR') return 'CREDIT_ORGANIZATION_STATUS';
    if (source === 'FGIS_GRAIN') return 'GRAIN_ELEVATOR_REGISTRY_STATUS';
    return 'ACCREDITATION_STATUS_AND_SCOPE';
  }

  private minimize(source: EligibilitySource, payload: Record<string, unknown>): Record<string, unknown> {
    if (source === 'FNS') return {
      inn: text(payload.inn), ogrn: text(payload.ogrn), active: bool(payload.active), legalName: text(payload.legalName),
      primaryOkved: text(payload.primaryOkved), additionalOkved: strings(payload.additionalOkved),
      status: text(payload.status), strongContradiction: bool(payload.strongContradiction),
    };
    if (source === 'CBR') return {
      ogrn: text(payload.ogrn), active: bool(payload.active), creditOrganization: bool(payload.creditOrganization),
      licenseValid: bool(payload.licenseValid), registrationNumber: text(payload.registrationNumber), licenseStatus: text(payload.licenseStatus),
    };
    if (source === 'FGIS_GRAIN') return {
      inn: text(payload.inn), ogrn: text(payload.ogrn), active: bool(payload.active), elevatorRecord: bool(payload.elevatorRecord),
      registryStatus: text(payload.registryStatus),
    };
    return {
      inn: text(payload.inn), ogrn: text(payload.ogrn), active: bool(payload.active), accreditedPersonType: text(payload.accreditedPersonType),
      scopeRelevant: bool(payload.scopeRelevant), validFrom: text(payload.validFrom), validUntil: text(payload.validUntil),
    };
  }

  private buildFacts(candidate: RoleEligibilityCandidate, evidence: EligibilityEvidence[]): NormalizedOrganizationFacts {
    const fns = evidence.find((entry) => entry.sourceType === 'FNS')?.normalizedPayload;
    const cbr = evidence.find((entry) => entry.sourceType === 'CBR')?.normalizedPayload;
    const fgis = evidence.find((entry) => entry.sourceType === 'FGIS_GRAIN')?.normalizedPayload;
    const accreditation = evidence.find((entry) => entry.sourceType === 'ROSACCREDITATION')?.normalizedPayload;

    const fnsInn = text(fns?.inn);
    const fnsOgrn = text(fns?.ogrn);
    const identity = {
      exists: Boolean(fns),
      active: bool(fns?.active),
      innMatch: Boolean(fns && fnsInn === candidate.inn),
      ogrnMatch: candidate.ogrn ? Boolean(fns && fnsOgrn === candidate.ogrn) : null,
      legalNameMatch: null,
    };

    return {
      identity,
      okved: fns ? {
        primary: text(fns.primaryOkved),
        additional: strings(fns.additionalOkved),
      } : undefined,
      cbr: cbr ? {
        present: true, active: bool(cbr.active), creditOrganization: bool(cbr.creditOrganization), licenseValid: bool(cbr.licenseValid),
      } : { present: false, active: false, creditOrganization: false, licenseValid: false },
      fgisGrain: fgis ? {
        present: true, active: bool(fgis.active), elevatorRecord: bool(fgis.elevatorRecord),
      } : { present: false, active: false, elevatorRecord: false },
      accreditation: accreditation ? {
        present: true, active: bool(accreditation.active), accreditedPersonType: text(accreditation.accreditedPersonType),
        scopeRelevant: bool(accreditation.scopeRelevant), validFrom: text(accreditation.validFrom), validUntil: text(accreditation.validUntil),
      } : { present: false, active: false, scopeRelevant: false },
      logistics: fns ? {
        transportProfile: [text(fns.primaryOkved), ...strings(fns.additionalOkved)].filter(Boolean).some((code) => String(code).startsWith('49') || String(code).startsWith('52')),
        governmentEvidence: false,
      } : undefined,
      strongContradiction: bool(fns?.strongContradiction),
    };
  }
}
