# TAI AP-13C.1a CPU/fallback benchmark execution authority

## Purpose

This slice establishes the exact owner-only gate for the real AP-13C.1 CPU benchmark. It does not execute model inference, generate benchmark numbers, accept expert reviews, admit a model or change production status.

Coordinator: issue `#2977`  
Parent execution issue: `#2971`  
Command: `/tai benchmark cpu-fallback exact-main`

## What is pinned

The authority binds:

- Qwen/Qwen3-8B revision `895c8d171bc03c30e113cd7a28c02494b5e068b7`, CPU `Q4_K_M`, profile `qwen3-8b-cpu-q4-k-m`;
- mistralai/Mistral-7B-Instruct-v0.3 revision `c170c708c41dac9275d15a8fff4eca08d52bab71`, CPU `Q4_K_M`, profile `mistral-7b-fallback-cpu-q4-k-m`;
- llama.cpp release `b9637`, commit `aedb2a5e9ca3d4064148bbb919e0ddc0c1b70ab3`;
- AP-14C suite `tai-platform-agro-58-v1`: 58 total cases and 23 critical cases;
- concurrency levels `1`, `2`, `4`;
- at least 100 samples per runtime profile;
- deterministic generation with temperature `0`;
- one-hour soak with at least 1,000 requests;
- at least 100 forced primary-to-fallback transitions;
- zero critical unsupported facts, safety failures, failed fallback transitions or continuity violations.

## Current state

The committed prerequisite observation is intentionally blocked:

- immutable model bundles have not yet been accepted in external storage;
- Selectel S3 external evidence storage is not accepted;
- the AP-14C corpus remains `PENDING_REVIEW`;
- CPU/fallback benchmark is `NOT_RUN`.

Therefore the command currently exits fail-closed after publishing bounded readiness metadata. It must not start inference, download model payloads or contact the production VPS.

## Owner-only exact-main check

After all external prerequisites are accepted on `main`, the repository owner posts this exact comment to issue `#2977`:

```text
/tai benchmark cpu-fallback exact-main
```

The workflow accepts no `workflow_dispatch`, schedule, push trigger, alternate issue, alternate actor or mutable branch input. It validates that the checkout equals current `main`.

The authority workflow produces only:

- authority validation;
- AP-13C prerequisite report;
- CPU/fallback readiness report;
- a bounded issue summary.

It deliberately contains no model, GGUF, source-weight, bundle archive, prompt/response payload or credential transfer.

## Readiness conditions

`READY_FOR_EXTERNAL_EXECUTION` requires all of the following at the same time:

1. the prerequisite report schema is exact and no more than 24 hours old;
2. `cpu-fallback-execution.status` is `READY_FOR_CPU_FALLBACK_BENCHMARK`;
3. `cpu-fallback-execution.ready=true`;
4. the blocker list is empty;
5. benchmark maturity remains `PENDING_BENCHMARK`;
6. model admission remains `PENDING_ADMISSION`;
7. production operational status remains `NOT_ATTESTED`;
8. AP-14C assessment status is `ACCEPTED`;
9. `accepted=true`, total cases `58`, critical cases `23`, unreviewed cases `0`;
10. the assessment has no blocking reasons and carries valid corpus/assessment SHA-256 values.

A stale report, future timestamp, simulated evidence, pending review, missing bundle, incomplete counts or maturity inflation blocks execution.

## Next governed slice

After this authority is accepted and all external prerequisites are real, AP-13C.1b must execute on the dedicated `tai-model` host:

- independently restore exact immutable Qwen and Mistral object versions;
- validate bundle and toolchain digests;
- materialize the accepted AP-14C corpus;
- measure CPU profiles and concurrency;
- exercise forced fallback;
- complete one-hour soak;
- store full evidence externally with exact-version restore;
- return only bounded metadata;
- verify both model reports through `tai.model-benchmark-evidence.v2`.

No CPU result can satisfy the separate Qwen GPU/shared Q8_0 profile. Joint model admission remains blocked until AP-13C.2 GPU evidence is independently verified.

## Maturity boundary

Until real external benchmark evidence verifies successfully:

- benchmark status: `PENDING_BENCHMARK`;
- model admission: `PENDING_ADMISSION`;
- production operational status: `NOT_ATTESTED`.
