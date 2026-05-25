# Review task — PR 5.6 Runtime Integration Tests

Current step: PR 5.6 — Runtime Integration Tests.
Maturity: controlled-pilot / pre-integration.
Review the diff, not the agent report.

## Required scope checks

Allowed files only:

- apps/web/tests/unit/platformV7RuntimeIntegration.test.ts

Reject if the PR changes:

- apps/landing
- apps/web/app/platform-v7
- apps/web/components/platform-v7
- apps/web/components/v7r
- apps/web/lib/platform-v7/adapters
- apps/web/lib/platform-v7/ai
- apps/web/app/api
- DTO schemas
- persistence ports
- application service files
- mock persistence adapter
- server action wrapper implementation
- package-lock.json
- theme
- onboarding

## Architecture checks

Confirm:

- tests exercise the integrated path through DTO validation, server action wrappers, application services and mock persistence adapter;
- tests do not rely on live bank, FGIS, EDO, payment or network calls;
- duplicate idempotency replay does not double-mutate money, audit or idempotency state;
- conflict/persistence errors are deterministic;
- malformed read-only runtime DTOs return validation_error before store access;
- result envelopes are JSON-serializable;
- no fake maturity or external-connection claims are introduced.

## Required output

Return:

BLOCKERS
- ...

REQUIRED FIXES
- ...

OPTIONAL IMPROVEMENTS
- ...

MERGEABLE: yes/no
