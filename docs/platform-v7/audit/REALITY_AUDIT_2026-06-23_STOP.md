# platform-v7 audit stop rule — 2026-06-23

## Stop or split when

- exact role file cannot be identified;
- shared shell is required for a role PR;
- a UI fix requires runtime behavior;
- status language would overstate readiness;
- GitHub or Netlify checks fail for a real reason outside the PR scope.

## Continue when

- scope is exact;
- forbidden zones are clear;
- checks are green or skipped;
- status language is honest;
- each CTA has a route, section, action, or disabled reason.
