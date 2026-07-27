import type { ReactNode } from 'react';

/**
 * The suppression wins on specificity, not on a forced-importance declaration.
 *
 * Forcing importance is the obvious way to survive stylesheet ordering, cached
 * chunks and component-local rules — but Design System v8 forbids that keyword
 * across every governed file, and the prohibition is exactly what makes
 * specificity sufficient here: no governed rule can raise itself above this one
 * that way either. The repeated id and the `html body` prefix put these
 * selectors beyond anything the components express, so ordering stops mattering.
 */
const OWNER_REMOVAL_CSS = `
html body .pc-v7-public-entry #maturity#maturity,
html body .pc-v7-public-entry .pc-site-header a[href="#maturity"][href],
html body .pc-v7-public-entry nav a[href="#maturity"][href] {
  display: none;
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
