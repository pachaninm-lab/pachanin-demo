import type { ReactNode } from 'react';

const OWNER_REMOVAL_CSS = `
.pc-v7-public-entry #maturity,
.pc-v7-public-entry .pc-site-header a[href="#maturity"],
.pc-v7-public-entry nav a[href="#maturity"] {
  display: none !important;
}
`;

/**
 * Platform V7 pages own their rendering contract through the public shell,
 * the server-verified protected shell and Design System v8 route components.
 * Historical DOM mutation, copy repair and viewport polling are intentionally absent.
 * Owner-removed public sections are suppressed at the route boundary so stylesheet
 * ordering, cached chunks or component-local rules cannot restore them.
 */
export default function PlatformV7Template({ children }: { children: ReactNode }) {
  return (
    <>
      <style>{OWNER_REMOVAL_CSS}</style>
      {children}
    </>
  );
}
