import {
  legalContentHash, renderedLegalDocumentHash, sealGektaConsentSnapshot,
  type GektaLegalEvidence,
} from '../../../../packages/domain-core/src/gekta-consent-evidence';
import { GEKTA_LEGAL_VERSION, getGektaLegalDocument, renderLegalDocument } from './legal';
import { getMerchantProfile } from './merchant';
import type { GektaLocale } from './content';

export function currentGektaLegalEvidence(locale: GektaLocale, sourceSurface: GektaLegalEvidence['sourceSurface']): GektaLegalEvidence {
  const profile = getMerchantProfile();
  const profileHash = legalContentHash(profile);
  const registration = sourceSurface === 'GEKTA_REGISTRATION';
  const terms = renderLegalDocument(getGektaLegalDocument('usloviya-ispolzovaniya-gekta')!, profile);
  const privacy = renderLegalDocument(getGektaLegalDocument(registration
    ? 'politika-obrabotki-personalnyh-dannyh' : 'politika-konfidencialnosti')!, profile);
  return {
    schemaVersion: 'gekta.legal-evidence.v1', version: GEKTA_LEGAL_VERSION,
    surfaceLocale: locale, documentLocale: 'ru', sourceSurface,
    profile: { id: profile.id, effectiveFrom: profile.effectiveFrom, contentHash: profileHash },
    terms: { purpose: registration ? 'SERVICE_TERMS' : 'TERMS_NOTICE', source: `/legal/${terms.slug}`,
      version: GEKTA_LEGAL_VERSION, contentHash: renderedLegalDocumentHash(GEKTA_LEGAL_VERSION, profileHash, terms), document: terms },
    privacy: { purpose: registration ? 'PERSONAL_DATA' : 'PRIVACY_NOTICE', source: `/legal/${privacy.slug}`,
      version: GEKTA_LEGAL_VERSION, contentHash: renderedLegalDocumentHash(GEKTA_LEGAL_VERSION, profileHash, privacy), document: privacy },
  };
}

export function committedGektaDocumentHref(evidence: GektaLegalEvidence, kind: 'terms' | 'privacy'): string {
  const query = new URLSearchParams({ v: evidence.version, h: evidence[kind].contentHash.slice(7), p: evidence.profile.contentHash.slice(7) });
  return `${evidence[kind].source}?${query}`;
}

export function registrationConsentPresentation(locale: GektaLocale, key: string) {
  const evidence = currentGektaLegalEvidence(locale, 'GEKTA_REGISTRATION');
  return { snapshot: sealGektaConsentSnapshot(evidence, key),
    termsHref: committedGektaDocumentHref(evidence, 'terms'), privacyHref: committedGektaDocumentHref(evidence, 'privacy') };
}
