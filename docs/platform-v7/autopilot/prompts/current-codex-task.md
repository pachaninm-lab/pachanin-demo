# Current task — canonical readiness prerequisite #4829

Official progress remains **5/100**. Staff-session source #5766 is merged; R1 production acceptance is still open.

After this metadata admission has independently passed its gates and merged, use only the existing `fix/readiness-database-deadline-4829` branch for the complete immutable COR5 proposal in Team Hub comment 5930247718. Preserve producer attribution. Independent proposal review is issue #4829 comment 5932138051, not final-commit approval.

The implementation diff must contain exactly:
- apps/api/src/main.ts
- apps/api/src/health.controller.ts
- apps/api/src/health.controller.spec.ts
- apps/api/src/common/guards/pre-auth-rate-limit.guard.ts
- apps/api/src/common/guards/pre-auth-rate-limit.guard.spec.ts

Keep all accepted state, manifests, guard/workflow, PgBouncer configuration and other source unchanged. The legacy branch manifest adds historical paths; this is not permission to use them in COR5. Current standard routing is not a mechanically immutable five-file gate.

Reuse the canonical HealthController, restricted Prisma principal and OutboxService. Preserve the 1500ms deadline, 15000ms grace, single flight, immediate/late pending migration invalidation and existing thresholds. Service-wide queue state stays UNKNOWN when RLS hides rows. Probe aliases must not weaken unrelated rate/auth controls.

Require fresh exact-head independent review, separate author audit, all applicable CI/security and actual Kubernetes PgBouncer zero-failure/deep-outbox/cleanup evidence. Do not transfer local proposal results to a new commit. Disclose existing aggregate teardown debt and skipped tests.

Actual PRODUCT handoff5933030140 grants this bounded window after #5768 merge5c43cd64fd61ee2e134ef319fa6c6087f1a37f14; recheck for newer conflicting claims and preserve its accepted purpose3/guard/test/workflow. Do not change PRODUCT, TAI, credentials, operator requisites or production. REG.RU topology/release and full 13-cabinet acceptance remain separate. After bounded source acceptance, return to R1.3 via a separate scope transition.
