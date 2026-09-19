# domain-core CHANGELOG

All notable changes to `@pc/domain-core` are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [0.2.0] — 2026-04-06

### Added
- `DOMAIN_CORE_VERSION` constant exported from `src/index.ts` for runtime version checks
- Unit tests for `deadline-protection.ts` (`deadline-protection.test.ts`)
- `commercial-expansion.ts` — commercial expansion engine
- `integration-hardening.ts` — integration resilience policy
- `unified-deal-passport.ts` — deal passport schema

### Changed
- `deadline-protection.ts` — added `deadlineAt` fallback field, `mostUrgent` in summary, null-safe `minutesLeft`
- `execution-scores-v2.ts` — revised scoring weights for V2 pipeline

---

## [0.1.0] — 2025-12-01

### Added
- Initial release: canonical-models, canonical-reason-codes, deadline-protection,
  document-requirements, scoring, status-policy-engine, action-decision-engine,
  service-provider-registry, operator-case-center, integration-contracts,
  risk-scoring, problem-closure-matrix, provider-compliance-gates,
  document-correction-workflow, browser-access-policy, source-of-truth
