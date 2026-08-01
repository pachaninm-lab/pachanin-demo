import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { CURRENT_CONSENT_EVIDENCE, isCurrentConsent } from './consent-policy';

function sourceHash(relativePath: string): string {
  const source = fs.readFileSync(path.resolve(__dirname, '../../../../web', relativePath));
  return `sha256:${createHash('sha256').update(source).digest('hex')}`;
}

describe('versioned public consent authority', () => {
  it('binds the accepted versions to the exact published source artifacts', () => {
    expect(sourceHash('app/platform-v7/terms/page.tsx')).toBe(CURRENT_CONSENT_EVIDENCE.terms.contentHash);
    expect(sourceHash('app/platform-v7/privacy/page.tsx')).toBe(CURRENT_CONSENT_EVIDENCE.privacy.contentHash);
  });

  it('rejects stale or client-invented policy versions', () => {
    expect(isCurrentConsent('2026-07-31', '2026-07-31')).toBe(true);
    expect(isCurrentConsent('future', '2026-07-31')).toBe(false);
    expect(isCurrentConsent('2026-07-31', 'future')).toBe(false);
  });
});
