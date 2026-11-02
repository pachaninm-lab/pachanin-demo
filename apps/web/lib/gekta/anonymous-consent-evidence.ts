import { legalContentHash } from '../../../../packages/domain-core/src/gekta-consent-evidence';
import { committedGektaDocumentHref, currentGektaLegalEvidence } from './consent-evidence-server';
import { hasCurrentConsent, sealAnonymousNotice, type GektaAnonymousSession } from './anonymous-session';
import { GEKTA_LEGAL_VERSION } from './legal';
import type { GektaLocale } from './content';

export type AnonymousConsentPresentation = Readonly<{ snapshot: string; locale: GektaLocale; termsHref: string; privacyHref: string }>;

export function anonymousConsentHash(locale: GektaLocale): string {
  return legalContentHash(currentGektaLegalEvidence(locale, 'GEKTA_ANONYMOUS_NOTICE'));
}

export function anonymousConsentPresentation(session: GektaAnonymousSession, locale: GektaLocale, now: Date): AnonymousConsentPresentation {
  const evidence = currentGektaLegalEvidence(locale, 'GEKTA_ANONYMOUS_NOTICE');
  return { snapshot: sealAnonymousNotice(session, legalContentHash(evidence), locale, now), locale,
    termsHref: committedGektaDocumentHref(evidence, 'terms'), privacyHref: committedGektaDocumentHref(evidence, 'privacy') };
}

export function hasCurrentAnonymousConsent(session: GektaAnonymousSession, now: Date = new Date(), locale?: GektaLocale): boolean {
  const recorded = session.consent;
  if (!recorded?.surfaceLocale || (locale !== undefined && recorded.surfaceLocale !== locale)) return false;
  return hasCurrentConsent(session, GEKTA_LEGAL_VERSION, now)
    && recorded.evidenceHash === anonymousConsentHash(recorded.surfaceLocale);
}
