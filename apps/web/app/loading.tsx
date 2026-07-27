export default function Loading() {
  // Evidence-only probe for PR #3249: remove the root streaming fallback so
  // Lighthouse can measure whether replacement of this boundary is resetting
  // the public homepage LCP candidate. This branch must not be merged.
  return null;
}
