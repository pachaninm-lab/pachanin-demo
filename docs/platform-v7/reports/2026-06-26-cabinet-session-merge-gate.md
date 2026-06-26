# Cabinet session merge gate

Do not merge unless:

- CI is green;
- web-unit is green;
- the changed file list is limited to cabinet session route, its static test and docs under `docs/platform-v7`;
- no `apps/landing` files changed;
- no package or lockfile changed;
- maturity language remains controlled-pilot / pre-integration;
- environment owners understand the body-role demo flag requirement.

This PR is not final auth/session acceptance.
