'use client';

import './PublicMobileExperiencePolish.css';

/**
 * Loads the legacy `.pc-ppe-page` mobile correction only on public routes that
 * still render the previous public-product shell. The strategic `/platform-v7`
 * homepage owns its `.pc-v6-page` styles and must not pay this CSS cost.
 */
export function LegacyPublicMobileExperiencePolish() {
  return null;
}
