# Current task — atomic canonical readiness prerequisite #4829

Official progress remains **5/100**. Staff-session source #5766 is merged; R1 production acceptance remains open.

The [owner-approved atomic disposition](https://github.com/pachaninm-lab/pachanin-demo/issues/5469#issuecomment-5935185862) replaces the separate metadata-first/source sequence for this one prerequisite. Use only the existing `fix/readiness-database-deadline-4829` branch with CORE as the existing writer. Preserve original readiness history and proposals #5770 (`056b185503e2db46956d2e6b76b78e936e963b37`) and #5771 (`e358177634856c9e71a0961497e7802f49213485`) through ordinary ancestry.

The complete accepted-base diff must contain exactly these eleven existing regular 100644 files:
- docs/platform-v7/autopilot/autopilot-state.json
- docs/platform-v7/autopilot/progress.json
- docs/platform-v7/autopilot/prompts/current-codex-task.md
- docs/platform-v7/autopilot/prompts/current-review-task.md
- docs/platform-v7/execution-queue.md
- apps/api/test/staff-access/postgresql-staff-access.e2e-spec.ts
- apps/api/src/main.ts
- apps/api/src/health.controller.ts
- apps/api/src/health.controller.spec.ts
- apps/api/src/common/guards/pre-auth-rate-limit.guard.ts
- apps/api/src/common/guards/pre-auth-rate-limit.guard.spec.ts

Adopt all five COR5 source blobs unchanged from original proposal #4829/comment5930247718 and the exact staff-test blob `1b0010715cbcd636d15b1c9c4e5587baca16137c` from #5771/e358. Preserve source attribution to the existing CORE producer and proposal histories. The full source transitions are recorded in `canonical-readiness-cor5-4829-20261001`. Only the five listed governance documents are revised for the atomic disposition; every prior accepted concurrent vector and admission stays unchanged.

No guard, workflow, manifest, PgBouncer configuration, dependency, migration, unrelated source or mode changes. No staff-source/test wildcard expansion. The legacy branch manifest is historical, and standard candidate-list routing is not mechanically immutable exact-eleven enforcement; external owner authority and independent whole-tree review enforce this boundary.

Reuse the canonical HealthController, restricted Prisma principal and OutboxService. Preserve the 1500ms deadline, 15000ms grace, single flight, immediate/late pending-migration invalidation and existing thresholds. Service-wide queue state stays UNKNOWN where RLS hides rows. Probe aliases must not weaken unrelated rate/auth controls.

Require fresh exact-published-head independent nonauthor review of all eleven files, separate implementation-owner audit, all applicable full native CI/security/PostgreSQL and unchanged Kubernetes with zero failed PgBouncer logical probes, complete deep-outbox scenarios and successful cleanup. Preserve old #5770 Security Abuse and #5771 Kubernetes failures; local proposal/composition results never transfer PASS to this head. Report skipped tests and pre-existing aggregate teardown limitations explicitly. Recheck current head, all findings and manual readiness immediately before an ordinary expected-full-SHA merge.

Preserve actual PRODUCT handoff5933030140, accepted purpose3/guard/test/workflow and all other owners; recheck fresh main/Hub before publication or merge. Return an actual handoff and supersede old proposals only after real atomic acceptance. No production, provider activation, R1 completion or progress claim follows from this bundle.

The next priority is the existing Gekta owner's actual model activation and live quality, speed and stability acceptance under its separate existing admissions and remaining topology/release prerequisites. This does not expand these eleven paths. R1.3 remains queued for a separately accepted scope transition; exact-main REG.RU and full 13-cabinet acceptance remain separate.

## Queued snapshot-only topology diagnostic — 2026-10-01

Preserve the entire current task and all existing owners. The bounded approval in [Hub5941557816](https://github.com/pachaninm-lab/pachanin-demo/issues/5469#issuecomment-5941557816) permits this five-file preparation and a subsequent exact two-file source draft only. It is a reduced continuation of [proposal5934069236](https://github.com/pachaninm-lab/pachanin-demo/issues/5469#issuecomment-5934069236), retaining the existing TAI/preflight owner and #3582 lineage, not a second observer or completed full-model proposal.

After actual admission acceptance, the sole source branch is `fix/tai-bounded-topology-observer-20261001`:
- `scripts/tai-reg-ru-preflight.sh`, mode 100755: `8f0f285bc436f3b4754204d198db5c68a4c916d2` -> `ac60f97dacdaf85ef1ccef63a1ea40709023d509`
- `scripts/check-tai-reg-ru-preflight.mjs`, mode 100644: `15fb496d2aba5b2fda7adc0d55b8caaf8d6d1c79` -> `70071581041d73e8d73f5d61d8699420844cdf86`

Use only the exact source transitions/SHA256 values in `tai-bounded-topology-observer-20261001`. Reuse existing private preflight JSON and ordered input snapshots; preserve every classifier, check, blocker, maturity and passed result. One additional Python collector reads bounded existing private work data/stdin, launches no child process and adds no wall-clock guarantee. No added Docker/Compose evaluation, daemon/image operation, network, source/env/protected-file read or workflow/controller change. Fresh persisted/discovery comparison, immutable-image/default-command evidence, registry provenance and freshness remain NOT_PROVEN.

This five-file admission must wait for explicit closure of the serialized runtime no-main-merge window before governance merge. The subsequent source PR stays draft: source merge and server execution require separate explicit approval because existing automatic build/preflight controllers pull images and refresh protected checkout. Current Gekta diagnostic/runtime authority grants no topology operation. No new rights, credentials, expense or progress credit; official 5/100 and all existing priorities remain unchanged.
