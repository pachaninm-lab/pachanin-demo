import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { CURRENT_CONSENT_EVIDENCE, CURRENT_CONSENT_VERSION, isCurrentConsent } from './consent-policy';

function sourceHash(relativePath: string): string {
  const source = fs.readFileSync(path.resolve(__dirname, '../../../../web', relativePath));
  return `sha256:${createHash('sha256').update(source).digest('hex')}`;
}

const consentEvidenceMigration = fs.readFileSync(
  path.resolve(
    __dirname,
    '../../../prisma/migrations/20260903044500_registration_consent_evidence_20260903/migration.sql',
  ),
  'utf8',
);

describe('versioned public consent authority', () => {
  it('binds the accepted versions to the exact published source artifacts', () => {
    expect(sourceHash('app/platform-v7/terms/page.tsx')).toBe(CURRENT_CONSENT_EVIDENCE.terms.contentHash);
    expect(sourceHash('app/platform-v7/privacy/page.tsx')).toBe(CURRENT_CONSENT_EVIDENCE.privacy.contentHash);
  });

  it('binds the current API consent authority to the PostgreSQL evidence whitelist', () => {
    expect(consentEvidenceMigration).toContain(`terms_version = '${CURRENT_CONSENT_EVIDENCE.terms.version}'`);
    expect(consentEvidenceMigration).toContain(`terms_content_hash = '${CURRENT_CONSENT_EVIDENCE.terms.contentHash}'`);
    expect(consentEvidenceMigration).toContain(`privacy_version = '${CURRENT_CONSENT_EVIDENCE.privacy.version}'`);
    expect(consentEvidenceMigration).toContain(`privacy_content_hash = '${CURRENT_CONSENT_EVIDENCE.privacy.contentHash}'`);
  });

  it('rejects stale or client-invented policy versions', () => {
    expect(isCurrentConsent(CURRENT_CONSENT_VERSION, CURRENT_CONSENT_VERSION)).toBe(true);
    expect(isCurrentConsent('2026-07-31', CURRENT_CONSENT_VERSION)).toBe(false);
    expect(isCurrentConsent(CURRENT_CONSENT_VERSION, 'future')).toBe(false);
  });
});
